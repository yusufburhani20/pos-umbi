import { api } from './api.js';
import { hardwareManager } from './hardware.js';
import { syncEngine } from './sync-engine.js';
import { clearActiveShiftLocal } from './offline-db.js';

// State
const state = {
  shift: null,
  user: null,
  settings: null,
  activePreviewType: null, // 'shift_x' | 'shift_z' | 'expense' | 'income'
  activePreviewData: null
};

// Helpers
function formatRupiah(val) {
  return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
}

function formatRupiahNumber(val) {
  return Number(val || 0).toLocaleString('id-ID');
}

function parseSafeDate(d) {
  if (!d) return new Date();
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? new Date() : dt;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(msg, type = 'info') {
  let toast = document.getElementById('cashierToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cashierToast';
    toast.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:99999;padding:12px 24px;border-radius:12px;font-weight:700;font-size:14px;color:#fff;box-shadow:0 12px 28px rgba(0,0,0,0.3);transition:all 0.3s cubic-bezier(0.16, 1, 0.3, 1);pointer-events:none;display:flex;align-items:center;gap:8px;';
    document.body.appendChild(toast);
  }
  const bgColors = {
    info: '#0284c7',
    success: '#059669',
    warning: '#d97706',
    error: '#dc2626'
  };
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  toast.style.background = bgColors[type] || '#0f172a';
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${escapeHtml(msg)}</span>`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
  }, 3200);
}

// DOM References
const el = {
  // Top-Bar Unified POS Header Elements
  cashierBrandTitle: document.getElementById('cashierBrandTitle'),
  cashierBrandSubtitle: document.getElementById('cashierBrandSubtitle'),
  liveDayDate: document.getElementById('liveDayDate'),
  liveClockTime: document.getElementById('liveClockTime'),
  syncStatusPill: document.getElementById('syncStatusPill'),
  syncStatusLabel: document.getElementById('syncStatusLabel'),
  syncSubLabel: document.getElementById('syncSubLabel'),
  btnManualSync: document.getElementById('btnManualSync'),
  printerStatusPill: document.getElementById('printerStatusPill'),
  printerStatusLabel: document.getElementById('printerStatusLabel'),
  printerSubLabel: document.getElementById('printerSubLabel'),
  btnHardwareModalTrigger: document.getElementById('btnHardwareModalTrigger'),

  btnToggleFullscreen: document.getElementById('btnToggleFullscreen'),
  btnQuickOpenDrawer: document.getElementById('btnQuickOpenDrawer'),
  btnHeaderPrintX: document.getElementById('btnHeaderPrintX'),
  btnExpensesQuickModal: document.getElementById('btnExpensesQuickModal'),
  btnHeaderCloseShift: document.getElementById('btnHeaderCloseShift'),
  btnLogout: document.getElementById('btnLogout'),
  btnManualLock: document.getElementById('btnManualLock'),

  // Lock Screen Elements
  modalLockScreen: document.getElementById('modalLockScreen'),
  lockCashierName: document.getElementById('lockCashierName'),
  inpLockPin: document.getElementById('inpLockPin'),
  lockNumpad: document.getElementById('lockNumpad'),
  btnUnlockScreen: document.getElementById('btnUnlockScreen'),
  btnLockLogout: document.getElementById('btnLockLogout'),

  activeCashierName: document.getElementById('activeCashierName'),
  activeShiftMeta: document.getElementById('activeShiftMeta'),
  dropdownUserDisplayName: document.getElementById('dropdownUserDisplayName'),
  dropdownUserRole: document.getElementById('dropdownUserRole'),
  cashierStatusDot: document.getElementById('cashierStatusDot'),

  // Content Area Elements
  activeShiftDashboard: document.getElementById('activeShiftDashboard'),
  noShiftSection: document.getElementById('noShiftSection'),
  inpDirectStartingCash: document.getElementById('inpDirectStartingCash'),
  btnDirectOpenShiftSubmit: document.getElementById('btnDirectOpenShiftSubmit'),
  stickyActionBar: document.getElementById('stickyActionBar'),

  pageStoreName: document.getElementById('pageStoreName'),
  pageShiftSubtitle: document.getElementById('pageShiftSubtitle'),
  badgeShiftText: document.getElementById('badgeShiftText'),
  badgeShiftStatus: document.getElementById('badgeShiftStatus'),
  btnKickDrawerTop: document.getElementById('btnKickDrawerTop'),
  btnRefreshPageData: document.getElementById('btnRefreshPageData'),

  kpiStartingCash: document.getElementById('kpiStartingCash'),
  kpiCashSales: document.getElementById('kpiCashSales'),
  kpiCashOrdersCount: document.getElementById('kpiCashOrdersCount'),
  kpiIncomeDebt: document.getElementById('kpiIncomeDebt'),
  kpiIncomeDebtMeta: document.getElementById('kpiIncomeDebtMeta'),
  kpiExpensesCash: document.getElementById('kpiExpensesCash'),
  kpiExpensesCount: document.getElementById('kpiExpensesCount'),

  formulaExplanation: document.getElementById('formulaExplanation'),
  expectedCashValue: document.getElementById('expectedCashValue'),

  btnResetDenom: document.getElementById('btnResetDenom'),
  d100k: document.getElementById('d100k'),
  d75k: document.getElementById('d75k'),
  d50k: document.getElementById('d50k'),
  d20k: document.getElementById('d20k'),
  d10k: document.getElementById('d10k'),
  d5k: document.getElementById('d5k'),
  d2k: document.getElementById('d2k'),
  d1k: document.getElementById('d1k'),
  dKoin: document.getElementById('dKoin'),
  sub100k: document.getElementById('sub100k'),
  sub75k: document.getElementById('sub75k'),
  sub50k: document.getElementById('sub50k'),
  sub20k: document.getElementById('sub20k'),
  sub10k: document.getElementById('sub10k'),
  sub5k: document.getElementById('sub5k'),
  sub2k: document.getElementById('sub2k'),
  sub1k: document.getElementById('sub1k'),
  subKoin: document.getElementById('subKoin'),

  totalCounted: document.getElementById('totalCounted'),
  varianceCard: document.getElementById('varianceCard'),
  varianceIcon: document.getElementById('varianceIcon'),
  varianceTitle: document.getElementById('varianceTitle'),
  varianceSubtitle: document.getElementById('varianceSubtitle'),
  varianceNominal: document.getElementById('varianceNominal'),
  cashierNotes: document.getElementById('cashierNotes'),

  badgeTotalOrders: document.getElementById('badgeTotalOrders'),
  salesCash: document.getElementById('salesCash'),
  salesQris: document.getElementById('salesQris'),
  salesTransfer: document.getElementById('salesTransfer'),
  salesTempo: document.getElementById('salesTempo'),
  totalOmset: document.getElementById('totalOmset'),
  expensesListContainer: document.getElementById('expensesListContainer'),

  btnPrintReportX: document.getElementById('btnPrintReportX'),
  btnCloseShiftZ: document.getElementById('btnCloseShiftZ'),
  thermalReceipt: document.getElementById('thermalReceipt'),

  // Receipt Preview Modal
  modalReceiptPreview: document.getElementById('modalReceiptPreview'),
  receiptPreviewTitle: document.getElementById('receiptPreviewTitle'),
  receiptPreviewContent: document.getElementById('receiptPreviewContent'),
  btnConfirmPrintReceipt: document.getElementById('btnConfirmPrintReceipt'),
  btnPreviewKickDrawer: document.getElementById('btnPreviewKickDrawer'),
  btnCancelReceiptPreview: document.getElementById('btnCancelReceiptPreview'),
  btnCloseReceiptPreview: document.getElementById('btnCloseReceiptPreview'),

  // Quick Expense Modal
  btnQuickExpense: document.getElementById('btnQuickExpense'),
  modalAddExpense: document.getElementById('modalAddExpense'),
  btnCloseAddExpense: document.getElementById('btnCloseAddExpense'),
  btnCancelAddExpense: document.getElementById('btnCancelAddExpense'),
  btnSubmitAddExpense: document.getElementById('btnSubmitAddExpense'),
  selectExpenseCategory: document.getElementById('selectExpenseCategory'),
  inputExpenseAmount: document.getElementById('inputExpenseAmount'),
  inputExpenseNotes: document.getElementById('inputExpenseNotes'),

  // Quick Income Modal
  btnQuickIncome: document.getElementById('btnQuickIncome'),
  modalAddIncome: document.getElementById('modalAddIncome'),
  btnCloseAddIncome: document.getElementById('btnCloseAddIncome'),
  btnCancelAddIncome: document.getElementById('btnCancelAddIncome'),
  btnSubmitAddIncome: document.getElementById('btnSubmitAddIncome'),
  selectIncomeCategory: document.getElementById('selectIncomeCategory'),
  inputIncomeAmount: document.getElementById('inputIncomeAmount'),
  inputIncomeNotes: document.getElementById('inputIncomeNotes')
};

// -----------------------------------------------------------------------------
// TOP-BAR HEADER HELPERS (Synced with POS Register)
// -----------------------------------------------------------------------------
function initHeaderClock() {
  function updateTime() {
    const now = new Date();
    if (el.liveClockTime) {
      el.liveClockTime.textContent = now.toLocaleTimeString('id-ID') + ' WIB';
    }
    if (el.liveDayDate) {
      el.liveDayDate.textContent = now.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
  }
  updateTime();
  setInterval(updateTime, 1000);
}

let pwaDismissedInCashier = false;
let isCashierUpdateReloading = false;

function showPwaUpdatePromptInCashier(newVersion) {
  if (pwaDismissedInCashier) return;
  try {
    if (sessionStorage.getItem('pwa_dismissed_ver_cashier') === String(newVersion)) return;
  } catch (e) {}
  let banner = document.getElementById('pwaUpdateFloatingBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'pwaUpdateFloatingBanner';
    banner.className = 'pwa-update-floating-banner';
    banner.innerHTML = `
      <div class="pwa-update-pill-inner">
        <div class="pwa-update-icon-glow">✨</div>
        <div class="pwa-update-text-col">
          <span class="pwa-update-title">Pembaruan Sistem Siap</span>
          <span class="pwa-update-desc" id="pwaUpdateVersionLabel">Versi terbaru (${newVersion || 'PWA'}) siap dipasang</span>
        </div>
        <div class="pwa-update-btn-group">
          <button type="button" class="btn-pwa-reload-action" id="btnApplyPwaUpdateCashier">
            <span>🔄</span> Muat Ulang
          </button>
          <button type="button" class="btn-pwa-dismiss-action" id="btnDismissPwaUpdateCashier" title="Tunda">✕</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);

    const btnApply = banner.querySelector('#btnApplyPwaUpdateCashier');
    if (btnApply) {
      btnApply.addEventListener('click', applyPwaUpdateInCashier);
    }
    const btnDismiss = banner.querySelector('#btnDismissPwaUpdateCashier');
    if (btnDismiss) {
      btnDismiss.addEventListener('click', () => {
        pwaDismissedInCashier = true;
        try {
          sessionStorage.setItem('pwa_dismissed_ver_cashier', String(newVersion || 'latest'));
        } catch (e) {}
        banner.style.display = 'none';
      });
    }
  } else {
    const desc = banner.querySelector('#pwaUpdateVersionLabel');
    if (desc) desc.textContent = `Versi terbaru (${newVersion || 'PWA'}) siap dipasang`;
    banner.style.display = 'block';
  }
}

