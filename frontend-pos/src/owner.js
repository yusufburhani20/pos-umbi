import { api } from './api.js';

function parseSafeDate(dateInput) {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  let s = String(dateInput).trim();
  if (s.includes(' ') && !s.includes('T')) {
    s = s.replace(' ', 'T');
  }
  return new Date(s);
}

const state = {
  user: null,
  products: [],
  filteredProducts: [],
  activeCategory: '',
  searchKeyword: '',
  dashboard: null,
  shifts: [],
  auditLogs: [],
  filteredLogs: [],
  activeAuditFilter: 'ALL',
  users: [],
  salesReport: null,
  debts: [],
  debtSummary: {},
  activeDebtFilter: 'all',
  activeDebtForPayment: null
};

// DOM Elements
const el = {
  ownerDayDate: document.getElementById('ownerDayDate'),
  liveClockText: document.getElementById('liveClockText'),
  quickCashierName: document.getElementById('quickCashierName'),
  productCountBadge: document.getElementById('productCountBadge'),
  auditCountBadge: document.getElementById('auditCountBadge'),

  // KPIs
  kpiCashDrawer: document.getElementById('kpiCashDrawer'),
  kpiDrawerStatus: document.getElementById('kpiDrawerStatus'),
  kpiRevenueToday: document.getElementById('kpiRevenueToday'),
  kpiOrdersCount: document.getElementById('kpiOrdersCount'),
  kpiNonCash: document.getElementById('kpiNonCash'),
  kpiVoidAmount: document.getElementById('kpiVoidAmount'),
  kpiVoidCount: document.getElementById('kpiVoidCount'),

  // Anomaly Radar
  radarIndicatorDot: document.getElementById('radarIndicatorDot'),
  anomalyStatusBadge: document.getElementById('anomalyStatusBadge'),
  anomalyProgressFill: document.getElementById('anomalyProgressFill'),
  txtRetailRatio: document.getElementById('txtRetailRatio'),
  txtResellerRatio: document.getElementById('txtResellerRatio'),
  anomalyExplanation: document.getElementById('anomalyExplanation'),

  // Lists & Containers
  shiftListContainer: document.getElementById('shiftListContainer'),
  wasteListContainer: document.getElementById('wasteListContainer'),
  productsCardsGrid: document.getElementById('productsCardsGrid'),
  auditTimelineContainer: document.getElementById('auditTimelineContainer'),

  // Reports & Export Elements
  btnExportCSV: document.getElementById('btnExportCSV'),
  btnPrintReportPDF: document.getElementById('btnPrintReportPDF'),
  reportPresetGroup: document.getElementById('reportPresetGroup'),
  repStartDate: document.getElementById('repStartDate'),
  repEndDate: document.getElementById('repEndDate'),
  repPaymentFilter: document.getElementById('repPaymentFilter'),
  btnApplyReportFilter: document.getElementById('btnApplyReportFilter'),
  repKpiRevenue: document.getElementById('repKpiRevenue'),
  repKpiProfit: document.getElementById('repKpiProfit'),
  repKpiMargin: document.getElementById('repKpiMargin'),
  repKpiCogs: document.getElementById('repKpiCogs'),
  repKpiKgSold: document.getElementById('repKpiKgSold'),
  repKpiLoss: document.getElementById('repKpiLoss'),
  repKpiLossDetail: document.getElementById('repKpiLossDetail'),
  repKpiOrdersCount: document.getElementById('repKpiOrdersCount'),
  repTopProductsBody: document.getElementById('repTopProductsBody'),
  repPayCash: document.getElementById('repPayCash'),
  repPayQris: document.getElementById('repPayQris'),
  repPayTransfer: document.getElementById('repPayTransfer'),
  repAvgBasket: document.getElementById('repAvgBasket'),
  repOrdersTableBody: document.getElementById('repOrdersTableBody'),
  repOrdersCountBadge: document.getElementById('repOrdersCountBadge'),

  // Print Report Modal Elements
  modalPrintReport: document.getElementById('modalPrintReport'),
  btnCloseModalPrintReport: document.getElementById('btnCloseModalPrintReport'),
  btnCancelModalPrintReport: document.getElementById('btnCancelModalPrintReport'),
  btnExecutePrint: document.getElementById('btnExecutePrint'),
  printPeriodText: document.getElementById('printPeriodText'),
  printTotalRevenue: document.getElementById('printTotalRevenue'),
  printTotalCogs: document.getElementById('printTotalCogs'),
  printGrossProfit: document.getElementById('printGrossProfit'),
  printMargin: document.getElementById('printMargin'),
  printTotalOrders: document.getElementById('printTotalOrders'),
  printTotalKg: document.getElementById('printTotalKg'),
  printCash: document.getElementById('printCash'),
  printNonCash: document.getElementById('printNonCash'),
  printVoid: document.getElementById('printVoid'),
  printWaste: document.getElementById('printWaste'),
  printTopProductsBody: document.getElementById('printTopProductsBody'),
  printOrdersBody: document.getElementById('printOrdersBody'),

  // Filters
  ownerSearchProd: document.getElementById('ownerSearchProd'),
  ownerCategoryChips: document.getElementById('ownerCategoryChips'),
  auditFilterType: document.getElementById('auditFilterType'),

  // Buttons
  btnRefreshData: document.getElementById('btnRefreshData'),
  btnRefreshAudit: document.getElementById('btnRefreshAudit'),
  btnBackToPos: document.getElementById('btnBackToPos'),
  btnOwnerLogout: document.getElementById('btnOwnerLogout'),
  btnAddNewProduct: document.getElementById('btnAddNewProduct'),
  btnRestockHeader: document.getElementById('btnRestockHeader'),

  // Modals
  modalNewProduct: document.getElementById('modalNewProduct'),
  btnCloseModalNewProduct: document.getElementById('btnCloseModalNewProduct'),
  btnCancelModalNewProduct: document.getElementById('btnCancelModalNewProduct'),
  btnSaveModalNewProduct: document.getElementById('btnSaveModalNewProduct'),

  modalRestock: document.getElementById('modalRestock'),
  btnCloseModalRestock: document.getElementById('btnCloseModalRestock'),
  btnCancelModalRestock: document.getElementById('btnCancelModalRestock'),
  btnSaveModalRestock: document.getElementById('btnSaveModalRestock'),
  inpRestockProductSelect: document.getElementById('inpRestockProductSelect'),
  inpRestockCurrentStock: document.getElementById('inpRestockCurrentStock'),
  inpRestockQty: document.getElementById('inpRestockQty'),
  inpRestockCost: document.getElementById('inpRestockCost'),
  inpRestockNotes: document.getElementById('inpRestockNotes'),

  modalEditPrice: document.getElementById('modalEditPrice'),
  btnCloseModalEditPrice: document.getElementById('btnCloseModalEditPrice'),
  btnCancelModalEditPrice: document.getElementById('btnCancelModalEditPrice'),
  btnSaveModalEditPrice: document.getElementById('btnSaveModalEditPrice'),
  editPriceProdId: document.getElementById('editPriceProdId'),
  editPriceProdName: document.getElementById('editPriceProdName'),
  editPriceCost: document.getElementById('editPriceCost'),
  editPriceRetail: document.getElementById('editPriceRetail'),
  editPriceReseller: document.getElementById('editPriceReseller'),
  editPriceMinQty: document.getElementById('editPriceMinQty'),
  editPriceMinAlert: document.getElementById('editPriceMinAlert'),
  radarLowStock: document.getElementById('radarLowStock'),
  lowStockIndicatorDot: document.getElementById('lowStockIndicatorDot'),
  lowStockSummaryBadge: document.getElementById('lowStockSummaryBadge'),
  lowStockItemsList: document.getElementById('lowStockItemsList'),
  ownerLowStockChipCount: document.getElementById('ownerLowStockChipCount'),

  // Tab 7: Settings & Receipt Customization
  setStoreName: document.getElementById('setStoreName'),
  setStoreTagline: document.getElementById('setStoreTagline'),
  setStoreAddress: document.getElementById('setStoreAddress'),
  setStorePhone: document.getElementById('setStorePhone'),
  setReceiptFooter: document.getElementById('setReceiptFooter'),
  btnSaveStoreSettings: document.getElementById('btnSaveStoreSettings'),
  setOldOwnerPin: document.getElementById('setOldOwnerPin'),
  setNewOwnerPin: document.getElementById('setNewOwnerPin'),
  setConfirmOwnerPin: document.getElementById('setConfirmOwnerPin'),
  btnChangeOwnerPin: document.getElementById('btnChangeOwnerPin'),
  liveReceiptPreview: document.getElementById('liveReceiptPreview'),

  
  cashierCountBadge: document.getElementById('cashierCountBadge'),
  debtCountBadge: document.getElementById('debtCountBadge'),

  // Buku Piutang & Kasbon
  kpiTotalOutstanding: document.getElementById('kpiTotalOutstanding'),
  kpiTotalOverdue: document.getElementById('kpiTotalOverdue'),
  kpiTotalDebtors: document.getElementById('kpiTotalDebtors'),
  kpiTotalPaidDebts: document.getElementById('kpiTotalPaidDebts'),
  badgeOverdueAlert: document.getElementById('badgeOverdueAlert'),
  ownerDebtsTableBody: document.getElementById('ownerDebtsTableBody'),
  searchOwnerDebt: document.getElementById('searchOwnerDebt'),
  btnRefreshOwnerDebts: document.getElementById('btnRefreshOwnerDebts'),

  // Modal Pay Debt (Owner)
  modalOwnerPayDebt: document.getElementById('modalOwnerPayDebt'),
  ownerPayDebtSubtitle: document.getElementById('ownerPayDebtSubtitle'),
  ownerPayDebtRemainingText: document.getElementById('ownerPayDebtRemainingText'),
  btnOwnerPayFull: document.getElementById('btnOwnerPayFull'),
  btnOwnerPayPartial: document.getElementById('btnOwnerPayPartial'),
  ownerPayAmountInput: document.getElementById('ownerPayAmountInput'),
  ownerPayMethodSelect: document.getElementById('ownerPayMethodSelect'),
  ownerPayNotesInput: document.getElementById('ownerPayNotesInput'),
  btnCancelOwnerPayDebt: document.getElementById('btnCancelOwnerPayDebt'),
  btnSubmitOwnerPayDebt: document.getElementById('btnSubmitOwnerPayDebt'),
  btnCloseOwnerPayDebt: document.getElementById('btnCloseOwnerPayDebt'),

  // Modal Debt Detail
  modalOwnerDebtDetail: document.getElementById('modalOwnerDebtDetail'),
  debtDetailSubtitle: document.getElementById('debtDetailSubtitle'),
  detailTotalKasbon: document.getElementById('detailTotalKasbon'),
  detailRemainingKasbon: document.getElementById('detailRemainingKasbon'),
  debtDetailPaymentsBody: document.getElementById('debtDetailPaymentsBody'),
  btnCloseDebtDetail: document.getElementById('btnCloseDebtDetail'),
  btnCloseDebtDetailFooter: document.getElementById('btnCloseDebtDetailFooter'),
  cashierCardsGrid: document.getElementById('cashierCardsGrid'),
  btnAddNewCashier: document.getElementById('btnAddNewCashier'),

  // Cashier Modals
  modalAddCashier: document.getElementById('modalAddCashier'),
  btnCloseModalAddCashier: document.getElementById('btnCloseModalAddCashier'),
  btnCancelModalAddCashier: document.getElementById('btnCancelModalAddCashier'),
  btnSaveModalAddCashier: document.getElementById('btnSaveModalAddCashier'),
  inpCashierName: document.getElementById('inpCashierName'),
  inpCashierUsername: document.getElementById('inpCashierUsername'),
  inpCashierRole: document.getElementById('inpCashierRole'),
  inpCashierPin: document.getElementById('inpCashierPin'),

  modalResetPin: document.getElementById('modalResetPin'),
  btnCloseModalResetPin: document.getElementById('btnCloseModalResetPin'),
  btnCancelModalResetPin: document.getElementById('btnCancelModalResetPin'),
  btnSaveModalResetPin: document.getElementById('btnSaveModalResetPin'),
  resetPinUserId: document.getElementById('resetPinUserId'),
  resetPinUserName: document.getElementById('resetPinUserName'),
  resetPinUserUsername: document.getElementById('resetPinUserUsername'),
  resetPinNewPin: document.getElementById('resetPinNewPin'),
  resetPinConfirmPin: document.getElementById('resetPinConfirmPin'),
  toastContainer: document.getElementById('toastContainer')
};


