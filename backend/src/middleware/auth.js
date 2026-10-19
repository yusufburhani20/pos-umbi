const jwt = require('jsonwebtoken');
const { dbQuery } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'pos_umbi_super_secret_key_2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Akses ditolak: Token tidak ditemukan' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Sesi kedaluwarsa atau token tidak valid' });
    }
    req.user = user;
    next();
  });
}

function requireOwner(req, res, next) {
  // Kasir sekaligus berperan sebagai admin sesuai wewenang operasional kios pasar
  if (!req.user || (req.user.role !== 'owner' && req.user.role !== 'cashier' && req.user.role !== 'admin')) {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak: Hanya Owner atau Kasir/Admin yang berwenang untuk tindakan ini'
    });
  }
  next();
}

function requireStrictOwner(req, res, next) {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak: Hanya Owner toko yang berwenang untuk tindakan ini'
    });
  }
  next();
}

async function logAudit(userId, action, details, ip = null) {
  try {
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details);
    await dbQuery.run(
      `INSERT INTO audit_logs (user_id, action, details, ip_address, created_at) 
       VALUES (?, ?, ?, ?, datetime('now', 'localtime'))`,
      [userId || null, action, detailsStr, ip]
    );
  } catch (err) {
    console.error('[AUDIT_ERROR] Failed to record audit log:', err);
  }
}

module.exports = {
  JWT_SECRET,
  authenticateToken,
  requireOwner,
  requireStrictOwner,
  logAudit
};
