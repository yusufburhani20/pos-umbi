// API Client for Toko Umbi POS
const isDev = typeof window !== 'undefined' && window.location && (window.location.port === '3000' || window.location.port === '5173');
const hostname = typeof window !== 'undefined' && window.location ? (window.location.hostname || 'localhost') : 'localhost';
const BASE_URL = isDev ? `http://${hostname}:4000/api` : '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('pos_token') || null;
    this.user = JSON.parse(localStorage.getItem('pos_user') || 'null');
  }

  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('pos_token', token);
    localStorage.setItem('pos_user', JSON.stringify(user));
  }

  clearSession() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
  }

  clearAuth() {
    this.clearSession();
  }

  async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Terjadi kesalahan sistem');
      }
      return data;
    } catch (err) {
      console.error(`API Error (${endpoint}):`, err);
      throw err;
    }
  }

  // Sync Endpoints
  getSyncStatus(deviceId = null) {
    const q = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    return this.request(`/sync/status${q}`);
  }

  pullSyncData(deviceId = null) {
    const q = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    return this.request(`/sync/pull${q}`);
  }

  pushSyncData(payload) {
    return this.request('/sync/push', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // Owner specific methods
  getDashboardReport(params = {}) {
    const qs = typeof params === 'object' ? new URLSearchParams(params).toString() : '';
    return this.request(`/reports/dashboard${qs ? '?' + qs : ''}`);
  }

  getSalesReport(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/reports/sales?${qs}`);
  }

  getAuditLogs(limit = 30) {
    return this.request(`/reports/audit-logs?limit=${limit}`);
  }

  updateProduct(id, payload) {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  deleteProduct(id) {
    return this.request(`/products/${id}`, {
      method: 'DELETE'
    });
  }

  
  restockProduct(productId, qtyKg, newCostPrice, notes, supplierId = null, paymentStatus = 'lunas', dpAmount = 0, dueDate = null, totalCost = null, paymentMethod = 'cash') {
    return this.request('/products/restock', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        qty_kg: qtyKg,
        new_cost_price: newCostPrice,
        total_cost: totalCost,
        notes,
        supplier_id: supplierId,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        dp_amount: dpAmount,
        due_date: dueDate
      })
    });
  }

  // Suppliers & Purchases API
  getSuppliers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/suppliers${qs ? '?' + qs : ''}`);
  }

  getSupplierDetail(id) {
    return this.request(`/suppliers/${id}`);
  }

  createSupplier(payload) {
    return this.request('/suppliers', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  updateSupplier(id, payload) {
    return this.request(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  deleteSupplier(id) {
    return this.request(`/suppliers/${id}`, {
      method: 'DELETE'
    });
  }

  getPurchases(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/suppliers/purchases/all${qs ? '?' + qs : ''}`);
  }

  createPurchase(payload) {
    return this.request('/suppliers/purchases', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  paySupplierDebt(purchaseId, payload) {
    return this.request(`/suppliers/purchases/${purchaseId}/pay`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  deletePurchase(purchaseId, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/suppliers/purchases/${purchaseId}${qs ? '?' + qs : ''}`, {
      method: 'DELETE'
    });
  }

  getExpenses(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/expenses${qs ? '?' + qs : ''}`);
  }

  getExpenseCategories() {
    return this.request('/expenses/categories');
  }

  createExpense(payload) {
    return this.request('/expenses', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  deleteExpense(id) {
    return this.request(`/expenses/${id}`, {
      method: 'DELETE'
    });
  }

  // Safe Cash (Buku Kas Brankas Toko - Owner)
  getSafeCash(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/safe-cash${qs ? '?' + qs : ''}`);
  }

  setInitialSafeCash(payload) {
    return this.request('/safe-cash/set-initial', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  depositSafeCash(payload) {
    return this.request('/safe-cash/deposit', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  withdrawSafeCash(payload) {
    return this.request('/safe-cash/withdraw', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  priveSafeCash(payload) {
    return this.request('/safe-cash/prive', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  
  createProduct(payload) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }


  // Cashier / User Management (Owner only)
  getUsers() {
    return this.request('/users');
  }

  createUser(payload) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  updateUser(id, payload) {
    return this.request('/users/' + id, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  deleteUser(id) {
    return this.request('/users/' + id, {
      method: 'DELETE'
    });
  }

  // Auth
  login(pin, username = null) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ pin, username })
    });
  }

  getMe() {
    return this.request('/auth/me');
  }

  // Shifts
  getCurrentShift() {
    return this.request('/shifts/current');
  }

  openShift(startingCash) {
    return this.request('/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ starting_cash: startingCash })
    });
  }

  closeShift(shiftId, actualCash, breakdown, closingNotes) {
    return this.request('/shifts/close', {
      method: 'POST',
      body: JSON.stringify({
        shift_id: shiftId,
        actual_cash: actualCash,
        breakdown,
        closing_notes: closingNotes
      })
    });
  }

  getShiftHistory(params = {}) {
    const qs = typeof params === 'object' ? new URLSearchParams(params).toString() : '';
    return this.request(`/shifts/history${qs ? '?' + qs : ''}`);
  }

  getShiftDetail(id) {
    return this.request(`/shifts/${id}`);
  }

  // Products
  getProducts(params = '') {
    if (typeof params === 'string') {
      const q = params ? `?category=${params}` : '';
      return this.request(`/products${q}`);
    }
    const query = new URLSearchParams(params).toString();
    return this.request(`/products${query ? '?' + query : ''}`);
  }

  getLowStockAlerts() {
    return this.request('/products/low-stock');
  }

  getProductRestockHistory(productId) {
    return this.request(`/products/${productId}/restock-history`);
  }

  recordWaste(productId, shiftId, type, qtyKg, notes) {
    return this.request('/products/adjust-stock', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        shift_id: shiftId,
        type,
        qty_kg: qtyKg,
        notes
      })
    });
  }

  // Customers
  getCustomers(tier = '') {
    const q = tier ? `?tier=${tier}` : '';
    return this.request(`/customers${q}`);
  }

  // Orders
  createOrder(payload) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  getOrders(shiftId = null) {
    const q = shiftId ? `?shift_id=${shiftId}` : '';
    return this.request(`/orders${q}`);
  }

  getOrder(orderId) {
    return this.request(`/orders/${orderId}`);
  }

  voidOrder(orderId, ownerPin, voidReason) {
    return this.request(`/orders/${orderId}/void`, {
      method: 'POST',
      body: JSON.stringify({
        owner_pin: ownerPin,
        void_reason: voidReason
      })
    });
  }

  // Debts (Buku Piutang / Kasbon)
  getDebts(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.customer_id) query.append('customer_id', params.customer_id);
    if (params.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/debts${qs}`);
  }

  getDebtDetail(debtId) {
    return this.request(`/debts/${debtId}`);
  }

  updateDebt(debtId, payload) {
    return this.request(`/debts/${debtId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  payDebt(debtId, payload) {
    return this.request(`/debts/${debtId}/pay`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  createManualDebt(payload) {
    return this.request('/debts/manual', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  deleteManualDebt(debtId) {
    return this.request(`/debts/${debtId}`, {
      method: 'DELETE'
    });
  }

  // Store Settings (Identitas Toko & Profil Struk)
  getSettings() {
    return this.request('/settings');
  }

  updateSettings(payload) {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  changeOwnerPin(oldPin, newPin) {
    return this.request('/settings/change-owner-pin', {
      method: 'POST',
      body: JSON.stringify({ old_pin: oldPin, new_pin: newPin })
    });
  }

  // Stock Opname Fisik
  applyStockOpname(productId, physicalQty, shiftId = null, notes = '') {
    return this.request('/products/opname', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        physical_qty: physicalQty,
        shift_id: shiftId,
        notes
      })
    });
  }

  // Update Identitas Profil Kasir / Admin Aktif & Ganti PIN
  updateProfile(name, oldPin = null, newPin = null) {
    return this.request('/settings/profile', {
      method: 'PUT',
      body: JSON.stringify({
        name,
        old_pin: oldPin,
        new_pin: newPin
      })
    });
  }

  // Subscription / License
  getSubscriptionStatus() {
    return this.request('/subscription/status');
  }
}

export const api = new ApiClient();