// -----------------------------------------------------------------------------
// CURRENCY AUTO-FORMATTING HELPERS
// -----------------------------------------------------------------------------
function parseRupiahInput(val) {
  if (!val && val !== 0) return 0;
  let str = String(val).trim().toLowerCase();

  if (str.endsWith('rb') || str.endsWith('k')) {
    const numPart = str.replace(/(rb|k)$/, '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const num = parseFloat(numPart) || 0;
    return Math.round(num * 1000);
  }

  if (str.endsWith('jt')) {
    const numPart = str.replace(/jt$/, '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const num = parseFloat(numPart) || 0;
    return Math.round(num * 1000000);
  }

  const cleanDigits = str.replace(/\D/g, '');
  return parseInt(cleanDigits, 10) || 0;
}

function formatRupiahNumber(num) {
  if (!num && num !== 0) return '';
  return Number(num).toLocaleString('id-ID');
}

function attachCurrencyAutoFormat(input, onValueChange = null) {
  if (!input) return;

  input.addEventListener('input', () => {
    const val = input.value;
    if (!val) {
      if (onValueChange) onValueChange(0);
      return;
    }

    const lower = val.toLowerCase().trim();
    if (lower.endsWith('r') && !lower.endsWith('rb')) {
      return;
    }

    if (lower.endsWith('rb') || lower.endsWith('k') || lower.endsWith('jt')) {
      const num = parseRupiahInput(lower);
      input.value = formatRupiahNumber(num);
      if (onValueChange) onValueChange(num);
      return;
    }

    const cleanDigits = val.replace(/\D/g, '');
    if (cleanDigits === '') {
      input.value = '';
      if (onValueChange) onValueChange(0);
      return;
    }

    const num = parseInt(cleanDigits, 10);
    input.value = formatRupiahNumber(num);
    if (onValueChange) onValueChange(num);
  });

  input.addEventListener('blur', () => {
    if (!input.value) return;
    const num = parseRupiahInput(input.value);
    input.value = num ? formatRupiahNumber(num) : '';
    if (onValueChange) onValueChange(num);
  });
}

function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : (type === 'error' ? '❌' : '⚠️')}</span> ${message}`;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

// -----------------------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------------------
async function initOwnerApp() {
  bindEvents();
  updateClock();
  setInterval(updateClock, 1000);

  if (!api.token) {
    alert('Sesi belum aktif. Silakan login sebagai Owner terlebih dahulu.');
    window.location.href = '/';
    return;
  }

  try {
    const meRes = await api.getMe();
    state.user = meRes.user;

    if (state.user.role !== 'owner') {
      alert('Akses Ditolak: Anda login sebagai Kasir. Halaman ini hanya untuk Pemilik (Owner).');
      window.location.href = '/';
      return;
    }

    await loadAllData();
  } catch (err) {
    console.error('Session error:', err);
    alert('Sesi kedaluwarsa. Silakan login kembali.');
    api.clearSession();
    window.location.href = '/';
  }
}

function updateClock() {
  const now = new Date();
  if (el.ownerDayDate) {
    el.ownerDayDate.textContent = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
  if (el.liveClockText) {
    el.liveClockText.textContent = now.toLocaleTimeString('id-ID') + ' WIB';
  }
}

function bindEvents() {
  el.btnRefreshData.addEventListener('click', loadAllData);
  if (el.btnRefreshAudit) el.btnRefreshAudit.addEventListener('click', loadAllData);
  el.btnBackToPos.addEventListener('click', () => { window.location.href = '/'; });

  el.btnOwnerLogout.addEventListener('click', () => {
    if (confirm('Keluar dari sesi Owner?')) {
      api.clearSession();
      window.location.href = '/';
    }
  });

  // Debts Tab Events
  document.querySelectorAll('[data-debt-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-debt-status]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeDebtFilter = btn.dataset.debtStatus;
      loadDebtsData();
    });
  });

  if (el.searchOwnerDebt) {
    let debtSearchTimeout;
    el.searchOwnerDebt.addEventListener('input', () => {
      clearTimeout(debtSearchTimeout);
      debtSearchTimeout = setTimeout(loadDebtsData, 300);
    });
  }

  if (el.btnRefreshOwnerDebts) {
    el.btnRefreshOwnerDebts.addEventListener('click', loadDebtsData);
  }

  // Pay Full / Partial Chips
  if (el.btnOwnerPayFull) {
    el.btnOwnerPayFull.addEventListener('click', () => {
      el.btnOwnerPayFull.classList.add('active');
      el.btnOwnerPayFull.style.background = '#10b981';
      el.btnOwnerPayFull.style.color = '#fff';
      el.btnOwnerPayPartial.classList.remove('active');
      el.btnOwnerPayPartial.style.background = 'rgba(255,255,255,0.08)';
      el.btnOwnerPayPartial.style.color = '#e2e8f0';
      if (state.activeDebtForPayment) {
        el.ownerPayAmountInput.value = formatRupiah(state.activeDebtForPayment.remaining_amount);
      }
    });
  }

  if (el.btnOwnerPayPartial) {
    el.btnOwnerPayPartial.addEventListener('click', () => {
      el.btnOwnerPayPartial.classList.add('active');
      el.btnOwnerPayPartial.style.background = '#f59e0b';
      el.btnOwnerPayPartial.style.color = '#fff';
      el.btnOwnerPayFull.classList.remove('active');
      el.btnOwnerPayFull.style.background = 'rgba(255,255,255,0.08)';
      el.btnOwnerPayFull.style.color = '#e2e8f0';
      el.ownerPayAmountInput.value = '';
      el.ownerPayAmountInput.focus();
    });
  }

  if (el.ownerPayAmountInput) {
    el.ownerPayAmountInput.addEventListener('input', (e) => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      if (raw) {
        e.target.value = formatRupiah(Number(raw));
      } else {
        e.target.value = '';
      }
    });
  }

  if (el.btnSubmitOwnerPayDebt) {
    el.btnSubmitOwnerPayDebt.addEventListener('click', handleOwnerPayDebtSubmit);
  }

  if (el.btnCancelOwnerPayDebt) {
    el.btnCancelOwnerPayDebt.addEventListener('click', () => {
      el.modalOwnerPayDebt.style.display = 'none';
    });
  }
  if (el.btnCloseOwnerPayDebt) {
    el.btnCloseOwnerPayDebt.addEventListener('click', () => {
      el.modalOwnerPayDebt.style.display = 'none';
    });
  }

  if (el.btnCloseDebtDetail) {
    el.btnCloseDebtDetail.addEventListener('click', () => {
      el.modalOwnerDebtDetail.style.display = 'none';
    });
  }
  if (el.btnCloseDebtDetailFooter) {
    el.btnCloseDebtDetailFooter.addEventListener('click', () => {
      el.modalOwnerDebtDetail.style.display = 'none';
    });
  }

  // Tab switching
  document.querySelectorAll('.tab-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.exec-section').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
      });

      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) {
        target.classList.add('active');
        target.style.display = 'flex';
        if (btn.dataset.tab === 'tab-reports') {
          loadSalesReport();
        }
        if (btn.dataset.tab === 'tab-debts') {
          loadDebtsData();
        }
      }
    });
  });

  // Search and Category Chips in Products
  el.ownerSearchProd.addEventListener('input', (e) => {
    state.searchKeyword = e.target.value.toLowerCase().trim();
    filterProducts();
  });

  el.ownerCategoryChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip-item');
    if (!chip) return;
    el.ownerCategoryChips.querySelectorAll('.chip-item').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.activeCategory = chip.dataset.cat;
    filterProducts();
  });

  // Audit filter
  el.auditFilterType.addEventListener('change', (e) => {
    state.activeAuditFilter = e.target.value;
    filterAuditLogs();
  });

  
  // Currency auto-formatting for owner pricing inputs
  ['inpProdCost', 'inpProdRetail', 'inpProdReseller', 'inpRestockCost', 'editPriceCost', 'editPriceRetail', 'editPriceReseller'].forEach(id => {
    const elInput = document.getElementById(id);
    if (elInput) attachCurrencyAutoFormat(elInput);
  });

  // Reports & Export Controls
  if (el.reportPresetGroup) {
    el.reportPresetGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-period-chip');
      if (btn) setReportPeriod(btn.dataset.period);
    });
  }

  if (el.btnApplyReportFilter) {
    el.btnApplyReportFilter.addEventListener('click', loadSalesReport);
  }

  if (el.btnExportCSV) {
    el.btnExportCSV.addEventListener('click', exportSalesReportToCSV);
  }

  if (el.btnPrintReportPDF) {
    el.btnPrintReportPDF.addEventListener('click', openPrintReportModal);
  }

  if (el.btnCloseModalPrintReport) {
    el.btnCloseModalPrintReport.addEventListener('click', () => el.modalPrintReport.style.display = 'none');
  }

  if (el.btnCancelModalPrintReport) {
    el.btnCancelModalPrintReport.addEventListener('click', () => el.modalPrintReport.style.display = 'none');
  }

  if (el.btnExecutePrint) {
    el.btnExecutePrint.addEventListener('click', () => window.print());
  }

  // Set default report dates to today
  const todayStr = formatYMD(new Date());
  if (el.repStartDate) el.repStartDate.value = todayStr;
  if (el.repEndDate) el.repEndDate.value = todayStr;

  // Modals
  el.btnAddNewProduct.addEventListener('click', openNewProductModal);
  el.btnCloseModalNewProduct.addEventListener('click', () => el.modalNewProduct.style.display = 'none');
  el.btnCancelModalNewProduct.addEventListener('click', () => el.modalNewProduct.style.display = 'none');
  el.btnSaveModalNewProduct.addEventListener('click', handleSaveNewProduct);

  el.btnRestockHeader.addEventListener('click', () => openRestockModal());
  el.btnCloseModalRestock.addEventListener('click', () => el.modalRestock.style.display = 'none');
  el.btnCancelModalRestock.addEventListener('click', () => el.modalRestock.style.display = 'none');
  el.inpRestockProductSelect.addEventListener('change', updateRestockCurrentStock);
  el.btnSaveModalRestock.addEventListener('click', handleSaveRestock);

  el.btnCloseModalEditPrice.addEventListener('click', () => el.modalEditPrice.style.display = 'none');
  el.btnCancelModalEditPrice.addEventListener('click', () => el.modalEditPrice.style.display = 'none');
  el.btnSaveModalEditPrice.addEventListener('click', handleSaveEditPrice);

  // Cashier Management Events
  if (el.btnAddNewCashier) el.btnAddNewCashier.addEventListener('click', openAddCashierModal);
  if (el.btnCloseModalAddCashier) el.btnCloseModalAddCashier.addEventListener('click', () => el.modalAddCashier.style.display = 'none');
  if (el.btnCancelModalAddCashier) el.btnCancelModalAddCashier.addEventListener('click', () => el.modalAddCashier.style.display = 'none');
  if (el.btnSaveModalAddCashier) el.btnSaveModalAddCashier.addEventListener('click', handleSaveAddCashier);

  if (el.btnCloseModalResetPin) el.btnCloseModalResetPin.addEventListener('click', () => el.modalResetPin.style.display = 'none');
  if (el.btnCancelModalResetPin) el.btnCancelModalResetPin.addEventListener('click', () => el.modalResetPin.style.display = 'none');
  if (el.btnSaveModalResetPin) el.btnSaveModalResetPin.addEventListener('click', handleSaveResetPin);

  // Settings & Live Receipt Preview Listeners
  ['setStoreName', 'setStoreTagline', 'setStoreAddress', 'setStorePhone', 'setReceiptFooter'].forEach(id => {
    const inputEl = document.getElementById(id);
    if (inputEl) inputEl.addEventListener('input', renderLiveReceiptPreview);
  });
  if (el.btnSaveStoreSettings) el.btnSaveStoreSettings.addEventListener('click', handleSaveStoreSettings);
  if (el.btnChangeOwnerPin) el.btnChangeOwnerPin.addEventListener('click', handleChangeOwnerPin);

}

// -----------------------------------------------------------------------------
// DATA FETCHING
// -----------------------------------------------------------------------------
async function loadAllData() {
  try {
    el.btnRefreshData.innerHTML = '<span class="icon">⏳</span> Memuat...';
    const [dashRes, shiftRes, prodRes, auditRes, usersRes, settingsRes] = await Promise.all([
      api.getDashboardReport(),
      api.getShiftHistory(),
      api.getProducts(),
      api.getAuditLogs(40),
      api.getUsers(),
      api.getSettings().catch(() => ({ settings: {} }))
    ]);

    state.dashboard = dashRes;
    state.shifts = shiftRes.shifts || [];
    state.products = prodRes.products || [];
    state.filteredProducts = [...state.products];
    state.auditLogs = auditRes.logs || [];
    state.users = usersRes.users || [];
    state.settings = (settingsRes && settingsRes.settings) || {};

    el.productCountBadge.textContent = state.products.length;
    el.auditCountBadge.textContent = state.auditLogs.length;
    if (el.cashierCountBadge) el.cashierCountBadge.textContent = state.users.length;

    renderKPIs();
    renderAnomalyRadar();
    renderLowStockRadar();
    renderShifts();
    renderWaste();
    renderProductsGrid();
    filterAuditLogs();
    renderCashiers();
    await loadDebtsData();
    populateSettingsForm();
    renderLiveReceiptPreview();

    showToast('Data toko berhasil diperbarui real-time!', 'success');
  } catch (err) {
    showToast('Gagal memuat data dashboard: ' + err.message, 'error');
  } finally {
    el.btnRefreshData.innerHTML = '<span class="icon">🔄</span> Segarkan';
  }
}

// -----------------------------------------------------------------------------
// TAB 1 RENDERERS
// -----------------------------------------------------------------------------
function renderKPIs() {
  const s = state.dashboard.summary;
  el.kpiCashDrawer.textContent = formatRupiah(s.cash_in_drawer);
  el.kpiRevenueToday.textContent = formatRupiah(s.total_revenue);
  el.kpiOrdersCount.textContent = `${s.total_orders} Nota Selesai Diproses`;
  el.kpiNonCash.textContent = formatRupiah(Number(s.total_qris) + Number(s.total_transfer));
  el.kpiVoidAmount.textContent = formatRupiah(s.void_total_amount);
  el.kpiVoidCount.textContent = `${s.void_count} Nota Dibatalkan`;

  if (state.dashboard.active_shift) {
    const act = state.dashboard.active_shift;
    el.quickCashierName.textContent = act.cashier_name;
    el.kpiDrawerStatus.innerHTML = `<span class="sub-dot green"></span> Shift #${act.id} Aktif: ${act.cashier_name} (Modal: ${formatRupiah(act.starting_cash)})`;
  } else {
    el.quickCashierName.textContent = 'Tidak Ada Shift Aktif';
    el.kpiDrawerStatus.textContent = 'Tidak ada shift kasir yang aktif';
  }
}