async function applyPwaUpdateInCashier() {
  if (isCashierUpdateReloading) return;
  isCashierUpdateReloading = true;
  showToast('Memperbarui aplikasi ke versi terbaru...', 'success');

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        await reg.update().catch(() => {});
      }
    }
  } catch (e) {
    console.warn('[PWA Update] Gagal postMessage ke worker:', e);
  }

  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (!name.includes('v36')) {
          await caches.delete(name);
        }
      }
    } catch (e) {}
  }

  setTimeout(() => {
    window.location.reload();
  }, 400);
}

function updateHeaderStatusPills() {
  function updateSyncPill(syncState = syncEngine ? syncEngine.getState() : {}) {
    if (!el.syncStatusPill) return;
    const isOnline = syncState.isOnline !== undefined ? syncState.isOnline : navigator.onLine;
    const isSyncing = syncState.isSyncing || false;
    const pendingCount = syncState.pendingCount || 0;
    const lastSyncTime = syncState.lastSyncTime || null;

    el.syncStatusPill.classList.remove('online', 'offline', 'syncing');

    if (isSyncing) {
      el.syncStatusPill.classList.add('syncing');
      if (el.syncStatusLabel) el.syncStatusLabel.textContent = '🔄 Menyinkron...';
      if (el.syncSubLabel) el.syncSubLabel.textContent = 'Kirim data cloud...';
      if (el.btnManualSync) el.btnManualSync.classList.add('rotating');
    } else if (!isOnline) {
      el.syncStatusPill.classList.add('offline');
      if (el.syncStatusLabel) el.syncStatusLabel.textContent = pendingCount > 0 ? `🟡 Offline (${pendingCount})` : '🟡 Offline';
      if (el.syncSubLabel) el.syncSubLabel.textContent = 'Tersimpan di Tablet';
      if (el.btnManualSync) el.btnManualSync.classList.remove('rotating');
    } else {
      el.syncStatusPill.classList.add('online');
      if (el.syncStatusLabel) el.syncStatusLabel.textContent = pendingCount > 0 ? `🟢 Ada Antrean (${pendingCount})` : '🟢 Online';
      if (el.syncSubLabel) el.syncSubLabel.textContent = lastSyncTime ? `Sync ${lastSyncTime}` : 'Tersinkron (1 mnt)';
      if (el.btnManualSync) el.btnManualSync.classList.remove('rotating');
    }

    if (syncState && syncState.hasUpdate) {
      showPwaUpdatePromptInCashier(syncState.latestVersion);
    }
  }

  function updatePrinterPill(hwState = (hardwareManager ? hardwareManager.getState() : {})) {
    if (!el.printerStatusPill) return;
    if (hwState && hwState.isConnected) {
      el.printerStatusPill.className = 'printer-status-pill online';
      if (el.printerStatusLabel) el.printerStatusLabel.textContent = `🖨️ ${hwState.deviceName || 'Printer OK'}`;
      if (el.printerSubLabel) el.printerSubLabel.textContent = 'Bluetooth / Laci RJ-11';
      el.printerStatusPill.setAttribute('title', `Printer: Terhubung (${hwState.deviceName || 'Thermal'}) • Siap Cetak`);
    } else if (hwState && hwState.isReconnecting) {
      el.printerStatusPill.className = 'printer-status-pill reconnecting';
      if (el.printerStatusLabel) el.printerStatusLabel.textContent = '🖨️ Mencari Printer...';
      if (el.printerSubLabel) el.printerSubLabel.textContent = 'Auto-Reconnect';
      el.printerStatusPill.setAttribute('title', `Printer: Mencari ${hwState.lockedDeviceName || 'Printer'} secara otomatis...`);
    } else if (hwState && hwState.isLocked) {
      el.printerStatusPill.className = 'printer-status-pill offline';
      if (el.printerStatusLabel) el.printerStatusLabel.textContent = `🖨️ ${hwState.lockedDeviceName || 'Printer'} (Offline)`;
      if (el.printerSubLabel) el.printerSubLabel.textContent = 'Koneksi Terkunci (Klik Sambung)';
      el.printerStatusPill.setAttribute('title', `Printer: Terkunci ke ${hwState.lockedDeviceName} • Klik untuk sambungkan kembali`);
    } else {
      el.printerStatusPill.className = 'printer-status-pill offline';
      if (el.printerStatusLabel) el.printerStatusLabel.textContent = '🖨️ Printer: Putus';
      if (el.printerSubLabel) el.printerSubLabel.textContent = 'Bluetooth / Laci RJ-11';
      el.printerStatusPill.setAttribute('title', 'Printer: Terputus • Bluetooth / Laci Kasir (Klik untuk Pengaturan)');
    }
  }

  updateSyncPill();
  updatePrinterPill();

  if (syncEngine && syncEngine.onStateChange) {
    syncEngine.onStateChange(updateSyncPill);
  }

  if (hardwareManager && hardwareManager.subscribeState) {
    hardwareManager.subscribeState(updatePrinterPill);
  }

  // Quick Reconnect on Pill Click (Fix: Langsung sambungkan jika terkunci saat kasir pindah ke halaman ini)
  if (el.printerStatusPill) {
    el.printerStatusPill.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btnHardwareModalTrigger') return;
      const hwState = hardwareManager ? hardwareManager.getState() : {};
      if (hwState.isLocked && !hwState.isConnected) {
        showToast('Mencoba menyambungkan kembali ke printer terkunci...', 'info');
        hardwareManager.startAutoReconnectWatcher();
      } else {
        openEmbeddedModal('hardware');
      }
    });
  }

  // Auto trigger sync & update check when screen turns on
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      if (syncEngine && syncEngine.syncNow) {
        syncEngine.syncNow({ silent: true });
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg) reg.update().catch(() => {});
        }).catch(() => {});
      }
    }
  });

  window.addEventListener('online', () => updateSyncPill());
  window.addEventListener('offline', () => updateSyncPill());
}

function initHeaderDropdowns() {
  const storeTrigger = document.getElementById('btnStoreMenuTrigger');
  const storeDropdown = document.getElementById('storeMenuDropdown');
  const userTrigger = document.getElementById('shiftIndicator');
  const userDropdown = document.getElementById('userMenuDropdown');
  const backdrop = document.getElementById('headerDropdownBackdrop');

  function positionDropdownOnMobile(dropdownEl) {
    if (!dropdownEl) return;
    const menu = dropdownEl.querySelector('.header-dropdown-menu');
    if (!menu) return;
    if (window.innerWidth <= 900) {
      const topBar = document.querySelector('.top-bar');
      if (topBar) {
        const rect = topBar.getBoundingClientRect();
        menu.style.top = `${Math.round(rect.bottom + 6)}px`;
      }
    } else {
      menu.style.top = '';
    }
  }

  function closeAllDropdowns() {
    const topBar = document.querySelector('.top-bar');
    if (topBar) topBar.classList.remove('has-active-dropdown');

    if (storeDropdown) {
      storeDropdown.classList.remove('active');
      if (storeTrigger) storeTrigger.setAttribute('aria-expanded', 'false');
      const storeMenu = storeDropdown.querySelector('.header-dropdown-menu');
      if (storeMenu && window.innerWidth <= 900) storeMenu.style.top = '';
    }
    if (userDropdown) {
      userDropdown.classList.remove('active');
      if (userTrigger) userTrigger.setAttribute('aria-expanded', 'false');
      const userMenu = userDropdown.querySelector('.header-dropdown-menu');
      if (userMenu && window.innerWidth <= 900) userMenu.style.top = '';
    }
    if (backdrop) {
      backdrop.classList.remove('active');
      setTimeout(() => {
        if (!storeDropdown?.classList.contains('active') && !userDropdown?.classList.contains('active')) {
          backdrop.style.display = 'none';
        }
      }, 180);
    }
  }

  function openDropdown(dropdown, trigger) {
    const isAlreadyOpen = dropdown.classList.contains('active');
    closeAllDropdowns();
    if (!isAlreadyOpen) {
      const topBar = document.querySelector('.top-bar');
      if (topBar) topBar.classList.add('has-active-dropdown');

      dropdown.classList.add('active');
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
      positionDropdownOnMobile(dropdown);
      if (backdrop) {
        backdrop.style.display = 'block';
        void backdrop.offsetHeight;
        backdrop.classList.add('active');
      }
    }
  }

  if (storeTrigger && storeDropdown) {
    storeTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      openDropdown(storeDropdown, storeTrigger);
    });
  }

  if (userTrigger && userDropdown) {
    userTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      openDropdown(userDropdown, userTrigger);
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeAllDropdowns);
    backdrop.addEventListener('touchstart', (e) => {
      e.preventDefault();
      closeAllDropdowns();
    }, { passive: false });
  }

  // Close dropdown when clicking any item inside menu
  document.querySelectorAll('.header-dropdown-menu .header-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      closeAllDropdowns();
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.header-dropdown')) {
      closeAllDropdowns();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllDropdowns();
    }
  });

  const btnReloadAppCashier = document.getElementById('btnReloadAppCashier');
  if (btnReloadAppCashier) {
    btnReloadAppCashier.addEventListener('click', async () => {
      if ('serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            await reg.update();
          }
        } catch (e) {}
      }
      setTimeout(() => {
        window.location.reload();
      }, 300);
    });
  }

  window.addEventListener('resize', () => {
    if (storeDropdown?.classList.contains('active')) positionDropdownOnMobile(storeDropdown);
    if (userDropdown?.classList.contains('active')) positionDropdownOnMobile(userDropdown);
  });
}

