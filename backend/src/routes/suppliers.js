const express = require('express');
const router = express.Router();
const { dbQuery, getCurrentDrawerCash } = require('../db');
const { authenticateToken, requireOwner, logAudit } = require('../middleware/auth');

// Helper to generate unique Purchase No (KUL-YYYYMMDD-XXXX)
async function generatePurchaseNo() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `KUL-${dateStr}-`;
  
  const last = await dbQuery.get(
    `SELECT purchase_no FROM purchases WHERE purchase_no LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let seq = 1;
  if (last && last.purchase_no) {
    const parts = last.purchase_no.split('-');
    if (parts.length >= 3) {
      seq = parseInt(parts[2], 10) + 1;
    }
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// GET /api/suppliers
// List all suppliers with stats and KPI summary
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, status, has_debt } = req.query;

    let sql = `
      SELECT 
        s.*,
        COALESCE(SUM(p.total_cost), 0) as total_purchases_amount,
        COALESCE(SUM(p.qty_kg), 0) as total_purchases_kg,
        COALESCE(COUNT(p.id), 0) as total_purchases_count,
        COALESCE(SUM(CASE WHEN p.remaining_amount > 0 THEN p.remaining_amount ELSE 0 END), 0) as total_debt_remaining,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM purchases p2 
            WHERE p2.supplier_id = s.id 
              AND p2.remaining_amount > 0 
              AND date(p2.due_date) < date('now', 'localtime')
          ) THEN 1 
          ELSE 0 
        END as has_overdue_debt
      FROM suppliers s
      LEFT JOIN purchases p ON s.id = p.supplier_id
      WHERE 1=1
    `;
    const params = [];

    if (status !== 'all') {
      sql += ' AND s.is_active = 1';
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ' AND (s.name LIKE ? OR s.phone LIKE ? OR s.address LIKE ? OR s.supplied_commodities LIKE ?)';
      params.push(q, q, q, q);
    }

    sql += ' GROUP BY s.id';

    if (has_debt === 'true' || has_debt === '1') {
      sql += ' HAVING total_debt_remaining > 0';
    }

    sql += ' ORDER BY total_debt_remaining DESC, s.name ASC';

    const suppliers = await dbQuery.all(sql, params);

    // Summary KPIs
    const summary = await dbQuery.get(`
      SELECT 
        (SELECT COUNT(*) FROM suppliers WHERE is_active = 1) as total_suppliers,
        (
          SELECT COALESCE(SUM(total_cost), 0) 
          FROM purchases 
          WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
        ) as total_purchases_month,
        (
          SELECT COALESCE(SUM(remaining_amount), 0) 
          FROM purchases 
          WHERE remaining_amount > 0
        ) as total_debt_outstanding,
        (
          SELECT COUNT(DISTINCT supplier_id) 
          FROM purchases 
          WHERE remaining_amount > 0
        ) as total_suppliers_with_debt,
        (
          SELECT COALESCE(SUM(remaining_amount), 0) 
          FROM purchases 
          WHERE remaining_amount > 0 AND date(due_date) < date('now', 'localtime')
        ) as total_overdue_debt
    `);

    return res.json({
      success: true,
      summary: {
        total_suppliers: summary.total_suppliers || 0,
        total_purchases_month: summary.total_purchases_month || 0,
        total_debt_outstanding: summary.total_debt_outstanding || 0,
        total_suppliers_with_debt: summary.total_suppliers_with_debt || 0,
        total_overdue_debt: summary.total_overdue_debt || 0
      },
      suppliers
    });
  } catch (err) {
    console.error('Error in GET /api/suppliers:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/suppliers/purchases/all
// List all purchases (kulakan history)
router.get('/purchases/all', authenticateToken, async (req, res) => {
  try {
    const { supplier_id, payment_status, search, product_id } = req.query;

    let sql = `
      SELECT 
        p.*,
        s.name as supplier_name,
        s.phone as supplier_phone,
        s.address as supplier_address,
        pr.name as product_name,
        pr.unit as product_unit,
        pr.image_emoji as product_emoji,
        u.name as recorded_by_name,
        CASE 
          WHEN p.remaining_amount > 0 AND date(p.due_date) < date('now', 'localtime') THEN 1 
          ELSE 0 
        END as is_overdue
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      JOIN products pr ON p.product_id = pr.id
      LEFT JOIN users u ON p.recorded_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (supplier_id) {
      sql += ' AND p.supplier_id = ?';
      params.push(supplier_id);
    }

    if (product_id) {
      sql += ' AND p.product_id = ?';
      params.push(product_id);
    }

    if (payment_status && payment_status !== 'all') {
      if (payment_status === 'overdue') {
        sql += " AND p.remaining_amount > 0 AND date(p.due_date) < date('now', 'localtime')";
      } else {
        sql += ' AND p.payment_status = ?';
        params.push(payment_status);
      }
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ' AND (p.purchase_no LIKE ? OR s.name LIKE ? OR pr.name LIKE ? OR p.notes LIKE ?)';
      params.push(q, q, q, q);
    }

    sql += ' ORDER BY p.id DESC';

    const purchases = await dbQuery.all(sql, params);
    return res.json({ success: true, purchases });
  } catch (err) {
    console.error('Error fetching all purchases:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/suppliers/:id
// Get single supplier detail with purchase history and payments
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await dbQuery.get(
      `SELECT 
        s.*,
        COALESCE(SUM(p.total_cost), 0) as total_purchases_amount,
        COALESCE(SUM(p.qty_kg), 0) as total_purchases_kg,
        COALESCE(COUNT(p.id), 0) as total_purchases_count,
        COALESCE(SUM(CASE WHEN p.remaining_amount > 0 THEN p.remaining_amount ELSE 0 END), 0) as total_debt_remaining
      FROM suppliers s
      LEFT JOIN purchases p ON s.id = p.supplier_id
      WHERE s.id = ?
      GROUP BY s.id`,
      [id]
    );

    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Pemasok / Supplier tidak ditemukan' });
    }

    // Purchase history for this supplier
    const purchases = await dbQuery.all(
      `SELECT 
        p.*,
        pr.name as product_name,
        pr.unit as product_unit,
        pr.image_emoji as product_emoji,
        u.name as recorded_by_name,
        CASE 
          WHEN p.remaining_amount > 0 AND date(p.due_date) < date('now', 'localtime') THEN 1 
          ELSE 0 
        END as is_overdue
      FROM purchases p
      JOIN products pr ON p.product_id = pr.id
      LEFT JOIN users u ON p.recorded_by = u.id
      WHERE p.supplier_id = ?
      ORDER BY p.id DESC`,
      [id]
    );

    // Payment history for this supplier
    const payments = await dbQuery.all(
      `SELECT 
        sp.*,
        p.purchase_no,
        u.name as recorded_by_name
      FROM supplier_payments sp
      JOIN purchases p ON sp.purchase_id = p.id
      LEFT JOIN users u ON sp.recorded_by = u.id
      WHERE sp.supplier_id = ?
      ORDER BY sp.id DESC`,
      [id]
    );

    return res.json({
      success: true,
      supplier,
      purchases,
      payments
    });
  } catch (err) {
    console.error('Error fetching supplier detail:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/suppliers
// Create new supplier
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      phone = '',
      address = '',
      supplied_commodities = '',
      bank_info = '',
      notes = ''
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama supplier / juragan wajib diisi' });
    }

    const result = await dbQuery.run(
      `INSERT INTO suppliers (name, phone, address, supplied_commodities, bank_info, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), phone.trim(), address.trim(), supplied_commodities.trim(), bank_info.trim(), notes.trim()]
    );

    await logAudit(req.user.id, 'SUPPLIER_CREATED', {
      supplier_id: result.lastID,
      name: name.trim(),
      phone: phone.trim()
    });

    const newSupplier = await dbQuery.get('SELECT * FROM suppliers WHERE id = ?', [result.lastID]);
    return res.status(201).json({
      success: true,
      message: `Pemasok "${name}" berhasil didaftarkan`,
      supplier: newSupplier
    });
  } catch (err) {
    console.error('Error creating supplier:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/suppliers/:id
// Update supplier
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      address,
      supplied_commodities,
      bank_info,
      notes,
      is_active
    } = req.body;

    const existing = await dbQuery.get('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Supplier tidak ditemukan' });
    }

    await dbQuery.run(
      `UPDATE suppliers
       SET name = COALESCE(?, name),
           phone = COALESCE(?, phone),
           address = COALESCE(?, address),
           supplied_commodities = COALESCE(?, supplied_commodities),
           bank_info = COALESCE(?, bank_info),
           notes = COALESCE(?, notes),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        name !== undefined ? name.trim() : existing.name,
        phone !== undefined ? phone.trim() : existing.phone,
        address !== undefined ? address.trim() : existing.address,
        supplied_commodities !== undefined ? supplied_commodities.trim() : existing.supplied_commodities,
        bank_info !== undefined ? bank_info.trim() : existing.bank_info,
        notes !== undefined ? notes.trim() : existing.notes,
        is_active !== undefined ? is_active : existing.is_active,
        id
      ]
    );

    await logAudit(req.user.id, 'SUPPLIER_UPDATED', { supplier_id: id, name });

    const updated = await dbQuery.get('SELECT * FROM suppliers WHERE id = ?', [id]);
    return res.json({
      success: true,
      message: `Data pemasok "${updated.name}" berhasil diperbarui`,
      supplier: updated
    });
  } catch (err) {
    console.error('Error updating supplier:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/suppliers/:id
// Deactivate supplier
router.delete('/:id', authenticateToken, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await dbQuery.get('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Supplier tidak ditemukan' });
    }

    // Check if supplier has unpaid debts
    const debtCheck = await dbQuery.get(
      'SELECT SUM(remaining_amount) as total_debt FROM purchases WHERE supplier_id = ? AND remaining_amount > 0',
      [id]
    );
    if (debtCheck && debtCheck.total_debt > 0) {
      return res.status(400).json({
        success: false,
        message: `Tidak dapat menghapus supplier yang masih memiliki sisa hutang tempo (Rp ${Number(debtCheck.total_debt).toLocaleString('id-ID')}). Harap lunasi terlebih dahulu.`
      });
    }

    await dbQuery.run('UPDATE suppliers SET is_active = 0 WHERE id = ?', [id]);
    await logAudit(req.user.id, 'SUPPLIER_DEACTIVATED', { supplier_id: id, name: existing.name });

    return res.json({
      success: true,
      message: `Supplier "${existing.name}" berhasil dinonaktifkan`
    });
  } catch (err) {
    console.error('Error deactivating supplier:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/suppliers/purchases
// Record new purchase / barang masuk (Kulakan)
router.post('/purchases', authenticateToken, async (req, res) => {
  try {
    const {
      supplier_id,
      product_id,
      qty_kg,
      cost_price,
      payment_status = 'lunas', // 'lunas' or 'tempo'
      payment_method = 'cash', // 'cash' or 'transfer'
      dp_amount = 0,
      due_date = null,
      notes = ''
    } = req.body;

    if (!product_id || !qty_kg || Number(qty_kg) <= 0 || !cost_price || Number(cost_price) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Komoditas, kuantiti masuk (kg > 0), dan harga modal kulakan (Rp/kg > 0) wajib diisi'
      });
    }

    const product = await dbQuery.get('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Komoditas produk tidak ditemukan' });
    }

    let supplierName = 'Bebas / Tanpa Supplier';
    if (supplier_id) {
      const sup = await dbQuery.get('SELECT name FROM suppliers WHERE id = ?', [supplier_id]);
      if (sup) supplierName = sup.name;
    }

    const qty = parseFloat(qty_kg);
    const unitCost = parseFloat(cost_price);
    const totalCost = qty * unitCost;

    let finalPaymentStatus = payment_status === 'tempo' ? 'tempo' : 'lunas';
    let paidAmount = 0;
    let remainingAmount = 0;

    if (finalPaymentStatus === 'lunas') {
      paidAmount = totalCost;
      remainingAmount = 0;
    } else {
      paidAmount = Math.max(0, Math.min(totalCost, parseFloat(dp_amount) || 0));
      remainingAmount = Math.max(0, totalCost - paidAmount);
      if (remainingAmount === 0) {
        finalPaymentStatus = 'lunas';
      } else if (paidAmount > 0) {
        finalPaymentStatus = 'partial';
      }
    }

    // RULE: Avoid minus drawer balance! If paid from cash drawer, ensure drawer has enough balance
    if (paidAmount > 0 && payment_method === 'cash') {
      const drawerState = await getCurrentDrawerCash();
      if (!drawerState.has_active_shift) {
        return res.status(400).json({
          success: false,
          code: 'NO_ACTIVE_SHIFT',
          message: 'Tidak dapat membayar kulakan tunai dari kas laci karena tidak ada shift kasir yang aktif. Buka shift kasir terlebih dahulu atau gunakan Transfer Bank.'
        });
      }

      if (drawerState.current_drawer_cash < paidAmount) {
        const shortage = paidAmount - drawerState.current_drawer_cash;
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_DRAWER_CASH',
          message: `Saldo kas laci tidak mencukupi untuk bayar kulakan tunai! Saldo laci saat ini hanya Rp ${drawerState.current_drawer_cash.toLocaleString('id-ID')}, sedangkan pembayaran tunai Rp ${paidAmount.toLocaleString('id-ID')} (kurang Rp ${shortage.toLocaleString('id-ID')}). Transaksi dibatalkan agar saldo tidak minus. Harap tambah kas masuk/modal terlebih dahulu atau pilih metode Transfer Bank / Tempo.`,
          current_drawer_cash: drawerState.current_drawer_cash,
          required_amount: paidAmount,
          shortage
        });
      }
    }

    const purchaseNo = await generatePurchaseNo();

    // 1. Insert into purchases
    const result = await dbQuery.run(
      `INSERT INTO purchases 
       (purchase_no, supplier_id, product_id, qty_kg, cost_price, total_cost, payment_status, paid_amount, remaining_amount, due_date, notes, recorded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
      [
        purchaseNo,
        supplier_id || null,
        product_id,
        qty,
        unitCost,
        totalCost,
        finalPaymentStatus,
        paidAmount,
        remainingAmount,
        due_date || null,
        notes || '',
        req.user.id
      ]
    );

    const purchaseId = result.lastID;

    // 2. If DP or full payment made, record to supplier_payments
    if (paidAmount > 0 && supplier_id) {
      await dbQuery.run(
        `INSERT INTO supplier_payments 
         (purchase_id, supplier_id, amount_paid, payment_method, payment_date, notes, recorded_by)
         VALUES (?, ?, ?, ?, datetime('now', 'localtime'), ?, ?)`,
        [
          purchaseId,
          supplier_id,
          paidAmount,
          payment_method,
          finalPaymentStatus === 'lunas' ? 'Pembayaran Lunas Saat Kulakan' : 'Uang Muka / DP Kulakan',
          req.user.id
        ]
      );
    }

    // 3. Update product physical stock and cost_price
    const newStock = Math.round((Number(product.stock_qty) + qty) * 100) / 100;
    await dbQuery.run(
      'UPDATE products SET stock_qty = ?, cost_price = ? WHERE id = ?',
      [newStock, unitCost, product_id]
    );

    // 4. Record stock adjustment audit trail
    await dbQuery.run(
      `INSERT INTO stock_adjustments (product_id, shift_id, user_id, type, qty_kg, notes, photo_url, created_at)
       VALUES (?, NULL, ?, 'opname', ?, ?, '', datetime('now', 'localtime'))`,
      [
        product_id,
        req.user.id,
        qty,
        `[KULAKAN ${purchaseNo}] Dari ${supplierName}: +${qty} kg @ Rp ${unitCost.toLocaleString('id-ID')}`
      ]
    );

    // 5. Log audit
    await logAudit(req.user.id, 'PURCHASE_RESTOCK_CREATED', {
      purchase_id: purchaseId,
      purchase_no: purchaseNo,
      supplier_name: supplierName,
      product_name: product.name,
      qty_kg: qty,
      cost_price: unitCost,
      total_cost: totalCost,
      payment_status: finalPaymentStatus,
      remaining_amount: remainingAmount
    });

    return res.status(201).json({
      success: true,
      message: `Kulakan ${purchaseNo} berhasil dicatat! Stok ${product.name} bertambah ${qty} kg (Total: ${newStock} kg)`,
      purchase: {
        id: purchaseId,
        purchase_no: purchaseNo,
        supplier_id: supplier_id || null,
        product_id,
        qty_kg: qty,
        cost_price: unitCost,
        total_cost: totalCost,
        payment_status: finalPaymentStatus,
        remaining_amount: remainingAmount,
        new_stock: newStock
      }
    });
  } catch (err) {
    console.error('Error recording purchase:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/suppliers/purchases/:id/pay
// Pay off / installment for tempo purchase to supplier
router.post('/purchases/:id/pay', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_method = 'transfer', notes = '' } = req.body;

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Nominal pembayaran harus lebih dari Rp 0' });
    }

    const purchase = await dbQuery.get(
      `SELECT p.*, s.name as supplier_name, pr.name as product_name
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       JOIN products pr ON p.product_id = pr.id
       WHERE p.id = ?`,
      [id]
    );

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Data nota kulakan tidak ditemukan' });
    }

    if (purchase.remaining_amount <= 0) {
      return res.status(400).json({ success: false, message: 'Nota kulakan ini sudah lunas sebelumnya' });
    }

    if (payAmount > purchase.remaining_amount) {
      return res.status(400).json({
        success: false,
        message: `Nominal bayar (Rp ${payAmount.toLocaleString('id-ID')}) melebihi sisa hutang (Rp ${Number(purchase.remaining_amount).toLocaleString('id-ID')})`
      });
    }

    const newPaid = Number(purchase.paid_amount) + payAmount;
    const newRemaining = Math.max(0, Number(purchase.remaining_amount) - payAmount);
    const newStatus = newRemaining === 0 ? 'lunas' : 'partial';

    // RULE: Avoid minus drawer balance! If payment method is cash, check drawer cash sufficiency
    if (payment_method === 'cash') {
      const drawerState = await getCurrentDrawerCash();
      if (!drawerState.has_active_shift) {
        return res.status(400).json({
          success: false,
          code: 'NO_ACTIVE_SHIFT',
          message: 'Tidak dapat membayar tunai dari laci karena tidak ada shift kasir yang sedang aktif. Buka shift kasir terlebih dahulu atau gunakan Transfer Bank.'
        });
      }

      if (drawerState.current_drawer_cash < payAmount) {
        const shortage = payAmount - drawerState.current_drawer_cash;
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_DRAWER_CASH',
          message: `Saldo kas laci tidak mencukupi untuk bayar hutang supplier! Saldo laci saat ini hanya Rp ${drawerState.current_drawer_cash.toLocaleString('id-ID')}, sedangkan pembayaran tunai Rp ${payAmount.toLocaleString('id-ID')} (kurang Rp ${shortage.toLocaleString('id-ID')}). Transaksi dibatalkan agar saldo tidak minus. Harap tambah kas masuk/modal terlebih dahulu atau pilih metode Transfer Bank.`,
          current_drawer_cash: drawerState.current_drawer_cash,
          required_amount: payAmount,
          shortage
        });
      }
    }

    // 1. Update purchase
    await dbQuery.run(
      'UPDATE purchases SET paid_amount = ?, remaining_amount = ?, payment_status = ? WHERE id = ?',
      [newPaid, newRemaining, newStatus, id]
    );

    // 2. Insert into supplier_payments
    const payResult = await dbQuery.run(
      `INSERT INTO supplier_payments 
       (purchase_id, supplier_id, amount_paid, payment_method, payment_date, notes, recorded_by)
       VALUES (?, ?, ?, ?, datetime('now', 'localtime'), ?, ?)`,
      [
        id,
        purchase.supplier_id,
        payAmount,
        payment_method,
        notes || (newRemaining === 0 ? 'Pelunasan Hutang Kulakan' : 'Cicilan Hutang Kulakan'),
        req.user.id
      ]
    );

    // 3. Log audit
    await logAudit(req.user.id, 'SUPPLIER_PAYMENT_RECORDED', {
      purchase_id: id,
      purchase_no: purchase.purchase_no,
      supplier_name: purchase.supplier_name,
      amount_paid: payAmount,
      remaining_amount: newRemaining,
      status: newStatus
    });

    return res.json({
      success: true,
      message: `Pembayaran sebesar Rp ${payAmount.toLocaleString('id-ID')} ke ${purchase.supplier_name || 'Supplier'} berhasil dicatat! Status: ${newStatus.toUpperCase()}`,
      payment_id: payResult.lastID,
      remaining_amount: newRemaining,
      status: newStatus
    });
  } catch (err) {
    console.error('Error paying supplier debt:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