function renderAnomalyRadar() {
  const fraud = state.dashboard.anti_fraud;
  el.anomalyProgressFill.style.width = `${fraud.retail_percentage}%`;
  el.txtRetailRatio.textContent = `${fraud.retail_percentage}%`;
  el.txtResellerRatio.textContent = `${fraud.reseller_percentage}%`;

  if (fraud.is_ratio_anomalous) {
    el.radarIndicatorDot.style.background = '#e11d48';
    el.radarIndicatorDot.style.boxShadow = '0 0 12px #e11d48';
    el.anomalyStatusBadge.className = 'risk-badge danger';
    el.anomalyStatusBadge.textContent = '🚨 WASPADA ANOMALI KECURANGAN';
    el.anomalyExplanation.innerHTML = `
      <div style="color: #9f1239; font-weight: 600;">
        ⚠️ Peringatan Kritis: Penjualan grosir mencapai ${fraud.reseller_percentage}%. 
        Ini mencurigakan karena melebihi batas 75%. Ada indikasi kasir menjual eceran ke pembeli biasa tapi menginput harga grosir di sistem untuk mengantongi selisih uang tunai!
      </div>
    `;
  } else {
    el.radarIndicatorDot.style.background = '#10b981';
    el.radarIndicatorDot.style.boxShadow = '0 0 10px #10b981';
    el.anomalyStatusBadge.className = 'risk-badge normal';
    el.anomalyStatusBadge.textContent = '🟢 STATUS TRANSAKSI AMAN';
    el.anomalyExplanation.innerHTML = `
      <div style="color: #065f46;">
        ✅ Rasio wajar: ${fraud.retail_percentage}% Eceran vs ${fraud.reseller_percentage}% Grosir. Tidak ditemukan indikasi manipulasi harga oleh kasir.
      </div>
    `;
  }
}