// -----------------------------------------------------------------------------
// LOAD DATA
// -----------------------------------------------------------------------------
async function initCashierPage() {
  try {
    initHeaderClock();
    initHeaderDropdowns();
    updateHeaderStatusPills();

    // 1. Load Store Settings
    const setRes = await api.getSettings().catch(() => null);
    if (setRes && setRes.settings) {
      state.settings = setRes.settings;
      if (el.cashierBrandTitle) {
        el.cashierBrandTitle.textContent = state.settings.store_name || 'PD. HASIL BUMI RAYA 1';
      }
      if (el.cashierBrandSubtitle) {
        el.cashierBrandSubtitle.textContent = state.settings.store_tagline || 'Kassa POS • Kasir & Admin';
      }
      if (el.pageStoreName) {
        el.pageStoreName.textContent = state.settings.store_name || 'PD. HASIL BUMI RAYA 1';
      }
    }

    // 2. Load User Profile
    const meRes = await api.getMe().catch(() => null);
    if (meRes && meRes.user) {
      state.user = meRes.user;
    }

    // 3. Load Active Shift
    await loadActiveShiftData();
  } catch (err) {
    console.error('Error initializing cashier page:', err);
    showToast('Gagal memuat data kasir: ' + err.message, 'error');
  }
}

async function loadActiveShiftData() {
  try {
    if (el.btnRefreshPageData) {
      el.btnRefreshPageData.disabled = true;
      el.btnRefreshPageData.innerHTML = '<span>⏳</span> Memuat...';
    }

    const res = await api.getCurrentShift().catch(() => null);
    if (!res || !res.has_active_shift) {
      // BELUM ADA SHIFT: Tampilkan kartu bersih ramah pengguna di cashier.html
      state.shift = null;
      await clearActiveShiftLocal().catch(() => {});
      if (el.activeShiftDashboard) el.activeShiftDashboard.style.display = 'none';
      if (el.stickyActionBar) el.stickyActionBar.style.display = 'none';
      if (el.noShiftSection) el.noShiftSection.style.display = 'block';

      if (el.inpDirectStartingCash && !el.inpDirectStartingCash.value) {
        el.inpDirectStartingCash.value = '200.000';
      }

      if (el.activeShiftMeta) el.activeShiftMeta.textContent = 'Shift Belum Dibuka';
      if (el.badgeShiftText) el.badgeShiftText.textContent = '🔴 Shift Belum Dibuka';
      if (el.badgeShiftStatus) el.badgeShiftStatus.textContent = 'Shift Belum Dibuka';
      if (el.pageShiftSubtitle) el.pageShiftSubtitle.textContent = 'Toko belum membuka shift aktif hari ini. Buka shift kasir di bawah untuk memulai.';
      if (el.btnHeaderCloseShift) el.btnHeaderCloseShift.style.display = 'none';
      if (el.btnRefreshPageData) {
        el.btnRefreshPageData.disabled = false;
        el.btnRefreshPageData.innerHTML = '<span>🔄</span> Segarkan Data';
      }
      return;
    }

    // ADA SHIFT AKTIF: Tampilkan dashboard & bottom bar, sembunyikan kartu noShift
    if (el.noShiftSection) el.noShiftSection.style.display = 'none';
    if (el.activeShiftDashboard) el.activeShiftDashboard.style.display = 'block';
    if (el.stickyActionBar) el.stickyActionBar.style.display = 'block';
    if (el.btnHeaderCloseShift) el.btnHeaderCloseShift.style.display = 'flex';

    state.shift = res.shift;
    const s = state.shift;

    // Header Badges - Resolve clean cashier name (never display raw 'Owner')
    function resolveCashierName(shiftObj, userObj) {
      if (userObj && userObj.name && userObj.role === 'cashier') return userObj.name;
      if (shiftObj && shiftObj.cashier_name && shiftObj.cashier_name.toLowerCase() !== 'owner') return shiftObj.cashier_name;
      if (userObj && userObj.name && userObj.name.toLowerCase() !== 'owner') return userObj.name;
      return 'Kasir (Admin)';
    }

    const cashierName = resolveCashierName(s, state.user);
    state.resolvedCashierName = cashierName;
    const startTimeStr = parseSafeDate(s.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Update Header User & Shift Info (Synced with POS Register Header)
    if (el.activeCashierName) {
      el.activeCashierName.textContent = cashierName;
    }
    if (el.activeShiftMeta) {
      el.activeShiftMeta.textContent = `Shift Aktif #${s.id}`;
    }
    if (el.dropdownUserDisplayName) {
      el.dropdownUserDisplayName.textContent = cashierName;
    }
    if (el.dropdownUserRole) {
      el.dropdownUserRole.textContent = state.user?.role === 'owner' ? 'Owner & Admin Kios' : 'Kasir & Admin Kios';
    }

    if (el.badgeShiftText) {
      el.badgeShiftText.textContent = `Shift Aktif #${s.id} • ${cashierName}`;
    }
    if (el.pageShiftSubtitle) {
      el.pageShiftSubtitle.textContent = `Petugas: ${cashierName} • Buka: ${startTimeStr} WIB • Modal Awal: ${formatRupiah(s.starting_cash)}`;
    }

    // 4 KPI Cards
    if (el.kpiStartingCash) {
      el.kpiStartingCash.textContent = formatRupiah(s.starting_cash || 0);
    }
    if (el.kpiCashSales) {
      el.kpiCashSales.textContent = formatRupiah(s.cash_sales || 0);
    }
    if (el.kpiCashOrdersCount) {
      el.kpiCashOrdersCount.textContent = `${s.total_orders || 0} transaksi lunas tunai`;
    }
    if (el.kpiIncomeDebt) {
      const totalIn = Number(s.cash_income || 0) + Number(s.cash_debt_collected || 0);
      el.kpiIncomeDebt.textContent = `+${formatRupiah(totalIn)}`;
    }
    if (el.kpiIncomeDebtMeta) {
      el.kpiIncomeDebtMeta.textContent = `Masuk: ${formatRupiah(s.cash_income || 0)} | Bon: ${formatRupiah(s.cash_debt_collected || 0)}`;
    }
    if (el.kpiExpensesCash) {
      el.kpiExpensesCash.textContent = `-${formatRupiah(s.cash_expenses || 0)}`;
    }
    if (el.kpiExpensesCount) {
      const expCount = (s.recent_expenses && s.recent_expenses.length) || 0;
      el.kpiExpensesCount.textContent = `${expCount} pengeluaran laci shift ini`;
    }

    // Expected Cash Formula
    const starting = Number(s.starting_cash || 0);
    const cashSales = Number(s.cash_sales || 0);
    const debtIn = Number(s.cash_debt_collected || 0);
    const incIn = Number(s.cash_income || 0);
    const expOut = Number(s.cash_expenses || 0);
    const supOut = Number(s.cash_supplier_payments || 0);
    const expected = starting + cashSales + debtIn + incIn - expOut - supOut;

    if (el.formulaExplanation) {
      el.formulaExplanation.textContent = `Modal [${formatRupiah(starting)}] + Tunai [${formatRupiah(cashSales)}] + Bon [${formatRupiah(debtIn)}] + Kas Masuk [${formatRupiah(incIn)}] - Biaya [${formatRupiah(expOut)}] = Saldo Seharusnya`;
    }
    if (el.expectedCashValue) {
      el.expectedCashValue.textContent = formatRupiah(expected);
    }

    // Transactions breakdown
    if (el.badgeTotalOrders) el.badgeTotalOrders.textContent = `${s.total_orders || 0} Nota Transaksi`;
    if (el.salesCash) el.salesCash.textContent = formatRupiah(cashSales);
    if (el.salesQris) el.salesQris.textContent = formatRupiah(s.qris_sales || 0);
    if (el.salesTransfer) el.salesTransfer.textContent = formatRupiah(s.transfer_sales || 0);
    if (el.salesTempo) el.salesTempo.textContent = formatRupiah(s.tempo_sales || 0);
    if (el.totalOmset) el.totalOmset.textContent = formatRupiah(s.total_omset || 0);

    // Recent Expenses List with Print buttons
    if (el.expensesListContainer) {
      if (s.recent_expenses && s.recent_expenses.length > 0) {
        el.expensesListContainer.innerHTML = s.recent_expenses.map(e => {
          const isIncome = e.type === 'income';
          const timeStr = parseSafeDate(e.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          const catLabel = e.category_name || e.category || (isIncome ? 'Kas Masuk Laci' : 'Biaya Operasional');
          const borderClr = isIncome ? '#bbf7d0' : '#fee2e2';
          const bgClr = isIncome ? '#f0fdf4' : '#fff5f5';
          const textClr = isIncome ? '#166534' : '#991b1b';
          const amountSign = isIncome ? '+' : '-';
          const amountClr = isIncome ? '#15803d' : '#b91c1c';

          return `
            <div style="display: flex; justify-content: space-between; align-items: center; background: ${bgClr}; border: 1px solid ${borderClr}; border-radius: 10px; padding: 10px 14px; gap: 8px;">
              <div style="flex: 1; min-width: 0;">
                <strong style="color: ${textClr}; display: block; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${isIncome ? '📥' : '💸'} ${escapeHtml(catLabel)}
                </strong>
                <span style="color: #64748b; font-size: 11.5px; display: block; margin-top: 2px;">
                  ${escapeHtml(e.notes || '-')} • ${timeStr} WIB • 👤 ${escapeHtml(e.recorded_by_name || 'Kasir')}
                </span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                <strong style="font-family: 'JetBrains Mono', monospace; color: ${amountClr}; font-size: 14px;">
                  ${amountSign}${formatRupiah(e.amount)}
                </strong>
                <button type="button" class="btn-preview-expense" data-id="${e.id}" style="padding: 5px 10px; border-radius: 6px; background: #e0f2fe; border: 1px solid #bae6fd; color: #0284c7; font-weight: 700; font-size: 11.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Pratinjau & Cetak Struk Bukti Kas">
                  <span>🖨️</span> Cetak
                </button>
              </div>
            </div>
          `;
        }).join('');

        // Wire event listener on each Cetak button
        el.expensesListContainer.querySelectorAll('.btn-preview-expense').forEach(btn => {
          btn.addEventListener('click', () => {
            const expId = Number(btn.dataset.id);
            const exp = (state.shift.recent_expenses || []).find(x => x.id === expId);
            if (exp) {
              openReceiptPreview(exp.type === 'income' ? 'income' : 'expense', exp);
            }
          });
        });
      } else {
        el.expensesListContainer.innerHTML = `
          <div style="text-align: center; color: #94a3b8; font-size: 13px; padding: 24px;">
            Belum ada pengeluaran kas laci pada shift ini.
          </div>
        `;
      }
    }

    recalculateDenominations();
  } catch (err) {
    console.error('Error loading shift data:', err);
    showToast('Gagal memuat data shift: ' + err.message, 'error');
  } finally {
    if (el.btnRefreshPageData) {
      el.btnRefreshPageData.disabled = false;
      el.btnRefreshPageData.innerHTML = '<span>🔄</span> Segarkan';
    }
  }
}

// -----------------------------------------------------------------------------
// DENOMINATIONS & VARIANCE CALCULATION
// -----------------------------------------------------------------------------
function recalculateDenominations() {
  const d100 = (Number(el.d100k ? el.d100k.value : 0) || 0) * 100000;
  const d75 = (Number(el.d75k ? el.d75k.value : 0) || 0) * 75000;
  const d50 = (Number(el.d50k ? el.d50k.value : 0) || 0) * 50000;
  const d20 = (Number(el.d20k ? el.d20k.value : 0) || 0) * 20000;
  const d10 = (Number(el.d10k ? el.d10k.value : 0) || 0) * 10000;
  const d5 = (Number(el.d5k ? el.d5k.value : 0) || 0) * 5000;
  const d2 = (Number(el.d2k ? el.d2k.value : 0) || 0) * 2000;
  const d1 = (Number(el.d1k ? el.d1k.value : 0) || 0) * 1000;
  const dKoin = Number(el.dKoin ? el.dKoin.value : 0) || 0;

  if (el.sub100k) el.sub100k.textContent = formatRupiah(d100);
  if (el.sub75k) el.sub75k.textContent = formatRupiah(d75);
  if (el.sub50k) el.sub50k.textContent = formatRupiah(d50);
  if (el.sub20k) el.sub20k.textContent = formatRupiah(d20);
  if (el.sub10k) el.sub10k.textContent = formatRupiah(d10);
  if (el.sub5k) el.sub5k.textContent = formatRupiah(d5);
  if (el.sub2k) el.sub2k.textContent = formatRupiah(d2);
  if (el.sub1k) el.sub1k.textContent = formatRupiah(d1);
  if (el.subKoin) el.subKoin.textContent = formatRupiah(dKoin);

  const total = d100 + d75 + d50 + d20 + d10 + d5 + d2 + d1 + dKoin;
  if (el.totalCounted) el.totalCounted.textContent = formatRupiah(total);

  // Expected
  const s = state.shift || {};
  const starting = Number(s.starting_cash || 0);
  const cashSales = Number(s.cash_sales || 0);
  const debtIn = Number(s.cash_debt_collected || 0);
  const incIn = Number(s.cash_income || 0);
  const expOut = Number(s.cash_expenses || 0);
  const supOut = Number(s.cash_supplier_payments || 0);
  const expected = starting + cashSales + debtIn + incIn - expOut - supOut;

  const diff = total - expected;

  if (el.varianceCard) {
    el.varianceCard.classList.remove('balanced', 'shortage', 'surplus');
    if (diff === 0) {
      el.varianceCard.classList.add('balanced');
      if (el.varianceIcon) el.varianceIcon.textContent = '✅';
      if (el.varianceTitle) el.varianceTitle.textContent = 'KAS BALANCE (SESUAI)';
      if (el.varianceSubtitle) el.varianceSubtitle.textContent = 'Uang fisik tepat sesuai dengan catatan kalkulasi sistem.';
      if (el.varianceNominal) {
        el.varianceNominal.textContent = 'Selisih: Rp 0';
        el.varianceNominal.style.color = '#059669';
      }
    } else if (diff < 0) {
      el.varianceCard.classList.add('shortage');
      if (el.varianceIcon) el.varianceIcon.textContent = '⚠️';
      if (el.varianceTitle) el.varianceTitle.textContent = 'SELISIH KURANG (MINUS TEKOR)';
      if (el.varianceSubtitle) el.varianceSubtitle.textContent = 'Uang fisik di laci kurang dari catatan sistem. Periksa kembali kembalian atau nota bon.';
      if (el.varianceNominal) {
        el.varianceNominal.textContent = `Kurang: -${formatRupiah(Math.abs(diff))}`;
        el.varianceNominal.style.color = '#dc2626';
      }
    } else {
      el.varianceCard.classList.add('surplus');
      if (el.varianceIcon) el.varianceIcon.textContent = 'ℹ️';
      if (el.varianceTitle) el.varianceTitle.textContent = 'SELISIH LEBIH (SURPLUS)';
      if (el.varianceSubtitle) el.varianceSubtitle.textContent = 'Uang fisik di laci lebih banyak daripada catatan sistem.';
      if (el.varianceNominal) {
        el.varianceNominal.textContent = `Lebih: +${formatRupiah(diff)}`;
        el.varianceNominal.style.color = '#d97706';
      }
    }
  }

  const breakdown = { d100k: d100, d75k: d75, d50k: d50, d20k: d20, d10k: d10, d5k: d5, d2k: d2, d1k: d1, dKoin };
  return { total, breakdown, diff, expected };
}

// -----------------------------------------------------------------------------
// RECEIPT PREVIEW MODAL LOGIC (PRATINJAU STRUK SEBELUM CETAK)
// -----------------------------------------------------------------------------
function openReceiptPreview(type, data) {
  state.activePreviewType = type;
  state.activePreviewData = data;

  let htmlReceipt = '';
  let titleText = 'Pratinjau Struk Thermal';

  if (type === 'shift_x') {
    titleText = 'Pratinjau Struk Laporan Harian (Cek Kas Berjalan)';
    htmlReceipt = renderThermalShiftReceipt(data, 'X');
    if (el.btnConfirmPrintReceipt) {
      el.btnConfirmPrintReceipt.innerHTML = '<span>🖨️</span> Cetak ke Printer Thermal';
    }
    if (el.btnCancelReceiptPreview) {
      el.btnCancelReceiptPreview.textContent = 'Tutup';
    }
  } else if (type === 'shift_z') {
    titleText = 'Pratinjau Struk Laporan Harian (Tutup Shift Kasir)';
    htmlReceipt = renderThermalShiftReceipt(data, 'Z');
    if (el.btnConfirmPrintReceipt) {
      el.btnConfirmPrintReceipt.innerHTML = '<span>🖨️</span> Cetak & Keluar ke PIN Kasir';
    }
    if (el.btnCancelReceiptPreview) {
      el.btnCancelReceiptPreview.textContent = 'Selesai & Keluar ke PIN';
    }
  } else if (type === 'expense') {
    titleText = 'Pratinjau Struk Biaya Operasional';
    htmlReceipt = renderThermalExpenseReceipt(data, false);
    if (el.btnConfirmPrintReceipt) {
      el.btnConfirmPrintReceipt.innerHTML = '<span>🖨️</span> Cetak ke Printer Thermal';
    }
    if (el.btnCancelReceiptPreview) {
      el.btnCancelReceiptPreview.textContent = 'Tutup';
    }
  } else if (type === 'income') {
    titleText = 'Pratinjau Bukti Kas Masuk Laci';
    htmlReceipt = renderThermalExpenseReceipt(data, false);
    if (el.btnConfirmPrintReceipt) {
      el.btnConfirmPrintReceipt.innerHTML = '<span>🖨️</span> Cetak ke Printer Thermal';
    }
    if (el.btnCancelReceiptPreview) {
      el.btnCancelReceiptPreview.textContent = 'Tutup';
    }
  }

  if (el.receiptPreviewTitle) {
    el.receiptPreviewTitle.textContent = titleText;
  }
  if (el.receiptPreviewContent) {
    el.receiptPreviewContent.innerHTML = htmlReceipt;
  }
  if (el.thermalReceipt) {
    el.thermalReceipt.innerHTML = htmlReceipt;
  }

  if (el.modalReceiptPreview) {
    el.modalReceiptPreview.style.display = 'flex';
    const rBody = el.modalReceiptPreview.querySelector('.modal-body');
    if (rBody) rBody.scrollTop = 0;
  }
}

function closeReceiptPreview() {
  const wasZ = state.activePreviewType === 'shift_z';
  if (el.modalReceiptPreview) {
    el.modalReceiptPreview.style.display = 'none';
  }
  state.activePreviewType = null;
  state.activePreviewData = null;

  if (wasZ) {
    api.clearSession();
    clearActiveShiftLocal().catch(() => {});
    window.location.href = '/';
  }
}

async function handleConfirmPrintReceipt() {
  if (!state.activePreviewData || !state.activePreviewType) {
    showToast('Tidak ada dokumen yang sedang dipratinjau.', 'warning');
    return;
  }

  const origBtnText = el.btnConfirmPrintReceipt ? el.btnConfirmPrintReceipt.innerHTML : '';
  try {
    if (el.btnConfirmPrintReceipt) {
      el.btnConfirmPrintReceipt.disabled = true;
      el.btnConfirmPrintReceipt.innerHTML = '<span>⏳</span> Mengirim ke Printer...';
    }

    const settings = state.settings || {};
    const type = state.activePreviewType;
    const data = state.activePreviewData;

    if (type === 'shift_x' || type === 'shift_z') {
      const modeType = type === 'shift_z' ? 'Z' : 'X';
      await hardwareManager.printShiftReport(data, modeType, settings);
      const repLabel = 'Laporan Harian';
      showToast(`🖨️ Struk ${repLabel} berhasil dicetak!`, 'success');
      if (type === 'shift_z') {
        setTimeout(() => {
          closeReceiptPreview();
        }, 1200);
        return;
      }
    } else if (type === 'expense' || type === 'income') {
      await hardwareManager.printExpense(data, settings, false);
      showToast('🖨️ Bukti kas berhasil dicetak ke printer!', 'success');
    }

    closeReceiptPreview();
  } catch (err) {
    console.warn('[Print] Gagal cetak thermal, fallback ke system print:', err);
    showToast('Printer belum terhubung (' + err.message + '). Membuka cetak browser...', 'warning');
    window.print();
    if (state.activePreviewType === 'shift_z') {
      setTimeout(() => {
        closeReceiptPreview();
      }, 1500);
      return;
    }
  } finally {
    if (el.btnConfirmPrintReceipt) {
      el.btnConfirmPrintReceipt.disabled = false;
      el.btnConfirmPrintReceipt.innerHTML = origBtnText;
    }
  }
}

// -----------------------------------------------------------------------------
// BUKA SHIFT LANGSUNG DARI HALAMAN CASHIER.HTML
// -----------------------------------------------------------------------------
async function handleDirectOpenShift() {
  const raw = el.inpDirectStartingCash ? el.inpDirectStartingCash.value.replace(/[^0-9]/g, '') : '';
  const amount = Number(raw) || 0;

  try {
    if (el.btnDirectOpenShiftSubmit) {
      el.btnDirectOpenShiftSubmit.disabled = true;
      el.btnDirectOpenShiftSubmit.innerHTML = '<span>⏳</span> Membuka Shift Kasir...';
    }

    const res = await api.openShift(amount);
    showToast(`🎉 Shift kasir berhasil dibuka dengan modal ${formatRupiah(amount)}!`, 'success');

    // Reload shift data & tampilkan dashboard otomatis
    await loadActiveShiftData();
  } catch (err) {
    console.error('Gagal membuka shift kasir:', err);
    showToast('Gagal membuka shift: ' + (err.message || 'Terjadi kesalahan sistem'), 'error');
  } finally {
    if (el.btnDirectOpenShiftSubmit) {
      el.btnDirectOpenShiftSubmit.disabled = false;
      el.btnDirectOpenShiftSubmit.innerHTML = '<span>🚀</span> Buka Shift Kasir Sekarang';
    }
  }
}

// -----------------------------------------------------------------------------
// PRINT LAPORAN HARIAN (CEK SALDO BERJALAN) -> BUKA PRATINJAU DULU
// -----------------------------------------------------------------------------
function handlePrintReportX() {
  if (!state.shift) {
    showToast('Tidak ada shift aktif yang bisa dicetak.', 'warning');
    return;
  }

  const { total, breakdown, diff, expected } = recalculateDenominations();
  const reportData = {
    ...state.shift,
    cashier_name: state.resolvedCashierName || (state.user ? state.user.name : 'Kasir (Admin)'),
    actual_cash: total,
    breakdown,
    expected_system_cash: expected,
    cash_difference: diff,
    closing_notes: el.cashierNotes ? el.cashierNotes.value : ''
  };

  // Sediakan preview struk terlebih dahulu seperti struk transaksi
  openReceiptPreview('shift_x', reportData);
}

// -----------------------------------------------------------------------------
// TUTUP SHIFT & PRINT LAPORAN HARIAN
// -----------------------------------------------------------------------------
async function handleCloseShiftZ() {
  if (!state.shift) {
    showToast('Tidak ada shift aktif yang bisa ditutup.', 'warning');
    return;
  }

  const { total, breakdown, diff, expected } = recalculateDenominations();

  let confirmMsg = `Konfirmasi Tutup Shift #${state.shift.id}?\n\nTotal Fisik Dihitung: ${formatRupiah(total)}\nSaldo Seharusnya: ${formatRupiah(expected)}`;
  if (diff === 0) {
    confirmMsg += '\n\n✅ Status: KAS BALANCE (Rp 0)';
  } else if (diff < 0) {
    confirmMsg += `\n\n⚠️ PERHATIAN: Terdapat SELISIH KURANG sebesar ${formatRupiah(Math.abs(diff))}!\nSelisih akan tercatat ke laporan Owner kios. Pastikan catatan keterangan sudah diisi.`;
  } else {
    confirmMsg += `\n\nℹ️ Status: SELISIH LEBIH ${formatRupiah(diff)}`;
  }
  confirmMsg += '\n\nSistem akan menutup shift, membuka laci kasir otomatis, dan menampilkan pratinjau Laporan Harian untuk dicetak.';

  if (!confirm(confirmMsg)) return;

  try {
    if (el.btnCloseShiftZ) {
      el.btnCloseShiftZ.disabled = true;
      el.btnCloseShiftZ.innerHTML = '<span>⏳</span> Menutup Shift...';
    }

    const notes = el.cashierNotes ? el.cashierNotes.value : '';
    const res = await api.closeShift(
      state.shift.id,
      total,
      breakdown,
      notes
    );

    const sum = res.summary;

    // Buka pratinjau struk Laporan Harian
    openReceiptPreview('shift_z', sum);

    let alertMsg = `Shift Kasir #${sum.shift_id} Berhasil Ditutup!\nTotal Fisik: ${formatRupiah(sum.actual_cash_input)}`;
    if (sum.is_balanced) {
      alertMsg += '\nStatus: KAS BALANCE (Sesuai Sistem)';
    } else if (sum.cash_difference < 0) {
      alertMsg += `\n⚠️ PERHATIAN: Selisih KURANG ${formatRupiah(Math.abs(sum.cash_difference))} (Tercatat ke Log Owner)`;
    } else {
      alertMsg += `\nStatus: Selisih LEBIH ${formatRupiah(sum.cash_difference)}`;
    }
    showToast(alertMsg, 'success');
  } catch (err) {
    showToast('Gagal menutup shift: ' + err.message, 'error');
  } finally {
    if (el.btnCloseShiftZ) {
      el.btnCloseShiftZ.disabled = false;
      el.btnCloseShiftZ.innerHTML = '<span>🔒</span> Tutup Shift & Cetak Laporan Harian';
    }
  }
}

// -----------------------------------------------------------------------------
// RENDER THERMAL SHIFT RECEIPT (LAPORAN HARIAN)
// -----------------------------------------------------------------------------
function renderThermalShiftReceipt(shiftData, type = 'X') {
  const isZ = type === 'Z';
  const timeFormatted = new Date().toLocaleString('id-ID');
  const sName = (state.settings && state.settings.store_name) || 'PD. HASIL BUMI RAYA 1';
  const sTagline = (state.settings && state.settings.store_tagline) || 'Pusat Umbi, Bawang & Komoditas';
  const sAddress = (state.settings && state.settings.store_address) || '';
  const sPhone = (state.settings && state.settings.store_phone) || '';

  const startingCash = Number(shiftData.starting_cash || 0);
  const cashSales = Number(shiftData.cash_sales || shiftData.total_cash_sales || 0);
  const cashDebt = Number(shiftData.cash_debt_collected || shiftData.total_cash_debt_collected || 0);
  const cashIncome = Number(shiftData.cash_income || shiftData.total_cash_income || 0);
  const cashExpenses = Number(shiftData.cash_expenses || shiftData.total_cash_expenses || 0);
  const cashSupplier = Number(shiftData.cash_supplier_payments || shiftData.total_cash_supplier_paid || 0);
  const expectedCash = startingCash + cashSales + cashDebt + cashIncome - cashExpenses - cashSupplier;
  const actualCash = Number(shiftData.actual_cash !== undefined ? shiftData.actual_cash : (shiftData.actual_cash_input !== undefined ? shiftData.actual_cash_input : expectedCash));
  const diff = actualCash - expectedCash;

  const qris = Number(shiftData.qris_sales || shiftData.total_qris || 0);
  const transfer = Number(shiftData.transfer_sales || shiftData.total_transfer || 0);
  const tempo = Number(shiftData.tempo_sales || shiftData.total_tempo || 0);
  const totalOmset = Number(shiftData.total_omset || (cashSales + qris + transfer + tempo));
  const totalOrders = shiftData.total_orders || '-';

  let varianceBadge = '';
  if (diff === 0) {
    varianceBadge = '<div style="color: #059669; font-weight: 800; font-size: 13px;">[ ✅ KAS BALANCE (SESUAI) ]</div>';
  } else if (diff < 0) {
    varianceBadge = `<div style="color: #dc2626; font-weight: 800; font-size: 13px;">[ ⚠️ SELISIH KURANG ${formatRupiah(Math.abs(diff))} ]</div>`;
  } else {
    varianceBadge = `<div style="color: #d97706; font-weight: 800; font-size: 13px;">[ ℹ️ SELISIH LEBIH ${formatRupiah(diff)} ]</div>`;
  }

  // Extract clean breakdown object if available
  let breakdownObj = null;
  if (shiftData.breakdown && typeof shiftData.breakdown === 'object') {
    breakdownObj = shiftData.breakdown;
  } else {
    const rawNotes = shiftData.closing_notes || shiftData.notes || '';
    const match = String(rawNotes).match(/^Breakdown\s*:\s*(\{[\s\S]*?\})/i);
    if (match) {
      try { breakdownObj = JSON.parse(match[1]); } catch (e) { breakdownObj = null; }
    }
  }

  let breakdownHtml = '';
  if (breakdownObj && typeof breakdownObj === 'object') {
    const b = breakdownObj;
    const bRows = [];
    if (b.d100k) bRows.push(`<span>Rp 100.000 x ${Math.round(b.d100k / 100000)}</span><span style="font-family:monospace;">${formatRupiah(b.d100k)}</span>`);
    if (b.d75k)  bRows.push(`<span>Rp 75.000 x ${Math.round(b.d75k / 75000)}</span><span style="font-family:monospace;">${formatRupiah(b.d75k)}</span>`);
    if (b.d50k)  bRows.push(`<span>Rp 50.000 x ${Math.round(b.d50k / 50000)}</span><span style="font-family:monospace;">${formatRupiah(b.d50k)}</span>`);
    if (b.d20k)  bRows.push(`<span>Rp 20.000 x ${Math.round(b.d20k / 20000)}</span><span style="font-family:monospace;">${formatRupiah(b.d20k)}</span>`);
    if (b.d10k)  bRows.push(`<span>Rp 10.000 x ${Math.round(b.d10k / 10000)}</span><span style="font-family:monospace;">${formatRupiah(b.d10k)}</span>`);
    if (b.d5k)   bRows.push(`<span>Rp 5.000 x ${Math.round(b.d5k / 5000)}</span><span style="font-family:monospace;">${formatRupiah(b.d5k)}</span>`);
    if (b.d2k)   bRows.push(`<span>Rp 2.000 x ${Math.round(b.d2k / 2000)}</span><span style="font-family:monospace;">${formatRupiah(b.d2k)}</span>`);
    if (b.d1k)   bRows.push(`<span>Rp 1.000 x ${Math.round(b.d1k / 1000)}</span><span style="font-family:monospace;">${formatRupiah(b.d1k)}</span>`);
    if (b.dKoin) bRows.push(`<span>Koin / Receh</span><span style="font-family:monospace;">${formatRupiah(b.dKoin)}</span>`);

    if (bRows.length > 0) {
      breakdownHtml = `
        <div class="receipt-divider"></div>
        <div style="font-size: 11px; line-height: 1.45;">
          <div style="font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">RINCIAN PECAHAN UANG LACI:</div>
          ${bRows.map(r => `<div style="display:flex; justify-content:space-between;">${r}</div>`).join('')}
        </div>
      `;
    }
  }

  // Extract clean human cashier notes (strip any raw "Breakdown: {...}." text)
  let cleanNotes = String(shiftData.closing_notes || shiftData.notes || '').trim();
  cleanNotes = cleanNotes.replace(/^Breakdown\s*:\s*\{[\s\S]*?\}\s*(\.|\;)?\s*/i, '').trim();

  return `
    <div class="receipt-header">
      <div class="receipt-title">${escapeHtml(sName)}</div>
      <div>${escapeHtml(sTagline)}</div>
      ${sAddress ? `<div style="font-size:11px; margin-top:2px;">${escapeHtml(sAddress)}</div>` : ''}
      ${sPhone ? `<div style="font-size:11px;">Telp/WA: ${escapeHtml(sPhone)}</div>` : ''}
      <div class="receipt-divider"></div>
      <div style="font-weight: 800; font-size: 13px; text-transform: uppercase; margin: 4px 0;">
        ${isZ ? '*** LAPORAN HARIAN (TUTUP KASIR) ***' : '*** LAPORAN HARIAN (CEK KAS BERJALAN) ***'}
      </div>
      <div style="font-size: 11px; color: #475569;">
        ${isZ ? '(REKONSILIASI KAS & PENUTUPAN HARIAN)' : '(RINGKASAN SALDO KAS BERJALAN)'}
      </div>
      <div style="margin-top: 6px;">No. Shift   : #${escapeHtml(String(shiftData.id || shiftData.shift_id || '-'))}</div>
      <div>Petugas Kasir: ${escapeHtml(shiftData.cashier_name || (state.user ? state.user.name : 'Kasir'))}</div>
      <div>Waktu Cetak  : ${timeFormatted}</div>
      <div>Status Shift : ${isZ ? 'TUTUP (CLOSED)' : 'AKTIF BERJALAN (OPEN)'}</div>
    </div>
    <div class="receipt-divider"></div>
    <div style="font-size: 11.5px; line-height: 1.5;">
      <div style="font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">POSISI KAS LACI:</div>
      <div style="display:flex; justify-content:space-between;">
        <span>Modal Awal (Float) :</span>
        <span style="font-family:monospace;">${formatRupiah(startingCash)}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span>(+) Penjualan Tunai:</span>
        <span style="font-family:monospace; color:#059669;">+${formatRupiah(cashSales)}</span>
      </div>
      ${cashDebt > 0 ? `
        <div style="display:flex; justify-content:space-between;">
          <span>(+) Pelunasan Bon :</span>
          <span style="font-family:monospace; color:#059669;">+${formatRupiah(cashDebt)}</span>
        </div>
      ` : ''}
      ${cashIncome > 0 ? `
        <div style="display:flex; justify-content:space-between;">
          <span>(+) Kas Masuk Toko:</span>
          <span style="font-family:monospace; color:#059669;">+${formatRupiah(cashIncome)}</span>
        </div>
      ` : ''}
      ${cashExpenses > 0 ? `
        <div style="display:flex; justify-content:space-between;">
          <span>(-) Biaya Keluar Laci:</span>
          <span style="font-family:monospace; color:#dc2626;">-${formatRupiah(cashExpenses)}</span>
        </div>
      ` : ''}
      ${cashSupplier > 0 ? `
        <div style="display:flex; justify-content:space-between;">
          <span>(-) Kulakan Tunai :</span>
          <span style="font-family:monospace; color:#dc2626;">-${formatRupiah(cashSupplier)}</span>
        </div>
      ` : ''}
    </div>
    <div class="receipt-divider"></div>
    <div style="display:flex; justify-content:space-between; font-weight:800; font-size:12.5px;">
      <span>SALDO SEHARUSNYA:</span>
      <span style="font-family:monospace;">${formatRupiah(expectedCash)}</span>
    </div>
    <div style="display:flex; justify-content:space-between; font-weight:800; font-size:12.5px; margin-top:2px;">
      <span>FISIK DIHITUNG:</span>
      <span style="font-family:monospace; color:#0284c7;">${formatRupiah(actualCash)}</span>
    </div>
    <div style="text-align:center; margin: 8px 0 4px;">
      ${varianceBadge}
    </div>
    ${breakdownHtml}
    <div class="receipt-divider"></div>
    <div style="font-size: 11.5px; line-height: 1.4;">
      <div style="font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">NON-TUNAI & OMSET:</div>
      <div style="display:flex; justify-content:space-between;">
        <span>QRIS :</span>
        <span style="font-family:monospace;">${formatRupiah(qris)}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span>Transfer Bank :</span>
        <span style="font-family:monospace;">${formatRupiah(transfer)}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span>Bon Tempo Baru :</span>
        <span style="font-family:monospace;">${formatRupiah(tempo)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-weight:700; margin-top:4px;">
        <span>Total Omset Shift :</span>
        <span style="font-family:monospace;">${formatRupiah(totalOmset)}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span>Total Nota :</span>
        <span>${totalOrders} Transaksi</span>
      </div>
    </div>
    ${cleanNotes ? `
      <div class="receipt-divider"></div>
      <div style="font-size:11px;">
        <strong>Catatan Kasir:</strong><br>
        <span>${escapeHtml(cleanNotes)}</span>
      </div>
    ` : ''}
    <div class="receipt-divider" style="margin-top:8px;"></div>
    <div style="display: flex; justify-content: space-between; text-align: center; font-size: 10px; margin-top: 6px; padding: 0 4px;">
      <div style="width: 48%;">
        Kasir Bertugas,<br><br>
        ( ............... )
      </div>
      <div style="width: 48%;">
        Supervisor / Penerima,<br><br>
        ( ............... )
      </div>
    </div>
    <div class="receipt-divider" style="margin-top: 8px;"></div>
    <div class="receipt-footer" style="padding: 2px 0 0; font-size: 9.5px;">
      <p style="margin: 0;">Kassa POS • Sistem Kasir Pintar Kios Pasar</p>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// RENDER THERMAL EXPENSE RECEIPT (STRUK BIAYA & KAS MASUK)
// -----------------------------------------------------------------------------
function renderThermalExpenseReceipt(expense, isReprint = false) {
  const isIncome = expense.type === 'income';
  const timeFormatted = parseSafeDate(expense.created_at || Date.now()).toLocaleString('id-ID');
  const sName = (state.settings && state.settings.store_name) || 'PD. HASIL BUMI RAYA 1';
  const sTagline = (state.settings && state.settings.store_tagline) || 'Pusat Umbi, Bawang & Komoditas';
  const sAddress = (state.settings && state.settings.store_address) || '';
  const sPhone = (state.settings && state.settings.store_phone) || '';

  return `
    <div class="receipt-header">
      <div class="receipt-title">${escapeHtml(sName)}</div>
      <div>${escapeHtml(sTagline)}</div>
      ${sAddress ? `<div style="font-size:11px; margin-top:2px;">${escapeHtml(sAddress)}</div>` : ''}
      ${sPhone ? `<div style="font-size:11px;">Telp/WA: ${escapeHtml(sPhone)}</div>` : ''}
      <div class="receipt-divider"></div>
      <div style="font-weight: 800; font-size: 13px; text-transform: uppercase; margin: 4px 0;">
        ${isIncome ? '*** BUKTI KAS MASUK TOKO ***' : '*** BIAYA OPERASIONAL ***'}
      </div>
      <div style="font-size: 11px; color: #475569;">
        ${isIncome ? '(TAMBAH MODAL / DANA LACI)' : '(PENGELUARAN KAS KIOS)'}
      </div>
      ${isReprint ? '<div class="receipt-reprint-tag" style="background:#0f172a; color:#fff; font-weight:800; padding:2px 4px; margin:4px 0; border-radius:4px; text-align:center;">*** SALINAN / CETAK ULANG ***</div>' : ''}
      <div style="margin-top: 6px;">No. Bukti : ${escapeHtml(expense.expense_no || ('EXP-' + (expense.id || '001')))}</div>
      <div>Waktu     : ${timeFormatted}</div>
      <div>Sumber Kas: ${expense.source === 'cash' ? '💵 Kas Laci Kasir' : '🏦 Transfer Bank'}</div>
      <div>Kategori  : ${escapeHtml(expense.category_name || expense.category || '-')}</div>
    </div>
    <div class="receipt-divider"></div>
    <div style="text-align: center; padding: 6px 0;">
      <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">JUMLAH NOMINAL:</div>
      <div style="font-size: 20px; font-weight: 900; font-family: monospace; color: ${isIncome ? '#059669' : '#dc2626'}; margin-top: 2px;">
        ${isIncome ? '+' : '-'}${formatRupiah(expense.amount)}
      </div>
    </div>
    <div class="receipt-divider"></div>
    ${expense.notes ? `
      <div style="font-size: 11.5px; padding: 2px 0;">
        <strong>Keterangan:</strong><br>
        <span>${escapeHtml(expense.notes)}</span>
      </div>
      <div class="receipt-divider"></div>
    ` : ''}
    <div class="receipt-divider" style="margin-top:8px;"></div>
    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-top: 6px; padding: 4px 6px; border: 1px dashed #cbd5e1; border-radius: 6px; background: #f8fafc;">
      <span>Petugas: <strong>${escapeHtml(expense.recorded_by_name || (state.user ? state.user.name : 'Kasir'))}</strong></span>
      <span>Penerima: <strong>( ............ )</strong></span>
    </div>
    <div class="receipt-divider" style="margin-top: 8px;"></div>
    <div class="receipt-footer" style="padding: 2px 0 0; font-size: 9.5px;">
      <p style="margin: 0;">Harap simpan struk ini sebagai bukti sah pembukuan keuangan kios.</p>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// EVENT LISTENERS & MODAL WIRES
// -----------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  initCashierPage();

  // Fullscreen Mode Toggle & Auto-Fullscreen on first touch
  function syncFullscreenState() {
    const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (el.btnToggleFullscreen) {
      el.btnToggleFullscreen.textContent = isFS ? '🗗' : '⛶';
      el.btnToggleFullscreen.title = isFS ? 'Keluar dari Mode Layar Penuh (F11)' : 'Mode Layar Penuh (F11)';
    }
  }



  if (el.btnToggleFullscreen) {
    el.btnToggleFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const docEl = document.documentElement;
        const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
        if (req) req.call(docEl).catch(() => {});
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document).catch(() => {});
      }
      setTimeout(syncFullscreenState, 150);
    });
  }

  document.addEventListener('fullscreenchange', syncFullscreenState);
  document.addEventListener('webkitfullscreenchange', syncFullscreenState);
  syncFullscreenState();

  // Initialize Lock Screen System
  initCashierLockScreen();

  // Quick Open Drawer (POS Register Header)
  const kickDrawerAction = async () => {
    try {
      await hardwareManager.kickCashDrawer();
      showToast('💰 Sinyal buka laci kasir (Kick RJ-11) terkirim!', 'success');
    } catch (err) {
      showToast('Gagal membuka laci: ' + err.message, 'warning');
    }
  };
  if (el.btnQuickOpenDrawer) el.btnQuickOpenDrawer.addEventListener('click', kickDrawerAction);
  if (el.btnKickDrawerTop) el.btnKickDrawerTop.addEventListener('click', kickDrawerAction);

  // Manual Sync Button
  if (el.btnManualSync) {
    el.btnManualSync.addEventListener('click', async () => {
      showToast('🔄 Menyinkronkan data shift kasir...', 'info');
      await loadActiveShiftData();
      showToast('✅ Data kasir berhasil disinkronkan!', 'success');
    });
  }

  // Header Print X Button
  if (el.btnHeaderPrintX) {
    el.btnHeaderPrintX.addEventListener('click', handlePrintReportX);
  }

  // Header Dropdown Quick Expense Modal Trigger
  if (el.btnExpensesQuickModal) {
    el.btnExpensesQuickModal.addEventListener('click', () => {
      const storeDropdown = document.getElementById('storeMenuDropdown');
      if (storeDropdown) storeDropdown.classList.remove('active');
      if (el.inputExpenseAmount) el.inputExpenseAmount.value = '';
      if (el.inputExpenseNotes) el.inputExpenseNotes.value = '';
      if (el.modalAddExpense) el.modalAddExpense.style.display = 'flex';
      if (el.inputExpenseAmount) el.inputExpenseAmount.focus();
    });
  }

  // Header Close Shift Button
  if (el.btnHeaderCloseShift) {
    el.btnHeaderCloseShift.addEventListener('click', () => {
      const userDropdown = document.getElementById('userMenuDropdown');
      if (userDropdown) userDropdown.classList.remove('active');
      handleCloseShiftZ();
    });
  }

  // Logout Button
  if (el.btnLogout) {
    el.btnLogout.addEventListener('click', () => {
      if (confirm('Apakah Anda yakin ingin keluar dari akun kasir?')) {
        api.clearAuth();
        window.location.href = '/';
      }
    });
  }

  if (el.btnRefreshPageData) {
    el.btnRefreshPageData.addEventListener('click', loadActiveShiftData);
  }

  if (el.btnResetDenom) {
    el.btnResetDenom.addEventListener('click', () => {
      ['d100k', 'd75k', 'd50k', 'd20k', 'd10k', 'd5k', 'd2k', 'd1k', 'dKoin'].forEach(id => {
        const inp = document.getElementById(id);
        if (inp) inp.value = '0';
      });
      recalculateDenominations();
    });
  }

  ['d100k', 'd75k', 'd50k', 'd20k', 'd10k', 'd5k', 'd2k', 'd1k', 'dKoin'].forEach(id => {
    const inp = document.getElementById(id);
    if (inp) {
      inp.addEventListener('input', recalculateDenominations);
    }
  });

  // Action Buttons
  if (el.btnPrintReportX) {
    el.btnPrintReportX.addEventListener('click', handlePrintReportX);
  }

  if (el.btnCloseShiftZ) {
    el.btnCloseShiftZ.addEventListener('click', handleCloseShiftZ);
  }

  // Direct Open Shift Handlers in cashier.html
  document.querySelectorAll('.btn-chip-direct-cash').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const val = e.currentTarget.dataset.val;
      if (el.inpDirectStartingCash) {
        el.inpDirectStartingCash.value = formatRupiahNumber(Number(val));
      }
      document.querySelectorAll('.btn-chip-direct-cash').forEach(b => {
        b.style.background = '#ffffff';
        b.style.border = '1px solid #cbd5e1';
        b.style.color = '#334155';
        b.style.fontWeight = '700';
      });
      e.currentTarget.style.background = '#eff6ff';
      e.currentTarget.style.border = '1.5px solid #3b82f6';
      e.currentTarget.style.color = '#1d4ed8';
      e.currentTarget.style.fontWeight = '800';
    });
  });

  if (el.inpDirectStartingCash) {
    el.inpDirectStartingCash.addEventListener('input', (e) => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = raw ? formatRupiahNumber(Number(raw)) : '';
    });

    el.inpDirectStartingCash.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleDirectOpenShift();
      }
    });
  }

  if (el.btnDirectOpenShiftSubmit) {
    el.btnDirectOpenShiftSubmit.addEventListener('click', handleDirectOpenShift);
  }

  // Receipt Preview Modal Actions
  if (el.btnConfirmPrintReceipt) {
    el.btnConfirmPrintReceipt.addEventListener('click', handleConfirmPrintReceipt);
  }
  if (el.btnPreviewKickDrawer) {
    el.btnPreviewKickDrawer.addEventListener('click', async () => {
      try {
        await hardwareManager.kickCashDrawer();
        showToast('💰 Laci uang kasir (Kick RJ-11) berhasil dibuka!', 'success');
      } catch (err) {
        showToast('Gagal membuka laci: ' + err.message, 'warning');
      }
    });
  }
  if (el.btnCancelReceiptPreview) {
    el.btnCancelReceiptPreview.addEventListener('click', closeReceiptPreview);
  }
  if (el.btnCloseReceiptPreview) {
    el.btnCloseReceiptPreview.addEventListener('click', closeReceiptPreview);
  }
  if (el.modalReceiptPreview) {
    el.modalReceiptPreview.addEventListener('click', (e) => {
      if (e.target === el.modalReceiptPreview) closeReceiptPreview();
    });
  }

  // Quick Expense Modal Actions
  if (el.btnQuickExpense) {
    el.btnQuickExpense.addEventListener('click', () => {
      if (el.inputExpenseAmount) el.inputExpenseAmount.value = '';
      if (el.inputExpenseNotes) el.inputExpenseNotes.value = '';
      if (el.modalAddExpense) el.modalAddExpense.style.display = 'flex';
      if (el.inputExpenseAmount) el.inputExpenseAmount.focus();
    });
  }
  if (el.btnCloseAddExpense) {
    el.btnCloseAddExpense.addEventListener('click', () => {
      if (el.modalAddExpense) el.modalAddExpense.style.display = 'none';
    });
  }
  if (el.btnCancelAddExpense) {
    el.btnCancelAddExpense.addEventListener('click', () => {
      if (el.modalAddExpense) el.modalAddExpense.style.display = 'none';
    });
  }
  if (el.modalAddExpense) {
    el.modalAddExpense.addEventListener('click', (e) => {
      if (e.target === el.modalAddExpense) el.modalAddExpense.style.display = 'none';
    });
  }
  if (el.btnSubmitAddExpense) {
    el.btnSubmitAddExpense.addEventListener('click', async () => {
      const category = el.selectExpenseCategory ? el.selectExpenseCategory.value : 'operasional';
      const amount = Number(el.inputExpenseAmount ? el.inputExpenseAmount.value : 0);
      const notes = el.inputExpenseNotes ? el.inputExpenseNotes.value.trim() : '';

      if (isNaN(amount) || amount <= 0) {
        showToast('Masukkan nominal pengeluaran yang valid!', 'error');
        if (el.inputExpenseAmount) el.inputExpenseAmount.focus();
        return;
      }

      try {
        el.btnSubmitAddExpense.disabled = true;
        el.btnSubmitAddExpense.textContent = 'Menyimpan...';

        const res = await api.createExpense({
          category,
          amount,
          source: 'cash',
          notes,
          type: 'expense'
        });

        showToast('💸 Pengeluaran kas laci berhasil dicatat!', 'success');
        if (el.modalAddExpense) el.modalAddExpense.style.display = 'none';

        // Reload shift data and open receipt preview
        await loadActiveShiftData();
        if (res.expense) {
          openReceiptPreview('expense', res.expense);
        }
      } catch (err) {
        showToast('Gagal mencatat pengeluaran: ' + err.message, 'error');
      } finally {
        if (el.btnSubmitAddExpense) {
          el.btnSubmitAddExpense.disabled = false;
          el.btnSubmitAddExpense.innerHTML = '<span>💸</span> Simpan & Pratinjau Struk';
        }
      }
    });
  }

  // Quick Income Modal Actions
  if (el.btnQuickIncome) {
    el.btnQuickIncome.addEventListener('click', () => {
      if (el.inputIncomeAmount) el.inputIncomeAmount.value = '';
      if (el.inputIncomeNotes) el.inputIncomeNotes.value = '';
      if (el.modalAddIncome) el.modalAddIncome.style.display = 'flex';
      if (el.inputIncomeAmount) el.inputIncomeAmount.focus();
    });
  }
  if (el.btnCloseAddIncome) {
    el.btnCloseAddIncome.addEventListener('click', () => {
      if (el.modalAddIncome) el.modalAddIncome.style.display = 'none';
    });
  }
  if (el.btnCancelAddIncome) {
    el.btnCancelAddIncome.addEventListener('click', () => {
      if (el.modalAddIncome) el.modalAddIncome.style.display = 'none';
    });
  }
  if (el.modalAddIncome) {
    el.modalAddIncome.addEventListener('click', (e) => {
      if (e.target === el.modalAddIncome) el.modalAddIncome.style.display = 'none';
    });
  }
  if (el.btnSubmitAddIncome) {
    el.btnSubmitAddIncome.addEventListener('click', async () => {
      const category = el.selectIncomeCategory ? el.selectIncomeCategory.value : 'kas_masuk_modal';
      const amount = Number(el.inputIncomeAmount ? el.inputIncomeAmount.value : 0);
      const notes = el.inputIncomeNotes ? el.inputIncomeNotes.value.trim() : '';

      if (isNaN(amount) || amount <= 0) {
        showToast('Masukkan nominal kas masuk yang valid!', 'error');
        if (el.inputIncomeAmount) el.inputIncomeAmount.focus();
        return;
      }

      try {
        el.btnSubmitAddIncome.disabled = true;
        el.btnSubmitAddIncome.textContent = 'Menyimpan...';

        const res = await api.createExpense({
          category,
          amount,
          source: 'cash',
          notes,
          type: 'income'
        });

        showToast('📥 Kas masuk berhasil dicatat!', 'success');
        if (el.modalAddIncome) el.modalAddIncome.style.display = 'none';

        // Reload shift data and open receipt preview
        await loadActiveShiftData();
        if (res.expense) {
          openReceiptPreview('income', res.expense);
        }
      } catch (err) {
        showToast('Gagal mencatat kas masuk: ' + err.message, 'error');
      } finally {
        if (el.btnSubmitAddIncome) {
          el.btnSubmitAddIncome.disabled = false;
          el.btnSubmitAddIncome.innerHTML = '<span>📥</span> Simpan & Pratinjau Struk';
        }
      }
    });
  }
});

