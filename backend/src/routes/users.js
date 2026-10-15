const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { dbQuery } = require('../db');
const { authenticateToken, requireOwner, logAudit } = require('../middleware/auth');

// GET /api/users (Owner only)
// Fetch all users (Cashiers & Owners)
router.get('/', authenticateToken, requireOwner, async (req, res) => {
  try {
    const users = await dbQuery.all(
      'SELECT id, name, username, role, is_active, created_at FROM users ORDER BY role DESC, id ASC'
    );
    return res.json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users (Owner only)
// Create new cashier
router.post('/', authenticateToken, requireOwner, async (req, res) => {
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
router.put('/:id', authenticateToken, requireOwner, async (req, res) => {
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

module.exports = router;
