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

    return res.json({
      success: true,
      has_active_shift: true,
      shift
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

    const totalCashSales = cashSalesRow.total_cash_sales || 0;
    const expectedSystemCash = Number(shift.starting_cash) + Number(totalCashSales);
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