// -----------------------------------------------------------------------------
// INACTIVITY AUTO-LOCK & MANUAL LOCK SYSTEM (10 MENIT) - CASHIER DASHBOARD
// -----------------------------------------------------------------------------
let cashierLockTimer = null;
const LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 menit

function resetCashierLockTimer() {
  clearTimeout(cashierLockTimer);
  if (state.user && el.modalLockScreen && el.modalLockScreen.style.display !== 'flex') {
    cashierLockTimer = setTimeout(() => {
      lockCashierScreen('auto');
    }, LOCK_TIMEOUT_MS);
  }
}

function lockCashierScreen(reason = 'manual') {
  if (!state.user) return;
  clearTimeout(cashierLockTimer);
  if (el.modalLockScreen) {
    if (el.lockCashierName) {
      el.lockCashierName.textContent = `Sesi Aktif: ${state.user.name || 'Kasir Bertugas'}`;
    }
    if (el.inpLockPin) {
      el.inpLockPin.value = '';
    }
    el.modalLockScreen.style.display = 'flex';
    setTimeout(() => {
      if (el.inpLockPin) el.inpLockPin.focus();
    }, 100);
  }
}

async function unlockCashierScreen() {
  const pin = el.inpLockPin ? el.inpLockPin.value.trim() : '';
  if (!pin) {
    showToast('Masukkan PIN kasir untuk membuka', 'warning');
    if (el.inpLockPin) el.inpLockPin.focus();
    return;
  }

  try {
    if (el.btnUnlockScreen) {
      el.btnUnlockScreen.disabled = true;
      el.btnUnlockScreen.innerHTML = '<span>⏳</span> Memeriksa PIN...';
    }

    let ok = false;
    if (navigator.onLine) {
      try {
        const res = await api.login(pin);
        if (res && res.user) {
          ok = true;
          state.user = res.user;
        }
      } catch (e) {
        if (state.user && (state.user.pin === pin || localStorage.getItem('kassa_cashier_pin') === pin)) {
          ok = true;
        } else {
          throw e;
        }
      }
    } else {
      if (state.user && (state.user.pin === pin || localStorage.getItem('kassa_cashier_pin') === pin)) {
        ok = true;
      } else {
        throw new Error('PIN tidak cocok');
      }
    }

    if (ok) {
      if (el.modalLockScreen) el.modalLockScreen.style.display = 'none';
      if (el.inpLockPin) el.inpLockPin.value = '';
      showToast('🔓 Layar berhasil dibuka. Selamat bertugas!', 'success');
      resetCashierLockTimer();
    }
  } catch (err) {
    showToast('PIN salah atau tidak valid: ' + (err.message || 'Periksa kembali'), 'error');
    if (el.inpLockPin) {
      el.inpLockPin.value = '';
      el.inpLockPin.focus();
    }
  } finally {
    if (el.btnUnlockScreen) {
      el.btnUnlockScreen.disabled = false;
      el.btnUnlockScreen.innerHTML = '<span>🔓</span> Buka Kunci Layar';
    }
  }
}

