const express = require('express');
const router = express.Router();
const { dbQuery, getSafeCashBalance, recordSafeCashTransaction, getCurrentDrawerCash } = require('../db');
const { authenticateToken, requireOwner, requireStrictOwner, logAudit } = require('../middleware/auth');

// GET /api/safe-cash
// Get current safe cash balance, quick summary, and transaction mutation history (Cashier & Owner)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, type, limit = 100 } = req.query;

    const currentStats = await getSafeCashBalance();

    let sql = `
      SELECT 
        s.*,
        u.name as recorded_by_name,
        u.role as recorded_by_role
      FROM safe_cash_transactions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (type && type !== 'all') {
      sql += ' AND s.type = ?';
      params.push(type);
    }

    if (start_date) {
      sql += ' AND date(s.created_at) >= date(?)';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND date(s.created_at) <= date(?)';
      params.push(end_date);
    }

    sql += ' ORDER BY s.id DESC LIMIT ?';
    params.push(Math.min(parseInt(limit, 10) || 100, 200));

    const transactions = await dbQuery.all(sql, params);

    // Today's summary
    const todaySummary = await dbQuery.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type IN ('initial', 'deposit', 'transfer_in', 'income') THEN amount ELSE 0 END), 0) as today_inflow,
        COALESCE(SUM(CASE WHEN type IN ('withdrawal', 'transfer_out', 'expense', 'supplier_pay', 'prive') THEN amount ELSE 0 END), 0) as today_outflow,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as today_expenses,
        COALESCE(SUM(CASE WHEN type = 'supplier_pay' THEN amount ELSE 0 END), 0) as today_supplier_pay,
        COALESCE(SUM(CASE WHEN type = 'prive' THEN amount ELSE 0 END), 0) as today_prive
      FROM safe_cash_transactions
      WHERE date(created_at) = date('now', 'localtime')
    `);

    // All-time breakdown
    const allTimeSummary = await dbQuery.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'initial' THEN amount ELSE 0 END), 0) as total_initial,
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as total_deposit,
        COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) as total_withdrawal,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
        COALESCE(SUM(CASE WHEN type = 'supplier_pay' THEN amount ELSE 0 END), 0) as total_supplier_pay,
        COALESCE(SUM(CASE WHEN type = 'prive' THEN amount ELSE 0 END), 0) as total_prive
      FROM safe_cash_transactions
    `);

    return res.json({
      success: true,
      current_balance: currentStats.balance,
      total_trx: currentStats.total_trx,
      total_in: currentStats.total_in,
      total_out: currentStats.total_out,
      today: {
        inflow: Number(todaySummary ? todaySummary.today_inflow : 0) || 0,
        outflow: Number(todaySummary ? todaySummary.today_outflow : 0) || 0,
        expenses: Number(todaySummary ? todaySummary.today_expenses : 0) || 0,
        supplier_pay: Number(todaySummary ? todaySummary.today_supplier_pay : 0) || 0,
        prive: Number(todaySummary ? todaySummary.today_prive : 0) || 0
      },
      all_time: {
        initial: Number(allTimeSummary ? allTimeSummary.total_initial : 0) || 0,
        deposit: Number(allTimeSummary ? allTimeSummary.total_deposit : 0) || 0,
        withdrawal: Number(allTimeSummary ? allTimeSummary.total_withdrawal : 0) || 0,
        expenses: Number(allTimeSummary ? allTimeSummary.total_expenses : 0) || 0,
        supplier_pay: Number(allTimeSummary ? allTimeSummary.total_supplier_pay : 0) || 0,
        prive: Number(allTimeSummary ? allTimeSummary.total_prive : 0) || 0
      },
      transactions
    });
  } catch (err) {
    console.error('Error fetching safe cash data:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/safe-cash/set-initial
// Set initial physical balance in the safe (Strict Owner only)
router.post('/set-initial', authenticateToken, requireStrictOwner, async (req, res) => {
  try {
    const { amount, notes = '' } = req.body;
    const numAmount = Math.max(0, Math.round(Number(amount) || 0));

    if (numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Nominal saldo awal brankas harus lebih besar dari Rp 0' });
    }

    const current = await getSafeCashBalance();
    if (current.balance > 0 && current.total_trx > 0) {
      return res.status(400).json({
        success: false,
        message: `Brankas sudah memiliki transaksi aktif dengan saldo Rp ${current.balance.toLocaleString('id-ID')}. Jika ingin menambah dana, gunakan menu 'Setor ke Brankas'.`
      });
    }

    const trx = await recordSafeCashTransaction({
      user_id: req.user.id,
      type: 'initial',
      amount: numAmount,
      source: 'owner_capital',
      reference_no: null,
      notes: notes.trim() || 'Penetapan Saldo Awal Kas Fisik Brankas Toko'
    });

    await logAudit(req.user.id, 'SAFE_CASH_INITIAL_SET', {
      trx_no: trx.trx_no,
      amount: numAmount,
      balance_after: trx.balance_after,
      notes: trx.notes
    });

    return res.json({
      success: true,
      message: `Saldo awal brankas berhasil ditetapkan sebesar Rp ${numAmount.toLocaleString('id-ID')}!`,
      transaction: trx
    });
  } catch (err) {
    console.error('Error setting initial safe cash:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/safe-cash/deposit
// Deposit money into safe (Setor ke Brankas - Cashier & Owner)
// Source can be 'drawer' (Laci Kasir), 'capital' (Modal Tambahan), or 'bank' (Tarik dari Rekening Bank)
router.post('/deposit', authenticateToken, async (req, res) => {
  try {
    const { amount, source = 'drawer', notes = '' } = req.body;
    const numAmount = Math.max(0, Math.round(Number(amount) || 0));

    if (numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Nominal setoran harus lebih besar dari Rp 0' });
    }

    if (!['drawer', 'capital', 'bank'].includes(source)) {
      return res.status(400).json({ success: false, message: 'Sumber dana setoran harus laci kasir, suntikan modal, atau rekening bank' });
    }

    let shift_id = null;

    // If source is cashier drawer, verify active shift and drawer cash sufficiency
    if (source === 'drawer') {
      const drawerState = await getCurrentDrawerCash();
      if (!drawerState.has_active_shift) {
        return res.status(400).json({
          success: false,
          code: 'NO_ACTIVE_SHIFT',
          message: 'Tidak dapat menyetor uang dari laci karena tidak ada shift kasir yang sedang aktif.'
        });
      }

      if (drawerState.current_drawer_cash < numAmount) {
        const shortage = numAmount - drawerState.current_drawer_cash;
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_DRAWER_CASH',
          message: `Saldo kas laci tidak mencukupi untuk disetor ke brankas! Saldo laci saat ini: Rp ${drawerState.current_drawer_cash.toLocaleString('id-ID')}, nominal setoran: Rp ${numAmount.toLocaleString('id-ID')} (kurang Rp ${shortage.toLocaleString('id-ID')}).`
        });
      }

      shift_id = drawerState.shift.id;
    }

    const defaultNotes = source === 'drawer' 
      ? 'Setor Uang Tunai dari Laci Kasir ke Brankas' 
      : (source === 'capital' ? 'Suntikan Modal Tambahan Tunai ke Brankas' : 'Pencairan Kas dari Bank ke Brankas');

    const trx = await recordSafeCashTransaction({
      user_id: req.user.id,
      shift_id,
      type: 'deposit',
      amount: numAmount,
      source,
      notes: notes.trim() || defaultNotes
    });

    await logAudit(req.user.id, 'SAFE_CASH_DEPOSIT', {
      trx_no: trx.trx_no,
      amount: numAmount,
      source,
      shift_id,
      balance_after: trx.balance_after
    });

    return res.json({
      success: true,
      message: `Berhasil menyetor Rp ${numAmount.toLocaleString('id-ID')} ke brankas! Saldo brankas sekarang: Rp ${trx.balance_after.toLocaleString('id-ID')}`,
      transaction: trx
    });
  } catch (err) {
    console.error('Error depositing to safe cash:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/safe-cash/withdraw
// Withdraw cash from safe (Tarik Tunai dari Brankas - Cashier & Owner)
// Destination can be 'drawer' (Kembalian/Modal Laci), 'bank' (Setor Kas ke Bank), or 'other'
router.post('/withdraw', authenticateToken, async (req, res) => {
  try {
    const { amount, destination = 'drawer', notes = '' } = req.body;
    const numAmount = Math.max(0, Math.round(Number(amount) || 0));

    if (numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Nominal penarikan harus lebih besar dari Rp 0' });
    }

    if (!['drawer', 'bank', 'other'].includes(destination)) {
      return res.status(400).json({ success: false, message: 'Tujuan penarikan tidak valid' });
    }

    let shift_id = null;
    if (destination === 'drawer') {
      const activeShift = await dbQuery.get("SELECT id FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1");
      if (activeShift) {
        shift_id = activeShift.id;
      }
    }

    const defaultNotes = destination === 'drawer'
      ? 'Tarik dari Brankas untuk Tambahan Uang Kembalian Laci Kasir'
      : (destination === 'bank' ? 'Pindah Kas Brankas untuk Setor ke Rekening Bank' : 'Penarikan Kas Fisik Brankas');

    const trx = await recordSafeCashTransaction({
      user_id: req.user.id,
      shift_id,
      type: 'withdrawal',
      amount: numAmount,
      source: destination,
      notes: notes.trim() || defaultNotes
    });

    await logAudit(req.user.id, 'SAFE_CASH_WITHDRAWAL', {
      trx_no: trx.trx_no,
      amount: numAmount,
      destination,
      shift_id,
      balance_after: trx.balance_after
    });

    return res.json({
      success: true,
      message: `Berhasil menarik Rp ${numAmount.toLocaleString('id-ID')} dari brankas! Sisa saldo brankas: Rp ${trx.balance_after.toLocaleString('id-ID')}`,
      transaction: trx
    });
  } catch (err) {
    console.error('Error withdrawing from safe cash:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/safe-cash/prive
// Owner personal drawing (Prive / Pengambilan Keuntungan Pribadi) (Strict Owner only)
router.post('/prive', authenticateToken, requireStrictOwner, async (req, res) => {
  try {
    const { amount, notes = '' } = req.body;
    const numAmount = Math.max(0, Math.round(Number(amount) || 0));

    if (numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Nominal pengambilan prive harus lebih besar dari Rp 0' });
    }

    const trx = await recordSafeCashTransaction({
      user_id: req.user.id,
      type: 'prive',
      amount: numAmount,
      source: 'owner',
      notes: notes.trim() || 'Pengambilan Prive / Keuntungan Pribadi Pemilik Toko'
    });

    await logAudit(req.user.id, 'SAFE_CASH_PRIVE', {
      trx_no: trx.trx_no,
      amount: numAmount,
      balance_after: trx.balance_after,
      notes: trx.notes
    });

    return res.json({
      success: true,
      message: `Pengambilan prive sebesar Rp ${numAmount.toLocaleString('id-ID')} berhasil dicatat! Sisa saldo brankas: Rp ${trx.balance_after.toLocaleString('id-ID')}`,
      transaction: trx
    });
  } catch (err) {
    console.error('Error recording prive from safe:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
