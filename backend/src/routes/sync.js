const express = require('express');
const router = express.Router();
const { db, dbQuery } = require('../db');
const { authenticateToken, logAudit } = require('../middleware/auth');

function formatToJakartaTimestamp(dateInput) {
  if (!dateInput) {
    return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' });
  }
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) {
    return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' });
  }
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' });
}

// GET /api/sync/status
// Lightweight heartbeat & sync status check
router.get('/status', async (req, res) => {
  try {
    const deviceId = req.query.device_id || req.headers['x-device-id'];
    if (deviceId) {
      const nowLocal = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      await dbQuery.run(
        "INSERT INTO store_settings (key, value, updated_at) VALUES ('last_tablet_sync', ?, datetime('now', 'localtime')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')",
        [nowLocal]
      );
      await dbQuery.run(
        "INSERT INTO store_settings (key, value, updated_at) VALUES ('last_tablet_device', ?, datetime('now', 'localtime')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')",
        [`${deviceId} (IP: ${req.ip || 'local'})`]
      );
    }

    const lastSyncRow = await dbQuery.get("SELECT value, updated_at FROM store_settings WHERE key = 'last_tablet_sync'");
    const lastDeviceRow = await dbQuery.get("SELECT value FROM store_settings WHERE key = 'last_tablet_device'");
    const activeShift = await dbQuery.get("SELECT s.id, COALESCE(u.name, 'Kasir Bertugas') as cashier_name FROM shifts s LEFT JOIN users u ON s.cashier_id = u.id WHERE s.status = 'open' ORDER BY s.id DESC LIMIT 1");

    const CURRENT_APP_VERSION = 'v43';

    return res.json({
      success: true,
      online: true,
      app_version: CURRENT_APP_VERSION,
      server_time: new Date().toISOString(),
      last_sync: lastSyncRow ? lastSyncRow.value : null,
      last_sync_updated_at: lastSyncRow ? lastSyncRow.updated_at : null,
      device_info: lastDeviceRow ? lastDeviceRow.value : null,
      active_shift: activeShift || null
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sync/pull
// Tablet downloads the latest master catalog, customers, and store settings
router.get('/pull', authenticateToken, async (req, res) => {
  try {
    const deviceId = req.query.device_id || req.headers['x-device-id'];
    if (deviceId) {
      const nowLocal = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      await dbQuery.run(
        "INSERT INTO store_settings (key, value, updated_at) VALUES ('last_tablet_sync', ?, datetime('now', 'localtime')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')",
        [nowLocal]
      );
      await dbQuery.run(
        "INSERT INTO store_settings (key, value, updated_at) VALUES ('last_tablet_device', ?, datetime('now', 'localtime')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')",
        [`${deviceId} (IP: ${req.ip || 'local'})`]
      );
    }

    const products = await dbQuery.all(`
      SELECT id, name, category, unit, cost_price, retail_price, reseller_price,
             wholesale_min_qty, ROUND(stock_qty, 2) AS stock_qty, min_stock_alert, image_emoji, is_active
      FROM products
      ORDER BY category ASC, name ASC
    `);

    const customers = await dbQuery.all(`
      SELECT id, name, phone, tier, address
      FROM customers
      ORDER BY name ASC
    `);

    const settingsRows = await dbQuery.all('SELECT key, value FROM store_settings');
    const settings = {};
    for (const row of settingsRows) {
      settings[row.key] = row.value;
    }

    // Active shift info
    const activeShift = await dbQuery.get(`
      SELECT s.*, u.name as cashier_name 
      FROM shifts s
      JOIN users u ON s.cashier_id = u.id
      WHERE s.status = 'open'
      ORDER BY s.id DESC LIMIT 1
    `);

    return res.json({
      success: true,
      server_time: new Date().toISOString(),
      sync_interval_seconds: 60,
      data: {
        products,
        customers,
        settings,
        active_shift: activeShift || null
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/sync/push
// Tablet uploads batch of offline transactions, shrinkage, shifts, and debt payments
router.post('/push', authenticateToken, async (req, res) => {
  try {
    const { device_id = 'TAB-KIOS-DEFAULT', orders = [], shifts = [], stock_adjustments = [], debt_payments = [] } = req.body;
    const userId = req.user ? req.user.id : 1;

    let syncedOrdersCount = 0;
    let syncedAdjustmentsCount = 0;
    let syncedDebtPaymentsCount = 0;
    const skippedOrders = [];

    // Helper: Ensure valid shift ID in DB
    async function resolveShiftId(providedShiftId) {
      if (providedShiftId) {
        const existing = await dbQuery.get('SELECT id FROM shifts WHERE id = ?', [providedShiftId]);
        if (existing) return existing.id;
      }
      // Fallback to active open shift
      const openShift = await dbQuery.get('SELECT id FROM shifts WHERE status = "open" ORDER BY id DESC LIMIT 1');
      if (openShift) return openShift.id;

      // Or fallback to latest shift created
      const anyShift = await dbQuery.get('SELECT id FROM shifts ORDER BY id DESC LIMIT 1');
      if (anyShift) return anyShift.id;

      // If absolutely no shifts exist, create an initial auto-shift
      const newShift = await dbQuery.run(
        'INSERT INTO shifts (cashier_id, start_time, starting_cash, status) VALUES (?, datetime("now", "localtime"), 0, "open")',
        [userId]
      );
      return newShift.lastID;
    }

    // 1. Process Orders (Idempotent by order_no)
    for (const order of orders) {
      if (!order.order_no) continue;

      // Check if already synced in DB
      const existing = await dbQuery.get('SELECT id FROM orders WHERE order_no = ?', [order.order_no]);
      if (existing) {
        skippedOrders.push(order.order_no);
        continue;
      }

      const shiftId = await resolveShiftId(order.shift_id);
      const isTempo = order.payment_method === 'tempo';
      const orderStatus = order.status === 'void' ? 'void' : 'completed';
      const orderDate = formatToJakartaTimestamp(order.created_at);

      let resolvedCustomerId = order.customer_id || null;
      let resolvedCustomerName = order.customer_name || null;
      if (isTempo && order.customer_name) {
        let cust = null;
        if (order.customer_phone) {
          cust = await dbQuery.get('SELECT id, name FROM customers WHERE phone = ? OR LOWER(name) = LOWER(?)', [order.customer_phone, order.customer_name]);
        } else {
          cust = await dbQuery.get('SELECT id, name FROM customers WHERE LOWER(name) = LOWER(?)', [order.customer_name]);
        }
        if (cust) {
          resolvedCustomerId = cust.id;
        } else {
          const newCust = await dbQuery.run(
            'INSERT INTO customers (name, phone, tier, created_at) VALUES (?, ?, "retail", datetime("now", "localtime"))',
            [order.customer_name, order.customer_phone || null]
          );
          resolvedCustomerId = newCust.lastID;
        }
        resolvedCustomerName = order.customer_name;
      }

      // Insert Order
      const orderRes = await dbQuery.run(
        `INSERT INTO orders 
         (order_no, shift_id, customer_id, customer_name, total_amount, payment_method, cash_tendered, change_due, status, due_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.order_no,
          shiftId,
          resolvedCustomerId,
          resolvedCustomerName,
          order.total_amount,
          order.payment_method,
          order.cash_tendered || order.total_amount,
          order.change_due || 0,
          orderStatus,
          order.due_date || null,
          orderDate
        ]
      );
      const orderId = orderRes.lastID;

      // Insert Order Items & Deduct Stock
      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          await dbQuery.run(
            `INSERT INTO order_items 
             (order_id, product_id, product_name, qty, price_tier, cost_price, unit_price, subtotal)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              orderId,
              item.product_id,
              item.product_name,
              item.qty,
              item.price_tier || 'retail',
              item.cost_price || 0,
              item.unit_price,
              item.subtotal
            ]
          );

          // Deduct stock in DB
          await dbQuery.run(
            'UPDATE products SET stock_qty = ROUND(MAX(0, stock_qty - ?), 2) WHERE id = ?',
            [item.qty, item.product_id]
          );
        }
      }

      // If tempo, register in customer_debts
      if (isTempo && resolvedCustomerId) {
        const dp = Number(order.cash_tendered) || 0;
        const remaining = Math.max(0, Number(order.total_amount) - dp);
        const debtStatus = remaining === 0 ? 'paid' : (dp > 0 ? 'partial' : 'unpaid');

        await dbQuery.run(
          `INSERT INTO customer_debts 
           (order_id, customer_id, total_amount, paid_amount, remaining_amount, due_date, status, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            resolvedCustomerId,
            order.total_amount,
            dp,
            remaining,
            order.due_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            debtStatus,
            order.notes || `Kasbon nota ${order.order_no} (${resolvedCustomerName || 'Pelanggan'})`,
            orderDate
          ]
        );
      }

      syncedOrdersCount++;
    }

    // 2. Process Stock Adjustments (Susut / Busuk / Opname)
    for (const adj of stock_adjustments) {
      const shiftId = await resolveShiftId(adj.shift_id);
      const adjDate = formatToJakartaTimestamp(adj.created_at);

      await dbQuery.run(
        `INSERT INTO stock_adjustments 
         (product_id, shift_id, user_id, type, qty_kg, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          adj.product_id,
          shiftId,
          adj.user_id || userId,
          adj.type || 'susut',
          adj.qty_kg,
          adj.notes ? `${adj.notes} (Sync ${device_id})` : `Sync ${device_id}`,
          adjDate
        ]
      );

      // Deduct stock
      await dbQuery.run(
        'UPDATE products SET stock_qty = ROUND(MAX(0, stock_qty - ?), 2) WHERE id = ?',
        [adj.qty_kg, adj.product_id]
      );

      syncedAdjustmentsCount++;
    }

    // 3. Process Debt Payments
    for (const pay of debt_payments) {
      const shiftId = await resolveShiftId(pay.shift_id);
      const payDate = formatToJakartaTimestamp(pay.payment_date);

      // Check debt exists
      const debt = await dbQuery.get('SELECT * FROM customer_debts WHERE id = ?', [pay.debt_id]);
      if (debt) {
        await dbQuery.run(
          `INSERT INTO debt_payments 
           (debt_id, customer_id, shift_id, amount_paid, payment_method, recorded_by, notes, payment_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pay.debt_id,
            pay.customer_id || debt.customer_id,
            shiftId,
            pay.amount_paid,
            pay.payment_method || 'cash',
            pay.recorded_by || userId,
            pay.notes ? `${pay.notes} (Sync ${device_id})` : `Cicilan sync dari ${device_id}`,
            payDate
          ]
        );

        // Update debt record
        const newPaid = Number(debt.paid_amount) + Number(pay.amount_paid);
        const newRemaining = Math.max(0, Number(debt.total_amount) - newPaid);
        const newStatus = newRemaining === 0 ? 'paid' : 'partial';

        await dbQuery.run(
          `UPDATE customer_debts 
           SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = datetime('now', 'localtime')
           WHERE id = ?`,
          [newPaid, newRemaining, newStatus, pay.debt_id]
        );

        syncedDebtPaymentsCount++;
      }
    }

    // 4. Update sync timestamp in store_settings
    const nowLocal = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    await dbQuery.run(
      "INSERT INTO store_settings (key, value, updated_at) VALUES ('last_tablet_sync', ?, datetime('now', 'localtime')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')",
      [nowLocal]
    );
    await dbQuery.run(
      "INSERT INTO store_settings (key, value, updated_at) VALUES ('last_tablet_device', ?, datetime('now', 'localtime')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')",
      [`${device_id} (IP: ${req.ip || 'local'})`]
    );

    // Audit log
    await logAudit(userId, 'SYNC_BATCH_PROCESSED', {
      device_id,
      orders_synced: syncedOrdersCount,
      adjustments_synced: syncedAdjustmentsCount,
      debt_payments_synced: syncedDebtPaymentsCount,
      skipped_duplicate_orders: skippedOrders.length
    });

    return res.json({
      success: true,
      message: 'Sinkronisasi berhasil diproses oleh server',
      server_time: new Date().toISOString(),
      synced: {
        orders: syncedOrdersCount,
        adjustments: syncedAdjustmentsCount,
        debt_payments: syncedDebtPaymentsCount,
        skipped_duplicates: skippedOrders
      }
    });
  } catch (err) {
    console.error('[SYNC ERROR]', err);
    return res.status(500).json({ success: false, message: 'Gagal memproses sinkronisasi: ' + err.message });
  }
});

module.exports = router;