function initCashierLockScreen() {
  const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
  events.forEach(evt => {
    window.addEventListener(evt, () => {
      resetCashierLockTimer();
    }, { passive: true });
  });
  resetCashierLockTimer();

  if (el.btnManualLock) {
    el.btnManualLock.addEventListener('click', () => {
      const userDropdown = document.getElementById('userMenuDropdown');
      if (userDropdown) userDropdown.classList.remove('active');
      lockCashierScreen('manual');
    });
  }

  if (el.btnUnlockScreen) {
    el.btnUnlockScreen.addEventListener('click', unlockCashierScreen);
  }

  if (el.inpLockPin) {
    el.inpLockPin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        unlockCashierScreen();
      }
    });
  }

  if (el.lockNumpad) {
    el.lockNumpad.querySelectorAll('.btn-lock-num').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!el.inpLockPin) return;
        const num = btn.dataset.num;
        const action = btn.dataset.action;
        if (num !== undefined) {
          if (el.inpLockPin.value.length < 6) {
            el.inpLockPin.value += num;
          }
        } else if (action === 'clear') {
          el.inpLockPin.value = '';
        } else if (action === 'backspace') {
          el.inpLockPin.value = el.inpLockPin.value.slice(0, -1);
        }
      });
    });
  }

  if (el.btnLockLogout) {
    el.btnLockLogout.addEventListener('click', () => {
      if (confirm('Keluar dari sesi kasir dan ganti akun?')) {
        api.clearAuth();
        window.location.href = '/';
      }
    });
  }
}

