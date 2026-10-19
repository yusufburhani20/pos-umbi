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
// Fetch all products for POS grid or inventory management with latest restock history info
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, search, low_stock } = req.query;
    let sql = `
      SELECT p.*,
        CASE 
          WHEN p.stock_qty <= 0 THEN 1 
          ELSE 0 
        END as is_out_of_stock,
        CASE 
          WHEN p.stock_qty > 0 AND p.stock_qty <= COALESCE(p.min_stock_alert, 15.0) THEN 1 
          ELSE 0 
        END as is_low_stock,
        (
          SELECT pu.created_at 
          FROM purchases pu 
          WHERE pu.product_id = p.id 
          ORDER BY pu.id DESC 
          LIMIT 1
        ) as last_restock_date,
        (
          SELECT s.name 
          FROM purchases pu 
          LEFT JOIN suppliers s ON pu.supplier_id = s.id 
          WHERE pu.product_id = p.id 
          ORDER BY pu.id DESC 
          LIMIT 1
        ) as last_supplier_name,
        (
          SELECT pu.qty_kg 
          FROM purchases pu 
          WHERE pu.product_id = p.id 
          ORDER BY pu.id DESC 
          LIMIT 1
        ) as last_restock_qty,
        (
          SELECT pu.cost_price 
          FROM purchases pu 
          WHERE pu.product_id = p.id 
          ORDER BY pu.id DESC 
          LIMIT 1
        ) as last_cost_price,
        (
          SELECT COUNT(*) 
          FROM purchases pu 
          WHERE pu.product_id = p.id
        ) as restock_count
      FROM products p
      WHERE p.is_active = 1
    `;
    const params = [];

    if (category) {
      sql += ' AND p.category = ?';
      params.push(category);
    }
    if (search) {
      sql += ' AND p.name LIKE ?';
      params.push(`%${search}%`);
    }
    if (low_stock === 'true' || low_stock === '1') {
      sql += ' AND p.stock_qty <= COALESCE(p.min_stock_alert, 15.0)';
    }

    sql += ' ORDER BY p.name ASC';
    const products = await dbQuery.all(sql, params);
    return res.json({ success: true, products });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products/:id/restock-history
