// Offline-First Storage Engine for Toko Umbi POS using browser IndexedDB
const DB_NAME = 'TokoUmbi_OfflineDB';
const DB_VERSION = 1;

let dbInstance = null;

function getLocalTimestampStr(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export function openOfflineDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Master Products cache
      if (!db.objectStoreNames.contains('products')) {
        const prodStore = db.createObjectStore('products', { keyPath: 'id' });
        prodStore.createIndex('category', 'category', { unique: false });
        prodStore.createIndex('name', 'name', { unique: false });
      }

      // 2. Master Customers cache
      if (!db.objectStoreNames.contains('customers')) {
        const custStore = db.createObjectStore('customers', { keyPath: 'id' });
        custStore.createIndex('tier', 'tier', { unique: false });
      }

      // 3. Store settings (Store name, receipt footer, address)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // 4. Active Shift cache
      if (!db.objectStoreNames.contains('active_shift')) {
        db.createObjectStore('active_shift', { keyPath: 'key' });
      }

      // 5. Outbox Orders (Offline transactions awaiting sync to cloud)
      if (!db.objectStoreNames.contains('outbox_orders')) {
        const orderStore = db.createObjectStore('outbox_orders', { keyPath: 'order_no' });
        orderStore.createIndex('status', 'status', { unique: false });
        orderStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // 6. Outbox Stock Adjustments (Susut / Busuk awaiting sync)
      if (!db.objectStoreNames.contains('outbox_adjustments')) {
        const adjStore = db.createObjectStore('outbox_adjustments', { keyPath: 'id', autoIncrement: true });
        adjStore.createIndex('status', 'status', { unique: false });
      }

      // 7. Outbox Debt Payments (Kasbon payments awaiting sync)
      if (!db.objectStoreNames.contains('outbox_debt_payments')) {
        const debtStore = db.createObjectStore('outbox_debt_payments', { keyPath: 'id', autoIncrement: true });
        debtStore.createIndex('status', 'status', { unique: false });
      }

      // 8. Sync Metadata (Device ID, Last Sync timestamp)
      if (!db.objectStoreNames.contains('sync_meta')) {
        db.createObjectStore('sync_meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('[IndexedDB] Gagal membuka database:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Generic transaction helper
async function getStore(storeName, mode = 'readonly') {
  const db = await openOfflineDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

// ==========================================
// 1. PRODUCTS MASTER DATA
// ==========================================
export async function saveProductsLocal(products) {
  if (!products || !Array.isArray(products) || products.length === 0) return true;
  const db = await openOfflineDB();
  const tx = db.transaction('products', 'readwrite');
  const store = tx.objectStore('products');
  
  // Clear old cache to avoid stale/corrupt records
  store.clear();

  for (const prod of products) {
    if (prod && (prod.name || prod.product_name)) {
      if (!prod.name && prod.product_name) {
        prod.name = prod.product_name;
      }
      if (prod.stock_qty !== undefined && prod.stock_qty !== null) {
        prod.stock_qty = Math.round((Number(prod.stock_qty) + Number.EPSILON) * 100) / 100;
      }
      store.put(prod);
    }
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getProductsLocal(category = null) {
  const store = await getStore('products', 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      let items = request.result || [];
      items = items.map(p => {
        if (!p.name && p.product_name) p.name = p.product_name;
        if (p.stock_qty !== undefined && p.stock_qty !== null) {
          p.stock_qty = Math.round((Number(p.stock_qty) + Number.EPSILON) * 100) / 100;
        }
        return p;
      }).filter(p => p && p.name);

      if (category) {
        items = items.filter(p => p.category === category);
      }
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deductProductStockLocal(productId, qty) {
  const db = await openOfflineDB();
  const tx = db.transaction('products', 'readwrite');
  const store = tx.objectStore('products');

  return new Promise((resolve, reject) => {
    const req = store.get(productId);
    req.onsuccess = () => {
      const prod = req.result;
      if (prod) {
        prod.stock_qty = Math.max(0, Math.round(((Number(prod.stock_qty) || 0) - Number(qty)) * 100) / 100);
        store.put(prod);
      }
      resolve(true);
    };
    req.onerror = () => reject(req.error);
  });
}

// ==========================================
// 2. CUSTOMERS MASTER DATA
// ==========================================
export async function saveCustomersLocal(customers) {
  const db = await openOfflineDB();
  const tx = db.transaction('customers', 'readwrite');
  const store = tx.objectStore('customers');
  for (const cust of customers) {
    store.put(cust);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCustomersLocal() {
  const store = await getStore('customers', 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ==========================================
// 3. STORE SETTINGS
// ==========================================
export async function saveSettingsLocal(settingsObj) {
  const db = await openOfflineDB();
  const tx = db.transaction('settings', 'readwrite');
  const store = tx.objectStore('settings');
  for (const [key, value] of Object.entries(settingsObj)) {
    store.put({ key, value });
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSettingsLocal() {
  const store = await getStore('settings', 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const res = {};
      for (const item of (req.result || [])) {
        res[item.key] = item.value;
      }
      resolve(res);
    };
    req.onerror = () => reject(req.error);
  });
}

// ==========================================
// 4. ACTIVE SHIFT
// ==========================================
export async function saveActiveShiftLocal(shift) {
  const store = await getStore('active_shift', 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put({ key: 'current', shift });
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getActiveShiftLocal() {
  const store = await getStore('active_shift', 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get('current');
    req.onsuccess = () => resolve(req.result ? req.result.shift : null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearActiveShiftLocal() {
  const store = await getStore('active_shift', 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete('current');
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// ==========================================
// 5. OUTBOX ORDERS (Offline Transactions)
// ==========================================
export async function enqueueOrderLocal(orderData) {
  const store = await getStore('outbox_orders', 'readwrite');
  const record = {
    order_no: orderData.order_no,
    payload: orderData,
    status: orderData.status || 'pending', // 'pending' | 'synced'
    created_at: orderData.created_at || getLocalTimestampStr()
  };

  return new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingOrdersLocal() {
  const store = await getStore('outbox_orders', 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result || []).filter(item => item.status === 'pending');
      resolve(items.map(i => i.payload));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markOrdersSyncedLocal(orderNos = []) {
  if (orderNos.length === 0) return true;
  const db = await openOfflineDB();
  const tx = db.transaction('outbox_orders', 'readwrite');
  const store = tx.objectStore('outbox_orders');

  for (const orderNo of orderNos) {
    const req = store.get(orderNo);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.status = 'synced';
        item.synced_at = new Date().toISOString();
        store.put(item);
      }
    };
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearSyncedLocalOrders() {
  const db = await openOfflineDB();
  const tx = db.transaction('outbox_orders', 'readwrite');
  const store = tx.objectStore('outbox_orders');

  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      for (const item of items) {
        if (item.status === 'synced') {
          store.delete(item.order_no);
        }
      }
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllLocalOrders() {
  const store = await getStore('outbox_orders', 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllLocalOrders(limit = 50, onlyPending = false) {
  const store = await getStore('outbox_orders', 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      let raw = req.result || [];
      if (onlyPending) {
        raw = raw.filter(i => i.status === 'pending');
      }
      const items = raw
        .map(i => ({ ...i.payload, is_local_synced: i.status === 'synced' }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      resolve(items.slice(0, limit));
    };
    req.onerror = () => reject(req.error);
  });
}

// ==========================================
// 6. OUTBOX ADJUSTMENTS (Susut / Busuk)
// ==========================================
export async function enqueueAdjustmentLocal(adjData) {
  const store = await getStore('outbox_adjustments', 'readwrite');
  const record = {
    payload: adjData,
    status: 'pending',
    created_at: adjData.created_at || getLocalTimestampStr()
  };
  return new Promise((resolve, reject) => {
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingAdjustmentsLocal() {
  const store = await getStore('outbox_adjustments', 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const pending = (req.result || []).filter(i => i.status === 'pending');
      resolve(pending);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markAdjustmentsSyncedLocal(ids = []) {
  if (ids.length === 0) return true;
  const db = await openOfflineDB();
  const tx = db.transaction('outbox_adjustments', 'readwrite');
  const store = tx.objectStore('outbox_adjustments');

  for (const id of ids) {
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.status = 'synced';
        store.put(item);
      }
    };
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// ==========================================
// 7. OUTBOX DEBT PAYMENTS (Kasbon / Cicilan)
// ==========================================
export async function enqueueDebtPaymentLocal(payData) {
  const store = await getStore('outbox_debt_payments', 'readwrite');
  const record = {
    payload: payData,
    status: 'pending',
    created_at: payData.payment_date || getLocalTimestampStr()
  };
  return new Promise((resolve, reject) => {
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingDebtPaymentsLocal() {
  const store = await getStore('outbox_debt_payments', 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const pending = (req.result || []).filter(i => i.status === 'pending');
      resolve(pending);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markDebtPaymentsSyncedLocal(ids = []) {
  if (ids.length === 0) return true;
  const db = await openOfflineDB();
  const tx = db.transaction('outbox_debt_payments', 'readwrite');
  const store = tx.objectStore('outbox_debt_payments');

  for (const id of ids) {
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.status = 'synced';
        store.put(item);
      }
    };
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// ==========================================
// 8. SYNC METADATA & STATUS SUMMARY
// ==========================================
export async function getSyncMetaLocal(key, defaultValue = null) {
  const store = await getStore('sync_meta', 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
    req.onerror = () => reject(req.error);
  });
}

export async function setSyncMetaLocal(key, value) {
  const store = await getStore('sync_meta', 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put({ key, value, updated_at: new Date().toISOString() });
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingCountSummary() {
  const [orders, adjustments, debts] = await Promise.all([
    getPendingOrdersLocal(),
    getPendingAdjustmentsLocal(),
    getPendingDebtPaymentsLocal()
  ]);

  return {
    ordersCount: orders.length,
    adjustmentsCount: adjustments.length,
    debtsCount: debts.length,
    totalPending: orders.length + adjustments.length + debts.length
  };
}
