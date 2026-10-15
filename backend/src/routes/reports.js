const express = require('express');
const router = express.Router();
const { dbQuery } = require('../db');
const { authenticateToken, requireOwner } = require('../middleware/auth');

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
      `SELECT s.id, u.name as cashier_name, s.start_time, s.starting_cash,
         COALESCE((
           SELECT SUM(total_amount) 
           FROM orders 
           WHERE shift_id = s.id AND payment_method = 'cash' AND status = 'completed'
         ), 0) as current_cash_sales
       FROM shifts s
       JOIN users u ON s.cashier_id = u.id
       WHERE s.status = 'open'
       ORDER BY s.id DESC LIMIT 1`
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

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_revenue: salesSummary.total_revenue,
        cash_in_drawer: activeShift 
          ? Number(activeShift.starting_cash) + Number(activeShift.current_cash_sales) 
          : salesSummary.total_cash,
        total_cash_today: salesSummary.total_cash,
        total_qris: salesSummary.total_qris,
        total_transfer: salesSummary.total_transfer,
        total_tempo: salesSummary.total_tempo,
        total_orders: salesSummary.total_orders,
        void_count: voidSummary.void_count,
        void_total_amount: voidSummary.void_total_amount
      },
      anti_fraud: {
        retail_percentage: retailPercentage,
        reseller_percentage: resellerPercentage,
        is_ratio_anomalous: resellerPercentage > 75, // Flag if reseller tier dominates unexpectedly
        recent_cash_shortages: recentDiscrepancies
      },
      active_shift: activeShift ? {
        id: activeShift.id,
        cashier_name: activeShift.cashier_name,
        start_time: activeShift.start_time,
        starting_cash: activeShift.starting_cash,
        cash_collected: activeShift.current_cash_sales,
        estimated_cash_now: Number(activeShift.starting_cash) + Number(activeShift.current_cash_sales)
      } : null,
      waste_today: wasteToday
    });
  } catch (err) {
    console.error('Error fetching dashboard reports:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/reports/audit-logs
// Audit logs viewable by Owner
router.get('/audit-logs', authenticateToken, requireOwner, async (req, res) => {
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
// Comprehensive Sales & Profit Report with Date Range Filtering & Export
router.get('/sales', authenticateToken, requireOwner, async (req, res) => {
  try {
    const { 
      start_date, 
      end_date, 
      cashier_id, 
      payment_method 
    } = req.query;

    // Default to today if not provided
    const today = new Date().toISOString().split('T')[0];
    const startDate = start_date || today;
    const endDate = end_date || today;

    // Filter conditions for orders
    let orderFilter = "WHERE date(o.created_at) >= date(?) AND date(o.created_at) <= date(?)";
    const orderParams = [startDate, endDate];

    if (cashier_id) {
      orderFilter += " AND s.cashier_id = ?";
      orderParams.push(cashier_id);
    }
    if (payment_method && payment_method !== 'all') {
      orderFilter += " AND o.payment_method = ?";
      orderParams.push(payment_method);
    }

    // 1. Overall Completed Sales & Profit Summary
    const salesSummary = await dbQuery.get(
      `SELECT 
         COALESCE(SUM(o.total_amount), 0) as total_revenue,
         COALESCE(SUM(CASE WHEN o.payment_method = 'cash' THEN o.total_amount ELSE 0 END), 0) as cash_revenue,
         COALESCE(SUM(CASE WHEN o.payment_method = 'qris' THEN o.total_amount ELSE 0 END), 0) as qris_revenue,
         COALESCE(SUM(CASE WHEN o.payment_method = 'transfer' THEN o.total_amount ELSE 0 END), 0) as transfer_revenue,
         COUNT(DISTINCT o.id) as total_orders,
         COALESCE(SUM(oi.qty), 0) as total_kg_sold,
         COALESCE(SUM(oi.cost_price * oi.qty), 0) as total_cogs
       FROM orders o
       JOIN shifts s ON o.shift_id = s.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       ${orderFilter} AND o.status = 'completed'`,
      orderParams
    );

    const totalRevenue = Number(salesSummary.total_revenue) || 0;
    const totalCogs = Number(salesSummary.total_cogs) || 0;
    const grossProfit = totalRevenue - totalCogs;
    const marginPercentage = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 1000) / 10 : 0;
    const totalOrders = Number(salesSummary.total_orders) || 0;
    const avgBasket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // 2. Voided / Cancelled Orders Summary
    const voidSummary = await dbQuery.get(
      `SELECT 
         COUNT(DISTINCT o.id) as void_count,
         COALESCE(SUM(o.total_amount), 0) as void_total_amount
       FROM orders o
       JOIN shifts s ON o.shift_id = s.id
       ${orderFilter} AND o.status = 'void'`,
      orderParams
    );

    // 3. Susut & Busuk (Waste Loss) in the same period
    const wasteSummary = await dbQuery.get(
      `SELECT 
         COALESCE(SUM(sa.qty_kg), 0) as total_waste_kg,
         COALESCE(SUM(sa.qty_kg * p.cost_price), 0) as total_waste_loss
       FROM stock_adjustments sa
       JOIN products p ON sa.product_id = p.id
       WHERE date(sa.created_at) >= date(?) AND date(sa.created_at) <= date(?)`,
      [startDate, endDate]
    );

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
       JOIN shifts s ON o.shift_id = s.id
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
         u.name as cashier_name,
         COALESCE(SUM(oi.cost_price * oi.qty), 0) as total_cogs,
         (o.total_amount - COALESCE(SUM(oi.cost_price * oi.qty), 0)) as gross_profit,
         COUNT(oi.id) as item_count,
         COALESCE(SUM(oi.qty), 0) as total_kg
       FROM orders o
       JOIN shifts s ON o.shift_id = s.id
       JOIN users u ON s.cashier_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       ${orderFilter}
       GROUP BY o.id
       ORDER BY o.id DESC`,
      orderParams
    );

    return res.json({
      success: true,
      period: {
        start_date: startDate,
        end_date: endDate
      },
      summary: {
        total_revenue: totalRevenue,
        total_cogs: totalCogs,
        gross_profit: grossProfit,
        margin_percentage: marginPercentage,
        total_orders: totalOrders,
        total_kg_sold: Math.round(Number(salesSummary.total_kg_sold) * 100) / 100,
        avg_basket: avgBasket,
        by_payment: {
          cash: Number(salesSummary.cash_revenue) || 0,
          qris: Number(salesSummary.qris_revenue) || 0,
          transfer: Number(salesSummary.transfer_revenue) || 0
        },
        void_count: Number(voidSummary.void_count) || 0,
        void_total_amount: Number(voidSummary.void_total_amount) || 0,
        waste_kg: Math.round(Number(wasteSummary.total_waste_kg) * 100) / 100,
        waste_loss_cost: Math.round(Number(wasteSummary.total_waste_loss))
      },
      top_products: topProducts,
      orders: ordersList
    });
  } catch (err) {
    console.error('Error generating sales report:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
