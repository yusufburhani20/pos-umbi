const express = require('express');
const router = express.Router();
const { dbQuery, getCurrentDrawerCash, getSafeCashBalance, recordSafeCashTransaction } = require('../db');
const { authenticateToken, requireStrictOwner, logAudit } = require('../middleware/auth');

// Preset categories for traditional market store
const EXPENSE_CATEGORIES = {
  makan_rokok: { name: 'Makan, Minum & Rokok', icon: '🍱', color: '#f59e0b' },
  parkir_retribusi: { name: 'Parkir & Retribusi Pasar', icon: '🛵', color: '#3b82f6' },
  kuli_bongkar: { name: 'Kuli Panggul & Bongkar Muat', icon: '🚚', color: '#8b5cf6' },
  perlengkapan: { name: 'Perlengkapan Kios (Karung/Plastik/Rafia)', icon: '📦', color: '#ec4899' },
  listrik_token: { name: 'Listrik & Token PLN', icon: '⚡', color: '#eab308' },
  wifi_pulsa: { name: 'WiFi, Internet & Pulsa', icon: '📶', color: '#06b6d4' },
  gaji_karyawan: { name: 'Gaji / Uang Saku Karyawan', icon: '👥', color: '#10b981' },
  perbaikan_alat: { name: 'Perbaikan Kios & Timbangan', icon: '🛠️', color: '#64748b' },
  kas_masuk_modal: { name: 'Kas Masuk / Tambah Modal Laci', icon: '💵', color: '#059669' },
  lain_lain: { name: 'Lain-Lain / Operasional Umum', icon: '📝', color: '#6b7280' }
};

