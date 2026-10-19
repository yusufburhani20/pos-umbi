const express = require('express');
const router = express.Router();
const { dbQuery } = require('../db');
const { authenticateToken, requireOwner, logAudit } = require('../middleware/auth');

// GET /api/shifts/current
// Check active open shift
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const shift = await dbQuery.get(
      `SELECT s.id, s.cashier_id, u.name as cashier_name, s.start_time, s.starting_cash, s.status
       FROM shifts s
       JOIN users u ON s.cashier_id = u.id
       WHERE s.status = 'open'
       ORDER BY s.id DESC LIMIT 1`
    );

    if (!shift) {
      return res.json({ success: true, has_active_shift: false, shift: null });
    }

    // Calculate current live cash in drawer for active shift
    const cashSalesRow = await dbQuery.get(
      `SELECT COALESCE(SUM(total_amount), 0) as cash_sales
       FROM orders
       WHERE shift_id = ? AND payment_method = 'cash' AND status = 'completed'`,
      [shift.id]
    );

    const expensesRow = await dbQuery.get(
      `SELECT 
         COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'cash' THEN amount ELSE 0 END), 0) as cash_expenses,
         COALESCE(SUM(CASE WHEN type = 'income' AND source = 'cash' THEN amount ELSE 0 END), 0) as cash_income
       FROM store_expenses
       WHERE shift_id = ?`,
      [shift.id]
    );

    const supplierCashRow = await dbQuery.get(
      `SELECT COALESCE(SUM(amount_paid), 0) as cash_supplier_payments
       FROM supplier_payments
       WHERE payment_method = 'cash' AND payment_date >= ?`,
      [shift.start_time]
    );

    const debtCashRow = await dbQuery.get(
      `SELECT COALESCE(SUM(amount_paid), 0) as cash_debt_collected
       FROM debt_payments
       WHERE (shift_id = ? OR (payment_date >= ? AND shift_id IS NULL)) AND payment_method = 'cash'`,
      [shift.id, shift.start_time]
    );

    const cashSales = cashSalesRow.cash_sales || 0;
    const cashExpenses = expensesRow.cash_expenses || 0;
    const cashIncome = expensesRow.cash_income || 0;
    const cashSupplier = supplierCashRow.cash_supplier_payments || 0;
    const cashDebt = debtCashRow.cash_debt_collected || 0;

    const currentDrawerCash = Number(shift.starting_cash) + Number(cashSales) + Number(cashIncome) + Number(cashDebt) - Number(cashExpenses) - Number(cashSupplier);

    return res.json({
      success: true,
      has_active_shift: true,
      shift: {
        ...shift,
        cash_sales: cashSales,
        cash_expenses: cashExpenses,
        cash_income: cashIncome,
        cash_debt_collected: cashDebt,
        cash_supplier_payments: cashSupplier,
        current_drawer_cash: currentDrawerCash
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/shifts/open
// Open new shift with initial cash float
router.post('/open', authenticateToken, async (req, res) => {
  try {
    const { starting_cash } = req.body;

    if (starting_cash === undefined || starting_cash === null || starting_cash < 0) {
      return res.status(400).json({ success: false, message: 'Modal awal laci (starting cash) wajib diisi' });
    }

    // Check if there is already an open shift
    const existing = await dbQuery.get("SELECT id FROM shifts WHERE status = 'open'");
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Sudah ada shift yang masih aktif. Silakan tutup shift sebelumnya terlebih dahulu.'
      });
    }

    const result = await dbQuery.run(
      `INSERT INTO shifts (cashier_id, start_time, starting_cash, status)
       VALUES (?, datetime('now', 'localtime'), ?, 'open')`,
      [req.user.id, starting_cash]
    );

    await logAudit(req.user.id, 'SHIFT_OPENED', {
      shift_id: result.lastID,
      starting_cash
    });

    const newShift = await dbQuery.get(
      `SELECT s.id, s.cashier_id, u.name as cashier_name, s.start_time, s.starting_cash, s.status
       FROM shifts s
       JOIN users u ON s.cashier_id = u.id
       WHERE s.id = ?`,
      [result.lastID]
    );

    return res.json({
      success: true,
      message: 'Shift kasir berhasil dibuka',
      shift: newShift
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/shifts/close
// BLIND CLOSE SHIFT: Cashier submits physically counted cash.
router.post('/close', authenticateToken, async (req, res) => {
  try {
    const { shift_id, actual_cash, breakdown, closing_notes } = req.body;

    if (!shift_id) {
      return res.status(400).json({ success: false, message: 'Shift ID wajib disertakan' });
    }

    if (actual_cash === undefined || actual_cash === null || actual_cash < 0) {
      return res.status(400).json({ success: false, message: 'Total fisik uang kas wajib diisi' });
    }

    const shift = await dbQuery.get('SELECT * FROM shifts WHERE id = ? AND status = "open"', [shift_id]);
    if (!shift) {
      return res.status(404).json({ success: false, message: 'Shift aktif tidak ditemukan atau sudah ditutup' });
    }

    // Calculate system cash from completed cash orders in this shift
    const cashSalesRow = await dbQuery.get(
      `SELECT COALESCE(SUM(total_amount), 0) as total_cash_sales
       FROM orders
       WHERE shift_id = ? AND payment_method = 'cash' AND status = 'completed'`,
      [shift_id]
    );

    const nonCashSalesRow = await dbQuery.get(
      `SELECT 
         COALESCE(SUM(CASE WHEN payment_method = 'qris' THEN total_amount ELSE 0 END), 0) as total_qris,
         COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total_amount ELSE 0 END), 0) as total_transfer
       FROM orders
       WHERE shift_id = ? AND status = 'completed'`,
      [shift_id]
    );

    // Cash expenses & cash income in this shift
    const cashExpensesRow = await dbQuery.get(
      `SELECT 
         COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'cash' THEN amount ELSE 0 END), 0) as total_cash_expenses,
         COALESCE(SUM(CASE WHEN type = 'income' AND source = 'cash' THEN amount ELSE 0 END), 0) as total_cash_income
       FROM store_expenses
       WHERE shift_id = ?`,
      [shift_id]
    );

    // Cash paid to suppliers during this shift
    const cashSupplierPaymentsRow = await dbQuery.get(
      `SELECT COALESCE(SUM(amount_paid), 0) as total_cash_supplier
       FROM supplier_payments
       WHERE payment_method = 'cash' AND payment_date >= ?`,
      [shift.start_time]
    );

    const debtCashRow = await dbQuery.get(
      `SELECT COALESCE(SUM(amount_paid), 0) as total_cash_debt
       FROM debt_payments
       WHERE (shift_id = ? OR (payment_date >= ? AND shift_id IS NULL)) AND payment_method = 'cash'`,
      [shift_id, shift.start_time]
    );

    const totalCashSales = cashSalesRow.total_cash_sales || 0;
    const totalCashExpenses = cashExpensesRow.total_cash_expenses || 0;
    const totalCashIncome = cashExpensesRow.total_cash_income || 0;
    const totalCashSupplierPaid = cashSupplierPaymentsRow.total_cash_supplier || 0;
    const totalCashDebtCollected = debtCashRow.total_cash_debt || 0;

    const expectedSystemCash = Number(shift.starting_cash) 
      + Number(totalCashSales) 
      + Number(totalCashIncome) 
      + Number(totalCashDebtCollected)
      - Number(totalCashExpenses) 
      - Number(totalCashSupplierPaid);

    const cashDifference = Number(actual_cash) - Number(expectedSystemCash);

    // Save notes with breakdown if provided
    let finalNotes = closing_notes || '';
    if (breakdown) {
      finalNotes = `Breakdown: ${JSON.stringify(breakdown)}. ${finalNotes}`;
    }

    await dbQuery.run(
      `UPDATE shifts
       SET end_time = datetime('now', 'localtime'),
           system_cash = ?,
           actual_cash = ?,
           cash_difference = ?,
           status = 'closed',
           closing_notes = ?
       WHERE id = ?`,
      [expectedSystemCash, actual_cash, cashDifference, finalNotes, shift_id]
    );

    const auditAction = cashDifference === 0 
      ? 'SHIFT_CLOSED_BALANCED' 
      : (cashDifference < 0 ? 'SHIFT_CLOSED_SHORTAGE' : 'SHIFT_CLOSED_SURPLUS');

    await logAudit(req.user.id, auditAction, {
      shift_id,
      starting_cash: shift.starting_cash,
      total_cash_sales: totalCashSales,
      total_cash_expenses: totalCashExpenses,
      total_cash_income: totalCashIncome,
      total_cash_supplier_paid: totalCashSupplierPaid,
      expected: expectedSystemCash,
      actual: actual_cash,
      difference: cashDifference
    });

    return res.json({
      success: true,
      message: 'Shift berhasil ditutup',
      summary: {
        shift_id,
        starting_cash: shift.starting_cash,
        total_cash_sales: totalCashSales,
        total_cash_expenses: totalCashExpenses,
        total_cash_income: totalCashIncome,
        total_cash_supplier_paid: totalCashSupplierPaid,
        total_qris: nonCashSalesRow.total_qris,
        total_transfer: nonCashSalesRow.total_transfer,
        expected_system_cash: expectedSystemCash,
        actual_cash_input: actual_cash,
        cash_difference: cashDifference,
        is_balanced: cashDifference === 0
      }
    });
  } catch (err) {
    console.error('Error closing shift:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/shifts/history
// List shift history (Accessible to Owner or Cashier for their records)
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const shifts = await dbQuery.all(
      `SELECT s.*, u.name as cashier_name
       FROM shifts s
       JOIN users u ON s.cashier_id = u.id
       ORDER BY s.id DESC LIMIT ?`,
      [Number(limit)]
    );
    return res.json({ success: true, shifts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
