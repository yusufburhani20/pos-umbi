// Background 1-Minute Sync Engine for Toko Umbi POS
import { api } from './api.js';
import {
  openOfflineDB,
  saveProductsLocal,
  saveCustomersLocal,
  saveSettingsLocal,
  getPendingOrdersLocal,
  markOrdersSyncedLocal,
  clearSyncedLocalOrders,
  getPendingAdjustmentsLocal,
  markAdjustmentsSyncedLocal,
  getPendingDebtPaymentsLocal,
  markDebtPaymentsSyncedLocal,
  getPendingCountSummary,
  setSyncMetaLocal,
  getSyncMetaLocal
} from './offline-db.js';

export const APP_CURRENT_VERSION = 'v41';
const SYNC_INTERVAL_MS = 60000; // 1 minute interval

class SyncEngine {
  constructor() {
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.pendingCount = 0;
    this.timer = null;
    this.listeners = new Set();
    this.deviceId = this.getOrCreateDeviceId();
    this.hasUpdate = false;
    this.latestServerVersion = null;
  }

  getOrCreateDeviceId() {
    let id = localStorage.getItem('pos_device_id');
    if (!id) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      id = `TAB-KIOS-${rand}`;
      localStorage.setItem('pos_device_id', id);
    }
    return id;
  }

  onStateChange(listener) {
    this.listeners.add(listener);
    // Emit immediate initial state
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('[SyncEngine] Error in listener:', e);
      }
    }
  }

  getState() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      pendingCount: this.pendingCount,
      deviceId: this.deviceId,
      hasUpdate: this.hasUpdate,
      currentVersion: APP_CURRENT_VERSION,
      latestVersion: this.latestServerVersion || APP_CURRENT_VERSION
    };
  }

  async init() {
    await openOfflineDB();

    // Load last sync time from metadata
    this.lastSyncTime = await getSyncMetaLocal('last_sync_time', null);
    await this.updatePendingCount();

    // Setup network listeners
    window.addEventListener('online', () => {
      console.log('[SyncEngine] Network connection detected. Triggering sync...');
      this.isOnline = true;
      this.notifyListeners();
      this.syncNow({ silent: true });
    });

    window.addEventListener('offline', () => {
      console.warn('[SyncEngine] Tablet is offline. Transactions will be queued locally.');
      this.isOnline = false;
      this.notifyListeners();
    });

    // Start 1-minute auto sync loop
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.syncNow({ silent: true });
    }, SYNC_INTERVAL_MS);

    // Initial sync
    if (navigator.onLine) {
      this.syncNow({ silent: true });
    }

    return this.getState();
  }

  async updatePendingCount() {
    try {
      const summary = await getPendingCountSummary();
      this.pendingCount = summary.totalPending;
      this.notifyListeners();
      return summary;
    } catch (e) {
      console.warn('[SyncEngine] Gagal menghitung antrean lokal:', e);
      return { totalPending: 0 };
    }
  }

  async syncNow(options = { silent: false }) {
    if (this.isSyncing) {
      return { status: 'already_syncing' };
    }

    this.isSyncing = true;
    this.notifyListeners();

    try {
      // 1. Check if backend is reachable & send heartbeat
      const statusRes = await api.getSyncStatus(this.deviceId);
      if (!statusRes || !statusRes.online) {
        throw new Error('Server backend tidak merespons');
      }
      this.isOnline = true;

      // Smart Version Detection: Bandingkan versi server dengan versi aplikasi lokal
      if (statusRes.app_version && statusRes.app_version !== APP_CURRENT_VERSION) {
        console.log(`[SyncEngine] 🚀 Versi baru terdeteksi di server: ${statusRes.app_version} (Lokal: ${APP_CURRENT_VERSION})`);
        this.hasUpdate = true;
        this.latestServerVersion = statusRes.app_version;
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) reg.update();
          }).catch(() => {});
        }
      }

      // 2. Gather pending outbox records from tablet's IndexedDB
      const pendingOrders = await getPendingOrdersLocal();
      const pendingAdjustments = await getPendingAdjustmentsLocal();
      const pendingDebts = await getPendingDebtPaymentsLocal();

      const hasOutboxItems = pendingOrders.length > 0 || pendingAdjustments.length > 0 || pendingDebts.length > 0;

      // 3. PUSH: Upload pending records to Cloud Server
      if (hasOutboxItems) {
        const payload = {
          device_id: this.deviceId,
          orders: pendingOrders,
          stock_adjustments: pendingAdjustments.map(a => a.payload),
          debt_payments: pendingDebts.map(d => d.payload)
        };

        const pushRes = await api.pushSyncData(payload);
        if (pushRes && pushRes.success) {
          // Mark as synced locally
          const orderNos = pendingOrders.map(o => o.order_no);
          const adjIds = pendingAdjustments.map(a => a.id);
          const debtIds = pendingDebts.map(d => d.id);

          await Promise.all([
            markOrdersSyncedLocal(orderNos),
            markAdjustmentsSyncedLocal(adjIds),
            markDebtPaymentsSyncedLocal(debtIds)
          ]);
          await clearSyncedLocalOrders();

          console.log(`[SyncEngine] Berhasil push ${pendingOrders.length} nota ke cloud server.`);
        }
      } else {
        // Even if no items were pending, keep outbox clean of any lingering synced orders
        await clearSyncedLocalOrders();
      }

      // 4. PULL: Fetch latest master catalog & settings from Cloud Server
      try {
        const pullRes = await api.pullSyncData(this.deviceId);
        if (pullRes && pullRes.success && pullRes.data) {
          const { products, customers, settings } = pullRes.data;
          await Promise.all([
            saveProductsLocal(products || []),
            saveCustomersLocal(customers || []),
            saveSettingsLocal(settings || {})
          ]);
        }
      } catch (pullErr) {
        // If pull fails (e.g. auth expired), don't block outbox sync success
        console.warn('[SyncEngine] Pull data master tertunda:', pullErr.message);
      }

      // Update sync metadata
      const now = new Date();
      this.lastSyncTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
      await setSyncMetaLocal('last_sync_time', this.lastSyncTime);
      await this.updatePendingCount();

      return { status: 'success', lastSyncTime: this.lastSyncTime };
    } catch (err) {
      console.warn('[SyncEngine] Sinkronisasi tertunda (offline atau server tidak terjangkau):', err.message);
      this.isOnline = false;
      await this.updatePendingCount();
      return { status: 'offline', error: err.message };
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }
}

export const syncEngine = new SyncEngine();
