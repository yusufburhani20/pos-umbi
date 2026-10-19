const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { dbQuery } = require('../db');
const { authenticateToken, requireStrictOwner, logAudit } = require('../middleware/auth');

// GET /api/users (Owner only)
// Fetch all users (Cashiers & Owners)
router.get('/', authenticateToken, requireStrictOwner, async (req, res) => {
  try {
    const users = await dbQuery.all(
      'SELECT id, name, username, role, is_active, created_at FROM users WHERE is_active >= 0 ORDER BY role DESC, id ASC'
    );
    return res.json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users (Owner only)
// Create new cashier
router.post('/', authenticateToken, requireStrictOwner, async (req, res) => {
  try {
    const { name, username, pin_code, role = 'cashier' } = req.body;

    if (!name || !username || !pin_code) {
      return res.status(400).json({ success: false, message: 'Nama, username, dan PIN wajib diisi' });
    }

    if (String(pin_code).length < 4 || String(pin_code).length > 6) {
      return res.status(400).json({ success: false, message: 'PIN harus 4 sampai 6 digit angka' });
    }

    // Check duplicate username
    const existing = await dbQuery.get('SELECT id FROM users WHERE username = ?', [username.toLowerCase().trim()]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username sudah digunakan oleh akun lain' });
    }

    const hashedPin = await bcrypt.hash(String(pin_code), 8);
    const result = await dbQuery.run(
      'INSERT INTO users (name, username, role, pin_code, is_active) VALUES (?, ?, ?, ?, 1)',
      [name.trim(), username.toLowerCase().trim(), role, hashedPin]
    );

    await logAudit(req.user.id, 'CASHIER_CREATED', {
      created_user_id: result.lastID,
      name,
      username,
      role
    });

    const newUser = await dbQuery.get(
      'SELECT id, name, username, role, is_active, created_at FROM users WHERE id = ?',
      [result.lastID]
    );

    return res.status(201).json({
      success: true,
      message: `Akun kasir "${name}" berhasil dibuat`,
      user: newUser
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/users/:id (Owner only)
// Update cashier details, reset PIN, or toggle active status
router.put('/:id', authenticateToken, requireStrictOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, pin_code, is_active } = req.body;

    const user = await dbQuery.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }

    // Protection: Owner cannot deactivate themselves
    if (user.id === req.user.id && is_active === 0) {
      return res.status(400).json({ success: false, message: 'Anda tidak dapat menonaktifkan akun Owner Anda sendiri' });
    }

    let finalPinHash = user.pin_code;
    let pinChanged = false;

    if (pin_code) {
      if (String(pin_code).length < 4 || String(pin_code).length > 6) {
        return res.status(400).json({ success: false, message: 'PIN baru harus 4 sampai 6 digit angka' });
      }
      finalPinHash = await bcrypt.hash(String(pin_code), 8);
      pinChanged = true;
    }

    const finalName = name ? name.trim() : user.name;
    const finalActive = is_active !== undefined ? Number(is_active) : user.is_active;

    await dbQuery.run(
      'UPDATE users SET name = ?, pin_code = ?, is_active = ? WHERE id = ?',
      [finalName, finalPinHash, finalActive, id]
    );

    await logAudit(req.user.id, 'CASHIER_UPDATED', {
      target_user_id: id,
      target_name: finalName,
      pin_reset: pinChanged,
      is_active: finalActive
    });

    const updatedUser = await dbQuery.get(
      'SELECT id, name, username, role, is_active, created_at FROM users WHERE id = ?',
      [id]
    );

    return res.json({
      success: true,
      message: pinChanged 
        ? `PIN kasir "${finalName}" berhasil direset` 
        : `Data kasir "${finalName}" berhasil diperbarui`,
      user: updatedUser
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/users/:id (Owner only)
// Delete cashier account with safety guards
router.delete('/:id', authenticateToken, requireStrictOwner, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await dbQuery.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User kasir tidak ditemukan' });
    }

    // Protection 1: Owner cannot delete themselves
    if (user.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Anda tidak dapat menghapus akun Owner Anda sendiri' });
    }

    // Protection 2: Cannot delete account with role owner
    if (user.role === 'owner') {
      return res.status(400).json({ success: false, message: 'Akun Owner tidak dapat dihapus' });
    }

    // Protection 3: If cashier has active open shift, auto-close it gracefully with audit note
    const activeShift = await dbQuery.get('SELECT id FROM shifts WHERE cashier_id = ? AND status = "open"', [id]);
    if (activeShift) {
      await dbQuery.run(
        `UPDATE shifts 
         SET status = 'closed', 
             end_time = datetime('now', 'localtime'), 
             closing_notes = 'Ditutup otomatis oleh Owner saat akun kasir dihapus' 
         WHERE id = ?`,
        [activeShift.id]
      );
      await logAudit(req.user.id, 'SHIFT_CLOSED_ON_CASHIER_DELETE', {
        shift_id: activeShift.id,
        cashier_id: id,
        cashier_name: user.name
      });
    }

    // Check if user has related records (shifts, audit logs, adjustments, expenses)
    const shiftCount = await dbQuery.get('SELECT COUNT(id) as count FROM shifts WHERE cashier_id = ?', [id]);
    const hasHistory = shiftCount && Number(shiftCount.count) > 0;

    if (hasHistory) {
      // Soft-delete to preserve relational integrity & accounting history:
      // Set is_active = -1, append timestamp to username so the username is freed up for future use, and scramble pin
      const freedUsername = `deleted_${user.id}_${Date.now()}`;
      await dbQuery.run(
        'UPDATE users SET is_active = -1, username = ?, pin_code = "DELETED" WHERE id = ?',
        [freedUsername, id]
      );
    } else {
      // Hard delete if no relational dependencies exist
      try {
        await dbQuery.run('DELETE FROM users WHERE id = ?', [id]);
      } catch (delErr) {
        // Fallback to soft-delete if foreign key constraint triggers
        const freedUsername = `deleted_${user.id}_${Date.now()}`;
        await dbQuery.run(
          'UPDATE users SET is_active = -1, username = ?, pin_code = "DELETED" WHERE id = ?',
          [freedUsername, id]
        );
      }
    }

    await logAudit(req.user.id, 'CASHIER_DELETED', {
      target_user_id: id,
      target_name: user.name,
      target_username: user.username
    });

    return res.json({
      success: true,
      message: `Akun kasir "${user.name}" (@${user.username}) berhasil dihapus.`
    });
  } catch (err) {
    console.error('Error deleting cashier:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

