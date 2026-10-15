const express = require('express');
const router = express.Router();
const { dbQuery } = require('../db');
const { authenticateToken, requireOwner, logAudit } = require('../middleware/auth');

// GET /api/products/low-stock
// Alert endpoint: Get all products with stock below threshold
router.get('/low-stock', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT *,
        CASE 
          WHEN stock_qty <= 0 THEN 1 
          ELSE 0 
        END as is_out_of_stock,
        CASE 
          WHEN stock_qty > 0 AND stock_qty <= COALESCE(min_stock_alert, 15.0) THEN 1 
          ELSE 0 
        END as is_low_stock
      FROM products
      WHERE is_active = 1 AND stock_qty <= COALESCE(min_stock_alert, 15.0)
      ORDER BY stock_qty ASC
    `;
    const products = await dbQuery.all(sql);
    const outOfStockCount = products.filter(p => p.stock_qty <= 0).length;
    const lowStockCount = products.filter(p => p.stock_qty > 0).length;

    return res.json({
      success: true,
      summary: {
        total_alerts: products.length,
        out_of_stock_count: outOfStockCount,
        low_stock_count: lowStockCount
      },
      products
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products
// Fetch all products for POS grid or inventory management
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, search, low_stock } = req.query;
    let sql = `
      SELECT *,
        CASE 
          WHEN stock_qty <= 0 THEN 1 
          ELSE 0 
        END as is_out_of_stock,
        CASE 
          WHEN stock_qty > 0 AND stock_qty <= COALESCE(min_stock_alert, 15.0) THEN 1 
          ELSE 0 
        END as is_low_stock
      FROM products 
      WHERE is_active = 1
    `;
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      sql += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }
    if (low_stock === 'true' || low_stock === '1') {
      sql += ' AND stock_qty <= COALESCE(min_stock_alert, 15.0)';
    }

    sql += ' ORDER BY name ASC';
    const products = await dbQuery.all(sql, params);
    return res.json({ success: true, products });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/products (Owner only)
router.post('/', authenticateToken, requireOwner, async (req, res) => {
  try {
    const {
      name,
      category = 'umbi',
      unit = 'kg',
      cost_price,
      retail_price,
      reseller_price,
      wholesale_min_qty = 10,
      stock_qty = 0,
      min_stock_alert = 15.0,
      image_emoji = '🥔'
    } = req.body;

    if (!name || cost_price === undefined || retail_price === undefined || reseller_price === undefined) {
      return res.status(400).json({ success: false, message: 'Data produk belum lengkap' });
    }

    const result = await dbQuery.run(
      `INSERT INTO products 
       (name, category, unit, cost_price, retail_price, reseller_price, wholesale_min_qty, stock_qty, min_stock_alert, image_emoji)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category, unit, cost_price, retail_price, reseller_price, wholesale_min_qty, stock_qty, min_stock_alert, image_emoji]
    );

    await logAudit(req.user.id, 'PRODUCT_CREATED', { product_id: result.lastID, name, retail_price, reseller_price });

    const newProduct = await dbQuery.get('SELECT * FROM products WHERE id = ?', [result.lastID]);
    return res.status(201).json({ success: true, message: 'Produk berhasil ditambahkan', product: newProduct });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/products/:id (Owner only)
