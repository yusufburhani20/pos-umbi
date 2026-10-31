const express = require('express');
const router = express.Router();
const { dbQuery } = require('../db');
const { authenticateToken, requireOwner, logAudit, JWT_SECRET } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

// Lenient token verification for current shift so UI never fails/closes on transient auth checks
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err && user) req.user = user;
    next();
  });
}

// GET /api/shifts/current
// Check active open shift
router.get('/current', optionalAuth, async (req, res) => {
  try {
    const shift = await dbQuery.get(
      `SELECT s.id, s.cashier_id, COALESCE(u.name, 'Kasir Bertugas') as cashier_name, s.start_time, s.starting_cash, s.status
       FROM shifts s
       LEFT JOIN users u ON s.cashier_id = u.id
       WHERE s.status = 'open'
       ORDER BY s.id DESC LIMIT 1`
    );

    if (!shift) {
      return res.json({ success: true, has_active_shift: false, shift: null });
    }

    // Calculate current live sales & transactions for active shift
    const ordersStatsRow = await dbQuery.get(
      `SELECT 
         COUNT(id) as total_orders,
         COALESCE(SUM(CASE WHEN payment_method = 'cash' AND status = 'completed' THEN total_amount ELSE 0 END), 0) as cash_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'qris' AND status = 'completed' THEN total_amount ELSE 0 END), 0) as qris_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'transfer' AND status = 'completed' THEN total_amount ELSE 0 END), 0) as transfer_sales,
         COALESCE(SUM(CASE WHEN (payment_method = 'tempo' OR status = 'tempo') THEN total_amount ELSE 0 END), 0) as tempo_sales,
         COALESCE(SUM(CASE WHEN status != 'void' THEN total_amount ELSE 0 END), 0) as total_omset
       FROM orders
       WHERE shift_id = ?`,
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
       WHERE payment_method = 'cash' AND (shift_id = ? OR (shift_id IS NULL AND payment_date >= ?))`,
      [shift.id, shift.start_time]
    );

    const debtCashRow = await dbQuery.get(
      `SELECT COALESCE(SUM(amount_paid), 0) as cash_debt_collected
       FROM debt_payments
       WHERE (shift_id = ? OR (payment_date >= ? AND shift_id IS NULL)) AND payment_method = 'cash'`,
      [shift.id, shift.start_time]
    );

    const safeTransferRow = await dbQuery.get(
      `SELECT 
         COALESCE(SUM(CASE WHEN type = 'deposit' AND source = 'drawer' THEN amount ELSE 0 END), 0) as cash_deposited_to_safe,
         COALESCE(SUM(CASE WHEN type = 'withdrawal' AND source = 'drawer' AND (reference_no IS NULL OR reference_no NOT LIKE 'EXP-%') THEN amount ELSE 0 END), 0) as cash_withdrawn_from_safe
       FROM safe_cash_transactions
       WHERE shift_id = ? OR (shift_id IS NULL AND created_at >= ?)`,
      [shift.id, shift.start_time]
    );

    // Recent cash expenses for cashier dashboard
    const recentExpenses = await dbQuery.all(
      `SELECT id, expense_no, category, category_name, type, amount, source, fund_source, notes, created_at
       FROM store_expenses
       WHERE shift_id = ? AND source = 'cash'
       ORDER BY id DESC LIMIT 50`,
      [shift.id]
    );

    // Recent supplier payments paid with cash in this shift
    const recentSupplierPayments = await dbQuery.all(
      `SELECT sp.id, sp.amount_paid, sp.payment_method, sp.payment_date, sp.notes,
              COALESCE(s.name, 'Pemasok Umum') as supplier_name,
              p.purchase_no,
              pr.name as product_name,
              p.qty_kg,
              p.cost_price
       FROM supplier_payments sp
       LEFT JOIN suppliers s ON sp.supplier_id = s.id
       LEFT JOIN purchases p ON sp.purchase_id = p.id
       LEFT JOIN products pr ON p.product_id = pr.id
       WHERE sp.payment_method = 'cash' AND (sp.shift_id = ? OR (sp.shift_id IS NULL AND sp.payment_date >= ?))
       ORDER BY sp.id DESC`,
      [shift.id, shift.start_time]
    );

    const cashSales = ordersStatsRow.cash_sales || 0;
    const qrisSales = ordersStatsRow.qris_sales || 0;
    const transferSales = ordersStatsRow.transfer_sales || 0;
    const tempoSales = ordersStatsRow.tempo_sales || 0;
    const totalOmset = ordersStatsRow.total_omset || 0;
    const totalOrders = ordersStatsRow.total_orders || 0;

    const cashExpenses = expensesRow.cash_expenses || 0;
    const cashIncome = expensesRow.cash_income || 0;
    const cashSupplier = supplierCashRow.cash_supplier_payments || 0;
    const cashDebt = debtCashRow.cash_debt_collected || 0;
    const cashDepositedToSafe = Number(safeTransferRow ? safeTransferRow.cash_deposited_to_safe : 0) || 0;
    const cashWithdrawnFromSafe = Number(safeTransferRow ? safeTransferRow.cash_withdrawn_from_safe : 0) || 0;

    const currentDrawerCash = Number(shift.starting_cash) 
      + Number(cashSales) 
      + Number(cashIncome) 
      + Number(cashDebt) 
      + Number(cashWithdrawnFromSafe)
      - Number(cashExpenses) 
      - Number(cashSupplier)
      - Number(cashDepositedToSafe);

    // Product / commodity sales breakdown in this shift
    const commoditySales = await dbQuery.all(
      `SELECT 
         oi.product_id,
         oi.product_name,
         COALESCE(p.unit, 'kg') as unit,
         COALESCE(SUM(oi.qty), 0) as total_qty,
         COALESCE(SUM(oi.subtotal), 0) as total_sales,
         COUNT(DISTINCT oi.order_id) as total_transactions
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.shift_id = ? AND o.status = 'completed'
       GROUP BY oi.product_id, oi.product_name
       ORDER BY total_sales DESC`,
      [shift.id]
    );

    return res.json({
      success: true,
      has_active_shift: true,
      shift: {
        ...shift,
        total_orders: totalOrders,
        total_omset: totalOmset,
        cash_sales: cashSales,
        qris_sales: qrisSales,
        transfer_sales: transferSales,
        tempo_sales: tempoSales,
        cash_expenses: cashExpenses,
        cash_income: cashIncome,
        cash_debt_collected: cashDebt,
        cash_supplier_payments: cashSupplier,
        current_drawer_cash: currentDrawerCash,
        commodity_sales: commoditySales || [],
        recent_expenses: recentExpenses || [],
        supplier_payments: recentSupplierPayments || []
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

    const numActualCash = Number(actual_cash);
    if (actual_cash === undefined || actual_cash === null || isNaN(numActualCash) || numActualCash < 0) {
      return res.status(400).json({ success: false, message: 'Total fisik uang kas wajib diisi' });
    }

    const shift = await dbQuery.get('SELECT * FROM shifts WHERE id = ? AND status = "open"', [shift_id]);
    if (!shift) {
      return res.status(404).json({ success: false, message: 'Shift aktif tidak ditemukan atau sudah ditutup' });
    }

    // Calculate full shift sales & transactions
    const ordersStatsRow = await dbQuery.get(
      `SELECT 
         COUNT(id) as total_orders,
         COALESCE(SUM(CASE WHEN payment_method = 'cash' AND status = 'completed' THEN total_amount ELSE 0 END), 0) as total_cash_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'qris' AND status = 'completed' THEN total_amount ELSE 0 END), 0) as total_qris,
         COALESCE(SUM(CASE WHEN payment_method = 'transfer' AND status = 'completed' THEN total_amount ELSE 0 END), 0) as total_transfer,
         COALESCE(SUM(CASE WHEN (payment_method = 'tempo' OR status = 'tempo') THEN total_amount ELSE 0 END), 0) as total_tempo,
         COALESCE(SUM(CASE WHEN status != 'void' THEN total_amount ELSE 0 END), 0) as total_omset
       FROM orders
       WHERE shift_id = ?`,
      [shift_id]
    );

    // Validasi ketat: Kunci penutupan jika kasir menginput uang fisik Rp 0 padahal ada pergerakan kas laci
    const hasCashMovement = Number(shift.starting_cash) > 0 || (ordersStatsRow && Number(ordersStatsRow.total_cash_sales) > 0);
    if (numActualCash === 0 && hasCashMovement) {
      return res.status(400).json({
        success: false,
        code: 'PHYSICAL_CASH_REQUIRED',
        message: 'DILARANG TUTUP KASIR DENGAN FISIK RP 0! Kasir wajib menghitung dan mengisi pecahan lembaran uang riil di laci kasir sebelum shift dapat ditutup.'
      });
    }

    // Validasi batas wajar jumlah lembar uang fisik (Sanity Check Backend)
    // Maksimal 2.000 lembar per pecahan (misal 2.000 x 100.000 = Rp 200.000.000 di satu laci kasir)
    if (breakdown && typeof breakdown === 'object') {
      const billLimits = [
        { key: 'd100k', mult: 100000, name: 'Rp 100.000' },
        { key: 'd75k',  mult: 75000,  name: 'Rp 75.000' },
        { key: 'd50k',  mult: 50000,  name: 'Rp 50.000' },
        { key: 'd20k',  mult: 20000,  name: 'Rp 20.000' },
        { key: 'd10k',  mult: 10000,  name: 'Rp 10.000' },
        { key: 'd5k',   mult: 5000,   name: 'Rp 5.000' },
        { key: 'd2k',   mult: 2000,   name: 'Rp 2.000' },
        { key: 'd1k',   mult: 1000,   name: 'Rp 1.000' }
      ];

      for (const item of billLimits) {
        const amount = Number(breakdown[item.key]) || 0;
        const sheets = Math.round(amount / item.mult);
        if (sheets > 2000) {
          return res.status(400).json({
            success: false,
            code: 'UNREALISTIC_DENOMINATION_COUNT',
            message: `Jumlah lembar pecahan ${item.name} tidak wajar (${sheets.toLocaleString('id-ID')} lembar). Masukkan JUMLAH LEMBAR, bukan nominal rupiah!`
          });
        }
      }
    }

    // Batas wajar total kas laci: Maksimal Rp 250.000.000 per shift laci kios
    if (numActualCash > 250000000) {
      return res.status(400).json({
        success: false,
        code: 'UNREALISTIC_CASH_TOTAL',
        message: `Total fisik uang kas laci (Rp ${numActualCash.toLocaleString('id-ID')}) melebihi batas wajar laci kasir (maks Rp 250.000.000). Harap periksa kembali input lembaran uang fisik!`
      });
    }

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
       WHERE payment_method = 'cash' AND (shift_id = ? OR (shift_id IS NULL AND payment_date >= ?))`,
      [shift_id, shift.start_time]
    );

    const debtCashRow = await dbQuery.get(
      `SELECT COALESCE(SUM(amount_paid), 0) as total_cash_debt
       FROM debt_payments
       WHERE (shift_id = ? OR (payment_date >= ? AND shift_id IS NULL)) AND payment_method = 'cash'`,
      [shift_id, shift.start_time]
    );

    const safeTransferRow = await dbQuery.get(
      `SELECT 
         COALESCE(SUM(CASE WHEN type = 'deposit' AND source = 'drawer' THEN amount ELSE 0 END), 0) as cash_deposited_to_safe,
         COALESCE(SUM(CASE WHEN type = 'withdrawal' AND source = 'drawer' AND (reference_no IS NULL OR reference_no NOT LIKE 'EXP-%') THEN amount ELSE 0 END), 0) as cash_withdrawn_from_safe
       FROM safe_cash_transactions
       WHERE shift_id = ? OR (shift_id IS NULL AND created_at >= ?)`,
      [shift_id, shift.start_time]
    );

    const totalCashSales = ordersStatsRow.total_cash_sales || 0;
    const totalCashExpenses = cashExpensesRow.total_cash_expenses || 0;
    const totalCashIncome = cashExpensesRow.total_cash_income || 0;
    const totalCashSupplierPaid = cashSupplierPaymentsRow.total_cash_supplier || 0;
    const totalCashDebtCollected = debtCashRow.total_cash_debt || 0;
    const cashDepositedToSafe = Number(safeTransferRow ? safeTransferRow.cash_deposited_to_safe : 0) || 0;
    const cashWithdrawnFromSafe = Number(safeTransferRow ? safeTransferRow.cash_withdrawn_from_safe : 0) || 0;

    const expectedSystemCash = Number(shift.starting_cash) 
      + Number(totalCashSales) 
      + Number(totalCashIncome) 
      + Number(totalCashDebtCollected)
      + Number(cashWithdrawnFromSafe)
      - Number(totalCashExpenses) 
      - Number(totalCashSupplierPaid)
      - Number(cashDepositedToSafe);

    const cashDifference = Number(actual_cash) - Number(expectedSystemCash);

    // Clean notes - do NOT pollute closing_notes with raw JSON breakdown string!
    let cleanNotes = closing_notes ? String(closing_notes).trim() : '';
    cleanNotes = cleanNotes.replace(/^Breakdown\s*:\s*\{[\s\S]*?\}\s*(\.|\;)?\s*/i, '').trim();

    const breakdownStr = breakdown && typeof breakdown === 'object' ? JSON.stringify(breakdown) : null;

    try {
      await dbQuery.run(
        `UPDATE shifts
         SET end_time = datetime('now', 'localtime'),
             system_cash = ?,
             actual_cash = ?,
             cash_difference = ?,
             status = 'closed',
             closing_notes = ?,
             breakdown = ?
         WHERE id = ?`,
        [expectedSystemCash, actual_cash, cashDifference, cleanNotes, breakdownStr, shift_id]
      );
    } catch (updateErr) {
      // Fallback if breakdown column is still updating
      await dbQuery.run(
        `UPDATE shifts
         SET end_time = datetime('now', 'localtime'),
             system_cash = ?,
             actual_cash = ?,
             cash_difference = ?,
             status = 'closed',
             closing_notes = ?
         WHERE id = ?`,
        [expectedSystemCash, actual_cash, cashDifference, cleanNotes, shift_id]
      );
    }

    // Logika penentuan status audit & selisih:
    // Jika expectedSystemCash < 0, ini adalah ANOMALI (saldo laci tersedot minus karena pengeluaran melebihi uang laci).
    // DILARANG menandainya sebagai SURPLUS!
    let auditAction;
    let isAnomalousNegative = false;

    if (expectedSystemCash < 0) {
      isAnomalousNegative = true;
      auditAction = 'SHIFT_CLOSED_ANOMALOUS_NEGATIVE_DRAWER';
    } else if (cashDifference === 0) {
      auditAction = 'SHIFT_CLOSED_BALANCED';
    } else if (cashDifference < 0) {
      auditAction = 'SHIFT_CLOSED_SHORTAGE';
    } else {
      auditAction = 'SHIFT_CLOSED_SURPLUS';
    }

    await logAudit(req.user.id, auditAction, {
      shift_id,
      starting_cash: shift.starting_cash,
      total_cash_sales: totalCashSales,
      total_cash_expenses: totalCashExpenses,
      total_cash_income: totalCashIncome,
      total_cash_supplier_paid: totalCashSupplierPaid,
      expected: expectedSystemCash,
      actual: actual_cash,
      difference: cashDifference,
      is_anomalous: isAnomalousNegative
    });

    const closedCommoditySales = await dbQuery.all(
      `SELECT 
         oi.product_id,
         oi.product_name,
         COALESCE(p.unit, 'kg') as unit,
         COALESCE(SUM(oi.qty), 0) as total_qty,
         COALESCE(SUM(oi.subtotal), 0) as total_sales,
         COUNT(DISTINCT oi.order_id) as total_transactions
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.shift_id = ? AND o.status = 'completed'
       GROUP BY oi.product_id, oi.product_name
       ORDER BY total_sales DESC`,
      [shift_id]
    );

    return res.json({
      success: true,
      message: 'Shift berhasil ditutup',
      summary: {
        shift_id,
        cashier_name: req.user.name,
        start_time: shift.start_time,
        end_time: new Date().toISOString(),
        starting_cash: shift.starting_cash,
        total_orders: ordersStatsRow.total_orders || 0,
        total_omset: ordersStatsRow.total_omset || 0,
        total_cash_sales: totalCashSales,
        total_qris: ordersStatsRow.total_qris || 0,
        total_transfer: ordersStatsRow.total_transfer || 0,
        total_tempo: ordersStatsRow.total_tempo || 0,
        total_cash_expenses: totalCashExpenses,
        total_cash_income: totalCashIncome,
        total_cash_supplier_paid: totalCashSupplierPaid,
        cash_supplier_payments: totalCashSupplierPaid,
        total_cash_debt_collected: totalCashDebtCollected,
        expected_system_cash: expectedSystemCash,
        actual_cash_input: actual_cash,
        cash_difference: cashDifference,
        is_balanced: !isAnomalousNegative && cashDifference === 0,
        is_anomalous: isAnomalousNegative,
        status_label: isAnomalousNegative 
          ? 'ANOMALOUS_NEGATIVE_DRAWER' 
          : (cashDifference === 0 ? 'BALANCED' : (cashDifference < 0 ? 'SHORTAGE' : 'SURPLUS')),
        breakdown: breakdown || null,
        closing_notes: cleanNotes,
        commodity_sales: closedCommoditySales || []
      }
    });
  } catch (err) {
    console.error('Error closing shift:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/shifts/history
// List shift history (Default: 7 hari terakhir, atau 30 hari / semua)
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 100, period = '7days' } = req.query;
    let filterClause = "";
    if (period === '7days') {
      filterClause = "WHERE date(s.start_time) >= date('now', 'localtime', '-6 days')";
    } else if (period === '30days') {
      filterClause = "WHERE date(s.start_time) >= date('now', 'localtime', '-29 days')";
    } else if (period === 'today') {
      filterClause = "WHERE date(s.start_time) = date('now', 'localtime')";
    }

    const shifts = await dbQuery.all(
      `SELECT s.*, u.name as cashier_name
       FROM shifts s
       JOIN users u ON s.cashier_id = u.id
       ${filterClause}
       ORDER BY s.id DESC LIMIT ?`,
      [Number(limit) || 100]
    );
    const formattedShifts = (shifts || []).map(s => {
      let bObj = null;
      if (s.breakdown) {
        try { bObj = JSON.parse(s.breakdown); } catch (e) { bObj = null; }
      }
      let cNotes = s.closing_notes ? String(s.closing_notes).trim() : '';
      if (!bObj && cNotes.startsWith('Breakdown:')) {
        const match = cNotes.match(/^Breakdown\s*:\s*(\{[\s\S]*?\})/i);
        if (match) {
          try { bObj = JSON.parse(match[1]); } catch (e) {}
        }
      }
      cNotes = cNotes.replace(/^Breakdown\s*:\s*\{[\s\S]*?\}\s*(\.|\;)?\s*/i, '').trim();
      const isNegativeSystem = Number(s.system_cash) < 0;
      const statusLabel = isNegativeSystem
        ? 'ANOMALOUS_NEGATIVE_DRAWER'
        : (s.cash_difference === 0 ? 'BALANCED' : (s.cash_difference < 0 ? 'SHORTAGE' : 'SURPLUS'));
      return {
        ...s,
        is_anomalous: isNegativeSystem,
        status_label: statusLabel,
        breakdown: bObj,
        closing_notes: cNotes
      };
    });
    return res.json({ success: true, shifts: formattedShifts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/shifts/:id
// Get comprehensive shift detail for reconciliation audit
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const shiftId = Number(req.params.id);
    const shift = await dbQuery.get(
      `SELECT s.*, u.name as cashier_name, u.username as cashier_username
       FROM shifts s
       JOIN users u ON s.cashier_id = u.id
       WHERE s.id = ?`,
      [shiftId]
    );

    if (!shift) {
      return res.status(404).json({ success: false, message: 'Data shift tidak ditemukan' });
    }

    // Orders summary in this shift
    const ordersStats = await dbQuery.get(
      `SELECT 
         COUNT(id) as total_orders,
         COALESCE(SUM(CASE WHEN payment_method = 'cash' AND status = 'completed' THEN total_amount ELSE 0 END), 0) as cash_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'qris' AND status = 'completed' THEN total_amount ELSE 0 END), 0) as qris_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'transfer' AND status = 'completed' THEN total_amount ELSE 0 END), 0) as transfer_sales,
         COALESCE(SUM(CASE WHEN (payment_method = 'tempo' OR status = 'tempo') THEN total_amount ELSE 0 END), 0) as tempo_sales,
         COALESCE(SUM(CASE WHEN status = 'void' THEN total_amount ELSE 0 END), 0) as void_total,
         COALESCE(SUM(CASE WHEN status = 'void' THEN 1 ELSE 0 END), 0) as void_count,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as total_omset
       FROM orders
       WHERE shift_id = ?`,
      [shiftId]
    );

    // Cash expenses during shift
    const expenses = await dbQuery.all(
      `SELECT id, expense_no, category, category_name, amount, notes, created_at, type, source
       FROM store_expenses
       WHERE shift_id = ?
       ORDER BY id DESC`,
      [shiftId]
    );

    // Supplier payments during shift
    const supplierPayments = await dbQuery.all(
      `SELECT sp.*, s.name as supplier_name
       FROM supplier_payments sp
       LEFT JOIN suppliers s ON sp.supplier_id = s.id
       WHERE sp.shift_id = ?
       ORDER BY sp.id DESC`,
      [shiftId]
    );

    // Debt payments collected during shift
    const debtPayments = await dbQuery.all(
      `SELECT dp.*, c.name as customer_name
       FROM debt_payments dp
       LEFT JOIN customers c ON dp.customer_id = c.id
       WHERE dp.shift_id = ?
       ORDER BY dp.id DESC`,
      [shiftId]
    );

    // Recent orders in this shift (top 15)
    const recentOrders = await dbQuery.all(
      `SELECT id, order_no, total_amount, payment_method, status, created_at
       FROM orders
       WHERE shift_id = ?
       ORDER BY id DESC LIMIT 15`,
      [shiftId]
    );

    // Parse breakdown
    let bObj = null;
    if (shift.breakdown) {
      try { bObj = JSON.parse(shift.breakdown); } catch (e) { bObj = null; }
    }
    let cNotes = shift.closing_notes ? String(shift.closing_notes).trim() : '';
    if (!bObj && cNotes.startsWith('Breakdown:')) {
      const match = cNotes.match(/^Breakdown\s*:\s*(\{[\s\S]*?\})/i);
      if (match) {
        try { bObj = JSON.parse(match[1]); } catch (e) {}
      }
    }
    cNotes = cNotes.replace(/^Breakdown\s*:\s*\{[\s\S]*?\}\s*(\.|\;)?\s*/i, '').trim();

    const isNegativeSystem = Number(shift.system_cash) < 0;
    const statusLabel = isNegativeSystem
      ? 'ANOMALOUS_NEGATIVE_DRAWER'
      : (shift.cash_difference === 0 ? 'BALANCED' : (shift.cash_difference < 0 ? 'SHORTAGE' : 'SURPLUS'));

    // Product / commodity sales breakdown in this shift
    const commoditySales = await dbQuery.all(
      `SELECT 
         oi.product_id,
         oi.product_name,
         COALESCE(p.unit, 'kg') as unit,
         COALESCE(SUM(oi.qty), 0) as total_qty,
         COALESCE(SUM(oi.subtotal), 0) as total_sales,
         COUNT(DISTINCT oi.order_id) as total_transactions
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.shift_id = ? AND o.status = 'completed'
       GROUP BY oi.product_id, oi.product_name
       ORDER BY total_sales DESC`,
      [shiftId]
    );

    return res.json({
      success: true,
      shift: {
        ...shift,
        is_anomalous: isNegativeSystem,
        status_label: statusLabel,
        breakdown: bObj,
        closing_notes: cNotes,
        stats: ordersStats || {},
        commodity_sales: commoditySales || [],
        expenses: expenses || [],
        supplier_payments: supplierPayments || [],
        debt_payments: debtPayments || [],
        recent_orders: recentOrders || []
      }
    });
  } catch (err) {
    console.error('Error fetching shift detail:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
