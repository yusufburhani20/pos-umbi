// API Client for Toko Umbi POS
const BASE_URL = 'http://localhost:4000/api';

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

  
  // Owner specific methods
  getDashboardReport() {
    return this.request('/reports/dashboard');
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

  
  restockProduct(productId, qtyKg, newCostPrice, notes) {
    return this.request('/products/restock', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        qty_kg: qtyKg,
        new_cost_price: newCostPrice,
        notes
      })
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

  getShiftHistory() {
    return this.request('/shifts/history');
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

  payDebt(debtId, payload) {
    return this.request(`/debts/${debtId}/pay`, {
      method: 'POST',
      body: JSON.stringify(payload)
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
}

export const api = new ApiClient();