// -----------------------------------------------------------------------------
// EMBEDDED IN-PAGE MODAL CONTROLLER (Riwayat, Katalog, Piutang, Opname, dll.)
// Instant 0ms modal opening via preloaded warm iframe & postMessage
// -----------------------------------------------------------------------------
let isModalIframeReady = false;
let pendingModalName = null;

function sendToModalIframe(message) {
  const iframe = document.getElementById('cashierModalIframe');
  if (iframe && iframe.contentWindow) {
    try {
      iframe.contentWindow.postMessage(message, '*');
    } catch (err) {
      console.warn('[Modal] Gagal kirim postMessage ke iframe:', err);
    }
  }
}

function openEmbeddedModal(modalName) {
  const overlay = document.getElementById('cashierModalOverlay');
  const iframe = document.getElementById('cashierModalIframe');
  const userDropdown = document.getElementById('userMenuDropdown');
  if (userDropdown) userDropdown.classList.remove('active');

  if (!overlay || !iframe) return;

  // Buka overlay dan tampilkan iframe seketika (0 milidetik, tanpa delay/loading)
  overlay.style.display = 'block';
  iframe.style.opacity = '1';

  // Pastikan iframe mengarah ke /?embed=1 jika belum pernah dimuat
  if (!iframe.src || iframe.src === 'about:blank' || !iframe.src.includes('embed=1')) {
    isModalIframeReady = false;
    iframe.src = '/?embed=1';
  }

  if (isModalIframeReady) {
    sendToModalIframe({ action: 'openModal', modal: modalName });
  } else {
    // Jika iframe masih menyelesaikan inisialisasi awal, simpan nama modal untuk dibuka seketika saat ready
    pendingModalName = modalName;
    sendToModalIframe({ action: 'pingReady' });
  }
}

