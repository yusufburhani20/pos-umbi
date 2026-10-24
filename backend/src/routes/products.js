const express = require('express');
const router = express.Router();
const { dbQuery, getSafeCashBalance, getCurrentDrawerCash, recordSafeCashTransaction } = require('../db');
const { authenticateToken, requireOwner, logAudit } = require('../middleware/auth');

// GET /api/products/low-stock
// Alert endpoint: Get all products with stock below threshold
router.get('/low-stock', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT *,
        ROUND(stock_qty, 2) AS stock_qty,
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
        ROUND(p.stock_qty, 2) AS stock_qty,
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

    const adjustments = await dbQuery.all(`
      SELECT 
        sa.*,
        u.name as recorded_by_name
      FROM stock_adjustments sa
      LEFT JOIN users u ON sa.user_id = u.id
      WHERE sa.product_id = ?
      ORDER BY sa.id DESC
    `, [id]);

    return res.json({
      success: true,
      product,
      summary: summary || { total_entries: 0, total_qty_received: 0, total_cost_spent: 0, total_debt_remaining: 0 },
      purchases,
      adjustments
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

    const sanitizedStock = Math.round(Number(stock_qty || 0) * 100) / 100;

    const result = await dbQuery.run(
      `INSERT INTO products 
       (name, category, unit, cost_price, retail_price, reseller_price, wholesale_min_qty, stock_qty, min_stock_alert, image_emoji)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category, unit, cost_price, retail_price, reseller_price, wholesale_min_qty, sanitizedStock, min_stock_alert, image_emoji]
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
      image_emoji,
      stock_notes
    } = req.body;

    const existing = await dbQuery.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }

    const oldStock = Math.round((Number(existing.stock_qty || 0) + Number.EPSILON) * 100) / 100;
    let sanitizedStock = oldStock;
    let stockChanged = false;
    let diff = 0;

    if (stock_qty !== undefined && stock_qty !== null && stock_qty !== '') {
      sanitizedStock = Math.round((Number(stock_qty) + Number.EPSILON) * 100) / 100;
      diff = Math.round((sanitizedStock - oldStock) * 100) / 100;
      if (Math.abs(diff) > 0.001) {
        stockChanged = true;
      }
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
           stock_qty = ?,
           min_stock_alert = COALESCE(?, min_stock_alert),
           image_emoji = COALESCE(?, image_emoji)
       WHERE id = ?`,
      [name, category, unit, cost_price, retail_price, reseller_price, wholesale_min_qty, sanitizedStock, min_stock_alert, image_emoji, id]
    );

    // If stock was edited manually, record into stock_adjustments history and audit trail
    if (stockChanged) {
      const diffText = diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
      const noteText = `[KOREKSI MANUAL STOK] Diubah dari ${oldStock} kg menjadi ${sanitizedStock} kg (Selisih: ${diffText} kg)${stock_notes ? '. Catatan: ' + stock_notes : ''}`;

      await dbQuery.run(
        `INSERT INTO stock_adjustments (product_id, shift_id, user_id, type, qty_kg, notes, photo_url, created_at)
         VALUES (?, NULL, ?, 'opname', ?, ?, '', datetime('now', 'localtime'))`,
        [id, req.user.id, Math.abs(diff), noteText]
      );

      await logAudit(req.user.id, 'PRODUCT_STOCK_MANUAL_EDIT', {
        product_id: id,
        product_name: name || existing.name,
        old_stock: oldStock,
        new_stock: sanitizedStock,
        difference: diff,
        notes: stock_notes || ''
      });
    }

    await logAudit(req.user.id, 'PRODUCT_UPDATED', {
      product_id: id,
      old: { name: existing.name, retail: existing.retail_price, reseller: existing.reseller_price, cost: existing.cost_price, stock: oldStock },
      new: { name: name || existing.name, retail: retail_price, reseller: reseller_price, cost: cost_price, stock: sanitizedStock }
    });

    const updated = await dbQuery.get('SELECT *, ROUND(stock_qty, 2) AS stock_qty FROM products WHERE id = ?', [id]);
    return res.json({
      success: true,
      message: stockChanged 
        ? `Komoditas & stok berhasil diperbarui (Stok: ${sanitizedStock} ${updated.unit || 'kg'})` 
        : 'Komoditas berhasil diperbarui',
      product: updated,
      stock_changed: stockChanged,
      stock_diff: diff
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/products/:id (Cashier / Owner)
router.delete('/:id', authenticateToken, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await dbQuery.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Komoditas tidak ditemukan' });
    }

    // Check if product is referenced in order items or purchases
    const orderRef = await dbQuery.get('SELECT COUNT(*) as cnt FROM order_items WHERE product_id = ?', [id]);
    const purchaseRef = await dbQuery.get('SELECT COUNT(*) as cnt FROM purchases WHERE product_id = ?', [id]);
    const hasReferences = ((orderRef && orderRef.cnt > 0) || (purchaseRef && purchaseRef.cnt > 0));

    if (hasReferences) {
      // Soft-delete so historical receipts, reports, and debt records maintain referential integrity
      await dbQuery.run('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
    } else {
      // Hard-delete if product was never transacted
      await dbQuery.run('DELETE FROM products WHERE id = ?', [id]);
    }

    await logAudit(req.user.id, 'PRODUCT_DELETED', {
      product_id: id,
      name: product.name,
      stock_qty: product.stock_qty,
      is_soft_delete: hasReferences
    });

    return res.json({
      success: true,
      message: `Komoditas "${product.name}" berhasil dihapus dari katalog toko`,
      product_id: id,
      soft_delete: hasReferences
    });
  } catch (err) {
    console.error('Error deleting product:', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus komoditas: ' + err.message });
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
    const newStock = Math.round(Math.max(0, product.stock_qty - Number(qty_kg)) * 100) / 100;
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
    const { product_id, qty_kg, new_cost_price, total_cost, notes } = req.body;

    if (!product_id || !qty_kg || Number(qty_kg) <= 0) {
      return res.status(400).json({ success: false, message: 'Produk dan kuantiti masuk (kg) wajib diisi' });
    }

    const product = await dbQuery.get('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }

    const addedQty = Math.round(Number(qty_kg) * 100) / 100;
    const newStock = Math.round((Number(product.stock_qty) + addedQty) * 100) / 100;
    
    const manualTotal = (total_cost !== undefined && total_cost !== null && total_cost !== '') ? Number(total_cost) : null;
    let inputCostPrice = (new_cost_price && Number(new_cost_price) > 0) ? Number(new_cost_price) : null;

    let finalCostPrice = inputCostPrice;
    let totalCost = 0;

    if (manualTotal !== null && manualTotal > 0) {
      totalCost = Math.round(manualTotal);
      if (!finalCostPrice && addedQty > 0) {
        finalCostPrice = Math.round((totalCost / addedQty) * 100) / 100;
      }
    } else {
      if (!finalCostPrice) {
        finalCostPrice = Number(product.cost_price || 0);
      }
      totalCost = Math.round(addedQty * finalCostPrice);
    }

    if (!finalCostPrice || finalCostPrice <= 0) {
      finalCostPrice = Number(product.cost_price || 0);
    }

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
      const isTempo = req.body.payment_status === 'tempo';
      const dpVal = Math.max(0, Math.min(totalCost, Number(req.body.dp_amount) || 0));
      const paidAmt = isTempo ? dpVal : totalCost;
      const remAmt = isTempo ? Math.max(0, totalCost - dpVal) : 0;
      const pStatus = isTempo ? (remAmt === 0 ? 'lunas' : (paidAmt > 0 ? 'partial' : 'tempo')) : 'lunas';

      const paymentMethod = req.body.payment_method || 'cash';

      // Verify balance sufficiency for immediate payments (full / DP)
      if (paidAmt > 0) {
        if (paymentMethod === 'safe') {
          const safeStats = await getSafeCashBalance();
          if (safeStats.balance < paidAmt) {
            const shortage = paidAmt - safeStats.balance;
            return res.status(400).json({
              success: false,
              code: 'INSUFFICIENT_SAFE_CASH',
              message: `Saldo kas brankas tidak mencukupi untuk bayar kulakan! Saldo brankas saat ini hanya Rp ${safeStats.balance.toLocaleString('id-ID')}, sedangkan pembayaran Rp ${paidAmt.toLocaleString('id-ID')} (kurang Rp ${shortage.toLocaleString('id-ID')}). Harap setor kas ke brankas terlebih dahulu atau pilih metode lain.`
            });
          }
        } else if (paymentMethod === 'cash') {
          const drawerState = await getCurrentDrawerCash();
          if (drawerState.has_active_shift && drawerState.current_drawer_cash < paidAmt) {
            const shortage = paidAmt - drawerState.current_drawer_cash;
            return res.status(400).json({
              success: false,
              code: 'INSUFFICIENT_DRAWER_CASH',
              message: `Saldo kas laci tidak mencukupi untuk bayar kulakan tunai! Saldo laci saat ini hanya Rp ${drawerState.current_drawer_cash.toLocaleString('id-ID')}, sedangkan pembayaran tunai Rp ${paidAmt.toLocaleString('id-ID')} (kurang Rp ${shortage.toLocaleString('id-ID')}). Harap gunakan Kas Brankas Toko / Transfer Bank / Tempo.`
            });
          }
        }
      }

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

      if (paidAmt > 0) {
        let targetShiftId = req.body.shift_id ? Number(req.body.shift_id) : null;
        if (!targetShiftId) {
          const actShift = await dbQuery.get("SELECT id FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1");
          if (actShift) targetShiftId = actShift.id;
        }

        await dbQuery.run(
          `INSERT INTO supplier_payments (purchase_id, supplier_id, shift_id, amount_paid, payment_method, payment_date, notes, recorded_by)
           VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?)`,
          [pResult.lastID, req.body.supplier_id ? Number(req.body.supplier_id) : null, targetShiftId, paidAmt, paymentMethod, pStatus === 'lunas' ? 'Lunas saat kulakan' : 'DP Kulakan', req.user.id]
        );

        if (paymentMethod === 'safe') {
          await recordSafeCashTransaction({
            user_id: req.user.id,
            shift_id: targetShiftId,
            type: 'supplier_pay',
            amount: paidAmt,
            source: 'safe',
            reference_no: purchaseNo,
            notes: `Bayar Kulakan ${purchaseNo} (${product.name})`
          });
        }
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

    const targetPhysical = Math.round(Math.max(0, parseFloat(physical_qty)) * 100) / 100;
    const previousStock = Math.round(parseFloat(product.stock_qty || 0) * 100) / 100;
    const diff = Math.round((targetPhysical - previousStock) * 100) / 100; // positif = kelebihan, negatif = susut/hilang

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