function renderShifts() {
  if (state.shifts.length === 0) {
    el.shiftListContainer.innerHTML = '<div class="loading-placeholder">Belum ada riwayat shift kasir.</div>';
    return;
  }

  el.shiftListContainer.innerHTML = state.shifts.map(s => {
    const isClosed = s.status === 'closed';
    const diff = Number(s.cash_difference) || 0;
    let badgeHtml = '';

    if (!isClosed) {
      badgeHtml = '<span class="status-pill-badge active">🟢 SEDANG AKTIF</span>';
    } else if (diff === 0) {
      badgeHtml = '<span class="status-pill-badge balanced">✅ KAS BALANCE</span>';
    } else if (diff < 0) {
      badgeHtml = `<span class="status-pill-badge shortage">⚠️ KURANG ${formatRupiah(Math.abs(diff))}</span>`;
    } else {
      badgeHtml = `<span class="status-pill-badge balanced">+ LEBIH ${formatRupiah(diff)}</span>`;
    }

    const timeStr = s.end_time 
      ? `Tutup: ${parseSafeDate(s.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
      : `Buka: ${parseSafeDate(s.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;

    return `
      <div class="shift-item-card">
        <div class="shift-info-left">
          <span class="shift-user-title">Shift #${s.id} - ${s.cashier_name}</span>
          <span class="shift-time-meta">${timeStr} | Modal: ${formatRupiah(s.starting_cash)}</span>
        </div>
        <div class="shift-amounts-right">
          ${badgeHtml}
          <small class="text-muted">${isClosed ? 'Fisik: ' + formatRupiah(s.actual_cash) : 'Kasir sedang bertugas'}</small>
        </div>
      </div>
    `;
  }).join('');
}

function renderWaste() {
  const wastes = state.dashboard.waste_today || [];
  if (wastes.length === 0) {
    el.wasteListContainer.innerHTML = '<div class="loading-placeholder">Belum ada catatan barang susut atau busuk hari ini.</div>';
    return;
  }

  el.wasteListContainer.innerHTML = wastes.map(w => {
    const time = parseSafeDate(w.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="waste-item-card">
        <div class="waste-left">
          <span class="waste-tag">${w.type.toUpperCase()}</span>
          <div>
            <strong style="color:var(--text-title); font-size:13px;">${w.product_name}</strong>
            <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">
              ${time} | Pelapor: ${w.reported_by} ${w.notes ? '• ' + w.notes : ''}
            </div>
          </div>
        </div>
        <div style="font-family:var(--font-mono); font-weight:800; font-size:14px; color:#b91c1c;">
          -${w.qty_kg} kg
        </div>
      </div>
    `;
  }).join('');
}

// -----------------------------------------------------------------------------
// RADAR PERINGATAN STOK MENIPIS & KULAKAN
// -----------------------------------------------------------------------------
function renderLowStockRadar() {
  if (!el.radarLowStock) return;

  const lowStockItems = state.products.filter(p => {
    const minAlert = p.min_stock_alert !== undefined && p.min_stock_alert !== null ? Number(p.min_stock_alert) : 15.0;
    return Number(p.stock_qty) <= minAlert;
  });

  // Update chip count in Tab Katalog
  if (el.ownerLowStockChipCount) {
    el.ownerLowStockChipCount.textContent = lowStockItems.length;
  }

  if (lowStockItems.length === 0) {
    el.radarLowStock.style.display = 'none';
    return;
  }

  // Display radar card
  el.radarLowStock.style.display = 'block';
  const outOfStockCount = lowStockItems.filter(p => Number(p.stock_qty) <= 0).length;
  const lowCount = lowStockItems.length - outOfStockCount;

  let badgeSummary = `${lowStockItems.length} Komoditas Perlu Restock`;
  if (outOfStockCount > 0) {
    badgeSummary = `🚨 ${outOfStockCount} Habis • ⚠️ ${lowCount} Menipis`;
  }
  if (el.lowStockSummaryBadge) {
    el.lowStockSummaryBadge.textContent = badgeSummary;
  }

  if (el.lowStockItemsList) {
    el.lowStockItemsList.innerHTML = lowStockItems.map(p => {
      const minAlert = p.min_stock_alert !== undefined && p.min_stock_alert !== null ? Number(p.min_stock_alert) : 15.0;
      const isOut = Number(p.stock_qty) <= 0;
      const alertClass = isOut ? 'is-empty' : 'is-low';
      const statusTxt = isOut
        ? '<span class="status-txt-empty">🚨 STOK HABIS (0 ' + p.unit + ')</span>'
        : '<span class="status-txt-low">⚠️ Sisa ' + p.stock_qty + ' ' + p.unit + '</span>';

      return `
        <div class="low-stock-alert-item ${alertClass}">
          <div class="item-info-left">
            <div class="item-alert-emoji">${p.image_emoji || '🥔'}</div>
            <div class="item-alert-details">
              <div class="item-alert-name">${p.name}</div>
              <div class="item-stock-status">
                ${statusTxt}
                <span class="status-txt-min">• Batas Min: ${minAlert} ${p.unit}</span>
              </div>
            </div>
          </div>
          <button class="btn-quick-restock" data-id="${p.id}">
            📦 Kulakan
          </button>
        </div>
      `;
    }).join('');

    el.lowStockItemsList.querySelectorAll('.btn-quick-restock').forEach(btn => {
      btn.addEventListener('click', () => {
        openRestockModal(Number(btn.dataset.id));
      });
    });
  }
}

// -----------------------------------------------------------------------------
// TAB 2: KOMODITAS LUXURY CARDS
// -----------------------------------------------------------------------------
function filterProducts() {
  state.filteredProducts = state.products.filter(p => {
    let matchCat = true;
    if (state.activeCategory === 'low_stock') {
      const minAlert = p.min_stock_alert !== undefined && p.min_stock_alert !== null ? Number(p.min_stock_alert) : 15.0;
      matchCat = Number(p.stock_qty) <= minAlert;
    } else if (state.activeCategory) {
      matchCat = p.category === state.activeCategory;
    }
    const matchSearch = !state.searchKeyword || p.name.toLowerCase().includes(state.searchKeyword);
    return matchCat && matchSearch;
  });
  renderProductsGrid();
}

function renderProductsGrid() {
  if (state.filteredProducts.length === 0) {
    el.productsCardsGrid.innerHTML = '<div class="loading-placeholder">Tidak ada komoditas yang cocok dengan pencarian Anda.</div>';
    return;
  }

  el.productsCardsGrid.innerHTML = state.filteredProducts.map(p => {
    const marginRetail = Number(p.retail_price) - Number(p.cost_price);
    const marginReseller = Number(p.reseller_price) - Number(p.cost_price);
    const marginPercent = p.cost_price > 0 ? Math.round((marginRetail / p.cost_price) * 100) : 0;

    const minAlert = p.min_stock_alert !== undefined && p.min_stock_alert !== null ? Number(p.min_stock_alert) : 15.0;
    const isOut = Number(p.stock_qty) <= 0;
    const isLow = !isOut && Number(p.stock_qty) <= minAlert;

    let stockClass = 'healthy';
    let stockIcon = '🟢';
    let stockLabel = `${p.stock_qty} ${p.unit}`;

    if (isOut) {
      stockClass = 'empty';
      stockIcon = '🚨 Habis:';
      stockLabel = `0 ${p.unit}`;
    } else if (isLow) {
      stockClass = 'low';
      stockIcon = '⚠️ Menipis:';
      stockLabel = `${p.stock_qty} ${p.unit}`;
    } else if (Number(p.stock_qty) <= 50) {
      stockClass = 'warning';
      stockIcon = '🟡 Normal:';
      stockLabel = `${p.stock_qty} ${p.unit}`;
    }

    return `
      <div class="prod-card-luxury">
        <div>
          <div class="prod-card-top">
            <div class="prod-avatar-wrap">
              <div class="prod-icon-box">${p.image_emoji || '🥔'}</div>
              <div>
                <div class="prod-name-title">${p.name}</div>
                <span class="prod-cat-badge">${p.category.toUpperCase()} • Satuan ${p.unit}</span>
              </div>
            </div>
            <div style="text-align: right;">
              <span class="prod-stock-pill ${stockClass}">
                ${stockIcon} ${stockLabel}
              </span>
              <span class="threshold-info-badge">Batas Min: ${minAlert} ${p.unit}</span>
            </div>
          </div>

          <!-- Pricing Breakdown Matrix -->
          <div class="pricing-matrix-box">
            <div class="matrix-item">
              <span class="matrix-label">Modal (Beli)</span>
              <span class="matrix-val">${formatRupiah(p.cost_price)}</span>
            </div>
            <div class="matrix-item">
              <span class="matrix-label">Harga Eceran</span>
              <span class="matrix-val">${formatRupiah(p.retail_price)}</span>
            </div>
            <div class="matrix-item">
              <span class="matrix-label">Grosir (&ge;${p.wholesale_min_qty}${p.unit})</span>
              <span class="matrix-val reseller">${formatRupiah(p.reseller_price)}</span>
            </div>
          </div>

          <!-- Margin Indicator -->
          <div class="margin-indicator-bar">
            <span class="margin-text-left">Laba Bersih per Kg:</span>
            <span class="margin-number">+${formatRupiah(marginRetail)} (${marginPercent}%)</span>
          </div>
        </div>

        <div class="prod-card-bottom">
          <button class="btn-card-stock" data-id="${p.id}">
            📦 + Masuk Stok
          </button>
          <button class="btn-card-price" data-id="${p.id}">
            ✏️ Edit Harga
          </button>
        </div>
      </div>
    `;
  }).join('');

  el.productsCardsGrid.querySelectorAll('.btn-card-stock').forEach(btn => {
    btn.addEventListener('click', () => openRestockModal(Number(btn.dataset.id)));
  });

  el.productsCardsGrid.querySelectorAll('.btn-card-price').forEach(btn => {
    btn.addEventListener('click', () => {
      const prod = state.products.find(p => p.id === Number(btn.dataset.id));
      if (prod) openEditPriceModal(prod);
    });
  });
}

// -----------------------------------------------------------------------------
// TAB 3: AUDIT TIMELINE (HUMAN NARRATIVE GENERATOR)
// -----------------------------------------------------------------------------
function filterAuditLogs() {
  const type = state.activeAuditFilter;
  if (type === 'ALL') {
    state.filteredLogs = [...state.auditLogs];
  } else if (type === 'VOID') {
    state.filteredLogs = state.auditLogs.filter(a => a.action.includes('VOID'));
  } else if (type === 'SHORTAGE') {
    state.filteredLogs = state.auditLogs.filter(a => a.action.includes('SHORTAGE') || a.action.includes('SHIFT'));
  } else if (type === 'RESTOCK') {
    state.filteredLogs = state.auditLogs.filter(a => a.action.includes('RESTOCK'));
  } else if (type === 'CASHIER') {
    state.filteredLogs = state.auditLogs.filter(a => a.action.includes('CASHIER'));
  }
  renderAuditTimeline();
}

function parseAuditToNarrative(log) {
  let narrative = '';
  let badgeClass = 'slate';
  let badgeTitle = log.action;
  let icon = '📌';

  let d = {};
  try {
    d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
  } catch (e) {
    d = { raw: log.details };
  }

  switch (log.action) {
    case 'ORDER_CREATED':
      icon = '🛒';
      badgeClass = 'emerald';
      badgeTitle = 'Transaksi Penjualan';
      narrative = `Kasir memproses nota <strong>${d.order_no || ''}</strong> senilai <strong>${formatRupiah(d.total)}</strong> melalui metode <strong>${(d.payment_method || '').toUpperCase()}</strong> (${d.item_count || 1} jenis komoditas).`;
      break;

    case 'ORDER_VOIDED':
      icon = '🛑';
      badgeClass = 'rose';
      badgeTitle = 'Pembatalan Transaksi';
      narrative = `Transaksi nota <strong>${d.order_no || ''}</strong> senilai <strong>${formatRupiah(d.total_amount)}</strong> DIBATALKAN dengan persetujuan Owner. Alasan: "<em>${d.void_reason || '-'}</em>". Stok barang telah dikembalikan.`;
      break;

    case 'PRODUCT_RESTOCK':
      icon = '📦';
      badgeClass = 'blue';
      badgeTitle = 'Barang Masuk / Kulakan';
      narrative = `Penambahan stok komoditas <strong>${d.product_name}</strong> sebanyak <strong>+${d.added_qty} kg</strong>. Stok baru: <strong>${d.new_stock} kg</strong>. ${d.notes ? '(Catatan: ' + d.notes + ')' : ''}`;
      break;

    case 'SHIFT_OPENED':
      icon = '🔓';
      badgeClass = 'blue';
      badgeTitle = 'Buka Shift Kasir';
      narrative = `Shift kasir #${d.shift_id} dibuka dengan modal awal laci sebesar <strong>${formatRupiah(d.starting_cash)}</strong>.`;
      break;

    case 'SHIFT_CLOSED_BALANCED':
      icon = '⚖️';
      badgeClass = 'emerald';
      badgeTitle = 'Tutup Shift Seimbang';
      narrative = `Shift kasir #${d.shift_id} ditutup. Uang fisik yang disetor kasir sebesar <strong>${formatRupiah(d.actual)}</strong> SESUAI DENGAN SALDO SISTEM (KAS BALANCE).`;
      break;

    case 'SHIFT_CLOSED_SHORTAGE':
      icon = '⚠️';
      badgeClass = 'rose';
      badgeTitle = 'Selisih Kasir (Minus)';
      narrative = `⚠️ <strong>PERHATIAN:</strong> Shift #${d.shift_id} ditutup dengan <strong>SELISIH MINUS ${formatRupiah(Math.abs(d.difference))}</strong>. Ekspektasi sistem: ${formatRupiah(d.expected)}, disetor fisik: ${formatRupiah(d.actual)}.`;
      break;

    case 'SHIFT_CLOSED_SURPLUS':
      icon = '💰';
      badgeClass = 'emerald';
      badgeTitle = 'Selisih Kasir (Lebih)';
      narrative = `Shift #${d.shift_id} ditutup dengan selisih lebih ${formatRupiah(d.difference)}. Ekspektasi sistem: ${formatRupiah(d.expected)}, disetor fisik: ${formatRupiah(d.actual)}.`;
      break;

    case 'STOCK_ADJUSTMENT_BUSUK':
    case 'STOCK_ADJUSTMENT_SUSUT':
      icon = '📉';
      badgeClass = 'amber';
      badgeTitle = 'Barang Susut / Rusak';
      narrative = `Pencatatan barang susut pada <strong>${d.product_name}</strong> sebesar <strong>-${d.qty_kg} kg</strong>. Keterangan: "<em>${d.notes || '-'}</em>".`;
      break;

        case 'CASHIER_CREATED':
      icon = '👤';
      badgeClass = 'blue';
      badgeTitle = 'Kasir Baru';
      narrative = `Akun kasir baru <strong>"${d.name}"</strong> (@${d.username}) didaftarkan dengan peran <strong>${d.role === 'owner' ? 'Owner / Pemilik' : 'Kasir Toko'}</strong>.`;
      break;

    case 'CASHIER_UPDATED':
      icon = '🔑';
      badgeClass = d.pin_reset ? 'amber' : 'blue';
      badgeTitle = d.pin_reset ? 'Reset PIN Kasir' : 'Update Akun Kasir';
      narrative = d.pin_reset 
        ? `Kode PIN untuk kasir <strong>"${d.target_name}"</strong> berhasil diatur ulang.`
        : `Status akun kasir <strong>"${d.target_name}"</strong> diperbarui menjadi <strong>${d.is_active ? 'Aktif' : 'Nonaktif'}</strong>.`;
      break;

    case 'PRODUCT_CREATED':
      icon = '✨';
      badgeClass = 'blue';
      badgeTitle = 'Komoditas Baru';
      narrative = `Komoditas baru <strong>"${d.name}"</strong> didaftarkan ke katalog (Eceran: ${formatRupiah(d.retail_price)}, Grosir: ${formatRupiah(d.reseller_price)}).`;
      break;

    default:
      narrative = typeof d === 'object' ? JSON.stringify(d) : String(d);
  }

  return { icon, badgeClass, badgeTitle, narrative };
}

function renderAuditTimeline() {
  if (state.filteredLogs.length === 0) {
    el.auditTimelineContainer.innerHTML = '<div class="loading-placeholder">Tidak ada rekaman log pada filter ini.</div>';
    return;
  }

  el.auditTimelineContainer.innerHTML = state.filteredLogs.map(a => {
    const { icon, badgeClass, badgeTitle, narrative } = parseAuditToNarrative(a);
    const timeFormatted = parseSafeDate(a.created_at).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    return `
      <div class="timeline-event-card">
        <div class="event-icon-circle ${badgeClass}">
          ${icon}
        </div>
        <div class="event-main-content">
          <div class="event-top-line">
            <span class="event-title-badge status-pill-badge ${badgeClass === 'rose' ? 'shortage' : (badgeClass === 'emerald' ? 'balanced' : 'active')}">
              ${badgeTitle}
            </span>
            <span class="event-time-stamp">${timeFormatted}</span>
          </div>
          <div class="event-human-narrative">${narrative}</div>
          <div class="event-user-signature">
            Pelaksana: <strong>${a.user_name || 'Sistem'}</strong> (${a.user_role || '-'})
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// -----------------------------------------------------------------------------
// MODALS LOGIC
// -----------------------------------------------------------------------------
function openNewProductModal() {
  document.getElementById('inpProdName').value = '';
  document.getElementById('inpProdEmoji').value = '🥔';
  document.getElementById('inpProdCategory').value = 'umbi';
  document.getElementById('inpProdUnit').value = 'kg';
  document.getElementById('inpProdCost').value = '';
  document.getElementById('inpProdRetail').value = '';
  document.getElementById('inpProdReseller').value = '';
  document.getElementById('inpProdMinQty').value = '10';
  document.getElementById('inpProdStock').value = '50';
  el.modalNewProduct.style.display = 'flex';
  document.getElementById('inpProdName').focus();
}

async function handleSaveNewProduct() {
  const name = document.getElementById('inpProdName').value.trim();
  const emoji = document.getElementById('inpProdEmoji').value.trim() || '🥔';
  const category = document.getElementById('inpProdCategory').value;
  const unit = document.getElementById('inpProdUnit').value;
  const costPrice = parseRupiahInput(document.getElementById('inpProdCost').value);
  const retailPrice = parseRupiahInput(document.getElementById('inpProdRetail').value);
  const resellerPrice = parseRupiahInput(document.getElementById('inpProdReseller').value);
  const wholesaleQty = Number(document.getElementById('inpProdMinQty').value) || 10;
  const initialStock = Number(document.getElementById('inpProdStock').value) || 0;
  const minAlert = parseFloat(document.getElementById('inpProdMinAlert')?.value) || 15.0;

  if (!name || isNaN(costPrice) || isNaN(retailPrice) || isNaN(resellerPrice)) {
    showToast('Mohon lengkapi nama komoditas dan seluruh harga modal, eceran, dan grosir!', 'error');
    return;
  }

  const payload = {
    name,
    category,
    unit,
    cost_price: costPrice,
    retail_price: retailPrice,
    reseller_price: resellerPrice,
    wholesale_min_qty: wholesaleQty,
    stock_qty: initialStock,
    image_emoji: emoji,
    min_stock_alert: minAlert
  };

  try {
    el.btnSaveModalNewProduct.disabled = true;
    el.btnSaveModalNewProduct.textContent = 'Menyimpan...';

    const res = await api.createProduct(payload);
    el.modalNewProduct.style.display = 'none';
    showToast(`Komoditas "${name}" berhasil didaftarkan!`, 'success');
    await loadAllData();
  } catch (err) {
    showToast('Gagal menambah komoditas: ' + err.message, 'error');
  } finally {
    el.btnSaveModalNewProduct.disabled = false;
    el.btnSaveModalNewProduct.textContent = 'Simpan Komoditas ke Katalog';
  }
}

function openRestockModal(targetProductId = null) {
  if (state.products.length === 0) return;
  el.inpRestockProductSelect.innerHTML = state.products.map(p => `
    <option value="${p.id}" ${targetProductId === p.id ? 'selected' : ''}>${p.image_emoji || '🥔'} ${p.name}</option>
  `).join('');

  if (targetProductId) {
    el.inpRestockProductSelect.value = targetProductId;
  }
  updateRestockCurrentStock();
  el.inpRestockQty.value = '';
  el.inpRestockCost.value = '';
  el.inpRestockNotes.value = '';
  el.modalRestock.style.display = 'flex';
  el.inpRestockQty.focus();
}

function updateRestockCurrentStock() {
  const prodId = Number(el.inpRestockProductSelect.value);
  const prod = state.products.find(p => p.id === prodId);
  if (prod) {
    el.inpRestockCurrentStock.value = `${prod.stock_qty} ${prod.unit}`;
    el.inpRestockCost.placeholder = `Modal saat ini: Rp ${Number(prod.cost_price).toLocaleString('id-ID')}`;
  }
}

async function handleSaveRestock() {
  const prodId = Number(el.inpRestockProductSelect.value);
  const qty = parseFloat(el.inpRestockQty.value);
  const cost = el.inpRestockCost.value ? parseRupiahInput(el.inpRestockCost.value) : null;
  const notes = el.inpRestockNotes.value.trim();

  if (isNaN(qty) || qty <= 0) {
    showToast('Masukkan jumlah berat kg masuk yang valid', 'error');
    return;
  }

  try {
    el.btnSaveModalRestock.disabled = true;
    el.btnSaveModalRestock.textContent = 'Menyimpan...';

    const res = await api.restockProduct(prodId, qty, cost, notes);
    el.modalRestock.style.display = 'none';
    showToast(res.message, 'success');
    await loadAllData();
  } catch (err) {
    showToast('Gagal menambah stok: ' + err.message, 'error');
  } finally {
    el.btnSaveModalRestock.disabled = false;
    el.btnSaveModalRestock.textContent = 'Simpan & Tambah Stok';
  }
}

function openEditPriceModal(p) {
  el.editPriceProdId.value = p.id;
  el.editPriceProdName.value = p.name;
  el.editPriceCost.value = formatRupiahNumber(p.cost_price);
  el.editPriceRetail.value = formatRupiahNumber(p.retail_price);
  el.editPriceReseller.value = formatRupiahNumber(p.reseller_price);
  el.editPriceMinQty.value = p.wholesale_min_qty;
  if (el.editPriceMinAlert) {
    el.editPriceMinAlert.value = p.min_stock_alert !== undefined && p.min_stock_alert !== null ? p.min_stock_alert : 15.0;
  }
  el.modalEditPrice.style.display = 'flex';
}

async function handleSaveEditPrice() {
  const id = el.editPriceProdId.value;
  const payload = {
    cost_price: parseRupiahInput(el.editPriceCost.value),
    retail_price: parseRupiahInput(el.editPriceRetail.value),
    reseller_price: parseRupiahInput(el.editPriceReseller.value),
    wholesale_min_qty: Number(el.editPriceMinQty.value),
    min_stock_alert: el.editPriceMinAlert ? (parseFloat(el.editPriceMinAlert.value) || 15.0) : 15.0
  };

  try {
    el.btnSaveModalEditPrice.disabled = true;
    await api.updateProduct(id, payload);
    el.modalEditPrice.style.display = 'none';
    showToast('Harga komoditas berhasil diperbarui!', 'success');
    await loadAllData();
  } catch (err) {
    showToast('Gagal update harga: ' + err.message, 'error');
  } finally {
    el.btnSaveModalEditPrice.disabled = false;
  }
}


// -----------------------------------------------------------------------------
// TAB 4: CASHIER MANAGEMENT (USERS & PIN)
// -----------------------------------------------------------------------------
function renderCashiers() {
  if (!el.cashierCardsGrid) return;

  if (state.users.length === 0) {
    el.cashierCardsGrid.innerHTML = '<div class="loading-placeholder">Belum ada akun kasir terdaftar.</div>';
    return;
  }

  el.cashierCardsGrid.innerHTML = state.users.map(u => {
    const isOwner = u.role === 'owner';
    const isSelf = state.user && state.user.id === u.id;
    const dateFormatted = u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    }) : '-';

    return `
      <div class="cashier-card-luxury ${isOwner ? 'card-owner-highlight' : ''}">
        <div class="cashier-card-top">
          <div class="cashier-avatar-wrap ${isOwner ? 'avatar-owner' : 'avatar-cashier'}">
            ${isOwner ? '👑' : '👤'}
          </div>
          <div class="cashier-info">
            <div class="cashier-name-row">
              <h3 class="cashier-name" title="${u.name}">${u.name}</h3>
              <span class="role-pill ${isOwner ? 'role-owner' : 'role-cashier'}">
                ${isOwner ? 'Owner / Pemilik' : 'Kasir Toko'}
              </span>
            </div>
            <div class="cashier-meta">
              <span class="cashier-username">@${u.username}</span>
              <span class="meta-sep">•</span>
              <span class="cashier-date">Sejak ${dateFormatted}</span>
            </div>
          </div>
          <div class="cashier-status-col">
            <span class="status-pill-badge ${u.is_active ? 'active' : 'inactive'}">
              <span class="status-dot"></span>
              ${u.is_active ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
        </div>

        <div class="cashier-privileges-box">
          <div class="privilege-item">
            <span class="priv-icon">${isOwner ? '✅' : '✅'}</span>
            <span>Transaksi POS & Cetak Struk</span>
          </div>
          <div class="privilege-item">
            <span class="priv-icon">${isOwner ? '✅' : '🔒'}</span>
            <span>${isOwner ? 'Akses Penuh Owner Dashboard' : 'Blind Shift Close (Saldo Ditutup)'}</span>
          </div>
          <div class="privilege-item">
            <span class="priv-icon">${isOwner ? '✅' : '❌'}</span>
            <span>${isOwner ? 'Otoritas Pembatalan & Edit Harga' : 'Dilarang Batalkan Tanpa PIN Owner'}</span>
          </div>
        </div>

        <div class="cashier-card-actions">
          <button class="btn-card-action btn-reset-pin" data-user-id="${u.id}">
            <span class="btn-ico">🔑</span> Ganti PIN
          </button>
          ${isSelf ? `
            <span class="badge-self-account">Akun Anda Saat Ini</span>
          ` : `
            <button class="btn-card-action ${u.is_active ? 'btn-deactivate' : 'btn-activate'}" data-toggle-id="${u.id}" data-current-active="${u.is_active}">
              <span class="btn-ico">${u.is_active ? '⛔' : '⚡'}</span>
              ${u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');

  // Attach handlers to Reset PIN buttons
  el.cashierCardsGrid.querySelectorAll('.btn-reset-pin').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = Number(btn.dataset.userId);
      const user = state.users.find(u => u.id === userId);
      if (user) openResetPinModal(user);
    });
  });

  // Attach handlers to Toggle Active buttons
  el.cashierCardsGrid.querySelectorAll('[data-toggle-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = Number(btn.dataset.toggleId);
      const currentActive = Number(btn.dataset.currentActive) === 1;
      const user = state.users.find(u => u.id === userId);
      if (user) handleToggleUserStatus(user, currentActive);
    });
  });
}

function openAddCashierModal() {
  el.inpCashierName.value = '';
  el.inpCashierUsername.value = '';
  el.inpCashierRole.value = 'cashier';
  el.inpCashierPin.value = '';
  el.modalAddCashier.style.display = 'flex';
  el.inpCashierName.focus();
}

async function handleSaveAddCashier() {
  const name = el.inpCashierName.value.trim();
  const username = el.inpCashierUsername.value.trim().toLowerCase();
  const role = el.inpCashierRole.value;
  const pin = el.inpCashierPin.value.trim();

  if (!name || !username || !pin) {
    showToast('Mohon lengkapi Nama, Username, dan PIN kasir!', 'error');
    return;
  }

  if (pin.length < 4 || pin.length > 6 || isNaN(Number(pin))) {
    showToast('PIN kasir harus berupa 4 sampai 6 digit angka!', 'error');
    return;
  }

  try {
    el.btnSaveModalAddCashier.disabled = true;
    el.btnSaveModalAddCashier.textContent = 'Mendaftarkan...';

    const res = await api.createUser({
      name,
      username,
      role,
      pin_code: pin
    });

    el.modalAddCashier.style.display = 'none';
    showToast(res.message || 'Akun kasir berhasil didaftarkan!', 'success');
    await loadAllData();
  } catch (err) {
    showToast('Gagal mendaftarkan kasir: ' + err.message, 'error');
  } finally {
    el.btnSaveModalAddCashier.disabled = false;
    el.btnSaveModalAddCashier.textContent = 'Daftarkan Akun Kasir';
  }
}

function openResetPinModal(user) {
  el.resetPinUserId.value = user.id;
  el.resetPinUserName.value = user.name;
  el.resetPinUserUsername.value = '@' + user.username;
  el.resetPinNewPin.value = '';
  el.resetPinConfirmPin.value = '';
  el.modalResetPin.style.display = 'flex';
  el.resetPinNewPin.focus();
}

async function handleSaveResetPin() {
  const userId = el.resetPinUserId.value;
  const newPin = el.resetPinNewPin.value.trim();
  const confirmPin = el.resetPinConfirmPin.value.trim();

  if (!newPin || !confirmPin) {
    showToast('Masukkan PIN baru dan konfirmasi PIN!', 'error');
    return;
  }

  if (newPin.length < 4 || newPin.length > 6 || isNaN(Number(newPin))) {
    showToast('PIN harus berupa 4 sampai 6 digit angka!', 'error');
    return;
  }

  if (newPin !== confirmPin) {
    showToast('Konfirmasi PIN tidak cocok dengan PIN baru!', 'error');
    return;
  }

  try {
    el.btnSaveModalResetPin.disabled = true;
    el.btnSaveModalResetPin.textContent = 'Menyimpan...';

    const res = await api.updateUser(userId, { pin_code: newPin });
    el.modalResetPin.style.display = 'none';
    showToast(res.message || 'PIN kasir berhasil direset!', 'success');
    await loadAllData();
  } catch (err) {
    showToast('Gagal mereset PIN: ' + err.message, 'error');
  } finally {
    el.btnSaveModalResetPin.disabled = false;
    el.btnSaveModalResetPin.textContent = 'Simpan PIN Baru';
  }
}

async function handleToggleUserStatus(user, currentActive) {
  const actionText = currentActive ? 'menonaktifkan' : 'mengaktifkan kembali';
  if (!confirm(`Apakah Anda yakin ingin ${actionText} akun kasir "${user.name}"? Kasir ${currentActive ? 'tidak akan bisa login lagi' : 'dapat login kembali'}.`)) {
    return;
  }

  try {
    const res = await api.updateUser(user.id, { is_active: currentActive ? 0 : 1 });
    showToast(res.message || 'Status akun kasir berhasil diperbarui!', 'success');
    await loadAllData();
  } catch (err) {
    showToast('Gagal mengubah status kasir: ' + err.message, 'error');
  }
}


// -----------------------------------------------------------------------------
// TAB: LAPORAN PENJUALAN & EKSPOR EXCEL (CSV / PDF)
// -----------------------------------------------------------------------------
function formatYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function setReportPeriod(periodKey) {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (periodKey === 'today') {
    start = now;
    end = now;
  } else if (periodKey === 'yesterday') {
    start.setDate(now.getDate() - 1);
    end.setDate(now.getDate() - 1);
  } else if (periodKey === '7days') {
    start.setDate(now.getDate() - 6);
    end = now;
  } else if (periodKey === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = now;
  } else if (periodKey === 'last_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
  }

  if (el.repStartDate) el.repStartDate.value = formatYMD(start);
  if (el.repEndDate) el.repEndDate.value = formatYMD(end);

  if (el.reportPresetGroup) {
    el.reportPresetGroup.querySelectorAll('.btn-period-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === periodKey);
    });
  }

  loadSalesReport();
}

async function loadSalesReport() {
  if (!el.repStartDate || !el.repEndDate) return;

  const startDate = el.repStartDate.value;
  const endDate = el.repEndDate.value;
  const paymentMethod = el.repPaymentFilter ? el.repPaymentFilter.value : 'all';

  if (el.repOrdersTableBody) {
    el.repOrdersTableBody.innerHTML = '<tr><td colspan="9" class="text-center">Memuat data laporan penjualan...</td></tr>';
  }
  if (el.repTopProductsBody) {
    el.repTopProductsBody.innerHTML = '<tr><td colspan="4" class="text-center">Memuat komoditas terlaris...</td></tr>';
  }

  try {
    const res = await api.getSalesReport({
      start_date: startDate,
      end_date: endDate,
      payment_method: paymentMethod
    });

    state.salesReport = res;

    // 1. Render Financial KPIs
    const s = res.summary;
    if (el.repKpiRevenue) el.repKpiRevenue.textContent = formatRupiah(s.total_revenue);
    if (el.repKpiOrdersCount) el.repKpiOrdersCount.textContent = `${s.total_orders} Nota Selesai (${s.total_kg_sold} kg terjual)`;

    if (el.repKpiProfit) el.repKpiProfit.textContent = formatRupiah(s.gross_profit);
    if (el.repKpiMargin) el.repKpiMargin.textContent = `Margin Laba: ${s.margin_percentage}% dari Omzet`;

    if (el.repKpiCogs) el.repKpiCogs.textContent = formatRupiah(s.total_cogs);
    if (el.repKpiKgSold) el.repKpiKgSold.textContent = `${s.total_kg_sold} kg Total Komoditas Terjual`;

    const totalLoss = (s.void_total_amount || 0) + (s.waste_loss_cost || 0);
    if (el.repKpiLoss) el.repKpiLoss.textContent = formatRupiah(totalLoss);
    if (el.repKpiLossDetail) el.repKpiLossDetail.textContent = `${s.waste_kg} kg busuk (${formatRupiah(s.waste_loss_cost)}) • ${s.void_count} nota batal`;

    // 2. Render Payment Breakdown
    if (el.repPayCash) el.repPayCash.textContent = formatRupiah(s.by_payment.cash);
    if (el.repPayQris) el.repPayQris.textContent = formatRupiah(s.by_payment.qris);
    if (el.repPayTransfer) el.repPayTransfer.textContent = formatRupiah(s.by_payment.transfer);
    if (el.repAvgBasket) el.repAvgBasket.textContent = formatRupiah(s.avg_basket);

    // 3. Render Top Selling Products
    if (el.repTopProductsBody) {
      if (!res.top_products || res.top_products.length === 0) {
        el.repTopProductsBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada komoditas terjual pada periode ini</td></tr>';
      } else {
        el.repTopProductsBody.innerHTML = res.top_products.map((p, idx) => `
          <tr>
            <td>
              <strong>#${idx + 1} ${p.product_name}</strong>
            </td>
            <td class="text-right font-mono">${Number(p.total_kg).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} ${p.unit || 'kg'}</td>
            <td class="text-right font-mono font-bold">${formatRupiah(p.total_revenue)}</td>
            <td class="text-right font-mono text-success font-bold">+${formatRupiah(p.gross_profit)}</td>
          </tr>
        `).join('');
      }
    }

    // 4. Render Orders List
    const orders = res.orders || [];
    if (el.repOrdersCountBadge) el.repOrdersCountBadge.textContent = `${orders.length} Transaksi`;

    if (el.repOrdersTableBody) {
      if (orders.length === 0) {
        el.repOrdersTableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Tidak ada transaksi ditemukan pada rentang tanggal ini</td></tr>';
      } else {
        el.repOrdersTableBody.innerHTML = orders.map(o => {
          const timeFormatted = parseSafeDate(o.created_at).toLocaleString('id-ID', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
          const isVoid = o.status === 'void';
          const statusLabel = isVoid ? 'Batal' : 'Selesai';
          const badgeClass = isVoid ? 'status-badge void' : 'status-badge completed';

          return `
            <tr>
              <td><strong>${o.order_no}</strong></td>
              <td>${timeFormatted}</td>
              <td>${o.cashier_name || 'Kasir'}</td>
              <td>${o.customer_name || 'Umum'}</td>
              <td><span class="badge-mini-payment ${o.payment_method}">${o.payment_method.toUpperCase()}</span></td>
              <td class="text-right font-mono font-bold">${formatRupiah(o.total_amount)}</td>
              <td class="text-right font-mono text-muted">${formatRupiah(o.total_cogs)}</td>
              <td class="text-right font-mono font-bold ${isVoid ? 'text-muted' : 'text-success'}">
                ${isVoid ? '-' : '+' + formatRupiah(o.gross_profit)}
              </td>
              <td class="text-center">
                <span class="${badgeClass}">${statusLabel}</span>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    if (el.repOrdersTableBody) {
      el.repOrdersTableBody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Gagal memuat laporan: ${err.message}</td></tr>`;
    }
    showToast('Gagal memuat laporan penjualan: ' + err.message, 'error');
  }
}

function exportSalesReportToCSV() {
  if (!state.salesReport || !state.salesReport.orders || state.salesReport.orders.length === 0) {
    showToast('Tidak ada data transaksi untuk diekspor pada periode ini!', 'warning');
    return;
  }

  const { start_date, end_date } = state.salesReport.period;
  const s = state.salesReport.summary;
  const orders = state.salesReport.orders;

  // CSV Headers
  const headers = [
    'No. Nota',
    'Tanggal & Waktu',
    'Nama Kasir',
    'Nama Pembeli',
    'Metode Bayar',
    'Total Omzet (Rp)',
    'Modal HPP (Rp)',
    'Laba Kotor (Rp)',
    'Status Nota'
  ];

  const rows = orders.map(o => {
    const timeFormatted = parseSafeDate(o.created_at).toLocaleString('id-ID');
    const statusLabel = o.status === 'void' ? 'Dibatalkan' : 'Selesai';
    return [
      `"${o.order_no}"`,
      `"${timeFormatted}"`,
      `"${o.cashier_name || 'Kasir'}"`,
      `"${o.customer_name || 'Umum'}"`,
      `"${o.payment_method.toUpperCase()}"`,
      o.total_amount,
      o.total_cogs,
      o.gross_profit,
      `"${statusLabel}"`
    ].join(',');
  });

  // Summary Row
  const summaryRow = [
    '"TOTAL KESELURUHAN"',
    `"Periode: ${start_date} s/d ${end_date}"`,
    `"${s.total_orders} Nota Selesai"`,
    '""',
    '""',
    s.total_revenue,
    s.total_cogs,
    s.gross_profit,
    `"Margin ${s.margin_percentage}%"`
  ].join(',');

  // Add UTF-8 BOM (﻿) so Microsoft Excel opens indonesian characters properly
  const csvContent = '\uFEFF' + [headers.join(','), ...rows, '', summaryRow].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Laporan_Penjualan_Toko_Umbi_Jaya_${start_date}_sd_${end_date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Laporan penjualan (.CSV) berhasil diunduh untuk Excel!', 'success');
}

function openPrintReportModal() {
  if (!state.salesReport) {
    showToast('Silakan muat laporan terlebih dahulu!', 'warning');
    return;
  }

  const { start_date, end_date } = state.salesReport.period;
  const s = state.salesReport.summary;
  const orders = state.salesReport.orders || [];
  const topProds = state.salesReport.top_products || [];

  // Period
  if (el.printPeriodText) el.printPeriodText.textContent = `Periode Laporan: ${start_date} s/d ${end_date}`;

  // Summary Table
  if (el.printTotalRevenue) el.printTotalRevenue.textContent = formatRupiah(s.total_revenue);
  if (el.printTotalCogs) el.printTotalCogs.textContent = formatRupiah(s.total_cogs);
  if (el.printGrossProfit) el.printGrossProfit.textContent = formatRupiah(s.gross_profit);
  if (el.printMargin) el.printMargin.textContent = `${s.margin_percentage}% dari Omzet`;
  if (el.printTotalOrders) el.printTotalOrders.textContent = `${s.total_orders} Nota Selesai`;
  if (el.printTotalKg) el.printTotalKg.textContent = `${s.total_kg_sold} kg`;
  if (el.printCash) el.printCash.textContent = formatRupiah(s.by_payment.cash);
  if (el.printNonCash) el.printNonCash.textContent = formatRupiah((s.by_payment.qris || 0) + (s.by_payment.transfer || 0));
  if (el.printVoid) el.printVoid.textContent = `${s.void_count} Nota (${formatRupiah(s.void_total_amount)})`;
  if (el.printWaste) el.printWaste.textContent = `${s.waste_kg} kg (${formatRupiah(s.waste_loss_cost)})`;

  // Top Products
  if (el.printTopProductsBody) {
    el.printTopProductsBody.innerHTML = topProds.map((p, idx) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td><strong>${p.product_name}</strong></td>
        <td class="text-right">${p.total_kg} ${p.unit || 'kg'}</td>
        <td class="text-right">${formatRupiah(p.total_revenue)}</td>
        <td class="text-right">${formatRupiah(p.total_cogs)}</td>
        <td class="text-right font-bold">${formatRupiah(p.gross_profit)}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-center">-</td></tr>';
  }

  // Orders
  if (el.printOrdersBody) {
    el.printOrdersBody.innerHTML = orders.map(o => {
      const timeFormatted = parseSafeDate(o.created_at).toLocaleString('id-ID', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const statusLabel = o.status === 'void' ? 'Batal' : 'Selesai';
      return `
        <tr>
          <td><strong>${o.order_no}</strong></td>
          <td>${timeFormatted}</td>
          <td>${o.cashier_name || 'Kasir'}</td>
          <td>${o.customer_name || 'Umum'}</td>
          <td class="text-center">${o.payment_method.toUpperCase()}</td>
          <td class="text-right font-bold">${formatRupiah(o.total_amount)}</td>
          <td class="text-right">${o.status === 'void' ? '-' : formatRupiah(o.gross_profit)}</td>
          <td class="text-center">${statusLabel}</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="8" class="text-center">-</td></tr>';
  }

  if (el.modalPrintReport) el.modalPrintReport.style.display = 'flex';
}


// -----------------------------------------------------------------------------
// BUKU PIUTANG & KASBON (TEMPO MANAGEMENT)
// -----------------------------------------------------------------------------
async function loadDebtsData() {
  try {
    if (el.btnRefreshOwnerDebts) {
      el.btnRefreshOwnerDebts.innerHTML = '⏳ Memuat...';
    }

    const searchVal = el.searchOwnerDebt ? el.searchOwnerDebt.value.trim() : '';
    const res = await api.getDebts({
      status: state.activeDebtFilter,
      search: searchVal
    });

    if (!res.success) {
      console.error('Failed to load debts:', res.message);
      return;
    }

    state.debts = res.debts || [];
    state.debtSummary = res.summary || {};

    // Update KPI Cards
    if (el.kpiTotalOutstanding) {
      el.kpiTotalOutstanding.textContent = formatRupiah(state.debtSummary.total_outstanding || 0);
    }
    if (el.kpiTotalOverdue) {
      el.kpiTotalOverdue.textContent = formatRupiah(state.debtSummary.total_overdue || 0);
    }
    if (el.kpiTotalDebtors) {
      el.kpiTotalDebtors.textContent = (state.debtSummary.total_debtors || 0) + ' Orang';
    }
    if (el.kpiTotalPaidDebts) {
      el.kpiTotalPaidDebts.textContent = formatRupiah(state.debtSummary.total_paid || 0);
    }

    // Overdue badge alert
    if (el.badgeOverdueAlert) {
      el.badgeOverdueAlert.style.display = (state.debtSummary.total_overdue > 0) ? 'inline-block' : 'none';
    }

    // Quick badge count on Tab
    if (el.debtCountBadge) {
      const activeCount = state.debtSummary.total_debtors || 0;
      if (activeCount > 0) {
        el.debtCountBadge.textContent = activeCount;
        el.debtCountBadge.style.display = 'inline-block';
      } else {
        el.debtCountBadge.style.display = 'none';
      }
    }

    renderOwnerDebtsTable();
  } catch (err) {
    console.error('Error loading debts data:', err);
  } finally {
    if (el.btnRefreshOwnerDebts) {
      el.btnRefreshOwnerDebts.innerHTML = '🔄 Segarkan';
    }
  }
}

function renderOwnerDebtsTable() {
  if (!el.ownerDebtsTableBody) return;

  if (state.debts.length === 0) {
    el.ownerDebtsTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #94a3b8;">
          Tidak ada data transaksi kasbon / piutang yang sesuai.
        </td>
      </tr>
    `;
    return;
  }

  el.ownerDebtsTableBody.innerHTML = state.debts.map(d => {
    const orderDateFormatted = parseSafeDate(d.order_date).toLocaleString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    let dueDateFormatted = '-';
    if (d.due_date) {
      const parts = d.due_date.split('-');
      if (parts.length === 3) {
        dueDateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    // Status Badge
    let statusBadge = '';
    if (d.remaining_amount <= 0) {
      statusBadge = '<span class="kpi-badge success" style="font-size:11px;">🟢 Lunas</span>';
    } else if (d.is_overdue) {
      statusBadge = '<span class="kpi-badge danger" style="font-size:11px;">🚨 Lewat Tempo</span>';
    } else if (d.paid_amount > 0) {
      statusBadge = '<span class="kpi-badge amber" style="font-size:11px;">🟡 Sebagian</span>';
    } else {
      statusBadge = '<span class="kpi-badge alert" style="font-size:11px;">⚠️ Belum Lunas</span>';
    }

    // Tier badge
    const tierBadge = d.customer_tier === 'reseller' 
      ? '<span class="badge-tier reseller" style="font-size:10px; margin-left:4px;">Grosir</span>'
      : '<span class="badge-tier retail" style="font-size:10px; margin-left:4px;">Eceran</span>';

    return `
      <tr>
        <td>
          <strong style="color: #0f172a; font-family: var(--font-mono); font-size: 13px;">${d.order_no}</strong>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${orderDateFormatted}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
            ${d.customer_name} ${tierBadge}
          </div>
          <div style="font-size: 11px; color: #059669; margin-top: 2px;">📞 ${d.customer_phone || '-'}</div>
        </td>
        <td class="text-right" style="font-weight: 600; color: #334155;">${formatRupiah(d.total_amount)}</td>
        <td class="text-right font-bold" style="color: #059669;">${formatRupiah(d.paid_amount)}</td>
        <td class="text-right font-bold" style="font-size: 13px; color: ${d.remaining_amount > 0 ? '#d97706' : '#64748b'};">
          ${formatRupiah(d.remaining_amount)}
        </td>
        <td class="text-center" style="font-size: 12px; color: ${d.is_overdue ? '#dc2626' : '#334155'}; font-weight: ${d.is_overdue ? '700' : '500'};">
          ${dueDateFormatted}
          ${d.is_overdue ? '<div style="font-size:10px; color:#dc2626; font-weight:700;">(Lewat Tempo)</div>' : ''}
        </td>
        <td class="text-center">${statusBadge}</td>
        <td class="text-center">
          <div style="display: flex; gap: 6px; justify-content: center;">
            ${d.remaining_amount > 0 ? `
              <button class="btn-table-action btn-pay-debt" data-debt-id="${d.id}" style="padding: 5px 12px; font-size: 12px; background: #059669; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                💵 Bayar
              </button>
            ` : ''}
            <button class="btn-table-action btn-detail-debt" data-debt-id="${d.id}" style="padding: 5px 10px; font-size: 12px; background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-weight: 600;">
              📋 Rincian
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Bind click handlers for table action buttons
  el.ownerDebtsTableBody.querySelectorAll('.btn-pay-debt').forEach(btn => {
    btn.addEventListener('click', () => {
      openOwnerPayDebtModal(Number(btn.dataset.debtId));
    });
  });

  el.ownerDebtsTableBody.querySelectorAll('.btn-detail-debt').forEach(btn => {
    btn.addEventListener('click', () => {
      openOwnerDebtDetailModal(Number(btn.dataset.debtId));
    });
  });
}

function openOwnerPayDebtModal(debtId) {
  const debt = state.debts.find(d => d.id === debtId);
  if (!debt) return;

  state.activeDebtForPayment = debt;
  if (el.ownerPayDebtSubtitle) {
    el.ownerPayDebtSubtitle.textContent = `${debt.customer_name} (Nota: ${debt.order_no})`;
  }
  if (el.ownerPayDebtRemainingText) {
    el.ownerPayDebtRemainingText.textContent = formatRupiah(debt.remaining_amount);
  }

  // Default to Full Pay
  if (el.btnOwnerPayFull) {
    el.btnOwnerPayFull.classList.add('active');
    el.btnOwnerPayFull.style.background = '#10b981';
    el.btnOwnerPayFull.style.color = '#fff';
  }
  if (el.btnOwnerPayPartial) {
    el.btnOwnerPayPartial.classList.remove('active');
    el.btnOwnerPayPartial.style.background = 'rgba(255,255,255,0.08)';
    el.btnOwnerPayPartial.style.color = '#e2e8f0';
  }

  if (el.ownerPayAmountInput) {
    el.ownerPayAmountInput.value = formatRupiah(debt.remaining_amount);
  }
  if (el.ownerPayNotesInput) {
    el.ownerPayNotesInput.value = '';
  }

  if (el.modalOwnerPayDebt) {
    el.modalOwnerPayDebt.style.display = 'flex';
  }
}

async function handleOwnerPayDebtSubmit() {
  if (!state.activeDebtForPayment) return;

  const rawAmount = el.ownerPayAmountInput.value.replace(/[^0-9]/g, '');
  const amount = Number(rawAmount);

  if (isNaN(amount) || amount <= 0) {
    alert('Nominal pembayaran wajib diisi dan harus lebih dari Rp 0!');
    el.ownerPayAmountInput.focus();
    return;
  }

  if (amount > state.activeDebtForPayment.remaining_amount) {
    alert(`Nominal melebihi sisa hutang (${formatRupiah(state.activeDebtForPayment.remaining_amount)})!`);
    return;
  }

  const method = el.ownerPayMethodSelect.value;
  const notes = el.ownerPayNotesInput.value.trim();

  try {
    el.btnSubmitOwnerPayDebt.disabled = true;
    el.btnSubmitOwnerPayDebt.textContent = 'Menyimpan...';

    const res = await api.payDebt(state.activeDebtForPayment.id, {
      amount_paid: amount,
      payment_method: method,
      notes: notes
    });

    if (res.success) {
      alert(res.message);
      el.modalOwnerPayDebt.style.display = 'none';
      await loadDebtsData();
      await loadAllData();
    } else {
      alert('Gagal: ' + res.message);
    }
  } catch (err) {
    alert('Terjadi kesalahan: ' + err.message);
  } finally {
    el.btnSubmitOwnerPayDebt.disabled = false;
    el.btnSubmitOwnerPayDebt.textContent = 'Simpan Pembayaran';
  }
}

async function openOwnerDebtDetailModal(debtId) {
  try {
    const res = await api.getDebtDetail(debtId);
    if (!res.success) {
      alert('Gagal mengambil rincian piutang: ' + res.message);
      return;
    }

    const d = res.debt;
    if (el.debtDetailSubtitle) {
      el.debtDetailSubtitle.textContent = `${d.customer_name} • Nota: ${d.order_no}`;
    }
    if (el.detailTotalKasbon) {
      el.detailTotalKasbon.textContent = formatRupiah(d.total_amount);
    }
    if (el.detailRemainingKasbon) {
      el.detailRemainingKasbon.textContent = formatRupiah(d.remaining_amount);
    }

    if (el.debtDetailPaymentsBody) {
      if (!d.payments || d.payments.length === 0) {
        el.debtDetailPaymentsBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">Belum ada catatan cicilan atau pelunasan.</td></tr>';
      } else {
        el.debtDetailPaymentsBody.innerHTML = d.payments.map(p => {
          const timeFormatted = parseSafeDate(p.payment_date).toLocaleString('id-ID', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          return `
            <tr>
              <td style="padding: 8px 10px; color: #cbd5e1;">${timeFormatted}</td>
              <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #34d399;">${formatRupiah(p.amount_paid)}</td>
              <td style="padding: 8px 10px; text-transform: uppercase;">${p.payment_method}</td>
              <td style="padding: 8px 10px; color: #94a3b8;">${p.recorded_by_name || 'Petugas'}</td>
              <td style="padding: 8px 10px; color: #cbd5e1;">${p.notes || '-'}</td>
            </tr>
          `;
        }).join('');
      }
    }

    if (el.modalOwnerDebtDetail) {
      el.modalOwnerDebtDetail.style.display = 'flex';
    }
  } catch (err) {
    alert('Gagal membuka rincian piutang: ' + err.message);
  }
}


// -----------------------------------------------------------------------------
// TAB 7: IDENTITAS TOKO & FOOTER STRUK (SETTINGS & LIVE PREVIEW)
// -----------------------------------------------------------------------------
function populateSettingsForm() {
  if (!state.settings) return;
  if (el.setStoreName && !el.setStoreName.matches(':focus')) {
    el.setStoreName.value = state.settings.store_name || 'TOKO UMBI JAYA';
  }
  if (el.setStoreTagline && !el.setStoreTagline.matches(':focus')) {
    el.setStoreTagline.value = state.settings.store_tagline || 'Pusat Umbi, Bawang & Komoditas Pasar';
  }
  if (el.setStoreAddress && !el.setStoreAddress.matches(':focus')) {
    el.setStoreAddress.value = state.settings.store_address || 'Pasar Induk Kramat Jati, Blok B No. 12-14';
  }
  if (el.setStorePhone && !el.setStorePhone.matches(':focus')) {
    el.setStorePhone.value = state.settings.store_phone || '0812-3456-7890';
  }
  if (el.setReceiptFooter && !el.setReceiptFooter.matches(':focus')) {
    el.setReceiptFooter.value = state.settings.receipt_footer || 'Terima kasih atas kunjungan Anda!\nBarang yang sudah ditimbang & dibeli tidak dapat ditukar/dikembalikan.';
  }
}

function renderLiveReceiptPreview() {
  if (!el.liveReceiptPreview) return;

  const sName = (el.setStoreName && el.setStoreName.value.trim()) || 'TOKO UMBI JAYA';
  const sTagline = (el.setStoreTagline && el.setStoreTagline.value.trim()) || 'Pusat Umbi, Bawang & Komoditas Pasar';
  const sAddress = (el.setStoreAddress && el.setStoreAddress.value.trim()) || 'Pasar Induk Kramat Jati, Blok B No. 12-14';
  const sPhone = (el.setStorePhone && el.setStorePhone.value.trim()) || '0812-3456-7890';
  const sFooter = (el.setReceiptFooter && el.setReceiptFooter.value.trim()) || 'Terima kasih atas kunjungan Anda!\nBarang yang sudah ditimbang & dibeli tidak dapat ditukar/dikembalikan.';

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
                  now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  el.liveReceiptPreview.innerHTML = `
    <div class="sim-receipt-header">
      <div class="sim-receipt-title">${sName}</div>
      <div class="sim-receipt-tagline">${sTagline}</div>
      ${sAddress ? `<div class="sim-receipt-contact">${sAddress}</div>` : ''}
      ${sPhone ? `<div class="sim-receipt-contact">Telp/WA: ${sPhone}</div>` : ''}
    </div>
    <div class="sim-receipt-divider"></div>
    <div class="sim-receipt-meta">
      <div>No. Nota: <strong>TB-20261015-0012</strong></div>
      <div>Waktu   : ${dateStr}</div>
      <div>Kasir   : ${state.user ? state.user.name : 'Kasir Utama'}</div>
      <div>Pembeli : Pelanggan Langganan</div>
    </div>
    <div class="sim-receipt-divider"></div>
    <div class="sim-receipt-row">
      <span>Wortel Brastagi (3.5 kg @16.000)</span>
      <strong>Rp 56.000</strong>
    </div>
    <div class="sim-receipt-row">
      <span>Kentang Dieng Super (5 kg @18.000)</span>
      <strong>Rp 90.000</strong>
    </div>
    <div class="sim-receipt-row">
      <span>Bawang Merah Brebes (2 kg @32.000)</span>
      <strong>Rp 64.000</strong>
    </div>
    <div class="sim-receipt-divider"></div>
    <div class="sim-receipt-row bold">
      <span>TOTAL BELANJA</span>
      <span>Rp 210.000</span>
    </div>
    <div class="sim-receipt-row">
      <span>Tunai (Cash)</span>
      <span>Rp 250.000</span>
    </div>
    <div class="sim-receipt-row">
      <span>Kembalian</span>
      <span>Rp 40.000</span>
    </div>
    <div class="sim-receipt-divider"></div>
    <div class="sim-receipt-footer">
      ${sFooter.split('\n').map(line => `<div>${line}</div>`).join('')}
    </div>
  `;
}

async function handleSaveStoreSettings() {
  const storeName = el.setStoreName.value.trim();
  const storeTagline = el.setStoreTagline.value.trim();
  const storeAddress = el.setStoreAddress.value.trim();
  const storePhone = el.setStorePhone.value.trim();
  const receiptFooter = el.setReceiptFooter.value.trim();

  if (!storeName) {
    showToast('Nama toko tidak boleh kosong!', 'error');
    el.setStoreName.focus();
    return;
  }

  const payload = {
    store_name: storeName,
    store_tagline: storeTagline,
    store_address: storeAddress,
    store_phone: storePhone,
    receipt_footer: receiptFooter
  };

  try {
    el.btnSaveStoreSettings.disabled = true;
    el.btnSaveStoreSettings.textContent = 'Menyimpan...';

    const res = await api.updateSettings(payload);
    state.settings = res.settings;
    showToast(res.message || 'Identitas toko & struk berhasil diperbarui!', 'success');
    renderLiveReceiptPreview();
  } catch (err) {
    showToast('Gagal menyimpan pengaturan: ' + err.message, 'error');
  } finally {
    el.btnSaveStoreSettings.disabled = false;
    el.btnSaveStoreSettings.textContent = '💾 Simpan Identitas & Struk Toko';
  }
}

async function handleChangeOwnerPin() {
  const oldPin = el.setOldOwnerPin.value.trim();
  const newPin = el.setNewOwnerPin.value.trim();
  const confirmPin = el.setConfirmOwnerPin.value.trim();

  if (!oldPin || !newPin || !confirmPin) {
    showToast('Semua kolom PIN lama, baru, dan konfirmasi wajib diisi!', 'error');
    return;
  }

  if (newPin !== confirmPin) {
    showToast('Konfirmasi PIN baru tidak cocok!', 'error');
    return;
  }

  if (newPin.length < 4 || newPin.length > 6 || isNaN(Number(newPin))) {
    showToast('PIN baru harus berupa 4-6 digit angka!', 'error');
    return;
  }

  try {
    el.btnChangeOwnerPin.disabled = true;
    el.btnChangeOwnerPin.textContent = 'Memproses...';

    const res = await api.changeOwnerPin(oldPin, newPin);
    showToast(res.message || 'PIN Owner berhasil diperbarui!', 'success');
    el.setOldOwnerPin.value = '';
    el.setNewOwnerPin.value = '';
    el.setConfirmOwnerPin.value = '';
  } catch (err) {
    showToast('Gagal mengubah PIN owner: ' + err.message, 'error');
  } finally {
    el.btnChangeOwnerPin.disabled = false;
    el.btnChangeOwnerPin.textContent = '🔒 Perbarui PIN Owner';
  }
}

window.addEventListener('DOMContentLoaded', initOwnerApp);