function closeEmbeddedModal() {
  const overlay = document.getElementById('cashierModalOverlay');
  const iframe = document.getElementById('cashierModalIframe');
  pendingModalName = null;

  if (overlay) overlay.style.display = 'none';
  if (iframe) {
    iframe.style.opacity = '0';
    // PENTING: JANGAN ubah iframe.src ke about:blank agar iframe tetap hangat di memori dan modal berikutnya buka instan 0ms!
    sendToModalIframe({ action: 'closeAllModals' });
  }

  // Sinkronkan data shift aktif di halaman kasir jika ada perubahan saat modal dibuka
  loadActiveShiftData();
}

window.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.action === 'iframeReady') {
    isModalIframeReady = true;
    if (pendingModalName) {
      sendToModalIframe({ action: 'openModal', modal: pendingModalName });
      pendingModalName = null;
    }
  } else if (event.data.action === 'closeCashierModal') {
    closeEmbeddedModal();
  } else if (event.data.action === 'modalReady') {
    const iframe = document.getElementById('cashierModalIframe');
    if (iframe) iframe.style.opacity = '1';
  }
});

const cashierIframeEl = document.getElementById('cashierModalIframe');
if (cashierIframeEl) {
  cashierIframeEl.addEventListener('load', () => {
    sendToModalIframe({ action: 'pingReady' });
  });
}

// Ping status awal iframe setelah script dimuat
setTimeout(() => {
  if (!isModalIframeReady) {
    sendToModalIframe({ action: 'pingReady' });
  }
}, 300);

const btnCloseOverlay = document.getElementById('btnCloseEmbeddedModalOverlay');
if (btnCloseOverlay) {
  btnCloseOverlay.addEventListener('click', closeEmbeddedModal);
}

// Hook all data-modal buttons in cashier dashboard
document.querySelectorAll('[data-modal]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const modalName = btn.dataset.modal;
    if (modalName) {
      openEmbeddedModal(modalName);
    }
  });
});

// Also hook printer settings icon in header
if (el.btnHardwareModalTrigger) {
  el.btnHardwareModalTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    openEmbeddedModal('hardware');
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('cashierModalOverlay');
    if (overlay && overlay.style.display !== 'none') {
      closeEmbeddedModal();
    }
  }
});