router.put('/:id', authenticateToken, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      unit,
      cost_price,
      retail_price,
      reseller_price,
      wholesale_min_qty,
      stock_qty,
      min_stock_alert,
      image_emoji
    } = req.body;

    const existing = await dbQuery.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }

    await dbQuery.run(
      `UPDATE products
       SET name = COALESCE(?, name),
           category = COALESCE(?, category),
           unit = COALESCE(?, unit),
           cost_price = COALESCE(?, cost_price),
           retail_price = COALESCE(?, retail_price),
           reseller_price = COALESCE(?, reseller_price),
           wholesale_min_qty = COALESCE(?, wholesale_min_qty),
           stock_qty = COALESCE(?, stock_qty),
           min_stock_alert = COALESCE(?, min_stock_alert),
           image_emoji = COALESCE(?, image_emoji)
       WHERE id = ?`,
      [name, category, unit, cost_price, retail_price, reseller_price, wholesale_min_qty, stock_qty, min_stock_alert, image_emoji, id]
    );

    await logAudit(req.user.id, 'PRODUCT_UPDATED', {
      product_id: id,
      old: { retail: existing.retail_price, reseller: existing.reseller_price },
      new: { retail: retail_price, reseller: reseller_price }
    });

    const updated = await dbQuery.get('SELECT * FROM products WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Produk berhasil diperbarui', product: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/products/adjust-stock
// Record susut, busuk, or opname adjustment with notes and photo proof
router.post('/adjust-stock', authenticateToken, async (req, res) => {
  try {
    const { product_id, shift_id, type, qty_kg, notes, photo_url } = req.body;

    if (!product_id || !type || !qty_kg || qty_kg <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, tipe (susut/busuk/rusak/opname), dan jumlah kg wajib diisi'
      });
    }

    const product = await dbQuery.get('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }

    // Deduct stock for waste/susut
    const newStock = Math.max(0, product.stock_qty - Number(qty_kg));
    await dbQuery.run('UPDATE products SET stock_qty = ? WHERE id = ?', [newStock, product_id]);

    const result = await dbQuery.run(
      `INSERT INTO stock_adjustments (product_id, shift_id, user_id, type, qty_kg, notes, photo_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
      [product_id, shift_id || null, req.user.id, type, qty_kg, notes || '', photo_url || '']
    );

    await logAudit(req.user.id, `STOCK_ADJUSTMENT_${type.toUpperCase()}`, {
      product_id,
      product_name: product.name,
      qty_kg,
      notes,
      photo_url
    });

    return res.json({
      success: true,
      message: `Pencatatan ${type} sebesar ${qty_kg} kg berhasil disimpan`,
      adjustment_id: result.lastID,
      remaining_stock: newStock
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});


// POST /api/products/restock (Tambah Stok / Barang Masuk / Kulakan)
router.post('/restock', authenticateToken, async (req, res) => {
  try {
    const { product_id, qty_kg, new_cost_price, notes } = req.body;

    if (!product_id || !qty_kg || Number(qty_kg) <= 0) {
      return res.status(400).json({ success: false, message: 'Produk dan kuantiti masuk (kg) wajib diisi' });
    }

    const product = await dbQuery.get('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }

    const addedQty = Number(qty_kg);
    const newStock = Number(product.stock_qty) + addedQty;
    const finalCostPrice = (new_cost_price && Number(new_cost_price) > 0) ? Number(new_cost_price) : product.cost_price;

    await dbQuery.run(
      'UPDATE products SET stock_qty = ?, cost_price = ? WHERE id = ?',
      [newStock, finalCostPrice, product_id]
    );

    // Record adjustment
    await dbQuery.run(
      `INSERT INTO stock_adjustments (product_id, shift_id, user_id, type, qty_kg, notes, photo_url)
       VALUES (?, NULL, ?, 'opname', ?, ?, '')`,
      [product_id, req.user.id, addedQty, `[KULAKAN/MASUK] ${notes || 'Barang masuk'}`]
    );

    await logAudit(req.user.id, 'PRODUCT_RESTOCK', {
      product_id,
      product_name: product.name,
      added_qty: addedQty,
      previous_stock: product.stock_qty,
      new_stock: newStock,
      cost_price: finalCostPrice,
      notes
    });

    return res.json({
      success: true,
      message: `Stok ${product.name} berhasil ditambahkan sebesar ${addedQty} kg (Total Stok Baru: ${newStock} kg)`,
      product_id,
      new_stock: newStock,
      cost_price: finalCostPrice
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
