const express = require('express');
const router = express.Router();
const { dbQuery } = require('../db');
const { authenticateToken, requireOwner, logAudit } = require('../middleware/auth');

// GET /api/debts
// List all customer debts with KPI summary
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, customer_id, search } = req.query;

    let sql = `
      SELECT 
        d.*,
        o.order_no,
        o.created_at as order_date,
        c.name as customer_name,
        c.phone as customer_phone,
        c.tier as customer_tier,
        c.address as customer_address,
        CASE 
          WHEN date(d.due_date) < date('now', 'localtime') AND d.remaining_amount > 0 THEN 1 
          ELSE 0 
        END as is_overdue
      FROM customer_debts d
      JOIN orders o ON d.order_id = o.id
      JOIN customers c ON d.customer_id = c.id
      WHERE o.status != 'void'
    `;
    const params = [];

    if (customer_id) {
      sql += ' AND d.customer_id = ?';
      params.push(customer_id);
    }

    if (status && status !== 'all') {
      if (status === 'overdue') {
        sql += " AND date(d.due_date) < date('now', 'localtime') AND d.remaining_amount > 0";
      } else if (status === 'unpaid') {
        sql += " AND d.remaining_amount > 0";
      } else {
        sql += ' AND d.status = ?';
        params.push(status);
      }
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR o.order_no LIKE ?)';
      params.push(q, q, q);
    }

    sql += ' ORDER BY d.remaining_amount DESC, d.due_date ASC, d.id DESC';

    const debts = await dbQuery.all(sql, params);

    // Summary KPIs
    const summary = await dbQuery.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN d.remaining_amount > 0 THEN d.remaining_amount ELSE 0 END), 0) as total_outstanding,
        COALESCE(SUM(CASE WHEN date(d.due_date) < date('now', 'localtime') AND d.remaining_amount > 0 THEN d.remaining_amount ELSE 0 END), 0) as total_overdue,
        COALESCE(SUM(d.paid_amount), 0) as total_paid,
        COALESCE(COUNT(DISTINCT CASE WHEN d.remaining_amount > 0 THEN d.customer_id END), 0) as total_debtors,
        COALESCE(COUNT(d.id), 0) as total_records
      FROM customer_debts d
      JOIN orders o ON d.order_id = o.id
      WHERE o.status != 'void'
    `);

    return res.json({
      success: true,
      summary: {
        total_outstanding: summary.total_outstanding || 0,
        total_overdue: summary.total_overdue || 0,
        total_paid: summary.total_paid || 0,
        total_debtors: summary.total_debtors || 0,
        total_records: summary.total_records || 0
      },
      debts
    });
  } catch (err) {
    console.error('Error fetching debts:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/debts/:id
// Get single debt detail with payment history
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const debt = await dbQuery.get(
      `SELECT 
        d.*,
        o.order_no,
        o.created_at as order_date,
        c.name as customer_name,
        c.phone as customer_phone,
        c.tier as customer_tier,
        c.address as customer_address,
        CASE 
          WHEN date(d.due_date) < date('now', 'localtime') AND d.remaining_amount > 0 THEN 1 
          ELSE 0 
        END as is_overdue
      FROM customer_debts d
      JOIN orders o ON d.order_id = o.id
      JOIN customers c ON d.customer_id = c.id
      WHERE d.id = ?`,
      [req.params.id]
    );

    if (!debt) {
      return res.status(404).json({ success: false, message: 'Data piutang tidak ditemukan' });
    }

    // Payment history
    const payments = await dbQuery.all(
      `SELECT p.*, u.name as recorded_by_name
       FROM debt_payments p
       JOIN users u ON p.recorded_by = u.id
       WHERE p.debt_id = ?
       ORDER BY p.id DESC`,
      [debt.id]
    );

    // Items from order
    const items = await dbQuery.all(
      'SELECT * FROM order_items WHERE order_id = ?',
      [debt.order_id]
    );

    return res.json({
      success: true,
      debt: {
        ...debt,
        payments,
        items
      }
    });
  } catch (err) {
    console.error('Error fetching debt detail:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/debts/:id/pay
// Record installment or full payoff for a customer debt
router.post('/:id/pay', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount_paid, payment_method = 'cash', notes } = req.body;

    const amount = Number(amount_paid);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Nominal pembayaran tidak valid (harus lebih dari Rp 0)'
      });
    }

    if (!['cash', 'transfer', 'qris'].includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: 'Metode pembayaran harus berupa cash, transfer, atau qris'
      });
    }

    const debt = await dbQuery.get(
      `SELECT d.*, c.name as customer_name, o.order_no
       FROM customer_debts d
       JOIN customers c ON d.customer_id = c.id
       JOIN orders o ON d.order_id = o.id
       WHERE d.id = ?`,
      [id]
    );

    if (!debt) {
      return res.status(404).json({ success: false, message: 'Data piutang tidak ditemukan' });
    }

    if (debt.remaining_amount <= 0) {
      return res.status(400).json({ success: false, message: 'Piutang ini sudah lunas sebelumnya' });
    }

    if (amount > debt.remaining_amount) {
      return res.status(400).json({
        success: false,
        message: `Nominal melebihi sisa hutang. Sisa hutang: Rp ${debt.remaining_amount.toLocaleString('id-ID')}`
      });
    }

    // Check active shift if cash payment is made
    let activeShiftId = null;
    const activeShift = await dbQuery.get('SELECT id FROM shifts WHERE status = "open" ORDER BY id DESC LIMIT 1');
    if (activeShift) {
      activeShiftId = activeShift.id;
    }

    await dbQuery.exec('BEGIN IMMEDIATE;');

    try {
      // 1. Insert payment record
      const payRes = await dbQuery.run(
        `INSERT INTO debt_payments
         (debt_id, customer_id, shift_id, amount_paid, payment_method, recorded_by, notes, payment_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
        [
          debt.id,
          debt.customer_id,
          activeShiftId,
          amount,
          payment_method,
          req.user.id,
          notes || (amount === debt.remaining_amount ? 'Pelunasan piutang' : 'Cicilan piutang')
        ]
      );

      // 2. Update debt record
      const newPaid = Number(debt.paid_amount) + amount;
      const newRemaining = Number(debt.remaining_amount) - amount;
      const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

      await dbQuery.run(
        `UPDATE customer_debts
         SET paid_amount = ?,
             remaining_amount = ?,
             status = ?,
             updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [newPaid, newRemaining, newStatus, debt.id]
      );

      await dbQuery.exec('COMMIT;');

      await logAudit(req.user.id, 'DEBT_PAYMENT_COLLECTED', {
        debt_id: debt.id,
        order_no: debt.order_no,
        customer_name: debt.customer_name,
        amount_paid: amount,
        payment_method,
        remaining_after: newRemaining,
        status: newStatus
      });

      return res.json({
        success: true,
        message: newRemaining <= 0
          ? `Piutang ${debt.customer_name} sebesar Rp ${amount.toLocaleString('id-ID')} telah LUNAS!`
          : `Pembayaran cicilan Rp ${amount.toLocaleString('id-ID')} berhasil dicatat. Sisa hutang: Rp ${newRemaining.toLocaleString('id-ID')}`,
        payment: {
          id: payRes.lastID,
          amount_paid: amount,
          payment_method,
          new_paid: newPaid,
          new_remaining: newRemaining,
          status: newStatus
        }
      });
    } catch (txErr) {
      await dbQuery.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    console.error('Error processing debt payment:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/debts/:id
// Update debt details (due_date, remaining_amount, notes, customer_name, customer_phone)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, customer_phone, due_date, remaining_amount, notes } = req.body;

    const debt = await dbQuery.get(
      `SELECT d.*, c.name as customer_name, c.phone as customer_phone, o.order_no
       FROM customer_debts d
       JOIN customers c ON d.customer_id = c.id
       JOIN orders o ON d.order_id = o.id
       WHERE d.id = ?`,
      [id]
    );

    if (!debt) {
      return res.status(404).json({ success: false, message: 'Data piutang tidak ditemukan' });
    }

    // 1. Update customer profile if name or phone provided
    if (customer_name || customer_phone !== undefined) {
      await dbQuery.run(
        `UPDATE customers
         SET name = COALESCE(?, name),
             phone = COALESCE(?, phone)
         WHERE id = ?`,
        [customer_name ? customer_name.trim() : null, customer_phone !== undefined ? customer_phone.trim() : null, debt.customer_id]
      );
      if (customer_name) {
        await dbQuery.run(
          'UPDATE orders SET customer_name = ? WHERE id = ?',
          [customer_name.trim(), debt.order_id]
        );
      }
    }

    // 2. Update debt fields
    let newRemaining = debt.remaining_amount;
    let newStatus = debt.status;
    if (remaining_amount !== undefined && remaining_amount !== null && !isNaN(Number(remaining_amount))) {
      const parsedAmount = Math.max(0, Number(remaining_amount));
      if (parsedAmount !== Number(debt.remaining_amount) && req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Akses ditolak: Hanya Owner yang berwenang mengubah sisa nominal piutang secara manual. Untuk pelunasan kasir, gunakan menu Bayar Cicilan.'
        });
      }
      newRemaining = parsedAmount;
      if (newRemaining <= 0) {
        newStatus = 'paid';
      } else if (debt.paid_amount > 0) {
        newStatus = 'partial';
      } else {
        newStatus = 'unpaid';
      }
    }

    const finalDueDate = due_date || debt.due_date;
    const finalNotes = notes !== undefined ? notes : debt.notes;

    await dbQuery.run(
      `UPDATE customer_debts
       SET due_date = ?,
           remaining_amount = ?,
           status = ?,
           notes = ?,
           updated_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [finalDueDate, newRemaining, newStatus, finalNotes, id]
    );

    await logAudit(req.user.id, 'DEBT_UPDATED', {
      debt_id: id,
      order_no: debt.order_no,
      old: {
        customer_name: debt.customer_name,
        customer_phone: debt.customer_phone,
        due_date: debt.due_date,
        remaining_amount: debt.remaining_amount,
        notes: debt.notes
      },
      new: {
        customer_name: customer_name || debt.customer_name,
        customer_phone: customer_phone !== undefined ? customer_phone : debt.customer_phone,
        due_date: finalDueDate,
        remaining_amount: newRemaining,
        notes: finalNotes
      }
    });

    const updatedDebt = await dbQuery.get(
      `SELECT d.*, c.name as customer_name, c.phone as customer_phone, o.order_no
       FROM customer_debts d
       JOIN customers c ON d.customer_id = c.id
       JOIN orders o ON d.order_id = o.id
       WHERE d.id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: 'Data piutang dan kontak pembeli berhasil diperbarui',
      debt: updatedDebt
    });
  } catch (err) {
    console.error('Error updating debt:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

