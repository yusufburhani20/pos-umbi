const express = require('express');
const router = express.Router();
const { dbQuery } = require('../db');
const { authenticateToken, logAudit } = require('../middleware/auth');

// GET /api/customers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { tier, search } = req.query;
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];

    if (tier) {
      sql += ' AND tier = ?';
      params.push(tier);
    }
    if (search) {
      sql += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY name ASC';
    const customers = await dbQuery.all(sql, params);
    return res.json({ success: true, customers });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/customers
// Register new customer / reseller
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, phone, tier = 'retail', address } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Nama pelanggan/reseller wajib diisi' });
    }

    const result = await dbQuery.run(
      'INSERT INTO customers (name, phone, tier, address) VALUES (?, ?, ?, ?)',
      [name, phone || '', tier, address || '']
    );

    await logAudit(req.user.id, 'CUSTOMER_CREATED', { customer_id: result.lastID, name, tier });

    const newCust = await dbQuery.get('SELECT * FROM customers WHERE id = ?', [result.lastID]);
    return res.status(201).json({ success: true, message: 'Pelanggan berhasil ditambahkan', customer: newCust });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
