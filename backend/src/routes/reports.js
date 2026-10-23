const express = require('express');
const router = express.Router();
const { dbQuery } = require('../db');
const { authenticateToken, requireOwner, requireStrictOwner } = require('../middleware/auth');

// GET /api/reports/dashboard
// Primary endpoint for Owner's smartphone dashboard
router.get('/dashboard', authenticateToken, requireOwner, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Today's sales by payment method
    const salesSummary = await dbQuery.get(
      `SELECT 
         COALESCE(SUM(total_amount), 0) as total_revenue,
         COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as total_cash,
         COALESCE(SUM(CASE WHEN payment_method = 'qris' THEN total_amount ELSE 0 END), 0) as total_qris,
         COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total_amount ELSE 0 END), 0) as total_transfer,
         COALESCE(SUM(CASE WHEN payment_method = 'tempo' THEN total_amount ELSE 0 END), 0) as total_tempo,
         COUNT(id) as total_orders
       FROM orders
       WHERE date(created_at) = date('now', 'localtime') AND status = 'completed'`
    );

    // 2. Void stats today (Anti-fraud indicator)
    const voidSummary = await dbQuery.get(
      `SELECT 
         COUNT(id) as void_count,
         COALESCE(SUM(total_amount), 0) as void_total_amount
       FROM orders
       WHERE date(created_at) = date('now', 'localtime') AND status = 'void'`
    );

    // 3. Retail vs Reseller volume breakdown (Arbitrage fraud detector!)
    const tierBreakdown = await dbQuery.all(
      `SELECT 
         oi.price_tier,
         COALESCE(SUM(oi.qty), 0) as total_kg,
         COALESCE(SUM(oi.subtotal), 0) as total_subtotal,
         COUNT(DISTINCT oi.order_id) as order_count
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE date(o.created_at) = date('now', 'localtime') AND o.status = 'completed'
       GROUP BY oi.price_tier`
    );

    let retailKg = 0;
    let resellerKg = 0;
    for (const t of tierBreakdown) {
      if (t.price_tier === 'retail') retailKg = t.total_kg;
      if (t.price_tier === 'reseller') resellerKg = t.total_kg;
    }
    const totalKg = retailKg + resellerKg;
    const retailPercentage = totalKg > 0 ? Math.round((retailKg / totalKg) * 100) : 0;
    const resellerPercentage = totalKg > 0 ? Math.round((resellerKg / totalKg) * 100) : 0;

    // 4. Active Shift status
    const activeShift = await dbQuery.get(
      `SELECT s.id, COALESCE(u.name, 'Kasir Bertugas') as cashier_name, s.start_time, s.starting_cash,
         COALESCE((
           SELECT SUM(total_amount) 
           FROM orders 
           WHERE shift_id = s.id AND payment_method = 'cash' AND status = 'completed'
         ), 0) as current_cash_sales,
         COALESCE((
           SELECT SUM(total_amount) 
           FROM orders 
           WHERE shift_id = s.id AND status = 'completed'
         ), 0) as current_total_sales,
         COALESCE((
           SELECT COUNT(id) 
           FROM orders 
           WHERE shift_id = s.id AND status = 'completed'
         ), 0) as current_order_count
       FROM shifts s
       LEFT JOIN users u ON s.cashier_id = u.id
       WHERE s.status = 'open'
       ORDER BY s.id DESC LIMIT 1`
    );

    let activeShiftCashExpenses = 0;
    let activeShiftCashIncome = 0;
    let activeShiftCashSupplier = 0;
    let activeShiftCashDebtCollected = 0;

    if (activeShift) {
      const expRow = await dbQuery.get(
        `SELECT 
           COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'cash' THEN amount ELSE 0 END), 0) as cash_expenses,
           COALESCE(SUM(CASE WHEN type = 'income' AND source = 'cash' THEN amount ELSE 0 END), 0) as cash_income
         FROM store_expenses
         WHERE shift_id = ?`,
        [activeShift.id]
      );
      activeShiftCashExpenses = expRow ? expRow.cash_expenses : 0;
      activeShiftCashIncome = expRow ? expRow.cash_income : 0;

      const supRow = await dbQuery.get(
        `SELECT COALESCE(SUM(amount_paid), 0) as cash_supplier
         FROM supplier_payments
         WHERE payment_method = 'cash' AND (shift_id = ? OR (shift_id IS NULL AND payment_date >= ?))`,
        [activeShift.id, activeShift.start_time]
      );
      activeShiftCashSupplier = supRow ? supRow.cash_supplier : 0;

      const debtCollectRow = await dbQuery.get(
        `SELECT COALESCE(SUM(amount_paid), 0) as cash_debt_collected
         FROM debt_payments
         WHERE (shift_id = ? OR (payment_date >= ? AND shift_id IS NULL)) AND payment_method = 'cash'`,
        [activeShift.id, activeShift.start_time]
      );
      activeShiftCashDebtCollected = debtCollectRow ? debtCollectRow.cash_debt_collected : 0;
    }

    // 4b. Expenses summary today
    const expensesToday = await dbQuery.get(
      `SELECT 
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses_today,
         COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'cash' THEN amount ELSE 0 END), 0) as cash_expenses_today,
         COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'transfer' THEN amount ELSE 0 END), 0) as transfer_expenses_today
       FROM store_expenses
       WHERE date(created_at) = date('now', 'localtime')`
    );

    // 4c. Other income today (suntikan modal / non-sales cash income)
    const incomeTodayRow = await dbQuery.get(
      `SELECT 
         COALESCE(SUM(amount), 0) as total_income_today,
         COALESCE(SUM(CASE WHEN source = 'cash' THEN amount ELSE 0 END), 0) as cash_income_today,
         COALESCE(SUM(CASE WHEN source = 'transfer' THEN amount ELSE 0 END), 0) as transfer_income_today
       FROM store_expenses
       WHERE date(created_at) = date('now', 'localtime') AND type = 'income'`
    );

    // 4d. Supplier payments made today (Kulakan bayar tunai / transfer)
    const supPayTodayRow = await dbQuery.get(
      `SELECT 
         COALESCE(SUM(amount_paid), 0) as total_supplier_paid_today,
         COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount_paid ELSE 0 END), 0) as cash_supplier_paid_today,
         COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN amount_paid ELSE 0 END), 0) as transfer_supplier_paid_today
       FROM supplier_payments
       WHERE date(payment_date) = date('now', 'localtime')`
    );

    // 4e. Debt installments collected today from customers
    const debtPayTodayRow = await dbQuery.get(
      `SELECT COALESCE(SUM(amount_paid), 0) as total_debt_collected_today
       FROM debt_payments
       WHERE date(payment_date) = date('now', 'localtime')`
    );

    // 4f. COGS (HPP modal barang terjual) today for real profitability calculation
    const cogsRow = await dbQuery.get(
      `SELECT COALESCE(SUM(oi.qty * oi.cost_price), 0) as total_cogs
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE date(o.created_at) = date('now', 'localtime') AND o.status = 'completed'`
    );

    // 4g. Working capital / liquidity positions
    const customerDebtsRow = await dbQuery.get(
      `SELECT 
         COALESCE(SUM(remaining_amount), 0) as total_customer_debts,
         COUNT(DISTINCT customer_id) as total_debtors
       FROM customer_debts
       WHERE status != 'paid' AND remaining_amount > 0`
    );

    const supplierPayablesRow = await dbQuery.get(
      `SELECT 
         COALESCE(SUM(remaining_amount), 0) as total_supplier_debt,
         COUNT(DISTINCT supplier_id) as total_suppliers_debt
       FROM purchases
       WHERE remaining_amount > 0`
    );

    // 4h. Detailed void transactions today
    const voidOrdersList = await dbQuery.all(
      `SELECT o.id, o.order_no, o.total_amount, o.created_at, o.void_reason, u.name as cashier_name
       FROM orders o
       LEFT JOIN shifts sh ON o.shift_id = sh.id
       LEFT JOIN users u ON sh.cashier_id = u.id
       WHERE date(o.created_at) = date('now', 'localtime') AND o.status = 'void'
       ORDER BY o.id DESC LIMIT 5`
    );

    // 5. Recent Shift Discrepancies (Shortages in the last 7 days)
    const recentDiscrepancies = await dbQuery.all(
      `SELECT s.id, u.name as cashier_name, s.end_time, s.system_cash, s.actual_cash, s.cash_difference
       FROM shifts s
       JOIN users u ON s.cashier_id = u.id
       WHERE s.status = 'closed' AND s.cash_difference != 0
       ORDER BY s.id DESC LIMIT 5`
    );

    // 6. Today's Susut / Busuk Log
    const wasteToday = await dbQuery.all(
      `SELECT sa.*, p.name as product_name, u.name as reported_by
       FROM stock_adjustments sa
       JOIN products p ON sa.product_id = p.id
       JOIN users u ON sa.user_id = u.id
       WHERE date(sa.created_at) = date('now', 'localtime')
       ORDER BY sa.id DESC`
    );

    // 7. Last 7 Days Daily Revenue Trend
    const rawDaily = await dbQuery.all(
      `SELECT date(created_at) as date, COALESCE(SUM(total_amount), 0) as revenue, COUNT(id) as orders_count
       FROM orders
       WHERE status = 'completed' AND date(created_at) >= date('now', 'localtime', '-6 days')
       GROUP BY date(created_at)
       ORDER BY date(created_at) ASC`
    );

    const dailyMap = {};
    for (const d of rawDaily) {
      dailyMap[d.date] = d;
    }

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
      const dayFormatted = `${dayName}, ${d.getDate()}/${d.getMonth() + 1}`;
      const found = dailyMap[dateStr];
      last7Days.push({
        date: dateStr,
        label: dayFormatted,
        revenue: found ? Number(found.revenue) : 0,
        orders_count: found ? Number(found.orders_count) : 0
      });
    }

    // 8. Today's Hourly Sales Trend (06:00 to 21:00)
    const rawHourly = await dbQuery.all(
      `SELECT strftime('%H', created_at) as hour, COALESCE(SUM(total_amount), 0) as revenue, COUNT(id) as orders_count
       FROM orders
       WHERE status = 'completed' AND date(created_at) = date('now', 'localtime')
       GROUP BY strftime('%H', created_at)
       ORDER BY hour ASC`
    );
    const hourlyMap = {};
    for (const h of rawHourly) {
      hourlyMap[h.hour] = h;
    }
    const hourlyTrend = [];
    for (let h = 6; h <= 21; h++) {
      const hStr = h.toString().padStart(2, '0');
      const found = hourlyMap[hStr];
      hourlyTrend.push({
        hour: `${hStr}:00`,
        revenue: found ? Number(found.revenue) : 0,
        orders_count: found ? Number(found.orders_count) : 0
      });
    }

    // 9. Today's Top Commodity Volume Breakdown
    const topCommodities = await dbQuery.all(
      `SELECT oi.product_name, COALESCE(SUM(oi.qty), 0) as total_kg, COALESCE(SUM(oi.subtotal), 0) as total_revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE date(o.created_at) = date('now', 'localtime') AND o.status = 'completed'
       GROUP BY oi.product_name
       ORDER BY total_kg DESC
       LIMIT 5`
    );

    // 10. Recent Activity Feeds (Latest Orders, Store Expenses & Stock Restock Purchases)
    const recentOrders = await dbQuery.all(`
      SELECT o.id, o.order_no, o.total_amount, o.payment_method, o.customer_name, o.created_at,
             u.name as cashier_name,
             (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
             (SELECT COALESCE(SUM(qty), 0) FROM order_items WHERE order_id = o.id) as total_kg
      FROM orders o
      LEFT JOIN shifts sh ON o.shift_id = sh.id
      LEFT JOIN users u ON sh.cashier_id = u.id
      WHERE o.status = 'completed'
      ORDER BY o.id DESC
      LIMIT 6
    `);

    const recentExpenses = await dbQuery.all(`
      SELECT se.id, se.expense_no, se.category, se.category_name, se.type, se.amount, se.source, se.notes, se.created_at,
             u.name as recorded_by_name
      FROM store_expenses se
      LEFT JOIN users u ON se.user_id = u.id
      ORDER BY se.id DESC
      LIMIT 6
    `);

    const recentPurchases = await dbQuery.all(`
      SELECT pu.id, pu.purchase_no, pu.qty_kg, pu.cost_price, pu.total_cost, pu.payment_status,
             pu.paid_amount, pu.remaining_amount, pu.notes, pu.created_at,
             COALESCE(s.name, 'Pemasok Umum') as supplier_name,
             p.name as product_name,
             u.name as recorded_by_name
      FROM purchases pu
      LEFT JOIN suppliers s ON pu.supplier_id = s.id
      JOIN products p ON pu.product_id = p.id
      LEFT JOIN users u ON pu.recorded_by = u.id
      ORDER BY pu.id DESC
      LIMIT 6
    `);

    // Computations
    const totalRevenue = Number(salesSummary.total_revenue) || 0;
    const totalCogs = Number(cogsRow ? cogsRow.total_cogs : 0) || 0;
    const grossProfit = totalRevenue - totalCogs;
    const grossMarginPct = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 1000) / 10 : 0;
    const totalStoreExpenses = Number(expensesToday ? expensesToday.total_expenses_today : 0) || 0;
    const otherIncomeToday = Number(incomeTodayRow ? incomeTodayRow.total_income_today : 0) || 0;
    const netProfitToday = grossProfit + otherIncomeToday - totalStoreExpenses;
    const netMarginPct = totalRevenue > 0 ? Math.round((netProfitToday / totalRevenue) * 1000) / 10 : 0;

    // Today's full itemized expenses list for executive profit breakdown modal
    const todayExpensesList = await dbQuery.all(`
      SELECT se.id, se.expense_no, se.category, se.category_name, se.type, se.amount, se.source, se.notes, se.created_at,
             u.name as recorded_by_name
      FROM store_expenses se
      LEFT JOIN users u ON se.user_id = u.id
      WHERE date(se.created_at) = date('now', 'localtime') AND se.type = 'expense'
      ORDER BY se.id DESC
    `);

    const cashSalesToday = Number(salesSummary.total_cash) || 0;
    const digitalSalesToday = (Number(salesSummary.total_qris) || 0) + (Number(salesSummary.total_transfer) || 0);
    const debtCollectedToday = Number(debtPayTodayRow ? debtPayTodayRow.total_debt_collected_today : 0) || 0;
    const totalInflow = cashSalesToday + digitalSalesToday + debtCollectedToday + otherIncomeToday;

    const totalSupplierPaidToday = Number(supPayTodayRow ? supPayTodayRow.total_supplier_paid_today : 0) || 0;
    const totalCashOutflow = totalStoreExpenses + totalSupplierPaidToday;
    const netCashflowMovement = totalInflow - totalCashOutflow;

    const estimatedDrawerCash = activeShift 
      ? Number(activeShift.starting_cash) 
        + Number(activeShift.current_cash_sales) 
        + Number(activeShiftCashIncome) 
        + Number(activeShiftCashDebtCollected)
        - Number(activeShiftCashExpenses) 
        - Number(activeShiftCashSupplier)
      : cashSalesToday;

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_revenue: totalRevenue,
        cash_in_drawer: estimatedDrawerCash,
        total_cash_today: cashSalesToday,
        total_qris: Number(salesSummary.total_qris) || 0,
        total_transfer: Number(salesSummary.total_transfer) || 0,
        total_tempo: Number(salesSummary.total_tempo) || 0,
        total_orders: Number(salesSummary.total_orders) || 0,
        active_shift_sales: activeShift ? Number(activeShift.current_total_sales) : 0,
        active_shift_orders: activeShift ? Number(activeShift.current_order_count) : 0,
        void_count: Number(voidSummary.void_count) || 0,
        void_total_amount: Number(voidSummary.void_total_amount) || 0,
        total_expenses_today: totalStoreExpenses,
        total_supplier_paid_today: totalSupplierPaidToday,
        total_cash_outflow_today: totalCashOutflow,
        net_profit_today: netProfitToday,
        gross_profit_today: grossProfit,
        gross_margin_pct: grossMarginPct,
        net_margin_pct: netMarginPct
      },
      profitability_today: {
        total_revenue: totalRevenue,
        total_cogs: totalCogs,
        gross_profit: grossProfit,
        gross_margin_pct: grossMarginPct,
        total_operating_expenses: totalStoreExpenses,
        other_income: otherIncomeToday,
        net_profit: netProfitToday,
        net_margin_pct: netMarginPct,
        today_expenses_list: todayExpensesList || []
      },
      cashflow_today: {
        inflow: {
          cash_sales: cashSalesToday,
          digital_sales: digitalSalesToday,
          debt_collected: debtCollectedToday,
          other_income: otherIncomeToday,
          total_inflow: totalInflow
        },
        outflow: {
          store_expenses_cash: Number(expensesToday ? expensesToday.cash_expenses_today : 0) || 0,
          store_expenses_transfer: Number(expensesToday ? expensesToday.transfer_expenses_today : 0) || 0,
          total_store_expenses: totalStoreExpenses,
          supplier_paid_cash: Number(supPayTodayRow ? supPayTodayRow.cash_supplier_paid_today : 0) || 0,
          supplier_paid_transfer: Number(supPayTodayRow ? supPayTodayRow.transfer_supplier_paid_today : 0) || 0,
          total_supplier_paid: totalSupplierPaidToday,
          total_cash_outflow: totalCashOutflow
        },
        net_cashflow: netCashflowMovement
      },
      liquidity_snapshot: {
        cash_in_drawer: estimatedDrawerCash,
        bank_incoming_today: digitalSalesToday,
        total_customer_debts: Number(customerDebtsRow ? customerDebtsRow.total_customer_debts : 0) || 0,
        total_debtors: Number(customerDebtsRow ? customerDebtsRow.total_debtors : 0) || 0,
        total_supplier_debt: Number(supplierPayablesRow ? supplierPayablesRow.total_supplier_debt : 0) || 0,
        total_suppliers_debt: Number(supplierPayablesRow ? supplierPayablesRow.total_suppliers_debt : 0) || 0
      },
      anti_fraud: {
        retail_percentage: retailPercentage,
        reseller_percentage: resellerPercentage,
        is_ratio_anomalous: resellerPercentage > 75,
        recent_cash_shortages: recentDiscrepancies
      },
      void_today_details: voidOrdersList,
      expenses_today: expensesToday,
      active_shift: activeShift ? {
        id: activeShift.id,
        cashier_name: activeShift.cashier_name,
        start_time: activeShift.start_time,
        starting_cash: activeShift.starting_cash,
        cash_collected: activeShift.current_cash_sales,
        total_sales: Number(activeShift.current_total_sales) || 0,
        order_count: Number(activeShift.current_order_count) || 0,
        cash_expenses: activeShiftCashExpenses,
        cash_income: activeShiftCashIncome,
        cash_debt_collected: activeShiftCashDebtCollected,
        cash_supplier_paid: activeShiftCashSupplier,
        estimated_cash_now: estimatedDrawerCash
      } : null,
      waste_today: wasteToday,
      recent_orders: recentOrders,
      recent_expenses: recentExpenses,
      recent_purchases: recentPurchases,
      trends: {
        last_7_days: last7Days,
        hourly_today: hourlyTrend,
        top_commodities: topCommodities
      }
    });
  } catch (err) {
    console.error('Error fetching dashboard reports:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/reports/audit-logs
// Audit logs viewable strictly by Owner
router.get('/audit-logs', authenticateToken, requireStrictOwner, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const logs = await dbQuery.all(
      `SELECT al.*, u.name as user_name, u.role as user_role
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.id DESC LIMIT ?`,
      [Number(limit)]
    );
    return res.json({ success: true, logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});


// GET /api/reports/sales
// Comprehensive Sales & Profit Report with Date Range / Shift Filtering & Export
router.get('/sales', authenticateToken, requireOwner, async (req, res) => {
  try {
    const { 
      start_date, 
      end_date, 
      cashier_id, 
      payment_method,
      period,
      shift_id
    } = req.query;

    const today = new Date().toISOString().split('T')[0];
    let isShiftMode = false;
    let targetShift = null;

    if (period === 'active_shift' || shift_id === 'active') {
      targetShift = await dbQuery.get(
        `SELECT s.id, COALESCE(u.name, 'Kasir') as cashier_name, s.start_time, s.starting_cash
         FROM shifts s
         LEFT JOIN users u ON s.cashier_id = u.id
         WHERE s.status = 'open'
         ORDER BY s.id DESC LIMIT 1`
      );
      if (targetShift) {
        isShiftMode = true;
      }
    } else if (shift_id && Number(shift_id) > 0) {
      targetShift = await dbQuery.get(
        `SELECT s.id, COALESCE(u.name, 'Kasir') as cashier_name, s.start_time, s.starting_cash
         FROM shifts s
         LEFT JOIN users u ON s.cashier_id = u.id
         WHERE s.id = ?`,
        [Number(shift_id)]
      );
      if (targetShift) {
        isShiftMode = true;
      }
    }

    const startDate = start_date || today;
    const endDate = end_date || today;

    let orderFilter = "";
    const orderParams = [];

    if (isShiftMode && targetShift) {
      orderFilter = "WHERE o.shift_id = ?";
      orderParams.push(targetShift.id);
    } else {
      orderFilter = "WHERE date(o.created_at) >= date(?) AND date(o.created_at) <= date(?)";
      orderParams.push(startDate, endDate);
    }

    if (cashier_id) {
      orderFilter += " AND s.cashier_id = ?";
      orderParams.push(cashier_id);
    }
    if (payment_method && payment_method !== 'all') {
      orderFilter += " AND o.payment_method = ?";
      orderParams.push(payment_method);
    }

    // 1a. Completed Sales Totals strictly from orders table (No Cartesian duplication from order_items!)
    const salesSummary = await dbQuery.get(
      `SELECT 
         COALESCE(SUM(o.total_amount), 0) as total_revenue,
         COALESCE(SUM(CASE WHEN o.payment_method = 'cash' THEN o.total_amount ELSE 0 END), 0) as cash_revenue,
         COALESCE(SUM(CASE WHEN o.payment_method = 'qris' THEN o.total_amount ELSE 0 END), 0) as qris_revenue,
         COALESCE(SUM(CASE WHEN o.payment_method = 'transfer' THEN o.total_amount ELSE 0 END), 0) as transfer_revenue,
         COALESCE(SUM(CASE WHEN o.payment_method = 'tempo' THEN o.total_amount ELSE 0 END), 0) as tempo_revenue,
         COUNT(o.id) as total_orders
       FROM orders o
       LEFT JOIN shifts s ON o.shift_id = s.id
       ${orderFilter} AND o.status = 'completed'`,
      orderParams
    );

    // 1b. COGS & Volume Sold strictly from order_items
    const itemsSummary = await dbQuery.get(
      `SELECT 
         COALESCE(SUM(oi.qty), 0) as total_kg_sold,
         COALESCE(SUM(oi.cost_price * oi.qty), 0) as total_cogs
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       LEFT JOIN shifts s ON o.shift_id = s.id
       ${orderFilter} AND o.status = 'completed'`,
      orderParams
    );

    const totalRevenue = Number(salesSummary.total_revenue) || 0;
    const totalCogs = Number(itemsSummary ? itemsSummary.total_cogs : 0) || 0;
    const grossProfit = totalRevenue - totalCogs;
    const marginPercentage = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 1000) / 10 : 0;
    const totalOrders = Number(salesSummary.total_orders) || 0;
    const avgBasket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // 2. Voided / Cancelled Orders Summary
    const voidSummary = await dbQuery.get(
      `SELECT 
         COUNT(o.id) as void_count,
         COALESCE(SUM(o.total_amount), 0) as void_total_amount
       FROM orders o
       LEFT JOIN shifts s ON o.shift_id = s.id
       ${orderFilter} AND o.status = 'void'`,
      orderParams
    );

    // 3. Susut & Busuk (Waste Loss) in the same period / shift
    let wasteSummary = { total_waste_kg: 0, total_waste_loss: 0 };
    let expenseSummary = { total_expenses: 0, total_other_income: 0, cash_expenses: 0, transfer_expenses: 0 };

    if (isShiftMode && targetShift) {
      wasteSummary = await dbQuery.get(
        `SELECT 
           COALESCE(SUM(sa.qty_kg), 0) as total_waste_kg,
           COALESCE(SUM(sa.qty_kg * p.cost_price), 0) as total_waste_loss
         FROM stock_adjustments sa
         JOIN products p ON sa.product_id = p.id
         WHERE sa.created_at >= ?`,
        [targetShift.start_time]
      );

      expenseSummary = await dbQuery.get(
        `SELECT 
           COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
           COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_other_income,
           COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'cash' THEN amount ELSE 0 END), 0) as cash_expenses,
           COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'transfer' THEN amount ELSE 0 END), 0) as transfer_expenses
         FROM store_expenses
         WHERE shift_id = ?`,
        [targetShift.id]
      );
    } else {
      wasteSummary = await dbQuery.get(
        `SELECT 
           COALESCE(SUM(sa.qty_kg), 0) as total_waste_kg,
           COALESCE(SUM(sa.qty_kg * p.cost_price), 0) as total_waste_loss
         FROM stock_adjustments sa
         JOIN products p ON sa.product_id = p.id
         WHERE date(sa.created_at) >= date(?) AND date(sa.created_at) <= date(?)`,
        [startDate, endDate]
      );

      expenseSummary = await dbQuery.get(
        `SELECT 
           COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
           COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_other_income,
           COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'cash' THEN amount ELSE 0 END), 0) as cash_expenses,
           COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'transfer' THEN amount ELSE 0 END), 0) as transfer_expenses
         FROM store_expenses
         WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)`,
        [startDate, endDate]
      );
    }

    const totalExpenses = Number(expenseSummary.total_expenses) || 0;
    const totalOtherIncome = Number(expenseSummary.total_other_income) || 0;
    const netProfit = grossProfit - totalExpenses + totalOtherIncome;

    // 4. Top Selling Products in this period
    const topProducts = await dbQuery.all(
      `SELECT 
         oi.product_id,
         oi.product_name,
         p.unit,
         COALESCE(SUM(oi.qty), 0) as total_kg,
         COALESCE(SUM(oi.subtotal), 0) as total_revenue,
         COALESCE(SUM(oi.cost_price * oi.qty), 0) as total_cogs,
         (COALESCE(SUM(oi.subtotal), 0) - COALESCE(SUM(oi.cost_price * oi.qty), 0)) as gross_profit
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       LEFT JOIN shifts s ON o.shift_id = s.id
       LEFT JOIN products p ON oi.product_id = p.id
       ${orderFilter} AND o.status = 'completed'
       GROUP BY oi.product_id, oi.product_name
       ORDER BY total_kg DESC
       LIMIT 10`,
      orderParams
    );

    // 5. Detailed Orders List
    const ordersList = await dbQuery.all(
      `SELECT 
         o.id,
         o.order_no,
         o.created_at,
         o.customer_name,
         o.payment_method,
         o.total_amount,
         o.cash_tendered,
         o.change_due,
         o.status,
         COALESCE(u.name, 'Kasir') as cashier_name,
         COALESCE((SELECT SUM(cost_price * qty) FROM order_items WHERE order_id = o.id), 0) as total_cogs,
         (o.total_amount - COALESCE((SELECT SUM(cost_price * qty) FROM order_items WHERE order_id = o.id), 0)) as gross_profit,
         (SELECT COUNT(id) FROM order_items WHERE order_id = o.id) as item_count,
         COALESCE((SELECT SUM(qty) FROM order_items WHERE order_id = o.id), 0) as total_kg
       FROM orders o
       LEFT JOIN shifts s ON o.shift_id = s.id
       LEFT JOIN users u ON s.cashier_id = u.id
       ${orderFilter}
       ORDER BY o.id DESC`,
      orderParams
    );

    // 6. Daily trend for the selected period (No Cartesian duplication)
    const rawDailyOrders = await dbQuery.all(
      `SELECT date(o.created_at) as date,
              COALESCE(SUM(o.total_amount), 0) as revenue,
              COUNT(o.id) as orders_count
       FROM orders o
       LEFT JOIN shifts s ON o.shift_id = s.id
       ${orderFilter} AND o.status = 'completed'
       GROUP BY date(o.created_at)
       ORDER BY date(o.created_at) ASC`,
      orderParams
    );

    const rawDailyCogs = await dbQuery.all(
      `SELECT date(o.created_at) as date,
              COALESCE(SUM(oi.cost_price * oi.qty), 0) as cogs
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       LEFT JOIN shifts s ON o.shift_id = s.id
       ${orderFilter} AND o.status = 'completed'
       GROUP BY date(o.created_at)`,
      orderParams
    );

    const cogsByDate = {};
    for (const c of rawDailyCogs) {
      cogsByDate[c.date] = Number(c.cogs) || 0;
    }

    const dailyTrend = rawDailyOrders.map(d => {
      const cogs = cogsByDate[d.date] || 0;
      const rev = Number(d.revenue) || 0;
      return {
        date: d.date,
        revenue: rev,
        cogs: cogs,
        profit: rev - cogs,
        orders_count: Number(d.orders_count) || 0
      };
    });

    return res.json({
      success: true,
      is_shift_mode: isShiftMode,
      target_shift: targetShift ? {
        id: targetShift.id,
        cashier_name: targetShift.cashier_name,
        start_time: targetShift.start_time,
        starting_cash: targetShift.starting_cash
      } : null,
      shift: targetShift ? {
        id: targetShift.id,
        cashier_name: targetShift.cashier_name,
        start_time: targetShift.start_time,
        starting_cash: targetShift.starting_cash
      } : null,
      period: {
        start_date: isShiftMode && targetShift ? targetShift.start_time.split(' ')[0] : startDate,
        end_date: isShiftMode && targetShift ? targetShift.start_time.split(' ')[0] : endDate
      },
      summary: {
        total_revenue: totalRevenue,
        total_cogs: totalCogs,
        gross_profit: grossProfit,
        margin_percentage: marginPercentage,
        total_orders: totalOrders,
        total_kg_sold: Math.round(Number(itemsSummary ? itemsSummary.total_kg_sold : 0) * 100) / 100,
        avg_basket: avgBasket,
        by_payment: {
          cash: Number(salesSummary.cash_revenue) || 0,
          qris: Number(salesSummary.qris_revenue) || 0,
          transfer: Number(salesSummary.transfer_revenue) || 0,
          tempo: Number(salesSummary.tempo_revenue) || 0
        },
        void_count: Number(voidSummary.void_count) || 0,
        void_total_amount: Number(voidSummary.void_total_amount) || 0,
        waste_kg: Math.round(Number(wasteSummary ? wasteSummary.total_waste_kg : 0) * 100) / 100,
        waste_loss_cost: Math.round(Number(wasteSummary ? wasteSummary.total_waste_loss : 0)),
        total_expenses: totalExpenses,
        total_other_income: totalOtherIncome,
        cash_expenses: Number(expenseSummary.cash_expenses) || 0,
        transfer_expenses: Number(expenseSummary.transfer_expenses) || 0,
        net_profit: netProfit
      },
      top_products: topProducts,
      orders: ordersList,
      daily_trend: dailyTrend
    });
  } catch (err) {
    console.error('Error generating sales report:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