// Fetch complete chronological incoming stock / purchases history for a single product
router.get('/:id/restock-history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await dbQuery.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Komoditas tidak ditemukan' });
    }

    const purchases = await dbQuery.all(`
      SELECT 
        p.*,
        s.name as supplier_name,
        s.phone as supplier_phone,
        s.address as supplier_address,
        u.name as recorded_by_name
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN users u ON p.recorded_by = u.id
      WHERE p.product_id = ?
      ORDER BY p.id DESC
    `, [id]);

    const summary = await dbQuery.get(`
      SELECT 
        COUNT(*) as total_entries,
        COALESCE(SUM(qty_kg), 0) as total_qty_received,
        COALESCE(SUM(total_cost), 0) as total_cost_spent,
        COALESCE(SUM(remaining_amount), 0) as total_debt_remaining
      FROM purchases
      WHERE product_id = ?
    `, [id]);

    return res.json({
      success: true,
      product,
      summary: summary || { total_entries: 0, total_qty_received: 0, total_cost_spent: 0, total_debt_remaining: 0 },
      purchases
    });
  } catch (err) {
    console.error('Error fetching product restock history:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/products (Cashier / Owner)
router.post('/', authenticateToken, async (req, res) => {
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

// PUT /api/products/:id (Cashier / Owner)
router.put('/:id', authenticateToken, async (req, res) => {
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

    // Record purchase transaction
    try {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = `KUL-${dateStr}-`;
      const lastP = await dbQuery.get(
        `SELECT purchase_no FROM purchases WHERE purchase_no LIKE ? ORDER BY id DESC LIMIT 1`,
        [`${prefix}%`]
      );
      let seq = 1;
      if (lastP && lastP.purchase_no) {
        const parts = lastP.purchase_no.split('-');
        if (parts.length >= 3) seq = parseInt(parts[2], 10) + 1;
      }
      const purchaseNo = `${prefix}${String(seq).padStart(4, '0')}`;
      const totalCost = addedQty * finalCostPrice;
      const isTempo = req.body.payment_status === 'tempo';
      const dpVal = Math.max(0, Math.min(totalCost, Number(req.body.dp_amount) || 0));
      const paidAmt = isTempo ? dpVal : totalCost;
      const remAmt = isTempo ? Math.max(0, totalCost - dpVal) : 0;
      const pStatus = isTempo ? (remAmt === 0 ? 'lunas' : (paidAmt > 0 ? 'partial' : 'tempo')) : 'lunas';

      const pResult = await dbQuery.run(
        `INSERT INTO purchases (purchase_no, supplier_id, product_id, qty_kg, cost_price, total_cost, payment_status, paid_amount, remaining_amount, due_date, notes, recorded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
        [
          purchaseNo,
          req.body.supplier_id ? Number(req.body.supplier_id) : null,
          product_id,
          addedQty,
          finalCostPrice,
          totalCost,
          pStatus,
          paidAmt,
          remAmt,
          req.body.due_date || null,
          notes || '',
          req.user.id
        ]
      );

      if (paidAmt > 0 && req.body.supplier_id) {
        await dbQuery.run(
          `INSERT INTO supplier_payments (purchase_id, supplier_id, amount_paid, payment_method, payment_date, notes, recorded_by)
           VALUES (?, ?, ?, 'cash', datetime('now', 'localtime'), ?, ?)`,
          [pResult.lastID, Number(req.body.supplier_id), paidAmt, pStatus === 'lunas' ? 'Lunas saat kulakan' : 'DP Kulakan', req.user.id]
        );
      }
    } catch (pErr) {
      console.warn('[RESTOCK] Warning recording purchase entry:', pErr.message);
    }

    await logAudit(req.user.id, 'PRODUCT_RESTOCK', {
      product_id,
      product_name: product.name,
      added_qty: addedQty,
      previous_stock: product.stock_qty,
      new_stock: newStock,
      cost_price: finalCostPrice,
      supplier_id: req.body.supplier_id || null,
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

// POST /api/products/opname (Audit Fisik & Penyesuaian Stok Opname)
router.post('/opname', authenticateToken, async (req, res) => {
  try {
    const { product_id, physical_qty, shift_id, notes } = req.body;

    if (!product_id || physical_qty === undefined || physical_qty === null || isNaN(Number(physical_qty))) {
      return res.status(400).json({
        success: false,
        message: 'ID komoditas dan hasil hitung stok fisik (kg) wajib diisi'
      });
    }

    const product = await dbQuery.get('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Komoditas produk tidak ditemukan' });
    }

    const targetPhysical = Math.max(0, parseFloat(physical_qty));
    const previousStock = parseFloat(product.stock_qty || 0);
    const diff = targetPhysical - previousStock; // positif = kelebihan, negatif = susut/hilang

    // Terapkan stok fisik nyata ke database
    await dbQuery.run('UPDATE products SET stock_qty = ? WHERE id = ?', [targetPhysical, product_id]);

    // Format catatan penyesuaian opname yang jelas
    const diffText = diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
    const adjNote = `[STOK OPNAME FISIK] Sistem: ${previousStock.toFixed(2)} kg ➔ Fisik: ${targetPhysical.toFixed(2)} kg (Selisih: ${diffText} kg). ${notes ? 'Catatan: ' + notes : ''}`;

    await dbQuery.run(
      `INSERT INTO stock_adjustments (product_id, shift_id, user_id, type, qty_kg, notes, photo_url, created_at)
       VALUES (?, ?, ?, 'opname', ?, ?, '', datetime('now', 'localtime'))`,
      [product_id, shift_id || null, req.user.id, Math.abs(diff), adjNote]
    );

    await logAudit(req.user.id, 'STOCK_OPNAME_APPLIED', {
      product_id,
      product_name: product.name,
      previous_stock: previousStock,
      physical_stock: targetPhysical,
      difference: diff,
      notes: notes || ''
    });

    return res.json({
      success: true,
      message: `Stok opname ${product.name} berhasil disimpan! Stok sistem disesuaikan menjadi ${targetPhysical} kg (Selisih: ${diffText} kg)`,
      product_id,
      product_name: product.name,
      previous_stock: previousStock,
      new_stock: targetPhysical,
      difference: diff
    });
  } catch (err) {
    console.error('Error in /api/products/opname:', err);
    return res.status(500).json({ success: false, message: 'Gagal memproses stok opname: ' + err.message });
  }
});

module.exports = router;
