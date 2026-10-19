const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const customersRoutes = require('./routes/customers');
const shiftsRoutes = require('./routes/shifts');
const ordersRoutes = require('./routes/orders');
const reportsRoutes = require('./routes/reports');
const usersRoutes = require('./routes/users');
const debtsRoutes = require('./routes/debts');
const settingsRoutes = require('./routes/settings');
const syncRoutes = require('./routes/sync');
const suppliersRoutes = require('./routes/suppliers');
const expensesRoutes = require('./routes/expenses');
const subscriptionRoutes = require('./routes/subscription');

const app = express();

app.use(cors());
app.use(express.json());

// Request logging in development
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Toko Umbi POS API', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/debts', debtsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/subscription', subscriptionRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Endpoint ${req.method} ${req.url} tidak ditemukan` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled API Error:', err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    success: false,
    message: isProd ? 'Terjadi kesalahan sistem internal pada server.' : 'Internal Server Error',
    error: isProd ? undefined : err.message
  });
});

module.exports = app;
