const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db, dbQuery } = require('../db');
const { authenticateToken, logAudit } = require('../middleware/auth');

// Helper to generate unique order number: TR-YYYYMMDD-XXXX
function generateOrderNo() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TR-${yyyy}${mm}${dd}-${rand}`;
}

// POST /api/orders
// Create new sales transaction with strict pricing logic
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { shift_id, customer_id, payment_method, cash_tendered, items } = req.body;

    if (!shift_id || !payment_method || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Shift ID, metode pembayaran, dan daftar item belanja wajib diisi'
      });
    }

    // 1. Verify shift is currently open
    const shift = await dbQuery.get('SELECT * FROM shifts WHERE id = ? AND status = "open"', [shift_id]);
    if (!shift) {
      return res.status(400).json({
        success: false,
        message: 'Shift tidak aktif atau sudah ditutup. Buka shift baru untuk melanjutkan transaksi.'
      });
    }

    // 2. Check or create customer profile (Kasbon bisa pembeli siapa saja)
    let customer = null;
    const customerName = (req.body.customer_name || '').trim();
    const customerPhone = (req.body.customer_phone || '').trim();

    if (customer_id) {
      customer = await dbQuery.get('SELECT * FROM customers WHERE id = ?', [customer_id]);
    }

    if (!customer && customerName) {
      if (customerPhone) {
        customer = await dbQuery.get('SELECT * FROM customers WHERE phone = ? OR LOWER(name) = LOWER(?)', [customerPhone, customerName]);
      } else {
        customer = await dbQuery.get('SELECT * FROM customers WHERE LOWER(name) = LOWER(?)', [customerName]);
      }

      if (!customer) {
        const newCustRes = await dbQuery.run(
          'INSERT INTO customers (name, phone, tier, created_at) VALUES (?, ?, "retail", datetime("now", "localtime"))',
          [customerName, customerPhone || null]
        );
        customer = {
          id: newCustRes.lastID,
          name: customerName,
          phone: customerPhone || null,
          tier: 'retail'
        };
      } else if (customerPhone && !customer.phone) {
        await dbQuery.run('UPDATE customers SET phone = ? WHERE id = ?', [customerPhone, customer.id]);
        customer.phone = customerPhone;
      }
    }

    const isCustomerReseller = customer && customer.tier === 'reseller';

    // 3. Process each line item with Anti-Fraud Pricing Engine
    let calculatedTotal = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await dbQuery.get('SELECT * FROM products WHERE id = ? AND is_active = 1', [item.product_id]);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Produk dengan ID ${item.product_id} tidak ditemukan atau non-aktif`
        });
      }

      const qty = Number(item.qty);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: `Jumlah kuantiti untuk ${product.name} tidak valid`
        });
      }

      // DETERMINATION OF PRICE TIER:
      // Price is explicitly chosen by cashier (Eceran vs Karungan) or custom price nego
      const isKarung = item.price_tier === 'karungan' || item.price_tier === 'reseller';
      const priceTier = isKarung ? 'reseller' : 'retail';
      let unitPrice = isKarung ? Number(product.reseller_price) : Number(product.retail_price);

      // Support cashier custom unit price adjustment (nego pasar / penyesuaian kasir)
      if (item.unit_price && Number(item.unit_price) > 0) {
        unitPrice = Number(item.unit_price);
      }
      
      // Calculate raw subtotal from weight and unit price
      const rawSubtotal = qty * unitPrice;
      // Round to nearest Rp 100 so receipts never have unrounded penny tails (e.g. 9.996 -> 10.000)
      let subtotal = Math.round(rawSubtotal / 100) * 100;

      // Support exact round nominal purchase (e.g. buyer asks for 10.000 or 15.000) within tolerance
      if (item.subtotal && Math.abs(Number(item.subtotal) - rawSubtotal) <= 1000) {
        subtotal = Math.round(Number(item.subtotal) / 100) * 100;
      }

      calculatedTotal += subtotal;

      processedItems.push({
        product_id: product.id,
        product_name: product.name,
        qty,
        price_tier: priceTier,
        cost_price: Number(product.cost_price),
        unit_price: unitPrice,
        subtotal
      });
    }

    const calculatedSubtotal = calculatedTotal;

    // 3b. Price Adjustments (Nego Total Manual, Rotten Produce Refund, & Discounts)
    const rawManualTotal = req.body.manual_total_override;
    const manualTotalOverride = (rawManualTotal !== undefined && rawManualTotal !== null && rawManualTotal !== '' && !isNaN(Number(rawManualTotal)) && Number(rawManualTotal) > 0)
      ? Math.round(Number(rawManualTotal))
      : null;

    const discountAmount = Math.max(0, Math.round(Number(req.body.discount_amount) || 0));
    const discountNotes = (req.body.discount_notes || '').trim();

    const rottenRefundAmount = Math.max(0, Math.round(Number(req.body.rotten_refund_amount) || 0));
    const rottenRefundNotes = (req.body.rotten_refund_notes || '').trim();

    // Calculate final net payable:
    // If manual total is set (tawar-menawar total), start from that negotiated base, then deduct any rotten refund or extra discount.
    // Otherwise, start from item subtotal and deduct discounts and rotten refund.
    let finalPayableTotal = calculatedSubtotal;
    if (manualTotalOverride !== null) {
      finalPayableTotal = Math.max(0, manualTotalOverride - discountAmount - rottenRefundAmount);
    } else {
      finalPayableTotal = Math.max(0, calculatedSubtotal - discountAmount - rottenRefundAmount);
    }

    // 4. Validate payment
    let changeDue = 0;
    const finalCashTendered = Number(cash_tendered) || 0;
    let finalDueDate = null;

    if (payment_method === 'cash') {
      if (finalCashTendered < finalPayableTotal) {
        return res.status(400).json({
          success: false,
          message: `Uang tunai kurang. Total: Rp ${finalPayableTotal.toLocaleString('id-ID')}, diterima: Rp ${finalCashTendered.toLocaleString('id-ID')}`
        });
      }
      changeDue = finalCashTendered - finalPayableTotal;
    } else if (payment_method === 'tempo') {
      if (!customer) {
        return res.status(400).json({
          success: false,
          message: 'Transaksi Kasbon / Tempo wajib mencantumkan nama dan nomor HP pembeli.'
        });
      }
      changeDue = 0;
      if (req.body.due_date && String(req.body.due_date).trim()) {
        finalDueDate = String(req.body.due_date).trim();
      } else {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        finalDueDate = d.toISOString().split('T')[0];
      }
    } else {
      // For transfer/qris, cash_tendered equals finalPayableTotal
      changeDue = 0;
    }

    const orderNo = generateOrderNo();

    // 5. Database Transaction (Insert Order, Order Items, Deduct Stock)
    await dbQuery.exec('BEGIN IMMEDIATE;');

    try {
      const orderResult = await dbQuery.run(
        `INSERT INTO orders 
         (order_no, shift_id, customer_id, customer_name, subtotal_amount, manual_total_override, discount_amount, discount_notes, rotten_refund_amount, rotten_refund_notes, total_amount, payment_method, cash_tendered, change_due, status, due_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, datetime('now', 'localtime'))`,
        [
          orderNo,
          shift_id,
          customer ? customer.id : null,
          customer ? customer.name : 'Pelanggan Umum',
          calculatedSubtotal,
          manualTotalOverride,
          discountAmount,
          discountNotes || null,
          rottenRefundAmount,
          rottenRefundNotes || null,
          finalPayableTotal,
          payment_method,
          payment_method === 'cash' ? finalCashTendered : (payment_method === 'tempo' ? finalCashTendered : finalPayableTotal),
          changeDue,
          finalDueDate
        ]
      );

      const orderId = orderResult.lastID;

      for (const pi of processedItems) {
        // Insert order item
        await dbQuery.run(
          `INSERT INTO order_items 
           (order_id, product_id, product_name, qty, price_tier, cost_price, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderId, pi.product_id, pi.product_name, pi.qty, pi.price_tier, pi.cost_price, pi.unit_price, pi.subtotal]
        );

        // Deduct inventory stock
        await dbQuery.run(
          'UPDATE products SET stock_qty = ROUND(MAX(0, stock_qty - ?), 2) WHERE id = ?',
          [pi.qty, pi.product_id]
        );
      }

      // Record in customer_debts if tempo
      if (payment_method === 'tempo') {
        const dpAmount = finalCashTendered > 0 ? Math.min(finalCashTendered, finalPayableTotal) : 0;
        const remaining = finalPayableTotal - dpAmount;
        const debtStatus = remaining <= 0 ? 'paid' : (dpAmount > 0 ? 'partial' : 'unpaid');

        const debtRes = await dbQuery.run(
          `INSERT INTO customer_debts
           (order_id, customer_id, total_amount, paid_amount, remaining_amount, due_date, status, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
          [
            orderId,
            customer.id,
            finalPayableTotal,
            dpAmount,
            remaining,
            finalDueDate,
            debtStatus,
            `Kasbon nota ${orderNo} - ${customer.name} (HP: ${customer.phone || '-'})`
          ]
        );

        if (dpAmount > 0) {
          await dbQuery.run(
            `INSERT INTO debt_payments
             (debt_id, customer_id, shift_id, amount_paid, payment_method, recorded_by, notes, payment_date)
             VALUES (?, ?, ?, ?, 'cash', ?, 'Uang Muka (DP) saat kasir', datetime('now', 'localtime'))`,
            [debtRes.lastID, customer.id, shift_id, dpAmount, req.user.id]
          );
        }
      }

      await dbQuery.exec('COMMIT;');

      await logAudit(req.user.id, 'ORDER_CREATED', {
        order_id: orderId,
        order_no: orderNo,
        subtotal: calculatedSubtotal,
        manual_override: manualTotalOverride,
        rotten_refund: rottenRefundAmount,
        discount: discountAmount,
        total: finalPayableTotal,
        payment_method,
        item_count: processedItems.length
      });

      const savedOrder = await dbQuery.get(
        `SELECT o.*, u.name as cashier_name
         FROM orders o
         JOIN shifts s ON o.shift_id = s.id
         JOIN users u ON s.cashier_id = u.id
         WHERE o.id = ?`,
        [orderId]
      );

      return res.status(201).json({
        success: true,
        message: 'Transaksi berhasil disimpan',
        order: {
          ...(savedOrder || {
            id: orderId,
            order_no: orderNo,
            shift_id,
            customer_name: customer ? customer.name : 'Pelanggan Umum',
            subtotal_amount: calculatedSubtotal,
            manual_total_override: manualTotalOverride,
            discount_amount: discountAmount,
            discount_notes: discountNotes,
            rotten_refund_amount: rottenRefundAmount,
            rotten_refund_notes: rottenRefundNotes,
            total_amount: finalPayableTotal,
            payment_method,
            cash_tendered: payment_method === 'cash' ? finalCashTendered : finalPayableTotal,
            change_due: changeDue
          }),
          items: processedItems
        }
      });
    } catch (txErr) {
      await dbQuery.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    console.error('Error creating order:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders
// List orders with filter
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { shift_id, status, limit = 100 } = req.query;
    let sql = `
      SELECT o.*, u.name as cashier_name
      FROM orders o
      JOIN shifts s ON o.shift_id = s.id
      JOIN users u ON s.cashier_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (shift_id) {
      sql += ' AND o.shift_id = ?';
      params.push(shift_id);
    }
    if (status) {
      sql += ' AND o.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY o.id DESC LIMIT ?';
    params.push(Number(limit));

    const orders = await dbQuery.all(sql, params);
    return res.json({ success: true, orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/:id
// Get order detail with items
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const order = await dbQuery.get(
      `SELECT o.*, u.name as cashier_name
       FROM orders o
       JOIN shifts s ON o.shift_id = s.id
       JOIN users u ON s.cashier_id = u.id
       WHERE o.id = ?`,
      [req.params.id]
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    const items = await dbQuery.all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    return res.json({ success: true, order: { ...order, items } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/orders/:id/void
// Strict Void with Owner PIN authorization & Stock Reversal
router.post('/:id/void', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { owner_pin, void_reason } = req.body;

    if (!owner_pin || !void_reason) {
      return res.status(400).json({
        success: false,
        message: 'PIN Owner dan alasan pembatalan wajib diisi'
      });
    }

    // Verify Owner PIN
    const owners = await dbQuery.all('SELECT * FROM users WHERE role = "owner" AND is_active = 1');
    let authorizedOwner = null;

    for (const owner of owners) {
      const isMatch = await bcrypt.compare(owner_pin, owner.pin_code);
      if (isMatch) {
        authorizedOwner = owner;
        break;
      }
    }

    if (!authorizedOwner) {
      await logAudit(req.user.id, 'VOID_ATTEMPT_DENIED_INVALID_PIN', { order_id: id });
      return res.status(403).json({ success: false, message: 'Otorisasi gagal: PIN Owner salah' });
    }

    const order = await dbQuery.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    if (order.status === 'void') {
      return res.status(400).json({ success: false, message: 'Transaksi ini sudah pernah dibatalkan' });
    }

    // Begin Transaction to Void and Restore Stock
    await dbQuery.exec('BEGIN IMMEDIATE;');

    try {
      const items = await dbQuery.all('SELECT * FROM order_items WHERE order_id = ?', [id]);

      // Restore stock for each item
      for (const item of items) {
        await dbQuery.run(
          'UPDATE products SET stock_qty = ROUND(stock_qty + ?, 2) WHERE id = ?',
          [item.qty, item.product_id]
        );
      }

      // Mark order as void
      await dbQuery.run(
        `UPDATE orders
         SET status = 'void',
             void_reason = ?,
             void_approved_by = ?,
             void_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [void_reason, authorizedOwner.id, id]
      );

      // Cancel associated customer debt if any
      await dbQuery.run(
        `UPDATE customer_debts
         SET remaining_amount = 0,
             status = 'paid',
             notes = notes || ' [NOTA DIBATALKAN/VOID]'
         WHERE order_id = ?`,
        [id]
      );

      await dbQuery.exec('COMMIT;');

      await logAudit(req.user.id, 'ORDER_VOIDED', {
        order_id: id,
        order_no: order.order_no,
        total_amount: order.total_amount,
        approved_by: authorizedOwner.name,
        void_reason
      });

      return res.json({
        success: true,
        message: `Transaksi ${order.order_no} berhasil dibatalkan dan stok dikembalikan`,
        voided_by: authorizedOwner.name
      });
    } catch (txErr) {
      await dbQuery.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
