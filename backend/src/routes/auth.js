const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbQuery } = require('../db');
const { JWT_SECRET, authenticateToken, logAudit } = require('../middleware/auth');

// POST /api/auth/login
// Supports login with username + pin, OR just 6-digit PIN for quick cashier login
router.post('/login', async (req, res) => {
  try {
    const { username, pin } = req.body;

    if (!pin) {
      return res.status(400).json({ success: false, message: 'PIN wajib diisi' });
    }

    let user;
    if (username) {
      user = await dbQuery.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
    } else {
      // Find user matching pin
      const allUsers = await dbQuery.all('SELECT * FROM users WHERE is_active = 1');
      for (const u of allUsers) {
        const isMatch = await bcrypt.compare(pin, u.pin_code);
        if (isMatch) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      await logAudit(null, 'LOGIN_FAILED', { username, ip: req.ip });
      return res.status(401).json({ success: false, message: 'PIN atau username salah' });
    }

    // Verify PIN if username was specified
    if (username) {
      const isMatch = await bcrypt.compare(pin, user.pin_code);
      if (!isMatch) {
        await logAudit(user.id, 'LOGIN_FAILED_PIN', { username });
        return res.status(401).json({ success: false, message: 'PIN salah' });
      }
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    await logAudit(user.id, 'LOGIN_SUCCESS', { role: user.role });

    return res.json({
      success: true,
      message: `Selamat datang, ${user.name}`,
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat login' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbQuery.get(
      'SELECT id, name, username, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/verify-owner-pin
// Quick authorization check for supervisor/owner actions (e.g. Void, Manual Price Change)
router.post('/verify-owner-pin', authenticateToken, async (req, res) => {
  try {
    const { owner_pin } = req.body;
    if (!owner_pin) {
      return res.status(400).json({ success: false, message: 'PIN Owner wajib diisi' });
    }

    const owners = await dbQuery.all('SELECT * FROM users WHERE role = "owner" AND is_active = 1');
    let approvedOwner = null;

    for (const owner of owners) {
      const isMatch = await bcrypt.compare(owner_pin, owner.pin_code);
      if (isMatch) {
        approvedOwner = owner;
        break;
      }
    }

    if (!approvedOwner) {
      await logAudit(req.user.id, 'OWNER_OVERRIDE_FAILED', { attempted_by: req.user.name });
      return res.status(403).json({ success: false, message: 'PIN Owner tidak valid' });
    }

    await logAudit(req.user.id, 'OWNER_OVERRIDE_SUCCESS', {
      approved_by_id: approvedOwner.id,
      approved_by_name: approvedOwner.name
    });

    return res.json({
      success: true,
      message: 'Otorisasi Owner berhasil',
      owner: { id: approvedOwner.id, name: approvedOwner.name }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
