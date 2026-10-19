const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbQuery } = require('../db');
const { JWT_SECRET, authenticateToken, logAudit } = require('../middleware/auth');

// Brute-force rate limiter for PIN logins (5 failed attempts = 5 min lockout)
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;
const loginAttempts = new Map();

function checkRateLimit(ip) {
  const record = loginAttempts.get(ip);
  if (!record) return { blocked: false };
  const now = Date.now();
  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { blocked: true, remainingSeconds };
  }
  if (record.lockedUntil && now >= record.lockedUntil) {
    loginAttempts.delete(ip);
    return { blocked: false };
  }
  return { blocked: false };
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, firstAttempt: now };
  if (now - record.firstAttempt > LOCKOUT_DURATION_MS) {
    record.count = 1;
    record.firstAttempt = now;
    delete record.lockedUntil;
  } else {
    record.count += 1;
  }
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
  }
  loginAttempts.set(ip, record);
}

function clearRateLimit(ip) {
  loginAttempts.delete(ip);
}

// POST /api/auth/login
// Supports login with username + pin, OR just 6-digit PIN for quick cashier login
router.post('/login', async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateCheck = checkRateLimit(clientIp);
    if (rateCheck.blocked) {
      return res.status(429).json({
        success: false,
        message: `Terlalu banyak percobaan PIN salah. Demi keamanan, silakan coba lagi dalam ${rateCheck.remainingSeconds} detik.`
      });
    }

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
      recordFailedAttempt(clientIp);
      await logAudit(null, 'LOGIN_FAILED', { username, ip: clientIp });
      return res.status(401).json({ success: false, message: 'PIN atau username salah' });
    }

    // Verify PIN if username was specified
    if (username) {
      const isMatch = await bcrypt.compare(pin, user.pin_code);
      if (!isMatch) {
        recordFailedAttempt(clientIp);
        await logAudit(user.id, 'LOGIN_FAILED_PIN', { username, ip: clientIp });
        return res.status(401).json({ success: false, message: 'PIN salah' });
      }
    }

    // Login successful: reset rate limit counter
    clearRateLimit(clientIp);

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