// Helper: Generate unique expense number (EXP-YYYYMMDD-XXXX)
async function generateExpenseNo() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `EXP-${dateStr}-`;

  const last = await dbQuery.get(
    `SELECT expense_no FROM store_expenses WHERE expense_no LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let seq = 1;
  if (last && last.expense_no) {
    const parts = last.expense_no.split('-');
    if (parts.length >= 3) {
      seq = parseInt(parts[2], 10) + 1;
    }
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// GET /api/expenses/categories
router.get('/categories', authenticateToken, (req, res) => {
  const list = Object.entries(EXPENSE_CATEGORIES).map(([key, val]) => ({
    key,
    ...val
  }));
  res.json({ success: true, categories: list, map: EXPENSE_CATEGORIES });
});

// GET /api/expenses
// List all store expenses with filtering and summary metrics
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type, category, source, shift_id, start_date, end_date, search } = req.query;

    let sql = `
      SELECT 
        e.*,
        u.name as recorded_by_name,
        u.role as recorded_by_role
      FROM store_expenses e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (type && type !== 'all') {
      sql += ' AND e.type = ?';
      params.push(type);
    }

    if (category && category !== 'all') {
      sql += ' AND e.category = ?';
      params.push(category);
    }

    if (source && source !== 'all') {
      sql += ' AND e.source = ?';
      params.push(source);
    }

    if (shift_id) {
      sql += ' AND e.shift_id = ?';
      params.push(shift_id);
    }

    if (start_date) {
      sql += ' AND date(e.created_at) >= date(?)';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND date(e.created_at) <= date(?)';
      params.push(end_date);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ' AND (e.expense_no LIKE ? OR e.category_name LIKE ? OR e.notes LIKE ?)';
      params.push(q, q, q);
    }

    sql += ' ORDER BY e.id DESC';

    const expenses = await dbQuery.all(sql, params);

    // Filter conditions for period-specific summary & category breakdown
    let filterCond = '1=1';
    const filterParams = [];

    if (type && type !== 'all') {
      filterCond += ' AND type = ?';
      filterParams.push(type);
    }
    if (category && category !== 'all') {
      filterCond += ' AND category = ?';
      filterParams.push(category);
    }
    if (source && source !== 'all') {
      filterCond += ' AND source = ?';
      filterParams.push(source);
    }
    if (shift_id) {
      filterCond += ' AND shift_id = ?';
      filterParams.push(shift_id);
    }
    if (start_date) {
      filterCond += ' AND date(created_at) >= date(?)';
      filterParams.push(start_date);
    }
    if (end_date) {
      filterCond += ' AND date(created_at) <= date(?)';
      filterParams.push(end_date);
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      filterCond += ' AND (expense_no LIKE ? OR category_name LIKE ? OR notes LIKE ?)';
      filterParams.push(q, q, q);
    }

    // Period specific summary
    const periodSummaryRow = await dbQuery.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as period_expenses,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN 1 ELSE 0 END), 0) as period_expenses_count,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as period_income,
        COALESCE(SUM(CASE WHEN type = 'income' THEN 1 ELSE 0 END), 0) as period_income_count,
        COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'cash' THEN amount ELSE 0 END), 0) as period_cash_drawer_out,
        COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'transfer' THEN amount ELSE 0 END), 0) as period_transfer_out,
        COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'safe' THEN amount ELSE 0 END), 0) as period_safe_out
      FROM store_expenses
      WHERE ${filterCond}
    `, filterParams);

    // Period Category breakdown
    const categoryRows = await dbQuery.all(`
      SELECT 
        category,
        category_name,
        COUNT(id) as count,
        SUM(amount) as total_amount
      FROM store_expenses
      WHERE type = 'expense' AND ${filterCond}
      GROUP BY category, category_name
      ORDER BY total_amount DESC
    `, filterParams);

    const totalPeriodExp = Number(periodSummaryRow.period_expenses) || 0;
    const category_breakdown = categoryRows.map(row => ({
      ...row,
      percentage: totalPeriodExp > 0 ? Math.round(((Number(row.total_amount) || 0) / totalPeriodExp) * 100) : 0
    }));

    // Overall summary reference
    const summaryRow = await dbQuery.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'cash' THEN amount ELSE 0 END), 0) as total_cash_drawer_out,
        COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'transfer' THEN amount ELSE 0 END), 0) as total_transfer_out,
        COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'safe' THEN amount ELSE 0 END), 0) as total_safe_out,
        COALESCE(SUM(CASE WHEN type = 'expense' AND date(created_at) = date('now', 'localtime') THEN amount ELSE 0 END), 0) as today_expenses,
        COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'cash' AND date(created_at) = date('now', 'localtime') THEN amount ELSE 0 END), 0) as today_cash_drawer_out,
        COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'safe' AND date(created_at) = date('now', 'localtime') THEN amount ELSE 0 END), 0) as today_safe_out,
        COALESCE(SUM(CASE WHEN type = 'income' AND date(created_at) = date('now', 'localtime') THEN amount ELSE 0 END), 0) as today_income,
        COALESCE(SUM(CASE WHEN type = 'expense' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime') THEN amount ELSE 0 END), 0) as month_expenses
      FROM store_expenses
    `);

    // Active shift stats
    const activeShift = await dbQuery.get("SELECT id FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1");
    let shift_summary = {
      has_active_shift: Boolean(activeShift),
      shift_id: activeShift ? activeShift.id : null,
      shift_cash_expenses: 0,
      shift_cash_income: 0
    };

    if (activeShift) {
      const shiftExp = await dbQuery.get(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'cash' THEN amount ELSE 0 END), 0) as cash_expenses,
          COALESCE(SUM(CASE WHEN type = 'income' AND source = 'cash' THEN amount ELSE 0 END), 0) as cash_income
        FROM store_expenses
        WHERE shift_id = ?
      `, [activeShift.id]);

      shift_summary.shift_cash_expenses = shiftExp.cash_expenses || 0;
      shift_summary.shift_cash_income = shiftExp.cash_income || 0;
    }

    return res.json({
      success: true,
      expenses,
      summary: {
        ...summaryRow,
        period_expenses: Number(periodSummaryRow.period_expenses) || 0,
        period_expenses_count: Number(periodSummaryRow.period_expenses_count) || 0,
        period_income: Number(periodSummaryRow.period_income) || 0,
        period_income_count: Number(periodSummaryRow.period_income_count) || 0,
        period_cash_drawer_out: Number(periodSummaryRow.period_cash_drawer_out) || 0,
        period_transfer_out: Number(periodSummaryRow.period_transfer_out) || 0,
        period_safe_out: Number(periodSummaryRow.period_safe_out) || 0,
        category_breakdown,
        shift_summary
      }
    });
  } catch (err) {
    console.error('Error fetching expenses:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/expenses
// Record a store expense or non-sales cash income
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { category, amount, source = 'cash', notes = '', type = 'expense' } = req.body;

    if (!category) {
      return res.status(400).json({ success: false, message: 'Kategori pengeluaran wajib dipilih' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Nominal transaksi harus lebih besar dari Rp 0' });
    }

    if (!['cash', 'transfer', 'safe'].includes(source)) {
      return res.status(400).json({ success: false, message: 'Sumber dana harus kas laci, transfer, atau kas brankas' });
    }

    if (!['expense', 'income'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Tipe transaksi harus pengeluaran atau kas masuk' });
    }

    const categoryMeta = EXPENSE_CATEGORIES[category] || { name: category, icon: '📝' };
    const category_name = categoryMeta.name;

    // Detect active shift
    const activeShift = await dbQuery.get("SELECT id FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1");
    const shift_id = activeShift ? activeShift.id : null;

    // RULE 1: If source is cash drawer and type is expense, verify drawer has enough balance
    if (type === 'expense' && source === 'cash') {
      const drawerState = await getCurrentDrawerCash(shift_id);
      if (!drawerState.has_active_shift) {
        return res.status(400).json({
          success: false,
          code: 'NO_ACTIVE_SHIFT',
          message: 'Tidak dapat mengeluarkan kas tunai laci karena belum ada shift kasir yang aktif. Harap buka shift kasir terlebih dahulu.'
        });
      }

      if (drawerState.current_drawer_cash < numAmount) {
        const shortage = numAmount - drawerState.current_drawer_cash;
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_DRAWER_CASH',
          message: `Saldo kas laci tidak mencukupi! Saldo laci saat ini hanya Rp ${drawerState.current_drawer_cash.toLocaleString('id-ID')}, sedangkan pengeluaran Rp ${numAmount.toLocaleString('id-ID')} (kurang Rp ${shortage.toLocaleString('id-ID')}). Transaksi dibatalkan otomatis agar saldo tidak minus. Harap tambah dana ke kas/saldo terlebih dahulu via '+ Kas Masuk / Modal'.`,
          current_drawer_cash: drawerState.current_drawer_cash,
          required_amount: numAmount,
          shortage
        });
      }
    }

    // RULE 2: If source is safe and type is expense, verify safe cash balance
    if (type === 'expense' && source === 'safe') {
      const safeStats = await getSafeCashBalance();
      if (safeStats.balance < numAmount) {
        const shortage = numAmount - safeStats.balance;
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_SAFE_CASH',
          message: `Saldo kas brankas tidak mencukupi! Saldo brankas saat ini hanya Rp ${safeStats.balance.toLocaleString('id-ID')}, sedangkan pengeluaran Rp ${numAmount.toLocaleString('id-ID')} (kurang Rp ${shortage.toLocaleString('id-ID')}). Harap setor dana ke brankas terlebih dahulu.`,
          current_safe_cash: safeStats.balance,
          required_amount: numAmount,
          shortage
        });
      }
    }

    const expense_no = await generateExpenseNo();

    const result = await dbQuery.run(`
      INSERT INTO store_expenses (
        expense_no, shift_id, user_id, category, category_name, type, amount, source, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      expense_no,
      shift_id,
      req.user.id,
      category,
      category_name,
      type,
      numAmount,
      source,
      notes.trim()
    ]);

    await logAudit(req.user.id, type === 'expense' ? 'EXPENSE_RECORDED' : 'CASH_INCOME_RECORDED', {
      expense_id: result.lastID,
      expense_no,
      category,
      category_name,
      amount: numAmount,
      source,
      shift_id
    });

    // Auto-record in safe cash mutations if source is safe
    if (source === 'safe') {
      await recordSafeCashTransaction({
        user_id: req.user.id,
        shift_id: shift_id || null,
        type: type === 'expense' ? 'expense' : 'income',
        amount: numAmount,
        source: 'safe',
        reference_no: expense_no,
        notes: `Biaya Operasional: ${category_name} - ${notes.trim()}`
      });
    }

    const created = await dbQuery.get(`
      SELECT 
        e.*,
        u.name as recorded_by_name,
        u.role as recorded_by_role
      FROM store_expenses e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.id = ?
    `, [result.lastID]);

    return res.json({
      success: true,
      message: `${type === 'expense' ? 'Biaya operasional' : 'Kas masuk'} sebesar Rp ${numAmount.toLocaleString('id-ID')} berhasil dicatat!`,
      expense: created
    });
  } catch (err) {
    console.error('Error creating expense:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/expenses/:id
// Void or remove mistake expense (Owner only)
router.delete('/:id', authenticateToken, requireStrictOwner, async (req, res) => {
  try {
    const expenseId = Number(req.params.id);
    const existing = await dbQuery.get('SELECT * FROM store_expenses WHERE id = ?', [expenseId]);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Data pengeluaran tidak ditemukan' });
    }

    await dbQuery.run('DELETE FROM store_expenses WHERE id = ?', [expenseId]);

    // Revert safe cash mutation if it was paid from safe
    if (existing.source === 'safe') {
      if (existing.type === 'expense') {
        await recordSafeCashTransaction({
          user_id: req.user.id,
          type: 'deposit',
          amount: existing.amount,
          source: 'safe',
          reference_no: existing.expense_no,
          notes: `Pembatalan / Reversal pengeluaran ${existing.expense_no}`
        });
      } else if (existing.type === 'income') {
        await recordSafeCashTransaction({
          user_id: req.user.id,
          type: 'withdrawal',
          amount: existing.amount,
          source: 'safe',
          reference_no: existing.expense_no,
          notes: `Pembatalan / Reversal kas masuk ${existing.expense_no}`
        });
      }
    }

    await logAudit(req.user.id, 'EXPENSE_DELETED', {
      expense_id: expenseId,
      expense_no: existing.expense_no,
      category: existing.category,
      amount: existing.amount
    });

    return res.json({
      success: true,
      message: `Catatan pengeluaran ${existing.expense_no} berhasil dihapus`
    });
  } catch (err) {
    console.error('Error deleting expense:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
