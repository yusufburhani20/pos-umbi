import { api } from './api.js';
import { syncEngine } from './sync-engine.js';
import { hardwareManager } from './hardware.js';
import { initSubscriptionGuard } from './subscription.js';
import {
  saveProductsLocal,
  getProductsLocal,
  saveCustomersLocal,
  getCustomersLocal,
  saveSettingsLocal,
  getSettingsLocal,
  saveActiveShiftLocal,
  getActiveShiftLocal,
  enqueueOrderLocal,
  deductProductStockLocal,
  enqueueAdjustmentLocal,
  enqueueDebtPaymentLocal,
  getAllLocalOrders
} from './offline-db.js';

// Local storage helper for cart persistence
function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem('pos_cart');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem('pos_cart', JSON.stringify(state.cart));
  } catch (e) {}
}

function parseSafeDate(dateInput) {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  let s = String(dateInput).trim();
  if (s.includes(' ') && !s.includes('T')) {
    s = s.replace(' ', 'T');
  }
  return new Date(s);
}

function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Global POS State
const state = {
  user: null,
  shift: null,
  products: [],
  filteredProducts: [],
  customers: [],
  selectedCustomerId: '',
  selectedCustomer: null,
  activeCategory: '',
  cart: loadCartFromStorage(),
  activeScaleProduct: null,
  scaleMode: 'weight',
  scaleCustomRate: null,
  activeCartEditIndex: null,
  activeEditCartPriceIndex: null,
  scaleCalculatedQty: 1,
  scaleCalculatedSubtotal: 0,
  paymentMethod: 'cash',
  pendingVoidOrder: null,
  cashierDebts: [],
  activeDebtForPayment: null,
  activeKarungModalIndex: null,
  cashierDebtFilter: 'unpaid',
  activeDetailDebtId: null,
  lastCompletedOrder: null,
  lastOrderIsReprint: false,
  suppliers: [],
  supplierSummary: {},
  purchases: [],
  cashierActiveSupplierTab: 'juragan',
  cashierActivePurchaseForPayment: null,
  expenses: [],
  expenseSummary: {},
  expenseCategories: [],
  selectedExpenseCategory: 'makan_rokok',
  activeExpenseTab: 'record'
};

// DOM Elements
const el = {
  liveDayDate: document.getElementById('liveDayDate'),
  liveClockTime: document.getElementById('liveClockTime'),
  activeCashierName: document.getElementById('activeCashierName'),
  btnOwnerPanel: document.getElementById('btnOwnerPanel'),
  activeShiftMeta: document.getElementById('activeShiftMeta'),
  productGrid: document.getElementById('productGrid'),
  searchProduct: document.getElementById('searchProduct'),
  clearSearch: document.getElementById('clearSearch'),
  categoryFilters: document.getElementById('categoryFilters'),
  customerSelect: document.getElementById('customerSelect'),
  currentTierLabel: document.getElementById('currentTierLabel'),
  tierHintText: document.getElementById('tierHintText'),
  cartItemsList: document.getElementById('cartItemsList'),
  btnClearCart: document.getElementById('btnClearCart'),
  totalWeightText: document.getElementById('totalWeightText'),
  totalAmountText: document.getElementById('totalAmountText'),
  btnCheckout: document.getElementById('btnCheckout'),
  cashPresetsBar: document.getElementById('cashPresetsBar'),

  // Modals
  
  modalScaleWeight: document.getElementById('modalScaleWeight'),
  scaleProdEmoji: document.getElementById('scaleProdEmoji'),
  scaleProdName: document.getElementById('scaleProdName'),
  scaleProdPriceRate: document.getElementById('scaleProdPriceRate'),
  btnCloseScaleModal: document.getElementById('btnCloseScaleModal'),
  btnCancelScaleModal: document.getElementById('btnCancelScaleModal'),
  btnSubmitScaleToCart: document.getElementById('btnSubmitScaleToCart'),
  tabModeWeight: document.getElementById('tabModeWeight'),
  tabModeMoney: document.getElementById('tabModeMoney'),
  paneScaleWeight: document.getElementById('paneScaleWeight'),
  paneScaleMoney: document.getElementById('paneScaleMoney'),
  inpScaleWeightKg: document.getElementById('inpScaleWeightKg'),
  scaleWeightSubtotal: document.getElementById('scaleWeightSubtotal'),
  scaleTierBadge: document.getElementById('scaleTierBadge'),
  inpScaleMoneyRp: document.getElementById('inpScaleMoneyRp'),
  scaleMoneyResultKg: document.getElementById('scaleMoneyResultKg'),
  scaleMoneyResultGram: document.getElementById('scaleMoneyResultGram'),
  loginModal: document.getElementById('loginModal'),
  pinInput: document.getElementById('pinInput'),
  openShiftModal: document.getElementById('openShiftModal'),
  startingCashInput: document.getElementById('startingCashInput'),
  btnConfirmOpenShift: document.getElementById('btnConfirmOpenShift'),
  btnCancelOpenShift: document.getElementById('btnCancelOpenShift'),

  btnDebtsModal: document.getElementById('btnDebtsModal'),

  // Tempo / Kasbon in Payment Modal
  tempoPaymentSection: document.getElementById('tempoPaymentSection'),
  tempoCustomerNameInput: document.getElementById('tempoCustomerNameInput'),
  tempoCustomerPhoneInput: document.getElementById('tempoCustomerPhoneInput'),
  registeredCustomersList: document.getElementById('registeredCustomersList'),
  tempoDueDateInput: document.getElementById('tempoDueDateInput'),
  tempoDpInput: document.getElementById('tempoDpInput'),
  tempoTotalAmount: document.getElementById('tempoTotalAmount'),
  tempoDpAmount: document.getElementById('tempoDpAmount'),
  tempoRemainingAmount: document.getElementById('tempoRemainingAmount'),

  // Cashier Debts Modal & Filter Tabs
  cashierDebtsModal: document.getElementById('cashierDebtsModal'),
  searchCashierDebt: document.getElementById('searchCashierDebt'),
  btnRefreshCashierDebts: document.getElementById('btnRefreshCashierDebts'),
  cashierDebtsTableBody: document.getElementById('cashierDebtsTableBody'),
  btnCloseCashierDebtsModal: document.getElementById('btnCloseCashierDebtsModal'),
  btnCloseCashierDebtsFooter: document.getElementById('btnCloseCashierDebtsFooter'),
  btnDebtFilterUnpaid: document.getElementById('btnDebtFilterUnpaid'),
  btnDebtFilterOverdue: document.getElementById('btnDebtFilterOverdue'),
  btnDebtFilterPaid: document.getElementById('btnDebtFilterPaid'),
  btnDebtFilterAll: document.getElementById('btnDebtFilterAll'),

  // Debt Detail Modal
  modalDetailDebt: document.getElementById('modalDetailDebt'),
  btnCloseDetailDebtModal: document.getElementById('btnCloseDetailDebtModal'),
  btnCloseDetailDebtFooter: document.getElementById('btnCloseDetailDebtFooter'),
  detailDebtSubtitle: document.getElementById('detailDebtSubtitle'),
  detailDebtCustomerName: document.getElementById('detailDebtCustomerName'),
  detailDebtCustomerPhone: document.getElementById('detailDebtCustomerPhone'),
  detailDebtWhatsAppLink: document.getElementById('detailDebtWhatsAppLink'),
  detailDebtStatusBadge: document.getElementById('detailDebtStatusBadge'),
  detailDebtOrderNo: document.getElementById('detailDebtOrderNo'),
  detailDebtDueDate: document.getElementById('detailDebtDueDate'),
  detailDebtTotalAmount: document.getElementById('detailDebtTotalAmount'),
  detailDebtPaidAmount: document.getElementById('detailDebtPaidAmount'),
  detailDebtRemainingAmount: document.getElementById('detailDebtRemainingAmount'),
  detailDebtItemsBody: document.getElementById('detailDebtItemsBody'),
  detailDebtPaymentsBody: document.getElementById('detailDebtPaymentsBody'),
  btnTriggerEditFromDetail: document.getElementById('btnTriggerEditFromDetail'),
  btnTriggerPayFromDetail: document.getElementById('btnTriggerPayFromDetail'),

  // Debt Edit Modal
  modalEditDebt: document.getElementById('modalEditDebt'),
  btnCloseEditDebtModal: document.getElementById('btnCloseEditDebtModal'),
  btnCancelEditDebt: document.getElementById('btnCancelEditDebt'),
  btnSaveEditDebt: document.getElementById('btnSaveEditDebt'),
  editDebtId: document.getElementById('editDebtId'),
  editDebtOrderNo: document.getElementById('editDebtOrderNo'),
  editDebtCustomerName: document.getElementById('editDebtCustomerName'),
  editDebtCustomerPhone: document.getElementById('editDebtCustomerPhone'),
  editDebtDueDate: document.getElementById('editDebtDueDate'),
  editDebtRemainingAmount: document.getElementById('editDebtRemainingAmount'),
  editDebtNotes: document.getElementById('editDebtNotes'),

  // Katalog & Margin DOM elements
  btnCatalogMargin: document.getElementById('btnCatalogMargin'),
  modalCatalogMargin: document.getElementById('modalCatalogMargin'),
  btnCloseCatalogMarginModal: document.getElementById('btnCloseCatalogMarginModal'),
  btnCloseCatalogMarginFooter: document.getElementById('btnCloseCatalogMarginFooter'),
  searchCatalogMarginInput: document.getElementById('searchCatalogMarginInput'),
  catalogMarginTableBody: document.getElementById('catalogMarginTableBody'),
  btnCatalogMarginAddProduct: document.getElementById('btnCatalogMarginAddProduct'),
  btnCatalogMarginRestock: document.getElementById('btnCatalogMarginRestock'),
  restockModal: document.getElementById('restockModal'),
  newProductModal: document.getElementById('newProductModal'),
  editProductModal: document.getElementById('editProductModal'),

  // Modal Riwayat Stok Masuk Komoditas (Kasir)
  modalProductRestockHistoryCashier: document.getElementById('modalProductRestockHistoryCashier'),
  cashierProdRestockIconBadge: document.getElementById('cashierProdRestockIconBadge'),
  cashierProdRestockModalTitle: document.getElementById('cashierProdRestockModalTitle'),
  cashierProdRestockModalSubtitle: document.getElementById('cashierProdRestockModalSubtitle'),
  btnCloseCashierProdRestockModal: document.getElementById('btnCloseCashierProdRestockModal'),
  btnCloseCashierProdRestockModalFooter: document.getElementById('btnCloseCashierProdRestockModalFooter'),
  btnCashierQuickRestockFromHistory: document.getElementById('btnCashierQuickRestockFromHistory'),
  cashierStatCurrentStock: document.getElementById('cashierStatCurrentStock'),
  cashierStatTotalReceived: document.getElementById('cashierStatTotalReceived'),
  cashierStatEntriesCount: document.getElementById('cashierStatEntriesCount'),
  cashierProdRestockTableBody: document.getElementById('cashierProdRestockTableBody'),

  // Suppliers, Kulakan & Hutang Tempo Toko (Kasir / Admin)
  btnDirectKulakan: document.getElementById('btnDirectKulakan'),
  btnCashierSupplierDebtItem: document.getElementById('btnCashierSupplierDebtItem'),
  btnCashierSuppliersModal: document.getElementById('btnCashierSuppliersModal'),
  modalCashierSuppliers: document.getElementById('modalCashierSuppliers'),
  btnCloseCashierSuppliersModal: document.getElementById('btnCloseCashierSuppliersModal'),
  btnCloseCashierSuppliersFooter: document.getElementById('btnCloseCashierSuppliersFooter'),
  btnCashierHeaderAddSupplier: document.getElementById('btnCashierHeaderAddSupplier'),
  btnCashierHeaderRecordPurchase: document.getElementById('btnCashierHeaderRecordPurchase'),
  kpiCashierTotalSuppliers: document.getElementById('kpiCashierTotalSuppliers'),
  kpiCashierMonthlyPurchases: document.getElementById('kpiCashierMonthlyPurchases'),
  kpiCashierTotalDebt: document.getElementById('kpiCashierTotalDebt'),
  kpiCashierDebtsCountText: document.getElementById('kpiCashierDebtsCountText'),
  kpiCashierOverdueDebt: document.getElementById('kpiCashierOverdueDebt'),
  tabCashierSupJuragan: document.getElementById('tabCashierSupJuragan'),
  tabCashierSupPurchases: document.getElementById('tabCashierSupPurchases'),
  tabCashierSupTempo: document.getElementById('tabCashierSupTempo'),
  badgeCashierTempoCount: document.getElementById('badgeCashierTempoCount'),
  cashierSearchSupplierInput: document.getElementById('cashierSearchSupplierInput'),
  cashierSupplierStatusFilter: document.getElementById('cashierSupplierStatusFilter'),
  btnRefreshCashierSuppliers: document.getElementById('btnRefreshCashierSuppliers'),
  cashierViewJuraganContainer: document.getElementById('cashierViewJuraganContainer'),
  cashierViewPurchasesContainer: document.getElementById('cashierViewPurchasesContainer'),
  cashierViewTempoContainer: document.getElementById('cashierViewTempoContainer'),
  cashierSuppliersContainer: document.getElementById('cashierSuppliersContainer'),
  cashierPurchasesTableBody: document.getElementById('cashierPurchasesTableBody'),
  cashierTempoDebtsTableBody: document.getElementById('cashierTempoDebtsTableBody'),
  btnOpenCashierNewSupplier: document.getElementById('btnOpenCashierNewSupplier'),
  modalNewSupplierQuick: document.getElementById('modalNewSupplierQuick'),
  btnCloseNewSupplierQuick: document.getElementById('btnCloseNewSupplierQuick'),
  btnCancelNewSupplierQuick: document.getElementById('btnCancelNewSupplierQuick'),
  btnSaveNewSupplierQuick: document.getElementById('btnSaveNewSupplierQuick'),
  quickSupName: document.getElementById('quickSupName'),
  quickSupPhone: document.getElementById('quickSupPhone'),
  quickSupAddress: document.getElementById('quickSupAddress'),
  quickSupCommodities: document.getElementById('quickSupCommodities'),
  quickSupBank: document.getElementById('quickSupBank'),
  quickSupNotes: document.getElementById('quickSupNotes'),

  // Modal Bayar Hutang Tempo Toko (Kasir)
  modalCashierPaySupplierDebt: document.getElementById('modalCashierPaySupplierDebt'),
  cashierSupPaySubtitle: document.getElementById('cashierSupPaySubtitle'),
  cashierSupPayPurchaseId: document.getElementById('cashierSupPayPurchaseId'),
  cashierSupPayRemainingText: document.getElementById('cashierSupPayRemainingText'),
  cashierSupPayNoteDetails: document.getElementById('cashierSupPayNoteDetails'),
  cashierSupPayAmountInput: document.getElementById('cashierSupPayAmountInput'),
  btnCashierSupPayFull: document.getElementById('btnCashierSupPayFull'),
  cashierSupPayMethodSelect: document.getElementById('cashierSupPayMethodSelect'),
  cashierSupPayNotesInput: document.getElementById('cashierSupPayNotesInput'),
  btnCancelCashierSupplierPay: document.getElementById('btnCancelCashierSupplierPay'),
  btnSubmitCashierSupplierPay: document.getElementById('btnSubmitCashierSupplierPay'),
  btnCloseCashierSupplierPay: document.getElementById('btnCloseCashierSupplierPay'),

  // Expenses & Petty Cash (Biaya & Kas Operasional Toko)
  btnDirectExpenses: document.getElementById('btnDirectExpenses'),
  btnCashierExpensesDropdownItem: document.getElementById('btnCashierExpensesDropdownItem'),
  modalCashierExpenses: document.getElementById('modalCashierExpenses'),
  btnCloseCashierExpensesModal: document.getElementById('btnCloseCashierExpensesModal'),
  btnCloseCashierExpensesFooter: document.getElementById('btnCloseCashierExpensesFooter'),
  btnExpenseQuickIncomeModal: document.getElementById('btnExpenseQuickIncomeModal'),
  kpiExpenseTodayTotal: document.getElementById('kpiExpenseTodayTotal'),
  kpiExpenseDrawerOut: document.getElementById('kpiExpenseDrawerOut'),
  kpiExpenseTransferOut: document.getElementById('kpiExpenseTransferOut'),
  kpiExpenseLiveDrawer: document.getElementById('kpiExpenseLiveDrawer'),
  tabExpenseRecord: document.getElementById('tabExpenseRecord'),
  tabExpenseHistory: document.getElementById('tabExpenseHistory'),
  expenseActiveShiftName: document.getElementById('expenseActiveShiftName'),
  viewExpenseRecordForm: document.getElementById('viewExpenseRecordForm'),
  viewExpenseHistoryTable: document.getElementById('viewExpenseHistoryTable'),
  expenseCategoryGrid: document.getElementById('expenseCategoryGrid'),
  sourceCash: document.getElementById('sourceCash'),
  sourceTransfer: document.getElementById('sourceTransfer'),
  inputExpenseAmount: document.getElementById('inputExpenseAmount'),
  inputExpenseNotes: document.getElementById('inputExpenseNotes'),
  btnSubmitExpense: document.getElementById('btnSubmitExpense'),
  btnResetExpenseAmount: document.getElementById('btnResetExpenseAmount'),
  searchExpenseHistoryInput: document.getElementById('searchExpenseHistoryInput'),
  filterExpenseCategory: document.getElementById('filterExpenseCategory'),
  filterExpenseSource: document.getElementById('filterExpenseSource'),
  btnRefreshExpensesList: document.getElementById('btnRefreshExpensesList'),
  cashierExpensesTableBody: document.getElementById('cashierExpensesTableBody'),
  cashierExpenseShortageAlert: document.getElementById('cashierExpenseShortageAlert'),
  lblCashierDrawerAvail: document.getElementById('lblCashierDrawerAvail'),
  lblCashierDrawerShortage: document.getElementById('lblCashierDrawerShortage'),
  btnQuickAddIncomeFromExpenseAlert: document.getElementById('btnQuickAddIncomeFromExpenseAlert'),
  modalCashierIncome: document.getElementById('modalCashierIncome'),
  btnCloseCashierIncomeModal: document.getElementById('btnCloseCashierIncomeModal'),
  btnCancelCashierIncome: document.getElementById('btnCancelCashierIncome'),
  btnSubmitCashierIncome: document.getElementById('btnSubmitCashierIncome'),
  incomeCategorySelect: document.getElementById('incomeCategorySelect'),
  inputIncomeAmount: document.getElementById('inputIncomeAmount'),
  incomeSourceSelect: document.getElementById('incomeSourceSelect'),
  inputIncomeNotes: document.getElementById('inputIncomeNotes'),

  // Restock Supplier Elements
  restockSupplierSelect: document.getElementById('restockSupplierSelect'),
  restockPaymentStatus: document.getElementById('restockPaymentStatus'),
  restockTempoContainer: document.getElementById('restockTempoContainer'),
  restockDueDate: document.getElementById('restockDueDate'),
  restockDpAmount: document.getElementById('restockDpAmount'),

  // Pay Debt Modal (Cashier)
  modalPayCashierDebt: document.getElementById('modalPayCashierDebt'),
  payDebtCustomerSubtitle: document.getElementById('payDebtCustomerSubtitle'),
  payDebtRemainingText: document.getElementById('payDebtRemainingText'),
  btnDebtPayFull: document.getElementById('btnDebtPayFull'),
  btnDebtPayPartial: document.getElementById('btnDebtPayPartial'),
  payDebtAmountInput: document.getElementById('payDebtAmountInput'),
  payDebtMethodSelect: document.getElementById('payDebtMethodSelect'),
  payDebtNotesInput: document.getElementById('payDebtNotesInput'),
  btnCancelPayDebt: document.getElementById('btnCancelPayDebt'),
  btnSubmitPayDebt: document.getElementById('btnSubmitPayDebt'),
  btnClosePayDebtModal: document.getElementById('btnClosePayDebtModal'),

  paymentModal: document.getElementById('paymentModal'),
  payModalTotal: document.getElementById('payModalTotal'),
  cashTenderedInput: document.getElementById('cashTenderedInput'),
  changeDueText: document.getElementById('changeDueText'),
  cashPaymentSection: document.getElementById('cashPaymentSection'),
  nonCashPaymentSection: document.getElementById('nonCashPaymentSection'),
  btnProcessPayment: document.getElementById('btnProcessPayment'),
  btnClosePaymentModal: document.getElementById('btnClosePaymentModal'),
  btnCancelPayment: document.getElementById('btnCancelPayment'),

  receiptModal: document.getElementById('receiptModal'),
  receiptModalTitle: document.getElementById('receiptModalTitle'),
  thermalReceipt: document.getElementById('thermalReceipt'),
  btnPrintReceipt: document.getElementById('btnPrintReceipt'),
  btnNextOrder: document.getElementById('btnNextOrder'),
  btnCloseReceiptModal: document.getElementById('btnCloseReceiptModal'),

  closeShiftModal: document.getElementById('closeShiftModal'),
  btnCloseShift: document.getElementById('btnCloseShift'),
  btnCloseCloseShiftModal: document.getElementById('btnCloseCloseShiftModal'),
  btnCancelCloseShiftModal: document.getElementById('btnCancelCloseShiftModal'),
  btnSubmitBlindClose: document.getElementById('btnSubmitBlindClose'),
  totalCountedText: document.getElementById('totalCountedText'),
  closingNotes: document.getElementById('closingNotes'),

  // Cashier Dashboard & Daily Balancing
  modalCashierDashboard: document.getElementById('modalCashierDashboard'),
  btnOpenCashierDashboard: document.getElementById('btnOpenCashierDashboard'),
  btnDropdownCashierDashboard: document.getElementById('btnDropdownCashierDashboard'),
  btnUserDropdownShiftDashboard: document.getElementById('btnUserDropdownShiftDashboard'),
  btnCloseCashierDashboard: document.getElementById('btnCloseCashierDashboard'),
  btnRefreshCashierDashboard: document.getElementById('btnRefreshCashierDashboard'),
  btnDrawerKickDashboard: document.getElementById('btnDrawerKickDashboard'),
  btnDashboardPrintReportX: document.getElementById('btnDashboardPrintReportX'),
  btnDashboardCloseShiftZ: document.getElementById('btnDashboardCloseShiftZ'),
  btnDashResetDenom: document.getElementById('btnDashResetDenom'),
  btnDashQuickAddExpense: document.getElementById('btnDashQuickAddExpense'),
  btnDashQuickAddIncome: document.getElementById('btnDashQuickAddIncome'),
  dashShiftBadge: document.getElementById('dashShiftBadge'),
  dashShiftMetaSubtitle: document.getElementById('dashShiftMetaSubtitle'),
  dashKpiStartingCash: document.getElementById('dashKpiStartingCash'),
  dashKpiCashSales: document.getElementById('dashKpiCashSales'),
  dashKpiCashSalesCount: document.getElementById('dashKpiCashSalesCount'),
  dashKpiIncomeDebt: document.getElementById('dashKpiIncomeDebt'),
  dashKpiIncomeDebtMeta: document.getElementById('dashKpiIncomeDebtMeta'),
  dashKpiExpensesCash: document.getElementById('dashKpiExpensesCash'),
  dashKpiExpensesCount: document.getElementById('dashKpiExpensesCount'),
  dashFormulaExplanation: document.getElementById('dashFormulaExplanation'),
  dashExpectedCashValue: document.getElementById('dashExpectedCashValue'),
  dashTotalCounted: document.getElementById('dashTotalCounted'),
  dashVarianceCard: document.getElementById('dashVarianceCard'),
  dashVarianceIcon: document.getElementById('dashVarianceIcon'),
  dashVarianceTitle: document.getElementById('dashVarianceTitle'),
  dashVarianceSubtitle: document.getElementById('dashVarianceSubtitle'),
  dashVarianceNominal: document.getElementById('dashVarianceNominal'),
  dashClosingNotes: document.getElementById('dashClosingNotes'),
  dashTotalOrdersBadge: document.getElementById('dashTotalOrdersBadge'),
  dashSalesCash: document.getElementById('dashSalesCash'),
  dashSalesQris: document.getElementById('dashSalesQris'),
  dashSalesTransfer: document.getElementById('dashSalesTransfer'),
  dashSalesTempo: document.getElementById('dashSalesTempo'),
  dashTotalOmset: document.getElementById('dashTotalOmset'),
  dashExpensesListContainer: document.getElementById('dashExpensesListContainer'),
  dashD100k: document.getElementById('dashD100k'),
  dashD50k: document.getElementById('dashD50k'),
  dashD20k: document.getElementById('dashD20k'),
  dashD10k: document.getElementById('dashD10k'),
  dashD5k: document.getElementById('dashD5k'),
  dashD2k: document.getElementById('dashD2k'),
  dashD1k: document.getElementById('dashD1k'),
  dashDKoin: document.getElementById('dashDKoin'),
  dashSub100k: document.getElementById('dashSub100k'),
  dashSub50k: document.getElementById('dashSub50k'),
  dashSub20k: document.getElementById('dashSub20k'),
  dashSub10k: document.getElementById('dashSub10k'),
  dashSub5k: document.getElementById('dashSub5k'),
  dashSub2k: document.getElementById('dashSub2k'),
  dashSub1k: document.getElementById('dashSub1k'),
  dashSubKoin: document.getElementById('dashSubKoin'),

  wasteModal: document.getElementById('wasteModal'),
  btnWaste: document.getElementById('btnWaste'),
  btnCloseWasteModal: document.getElementById('btnCloseWasteModal'),
  btnCancelWaste: document.getElementById('btnCancelWaste'),
  btnSubmitWaste: document.getElementById('btnSubmitWaste'),
  wasteProductSelect: document.getElementById('wasteProductSelect'),
  wasteTypeSelect: document.getElementById('wasteTypeSelect'),
  wasteQtyInput: document.getElementById('wasteQtyInput'),
  wasteNotesInput: document.getElementById('wasteNotesInput'),

  historyModal: document.getElementById('historyModal'),
  btnHistory: document.getElementById('btnHistory'),
  btnCloseHistoryModal: document.getElementById('btnCloseHistoryModal'),
  historyTableBody: document.getElementById('historyTableBody'),
  historyDateFilter: document.getElementById('historyDateFilter'),
  historySearchInput: document.getElementById('historySearchInput'),
  historySummaryText: document.getElementById('historySummaryText'),
  btnFilterToday: document.getElementById('btnFilterToday'),
  btnFilterYesterday: document.getElementById('btnFilterYesterday'),
  btnFilterAllDates: document.getElementById('btnFilterAllDates'),

  // Lock Screen & Fullscreen Elements
  modalLockScreen: document.getElementById('modalLockScreen'),
  lockCashierName: document.getElementById('lockCashierName'),
  inpLockPin: document.getElementById('inpLockPin'),
  lockNumpad: document.getElementById('lockNumpad'),
  btnUnlockScreen: document.getElementById('btnUnlockScreen'),
  btnLockLogout: document.getElementById('btnLockLogout'),
  btnManualLock: document.getElementById('btnManualLock'),
  btnToggleFullscreen: document.getElementById('btnToggleFullscreen'),

  voidAuthModal: document.getElementById('voidAuthModal'),
  voidOrderNo: document.getElementById('voidOrderNo'),
  voidReasonInput: document.getElementById('voidReasonInput'),
  voidOwnerPinInput: document.getElementById('voidOwnerPinInput'),
  btnCancelVoid: document.getElementById('btnCancelVoid'),
  btnConfirmVoid: document.getElementById('btnConfirmVoid'),

  btnLogout: document.getElementById('btnLogout'),
  toastContainer: document.getElementById('toastContainer'),

  // Sync Status & Modal Elements
  syncStatusPill: document.getElementById('syncStatusPill'),
  syncStatusDot: document.getElementById('syncStatusDot'),
  syncStatusLabel: document.getElementById('syncStatusLabel'),
  syncSubLabel: document.getElementById('syncSubLabel'),
  btnManualSync: document.getElementById('btnManualSync'),
  syncDetailsModal: document.getElementById('syncDetailsModal'),
  btnCloseSyncModal: document.getElementById('btnCloseSyncModal'),
  btnCancelSyncModal: document.getElementById('btnCancelSyncModal'),
  btnForceSyncNow: document.getElementById('btnForceSyncNow'),
  modalDeviceId: document.getElementById('modalDeviceId'),
  modalNetworkState: document.getElementById('modalNetworkState'),
  modalLastSyncTime: document.getElementById('modalLastSyncTime'),
  modalPendingCount: document.getElementById('modalPendingCount'),

  // Hardware: Panda Bluetooth Printer & Cash Drawer RJ-11
  printerStatusPill: document.getElementById('printerStatusPill'),
  printerStatusDot: document.getElementById('printerStatusDot'),
  printerStatusLabel: document.getElementById('printerStatusLabel'),
  printerSubLabel: document.getElementById('printerSubLabel'),
  btnHardwareModalTrigger: document.getElementById('btnHardwareModalTrigger'),
  btnHardwareDropdownItem: document.getElementById('btnHardwareDropdownItem'),
  btnQuickOpenDrawer: document.getElementById('btnQuickOpenDrawer'),
  btnReceiptOpenDrawer: document.getElementById('btnReceiptOpenDrawer'),
  hardwareModal: document.getElementById('hardwareModal'),
  btnCloseHardwareModal: document.getElementById('btnCloseHardwareModal'),
  hwPrinterIndicator: document.getElementById('hwPrinterIndicator'),
  hwDeviceNameDisplay: document.getElementById('hwDeviceNameDisplay'),
  hwDeviceStatusText: document.getElementById('hwDeviceStatusText'),
  btnConnectBluetooth: document.getElementById('btnConnectBluetooth'),
  btnDisconnectBluetooth: document.getElementById('btnDisconnectBluetooth'),
  hwPrintMode: document.getElementById('hwPrintMode'),
  hwPaperSize: document.getElementById('hwPaperSize'),
  hwAutoDrawer: document.getElementById('hwAutoDrawer'),
  btnTestDrawer: document.getElementById('btnTestDrawer'),
  btnTestPrint: document.getElementById('btnTestPrint'),
  btnSaveHardwareSettings: document.getElementById('btnSaveHardwareSettings'),

  // Scale Custom Rate Box
  inpScaleCustomRate: document.getElementById('inpScaleCustomRate'),
  scaleRateDefaultHint: document.getElementById('scaleRateDefaultHint'),
  btnResetScaleRate: document.getElementById('btnResetScaleRate'),
  scaleCustomRateUnit: document.getElementById('scaleCustomRateUnit'),

  // In-Cart Custom Price Edit Modal
  modalEditCartPrice: document.getElementById('modalEditCartPrice'),
  editCartItemName: document.getElementById('editCartItemName'),
  editCartItemSubtitle: document.getElementById('editCartItemSubtitle'),
  btnCloseEditCartPriceModal: document.getElementById('btnCloseEditCartPriceModal'),
  editCartWeightText: document.getElementById('editCartWeightText'),
  editCartStandardRate: document.getElementById('editCartStandardRate'),
  inpEditCartNewRate: document.getElementById('inpEditCartNewRate'),
  editCartRatePresets: document.getElementById('editCartRatePresets'),
  editCartNewSubtotalText: document.getElementById('editCartNewSubtotalText'),
  btnResetToStandardRate: document.getElementById('btnResetToStandardRate'),
  btnCancelEditCartPrice: document.getElementById('btnCancelEditCartPrice'),
  btnSaveEditCartPrice: document.getElementById('btnSaveEditCartPrice'),

  // Karung Quantity Modal
  modalKarungQty: document.getElementById('modalKarungQty'),
  karungModalItemName: document.getElementById('karungModalItemName'),
  karungModalSubtitle: document.getElementById('karungModalSubtitle'),
  btnCloseKarungModal: document.getElementById('btnCloseKarungModal'),
  btnCancelKarungModal: document.getElementById('btnCancelKarungModal'),
  btnApplyKarungQty: document.getElementById('btnApplyKarungQty'),
  karungModalUnitPriceText: document.getElementById('karungModalUnitPriceText'),
  karungModalStockText: document.getElementById('karungModalStockText'),
  inpKarungCount: document.getElementById('inpKarungCount'),
  btnMinusKarungCount: document.getElementById('btnMinusKarungCount'),
  btnPlusKarungCount: document.getElementById('btnPlusKarungCount'),
  selKgPerKarung: document.getElementById('selKgPerKarung'),
  inpKarungTotalKg: document.getElementById('inpKarungTotalKg'),
  previewKarungKgText: document.getElementById('previewKarungKgText'),
  previewKarungRateText: document.getElementById('previewKarungRateText'),
  previewKarungSubtotalText: document.getElementById('previewKarungSubtotalText'),

  // Tablet View Switcher & Floating Cart Bar
  tabletViewSwitcher: document.getElementById('tabletViewSwitcher'),
  tabCatalogView: document.getElementById('tabCatalogView'),
  tabCartView: document.getElementById('tabCartView'),
  tabletCatalogCount: document.getElementById('tabletCatalogCount'),
  tabletCartCountBadge: document.getElementById('tabletCartCountBadge'),
  tabletCartTotalBadge: document.getElementById('tabletCartTotalBadge'),
  posContainer: document.getElementById('posContainer'),
  tabletFloatingCartBar: document.getElementById('tabletFloatingCartBar'),
  btnOpenCartDrawer: document.getElementById('btnOpenCartDrawer'),
  floatingCartBadge: document.getElementById('floatingCartBadge'),
  floatingCartWeightText: document.getElementById('floatingCartWeightText'),
  floatingCartAmountText: document.getElementById('floatingCartAmountText'),
  btnFloatingCheckout: document.getElementById('btnFloatingCheckout'),

  // Modal Confirm Clear Cart
  modalConfirmClearCart: document.getElementById('modalConfirmClearCart'),
  btnCloseConfirmClear: document.getElementById('btnCloseConfirmClear'),
  btnCancelClearCart: document.getElementById('btnCancelClearCart'),
  btnConfirmClearCart: document.getElementById('btnConfirmClearCart'),

  // Stok Opname Elements
  btnStockOpname: document.getElementById('btnStockOpname'),
  modalStockOpname: document.getElementById('modalStockOpname'),
  btnCloseStockOpname: document.getElementById('btnCloseStockOpname'),
  btnCancelStockOpname: document.getElementById('btnCancelStockOpname'),
  inpOpnameSearch: document.getElementById('inpOpnameSearch'),
  opnameCategoryFilters: document.getElementById('opnameCategoryFilters'),
  opnameTableBody: document.getElementById('opnameTableBody'),
  opnameCountSummary: document.getElementById('opnameCountSummary'),

  // Edit Identitas Elements
  btnEditIdentity: document.getElementById('btnEditIdentity'),
  modalEditIdentity: document.getElementById('modalEditIdentity'),
  btnCloseEditIdentity: document.getElementById('btnCloseEditIdentity'),
  btnCancelEditIdentity: document.getElementById('btnCancelEditIdentity'),
  tabIdentityStore: document.getElementById('tabIdentityStore'),
  tabIdentityCashier: document.getElementById('tabIdentityCashier'),
  paneIdentityStore: document.getElementById('paneIdentityStore'),
  paneIdentityCashier: document.getElementById('paneIdentityCashier'),
  inpStoreName: document.getElementById('inpStoreName'),
  inpStoreTagline: document.getElementById('inpStoreTagline'),
  inpStoreAddress: document.getElementById('inpStoreAddress'),
  inpStorePhone: document.getElementById('inpStorePhone'),
  inpReceiptFooter: document.getElementById('inpReceiptFooter'),
  btnSaveStoreIdentity: document.getElementById('btnSaveStoreIdentity'),
  previewStoreName: document.getElementById('previewStoreName'),
  previewStoreTagline: document.getElementById('previewStoreTagline'),
  previewStoreAddress: document.getElementById('previewStoreAddress'),
  previewStorePhone: document.getElementById('previewStorePhone'),
  previewCashierName: document.getElementById('previewCashierName'),
  previewReceiptFooter: document.getElementById('previewReceiptFooter'),
  inpCashierName: document.getElementById('inpCashierName'),
  inpOldPin: document.getElementById('inpOldPin'),
  inpNewPin: document.getElementById('inpNewPin'),
  btnSaveCashierIdentity: document.getElementById('btnSaveCashierIdentity')
};

// Utilities

// -----------------------------------------------------------------------------
// CURRENCY AUTO-FORMATTING HELPERS
// -----------------------------------------------------------------------------
function parseRupiahInput(val) {
  if (!val && val !== 0) return 0;
  let str = String(val).trim().toLowerCase();

  // If ends with 'rb' or 'k' (e.g. 100rb, 100k, 1.5k)
  if (str.endsWith('rb') || str.endsWith('k')) {
    const numPart = str.replace(/(rb|k)$/, '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const num = parseFloat(numPart) || 0;
    return Math.round(num * 1000);
  }

  // If ends with 'jt' (e.g. 1jt, 1.5jt)
  if (str.endsWith('jt')) {
    const numPart = str.replace(/jt$/, '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const num = parseFloat(numPart) || 0;
    return Math.round(num * 1000000);
  }

  // Normal digit string (strip dots and non-digits)
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
    // Allow typing intermediate 'r' without interrupting
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
// LIVE DATE & CLOCK
// -----------------------------------------------------------------------------
function updateLiveDateTime() {
  const now = new Date();
  if (el.liveDayDate) {
    el.liveDayDate.textContent = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
  if (el.liveClockTime) {
    el.liveClockTime.textContent = now.toLocaleTimeString('id-ID') + ' WIB';
  }
}

// -----------------------------------------------------------------------------
// SYNC UI STATUS LISTENER
// -----------------------------------------------------------------------------
function updateSyncStatusUI(syncState) {
  if (!el.syncStatusPill) return;

  const { isOnline, isSyncing, lastSyncTime, pendingCount, deviceId } = syncState;

  el.syncStatusPill.classList.remove('online', 'offline', 'syncing');

  if (isSyncing) {
    el.syncStatusPill.classList.add('syncing');
    if (el.syncStatusLabel) el.syncStatusLabel.textContent = '🔄 Menyinkron...';
    if (el.syncSubLabel) el.syncSubLabel.textContent = 'Kirim data...';
    if (el.btnManualSync) el.btnManualSync.classList.add('rotating');
  } else if (!isOnline) {
    el.syncStatusPill.classList.add('offline');
    if (el.syncStatusLabel) {
      el.syncStatusLabel.textContent = pendingCount > 0 ? `🟡 Offline (${pendingCount})` : '🟡 Offline';
    }
    if (el.syncSubLabel) el.syncSubLabel.textContent = 'Tersimpan lokal';
    if (el.btnManualSync) el.btnManualSync.classList.remove('rotating');
  } else {
    el.syncStatusPill.classList.add('online');
    if (el.syncStatusLabel) {
      el.syncStatusLabel.textContent = pendingCount > 0 ? `🟢 Ada Antrean (${pendingCount})` : '🟢 Online';
    }
    if (el.syncSubLabel) {
      el.syncSubLabel.textContent = lastSyncTime ? `Sync ${lastSyncTime}` : 'Tersinkron (1 mnt)';
    }
    if (el.btnManualSync) el.btnManualSync.classList.remove('rotating');
  }

  // Update modal content if open
  if (el.modalDeviceId) el.modalDeviceId.textContent = deviceId || 'TAB-KIOS';
  if (el.modalNetworkState) {
    el.modalNetworkState.innerHTML = isOnline
      ? '<span style="color:#22c55e;">🟢 Terhubung ke Server</span>'
      : '<span style="color:#f59e0b;">🟡 Offline (Lokal Aktif)</span>';
  }
  if (el.modalLastSyncTime) {
    el.modalLastSyncTime.textContent = lastSyncTime || 'Belum pernah sync';
  }
  if (el.modalPendingCount) {
    el.modalPendingCount.textContent = `${pendingCount} Nota / Transaksi`;
    el.modalPendingCount.style.color = pendingCount > 0 ? '#f59e0b' : '#22c55e';
  }
}

// -----------------------------------------------------------------------------
// DYNAMIC VIEWPORT & FULLSCREEN PWA SUPPORT (TABLET / CHROME FIX)
// -----------------------------------------------------------------------------
function updateViewportMetrics() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

function initFullscreenAndViewportSupport() {
  updateViewportMetrics();
  window.addEventListener('resize', updateViewportMetrics, { passive: true });
  window.addEventListener('orientationchange', () => {
    setTimeout(updateViewportMetrics, 100);
    setTimeout(updateViewportMetrics, 300);
  });

  const btnToggleFullscreen = document.getElementById('btnToggleFullscreen');
  const fullscreenIcon = document.getElementById('fullscreenIcon');
  const fullscreenLabel = document.getElementById('fullscreenLabel');

  function syncFullscreenState() {
    const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (fullscreenIcon) fullscreenIcon.textContent = isFS ? '🗗' : '⛶';
    if (fullscreenLabel) fullscreenLabel.textContent = isFS ? 'Normal' : 'Layar Penuh';
    if (btnToggleFullscreen) {
      if (isFS) {
        btnToggleFullscreen.classList.add('active-fullscreen');
        btnToggleFullscreen.title = 'Keluar dari Mode Layar Penuh (F11)';
        btnToggleFullscreen.textContent = '🗗';
      } else {
        btnToggleFullscreen.classList.remove('active-fullscreen');
        btnToggleFullscreen.title = 'Mode Layar Penuh (F11)';
        btnToggleFullscreen.textContent = '⛶';
      }
    }
  }

  // Force auto-fullscreen on PWA launch / first user touch
  const tryAutoFullscreen = () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const docEl = document.documentElement;
      const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
      if (req) {
        req.call(docEl).catch(() => {});
      }
    }
  };

  // Immediate attempt for standalone/PWA
  tryAutoFullscreen();

  // One-time gesture listener on first interaction
  const onFirstInteraction = () => {
    tryAutoFullscreen();
    document.removeEventListener('click', onFirstInteraction, true);
    document.removeEventListener('touchstart', onFirstInteraction, true);
  };
  document.addEventListener('click', onFirstInteraction, { capture: true, once: true });
  document.addEventListener('touchstart', onFirstInteraction, { capture: true, once: true });

  if (btnToggleFullscreen) {
    btnToggleFullscreen.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          } else if (document.documentElement.webkitRequestFullscreen) {
            await document.documentElement.webkitRequestFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            await document.webkitExitFullscreen();
          }
        }
      } catch (err) {
        console.warn('[Fullscreen] Gagal mengubah mode layar penuh:', err);
      }
      setTimeout(syncFullscreenState, 150);
    });
  }

  document.addEventListener('fullscreenchange', syncFullscreenState);
  document.addEventListener('webkitfullscreenchange', syncFullscreenState);
  syncFullscreenState();
}

// -----------------------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------------------
async function initApp() {
  initFullscreenAndViewportSupport();
  bindEvents();
  updateLiveDateTime();
  setInterval(updateLiveDateTime, 1000);

  // Check Subscription & License Status
  initSubscriptionGuard({ isOwner: false });

  // Initialize Offline Storage & Sync Engine
  try {
    await syncEngine.init();
    syncEngine.onStateChange(updateSyncStatusUI);
  } catch (e) {
    console.warn('[Sync] Inisialisasi sync engine tertunda:', e);
  }

  // Initialize Hardware (Panda Bluetooth Printer & Cash Drawer RJ-11)
  try {
    initHardwareSupport();
  } catch (e) {
    console.warn('[Hardware] Inisialisasi hardware tertunda:', e);
  }

  // Check if session exists in memory/storage
  const urlParams = new URLSearchParams(window.location.search);
  const isPosMode = urlParams.get('mode') === 'pos';

  if (api.user && api.token) {
    state.user = api.user;
    if (state.user && state.user.role === 'owner' && !isPosMode) {
      window.location.href = '/owner.html';
      return;
    }
    el.activeCashierName.textContent = state.user.name;
    updateRoleUI();
  } else if (!api.token) {
    showLoginModal();
    return;
  }

  try {
    if (navigator.onLine) {
      const meRes = await api.getMe().catch(() => null);
      if (meRes && meRes.user) {
        state.user = meRes.user;
        if (state.user && state.user.role === 'owner' && !isPosMode) {
          window.location.href = '/owner.html';
          return;
        }
        el.activeCashierName.textContent = state.user.name;
        updateRoleUI();
      }
    }

    await syncShift();
    await loadInitialData();
  } catch (err) {
    console.error('Session error, fallback to offline:', err);
    await loadInitialData();
  }

  // Handle URL modal parameter (e.g. from cashier.html header dropdown)
  const targetModal = urlParams.get('modal');
  if (targetModal) {
    setTimeout(() => {
      try {
        if (targetModal === 'catalog') openCatalogMarginModal();
        else if (targetModal === 'debts') openCashierDebtsModal();
        else if (targetModal === 'stockOpname') openStockOpnameModal();
        else if (targetModal === 'waste') openWasteModal();
        else if (targetModal === 'suppliers') {
          if (el.modalCashierSuppliers) el.modalCashierSuppliers.style.display = 'flex';
          switchCashierSupplierTab('juragan');
          loadCashierSuppliers();
        }
        else if (targetModal === 'supplierDebt') {
          if (el.modalCashierSuppliers) el.modalCashierSuppliers.style.display = 'flex';
          switchCashierSupplierTab('tempo');
          loadCashierSuppliers();
        }
        else if (targetModal === 'expenses') {
          if (el.modalCashierExpenses) el.modalCashierExpenses.style.display = 'flex';
          switchCashierExpenseTab('record');
          loadCashierExpenses();
        }
        else if (targetModal === 'identity') openEditIdentityModal();
        else if (targetModal === 'hardware') {
          if (el.hardwareModal) el.hardwareModal.style.display = 'flex';
        }
      } catch (err) {
        console.warn('Gagal membuka modal dari parameter URL:', err);
      }
    }, 250);
  }
}

async function syncShift() {
  try {
    if (navigator.onLine) {
      const shiftRes = await api.getCurrentShift().catch(() => null);
      if (shiftRes && shiftRes.has_active_shift) {
        state.shift = shiftRes.shift;
        await saveActiveShiftLocal(state.shift);
        el.activeShiftMeta.textContent = `Shift Aktif #${state.shift.id} (Modal: ${formatRupiah(state.shift.starting_cash)})`;
        return;
      }
    }

    // Fallback: Check local shift
    const localShift = await getActiveShiftLocal();
    if (localShift) {
      state.shift = localShift;
      el.activeShiftMeta.textContent = `Shift Aktif #${state.shift.id} (Lokal)`;
    } else {
      state.shift = null;
      el.activeShiftMeta.textContent = 'Shift Belum Dibuka';
      showOpenShiftModal();
    }
  } catch (err) {
    console.warn('Gagal sinkron shift:', err);
  }
}

function updateStoreHeaderUI() {
  if (!state.settings) return;
  const titleEl = document.getElementById('cashierBrandTitle');
  const subtitleEl = document.getElementById('cashierBrandSubtitle');
  if (titleEl && state.settings.store_name) {
    titleEl.textContent = state.settings.store_name;
  }
  if (subtitleEl && state.settings.store_tagline) {
    subtitleEl.textContent = state.settings.store_tagline;
  }
}

async function loadInitialData() {
  try {
    // 1. FAST LOCAL LOAD FIRST (Zero latency for cashier)
    const [localProds, localCusts, localSettings] = await Promise.all([
      getProductsLocal(),
      getCustomersLocal(),
      getSettingsLocal()
    ]);

    if (localProds && localProds.length > 0) {
      const validProds = localProds.filter(p => p && (p.name || p.product_name));
      if (validProds.length > 0) {
        state.products = validProds;
        state.filteredProducts = [...state.products];
        renderProductGrid();
      }
    }
    if (localCusts && localCusts.length > 0) {
      state.customers = localCusts;
      renderCustomerSelect();
    }
    if (localSettings && Object.keys(localSettings).length > 0) {
      state.settings = localSettings;
      updateStoreHeaderUI();
    }

    // 2. NETWORK PULL IF ONLINE
    if (navigator.onLine) {
      const [prodRes, custRes, settingsRes] = await Promise.all([
        api.getProducts().catch(() => null),
        api.getCustomers().catch(() => null),
        api.getSettings().catch(() => null)
      ]);

      if (prodRes && prodRes.products && prodRes.products.length > 0) {
        const serverProds = prodRes.products.map(p => {
          if (!p.name && p.product_name) p.name = p.product_name;
          return p;
        });
        state.products = serverProds;
        state.filteredProducts = [...state.products];
        await saveProductsLocal(state.products);
      }
      if (custRes && custRes.customers) {
        state.customers = custRes.customers;
        await saveCustomersLocal(state.customers);
      }
      if (settingsRes && settingsRes.settings) {
        state.settings = settingsRes.settings;
        await saveSettingsLocal(state.settings);
      }

      updateStoreHeaderUI();
      renderProductGrid();
      renderCustomerSelect();
      await loadCashierSuppliers();
    }

    // Update Low Stock alert badge on cashier category filter
    const lowStockItems = state.products.filter(p => {
      const minAlert = p.min_stock_alert !== undefined && p.min_stock_alert !== null ? Number(p.min_stock_alert) : 15.0;
      return Number(p.stock_qty) <= minAlert;
    });
    const cashierDot = document.getElementById('cashierLowStockDot');
    if (cashierDot) {
      if (lowStockItems.length > 0) {
        cashierDot.textContent = lowStockItems.length;
        cashierDot.style.display = 'inline-flex';
      } else {
        cashierDot.style.display = 'none';
      }
    }
  } catch (err) {
    console.warn('Gagal memuat data komoditas (menggunakan cache lokal):', err);
  }
}

// -----------------------------------------------------------------------------
// EVENT BINDINGS
// -----------------------------------------------------------------------------
function bindEvents() {
  // Initialize Tablet Segmented Switcher & Floating Drawer
  initTabletViewSwitcher();

  // Initialize Header Dropdown Sub-Menus
  initHeaderDropdowns();

  // Initialize Stok Opname & Edit Identitas
  initStockOpnameEvents();
  initEditIdentityEvents();

  // Search and Category
  el.searchProduct.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase().trim();
    el.clearSearch.style.display = val ? 'block' : 'none';
    filterProducts();
  });

  el.clearSearch.addEventListener('click', () => {
    el.searchProduct.value = '';
    el.clearSearch.style.display = 'none';
    filterProducts();
  });

  el.categoryFilters.addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    el.categoryFilters.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    state.activeCategory = pill.dataset.category;
    filterProducts();
  });

  // Tempo / Kasbon Customer Input Auto-Fill (Jika pembeli sudah pernah terdata)
  if (el.tempoCustomerNameInput) {
    el.tempoCustomerNameInput.addEventListener('input', (e) => {
      const val = e.target.value.trim().toLowerCase();
      if (val && state.customers) {
        const found = state.customers.find(c => c.name.toLowerCase() === val);
        if (found && found.phone && el.tempoCustomerPhoneInput && !el.tempoCustomerPhoneInput.value) {
          el.tempoCustomerPhoneInput.value = found.phone;
        }
      }
    });
  }

  if (el.customerSelect) {
    el.customerSelect.addEventListener('change', (e) => {
      state.selectedCustomerId = e.target.value;
      state.selectedCustomer = state.customers.find(c => String(c.id) === state.selectedCustomerId) || null;
      recalculateCart();
    });
  }

  // Cart actions - In-App Confirmation Modal (Touch-friendly & immune to browser dialog blocking)
  el.btnClearCart.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.cart.length === 0) return;
    if (el.modalConfirmClearCart) {
      el.modalConfirmClearCart.style.display = 'flex';
    } else {
      state.cart = [];
      renderCart();
    }
  });

  const closeClearCartModal = () => {
    if (el.modalConfirmClearCart) el.modalConfirmClearCart.style.display = 'none';
  };

  if (el.btnCloseConfirmClear) el.btnCloseConfirmClear.addEventListener('click', closeClearCartModal);
  if (el.btnCancelClearCart) el.btnCancelClearCart.addEventListener('click', closeClearCartModal);
  if (el.modalConfirmClearCart) {
    el.modalConfirmClearCart.addEventListener('click', (e) => {
      if (e.target === el.modalConfirmClearCart) closeClearCartModal();
    });
  }

  if (el.btnConfirmClearCart) {
    el.btnConfirmClearCart.addEventListener('click', () => {
      state.cart = [];
      renderCart();
      closeClearCartModal();
      showToast('Keranjang belanja berhasil dikosongkan.', 'info');
    });
  }

  // Checkout trigger
  el.btnCheckout.addEventListener('click', () => {
    if (state.cart.length === 0) return;
    openPaymentModal();
  });

  // Keyboard shortcut F8 / Enter for checkout
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F8') {
      e.preventDefault();
      if (state.cart.length > 0 && el.paymentModal.style.display === 'none') {
        openPaymentModal();
      }
    }
  });

  // Login PIN Numpad
  document.getElementById('loginNumpad').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-num');
    if (!btn) return;
    const key = btn.dataset.key;
    if (key === 'clear') {
      el.pinInput.value = '';
    } else if (key === 'backspace') {
      el.pinInput.value = el.pinInput.value.slice(0, -1);
    } else {
      if (el.pinInput.value.length < 6) {
        el.pinInput.value += key;
        if (el.pinInput.value.length === 6) {
          submitPinLogin(el.pinInput.value);
        }
      }
    }
  });

  const btnPresetKasir = document.getElementById('presetKasir');
  if (btnPresetKasir) btnPresetKasir.addEventListener('click', () => submitPinLogin('112233'));
  const btnPresetSiti = document.getElementById('presetSiti');
  if (btnPresetSiti) btnPresetSiti.addEventListener('click', () => submitPinLogin('223344'));
  const btnPresetOwner = document.getElementById('presetOwner');
  if (btnPresetOwner) btnPresetOwner.addEventListener('click', () => submitPinLogin('123456'));

  // Sync Pill & Modal Events
  if (el.syncStatusPill) {
    el.syncStatusPill.addEventListener('click', (e) => {
      if (e.target.closest('#btnManualSync')) {
        e.stopPropagation();
        syncEngine.syncNow();
        return;
      }
      if (el.syncDetailsModal) {
        el.syncDetailsModal.style.display = 'flex';
        updateSyncStatusUI(syncEngine.getState());
      }
    });
  }

  if (el.btnCloseSyncModal) {
    el.btnCloseSyncModal.addEventListener('click', () => {
      if (el.syncDetailsModal) el.syncDetailsModal.style.display = 'none';
    });
  }

  if (el.btnCancelSyncModal) {
    el.btnCancelSyncModal.addEventListener('click', () => {
      if (el.syncDetailsModal) el.syncDetailsModal.style.display = 'none';
    });
  }

  if (el.btnForceSyncNow) {
    el.btnForceSyncNow.addEventListener('click', async () => {
      el.btnForceSyncNow.disabled = true;
      el.btnForceSyncNow.textContent = 'Menyinkronkan...';
      const res = await syncEngine.syncNow();
      el.btnForceSyncNow.disabled = false;
      el.btnForceSyncNow.textContent = '🔄 Sinkronkan Sekarang';
      if (res && res.status === 'success') {
        showToast('Sinkronisasi data ke cloud berhasil!', 'success');
        await loadInitialData();
      } else if (res && res.status === 'offline') {
        showToast('Tablet sedang offline. Data tersimpan di memori lokal.', 'info');
      }
    });
  }

  // Open Shift
  el.btnConfirmOpenShift.addEventListener('click', handleOpenShift);
  el.btnCancelOpenShift.addEventListener('click', () => {
    el.openShiftModal.style.display = 'none';
  });
  document.getElementById('chip100k').addEventListener('click', () => el.startingCashInput.value = formatRupiahNumber(100000));
  document.getElementById('chip200k').addEventListener('click', () => el.startingCashInput.value = formatRupiahNumber(200000));
  document.getElementById('chip500k').addEventListener('click', () => el.startingCashInput.value = formatRupiahNumber(500000));

  // Payment Modal controls
  el.btnClosePaymentModal.addEventListener('click', () => el.paymentModal.style.display = 'none');
  el.btnCancelPayment.addEventListener('click', () => el.paymentModal.style.display = 'none');
  
  document.querySelectorAll('.btn-method').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget;
      document.querySelectorAll('.btn-method').forEach(b => b.classList.remove('active'));
      target.classList.add('active');
      state.paymentMethod = method;

      if (state.paymentMethod === 'cash') {
        el.cashPaymentSection.style.display = 'block';
        el.nonCashPaymentSection.style.display = 'none';
        if (el.tempoPaymentSection) el.tempoPaymentSection.style.display = 'none';
        el.cashTenderedInput.focus();
      } else if (state.paymentMethod === 'tempo') {
        el.cashPaymentSection.style.display = 'none';
        el.nonCashPaymentSection.style.display = 'none';
        if (el.tempoPaymentSection) {
          el.tempoPaymentSection.style.display = 'block';
          updateTempoCalculation();
          if (el.tempoCustomerNameInput) {
            setTimeout(() => el.tempoCustomerNameInput.focus(), 50);
          }
        }
      } else {
        el.cashPaymentSection.style.display = 'none';
        el.nonCashPaymentSection.style.display = 'block';
        if (el.tempoPaymentSection) el.tempoPaymentSection.style.display = 'none';
      }
    });
  });

  if (el.tempoDpInput) {
    el.tempoDpInput.addEventListener('input', (e) => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      if (raw) {
        e.target.value = formatRupiah(Number(raw));
      } else {
        e.target.value = '';
      }
      updateTempoCalculation();
    });
  }

  // Cashier Debts Modal Events & Filter Tabs
  if (el.btnDebtsModal) {
    el.btnDebtsModal.addEventListener('click', openCashierDebtsModal);
  }
  if (el.btnCloseCashierDebtsModal) {
    el.btnCloseCashierDebtsModal.addEventListener('click', () => el.cashierDebtsModal.style.display = 'none');
  }
  if (el.btnCloseCashierDebtsFooter) {
    el.btnCloseCashierDebtsFooter.addEventListener('click', () => el.cashierDebtsModal.style.display = 'none');
  }
  if (el.btnRefreshCashierDebts) {
    el.btnRefreshCashierDebts.addEventListener('click', loadCashierDebts);
  }
  if (el.searchCashierDebt) {
    let cashierSearchTimeout;
    el.searchCashierDebt.addEventListener('input', () => {
      clearTimeout(cashierSearchTimeout);
      cashierSearchTimeout = setTimeout(loadCashierDebts, 300);
    });
  }

  // Debt Filter Tabs
  const debtFilterBtns = [
    { btn: el.btnDebtFilterUnpaid, filter: 'unpaid' },
    { btn: el.btnDebtFilterOverdue, filter: 'overdue' },
    { btn: el.btnDebtFilterPaid, filter: 'paid' },
    { btn: el.btnDebtFilterAll, filter: 'all' }
  ];
  debtFilterBtns.forEach(({ btn, filter }) => {
    if (btn) {
      btn.addEventListener('click', () => {
        debtFilterBtns.forEach(item => { if (item.btn) item.btn.classList.remove('active'); });
        btn.classList.add('active');
        state.cashierDebtFilter = filter;
        loadCashierDebts();
      });
    }
  });

  // Debt Detail Modal Events
  if (el.btnCloseDetailDebtModal) {
    el.btnCloseDetailDebtModal.addEventListener('click', () => el.modalDetailDebt.style.display = 'none');
  }
  if (el.btnCloseDetailDebtFooter) {
    el.btnCloseDetailDebtFooter.addEventListener('click', () => el.modalDetailDebt.style.display = 'none');
  }
  if (el.btnTriggerEditFromDetail) {
    el.btnTriggerEditFromDetail.addEventListener('click', () => {
      if (state.activeDetailDebtId) {
        el.modalDetailDebt.style.display = 'none';
        openEditDebtModal(state.activeDetailDebtId);
      }
    });
  }
  if (el.btnTriggerPayFromDetail) {
    el.btnTriggerPayFromDetail.addEventListener('click', () => {
      if (state.activeDetailDebtId) {
        el.modalDetailDebt.style.display = 'none';
        openPayCashierDebtModal(state.activeDetailDebtId);
      }
    });
  }

  // Debt Edit Modal Events
  if (el.btnCloseEditDebtModal) {
    el.btnCloseEditDebtModal.addEventListener('click', () => el.modalEditDebt.style.display = 'none');
  }
  if (el.btnCancelEditDebt) {
    el.btnCancelEditDebt.addEventListener('click', () => el.modalEditDebt.style.display = 'none');
  }
  if (el.btnSaveEditDebt) {
    el.btnSaveEditDebt.addEventListener('click', handleSaveEditDebt);
  }

  // Katalog & Margin Laba Modal Events
  if (el.btnCatalogMargin) {
    el.btnCatalogMargin.addEventListener('click', openCatalogMarginModal);
  }
  if (el.btnCloseCatalogMarginModal) {
    el.btnCloseCatalogMarginModal.addEventListener('click', () => el.modalCatalogMargin.style.display = 'none');
  }
  if (el.btnCloseCatalogMarginFooter) {
    el.btnCloseCatalogMarginFooter.addEventListener('click', () => el.modalCatalogMargin.style.display = 'none');
  }
  if (el.searchCatalogMarginInput) {
    el.searchCatalogMarginInput.addEventListener('input', renderCatalogMarginTable);
  }
  if (el.btnCatalogMarginAddProduct) {
    el.btnCatalogMarginAddProduct.addEventListener('click', () => {
      openNewProductModal();
    });
  }
  if (el.btnCatalogMarginRestock) {
    el.btnCatalogMarginRestock.addEventListener('click', () => {
      openRestockModal();
    });
  }

  // Cashier Suppliers & Kulakan & Tempo Modal Events
  if (el.btnDirectKulakan) {
    el.btnDirectKulakan.addEventListener('click', () => {
      if (el.modalCashierSuppliers) el.modalCashierSuppliers.style.display = 'flex';
      switchCashierSupplierTab('juragan');
      loadCashierSuppliers();
    });
  }
  if (el.btnCashierSupplierDebtItem) {
    el.btnCashierSupplierDebtItem.addEventListener('click', () => {
      const storeDropdown = document.getElementById('storeMenuDropdown');
      if (storeDropdown) storeDropdown.classList.remove('active');
      if (el.modalCashierSuppliers) el.modalCashierSuppliers.style.display = 'flex';
      switchCashierSupplierTab('tempo');
      loadCashierSuppliers();
    });
  }
  if (el.btnCashierSuppliersModal) {
    el.btnCashierSuppliersModal.addEventListener('click', () => {
      const storeDropdown = document.getElementById('storeMenuDropdown');
      if (storeDropdown) storeDropdown.classList.remove('active');
      if (el.modalCashierSuppliers) el.modalCashierSuppliers.style.display = 'flex';
      switchCashierSupplierTab('juragan');
      loadCashierSuppliers();
    });
  }
  if (el.btnCloseCashierSuppliersModal) {
    el.btnCloseCashierSuppliersModal.addEventListener('click', () => {
      if (el.modalCashierSuppliers) el.modalCashierSuppliers.style.display = 'none';
    });
  }
  if (el.btnCloseCashierSuppliersFooter) {
    el.btnCloseCashierSuppliersFooter.addEventListener('click', () => {
      if (el.modalCashierSuppliers) el.modalCashierSuppliers.style.display = 'none';
    });
  }

  // Cashier Expenses & Petty Cash Listeners
  if (el.btnDirectExpenses) {
    el.btnDirectExpenses.addEventListener('click', () => {
      if (el.modalCashierExpenses) el.modalCashierExpenses.style.display = 'flex';
      switchCashierExpenseTab('record');
      loadCashierExpenses();
    });
  }
  if (el.btnCashierExpensesDropdownItem) {
    el.btnCashierExpensesDropdownItem.addEventListener('click', () => {
      const storeDropdown = document.getElementById('storeMenuDropdown');
      if (storeDropdown) storeDropdown.classList.remove('active');
      if (el.modalCashierExpenses) el.modalCashierExpenses.style.display = 'flex';
      switchCashierExpenseTab('record');
      loadCashierExpenses();
    });
  }
  if (el.btnCloseCashierExpensesModal) {
    el.btnCloseCashierExpensesModal.addEventListener('click', () => {
      if (el.modalCashierExpenses) el.modalCashierExpenses.style.display = 'none';
    });
  }
  if (el.btnCloseCashierExpensesFooter) {
    el.btnCloseCashierExpensesFooter.addEventListener('click', () => {
      if (el.modalCashierExpenses) el.modalCashierExpenses.style.display = 'none';
    });
  }
  if (el.tabExpenseRecord) {
    el.tabExpenseRecord.addEventListener('click', () => switchCashierExpenseTab('record'));
  }
  if (el.tabExpenseHistory) {
    el.tabExpenseHistory.addEventListener('click', () => switchCashierExpenseTab('history'));
  }
  if (el.btnResetExpenseAmount) {
    el.btnResetExpenseAmount.addEventListener('click', () => {
      if (el.inputExpenseAmount) el.inputExpenseAmount.value = '';
      checkCashierExpenseSufficiency();
    });
  }
  document.querySelectorAll('.btn-quick-expense-amount').forEach(btn => {
    btn.addEventListener('click', () => {
      const addVal = Number(btn.dataset.val) || 0;
      const current = Number(el.inputExpenseAmount ? el.inputExpenseAmount.value : 0) || 0;
      if (el.inputExpenseAmount) el.inputExpenseAmount.value = current + addVal;
      checkCashierExpenseSufficiency();
    });
  });
  if (el.inputExpenseAmount) {
    el.inputExpenseAmount.addEventListener('input', checkCashierExpenseSufficiency);
  }
  if (el.sourceCash) {
    el.sourceCash.addEventListener('change', checkCashierExpenseSufficiency);
  }
  if (el.sourceTransfer) {
    el.sourceTransfer.addEventListener('change', checkCashierExpenseSufficiency);
  }
  if (el.btnQuickAddIncomeFromExpenseAlert) {
    el.btnQuickAddIncomeFromExpenseAlert.addEventListener('click', () => {
      const amount = Number(el.inputExpenseAmount ? el.inputExpenseAmount.value : 0) || 0;
      const drawerCash = Number(state.currentShiftCash) || 0;
      const shortage = Math.max(50000, amount - drawerCash);
      if (el.modalCashierIncome) el.modalCashierIncome.style.display = 'flex';
      if (el.inputIncomeAmount) el.inputIncomeAmount.value = shortage;
      if (el.inputIncomeNotes) el.inputIncomeNotes.value = 'Tambah modal kas laci toko';
    });
  }
  if (el.btnSubmitExpense) {
    el.btnSubmitExpense.addEventListener('click', handleSaveCashierExpense);
  }
  if (el.btnExpenseQuickIncomeModal) {
    el.btnExpenseQuickIncomeModal.addEventListener('click', () => {
      if (el.modalCashierIncome) el.modalCashierIncome.style.display = 'flex';
      if (el.inputIncomeAmount) el.inputIncomeAmount.value = '';
      if (el.inputIncomeNotes) el.inputIncomeNotes.value = '';
    });
  }
  if (el.btnCloseCashierIncomeModal) {
    el.btnCloseCashierIncomeModal.addEventListener('click', () => {
      if (el.modalCashierIncome) el.modalCashierIncome.style.display = 'none';
    });
  }
  if (el.btnCancelCashierIncome) {
    el.btnCancelCashierIncome.addEventListener('click', () => {
      if (el.modalCashierIncome) el.modalCashierIncome.style.display = 'none';
    });
  }
  if (el.btnSubmitCashierIncome) {
    el.btnSubmitCashierIncome.addEventListener('click', handleSaveCashierIncome);
  }
  if (el.searchExpenseHistoryInput) {
    el.searchExpenseHistoryInput.addEventListener('input', renderCashierExpensesHistoryTable);
  }
  if (el.filterExpenseCategory) {
    el.filterExpenseCategory.addEventListener('change', renderCashierExpensesHistoryTable);
  }
  if (el.filterExpenseSource) {
    el.filterExpenseSource.addEventListener('change', renderCashierExpensesHistoryTable);
  }
  if (el.btnRefreshExpensesList) {
    el.btnRefreshExpensesList.addEventListener('click', () => loadCashierExpenses());
  }

  // Header quick actions in modal
  if (el.btnCashierHeaderAddSupplier) {
    el.btnCashierHeaderAddSupplier.addEventListener('click', openCashierNewSupplierModal);
  }
  if (el.btnCashierHeaderRecordPurchase) {
    el.btnCashierHeaderRecordPurchase.addEventListener('click', () => {
      if (el.modalCashierSuppliers) el.modalCashierSuppliers.style.display = 'none';
      openRestockModal();
    });
  }

  // Tabs switching
  if (el.tabCashierSupJuragan) {
    el.tabCashierSupJuragan.addEventListener('click', () => switchCashierSupplierTab('juragan'));
  }
  if (el.tabCashierSupPurchases) {
    el.tabCashierSupPurchases.addEventListener('click', () => switchCashierSupplierTab('purchases'));
  }
  if (el.tabCashierSupTempo) {
    el.tabCashierSupTempo.addEventListener('click', () => switchCashierSupplierTab('tempo'));
  }

  // Filter & Search
  if (el.cashierSearchSupplierInput) {
    el.cashierSearchSupplierInput.addEventListener('input', () => {
      if (state.cashierActiveSupplierTab === 'juragan') renderCashierSuppliersList();
      else if (state.cashierActiveSupplierTab === 'purchases') renderCashierPurchasesTable();
      else if (state.cashierActiveSupplierTab === 'tempo') renderCashierTempoDebtsTable();
    });
  }
  if (el.cashierSupplierStatusFilter) {
    el.cashierSupplierStatusFilter.addEventListener('change', () => {
      if (state.cashierActiveSupplierTab === 'juragan') renderCashierSuppliersList();
      else if (state.cashierActiveSupplierTab === 'purchases') renderCashierPurchasesTable();
      else if (state.cashierActiveSupplierTab === 'tempo') renderCashierTempoDebtsTable();
    });
  }
  if (el.btnRefreshCashierSuppliers) {
    el.btnRefreshCashierSuppliers.addEventListener('click', () => loadCashierSuppliers());
  }

  // Modal Pay Supplier Debt listeners
  if (el.btnCashierSupPayFull) {
    el.btnCashierSupPayFull.addEventListener('click', () => {
      if (state.cashierActivePurchaseForPayment && el.cashierSupPayAmountInput) {
        el.cashierSupPayAmountInput.value = state.cashierActivePurchaseForPayment.remaining_amount;
      }
    });
  }
  if (el.btnCancelCashierSupplierPay) {
    el.btnCancelCashierSupplierPay.addEventListener('click', () => {
      if (el.modalCashierPaySupplierDebt) el.modalCashierPaySupplierDebt.style.display = 'none';
    });
  }
  if (el.btnCloseCashierSupplierPay) {
    el.btnCloseCashierSupplierPay.addEventListener('click', () => {
      if (el.modalCashierPaySupplierDebt) el.modalCashierPaySupplierDebt.style.display = 'none';
    });
  }
  if (el.btnSubmitCashierSupplierPay) {
    el.btnSubmitCashierSupplierPay.addEventListener('click', handleSaveCashierSupplierPayment);
  }

  if (el.btnOpenCashierNewSupplier) {
    el.btnOpenCashierNewSupplier.addEventListener('click', openCashierNewSupplierModal);
  }
  if (el.btnCloseNewSupplierQuick) {
    el.btnCloseNewSupplierQuick.addEventListener('click', () => {
      if (el.modalNewSupplierQuick) el.modalNewSupplierQuick.style.display = 'none';
    });
  }
  if (el.btnCancelNewSupplierQuick) {
    el.btnCancelNewSupplierQuick.addEventListener('click', () => {
      if (el.modalNewSupplierQuick) el.modalNewSupplierQuick.style.display = 'none';
    });
  }
  if (el.btnSaveNewSupplierQuick) {
    el.btnSaveNewSupplierQuick.addEventListener('click', handleSaveNewSupplierQuick);
  }

  // Restock Payment Status Toggle
  if (el.restockPaymentStatus) {
    el.restockPaymentStatus.addEventListener('change', () => {
      const isTempo = el.restockPaymentStatus.value === 'tempo';
      if (el.restockTempoContainer) {
        el.restockTempoContainer.style.display = isTempo ? 'block' : 'none';
      }
    });
  }

  // Live Margin Preview on Edit Product Modal
  ['editCostPrice', 'editRetailPrice', 'editResellerPrice'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateLiveMarginPreview);
    }
  });

  // Cashier Pay Debt Modal
  if (el.btnDebtPayFull) {
    el.btnDebtPayFull.addEventListener('click', () => {
      el.btnDebtPayFull.classList.add('active');
      el.btnDebtPayFull.style.background = '#10b981';
      el.btnDebtPayFull.style.color = '#ffffff';
      el.btnDebtPayFull.style.border = 'none';
      el.btnDebtPayPartial.classList.remove('active');
      el.btnDebtPayPartial.style.background = '#f1f5f9';
      el.btnDebtPayPartial.style.color = '#334155';
      el.btnDebtPayPartial.style.border = '1.5px solid #cbd5e1';
      if (state.activeDebtForPayment) {
        el.payDebtAmountInput.value = formatRupiah(state.activeDebtForPayment.remaining_amount);
      }
    });
  }
  if (el.btnDebtPayPartial) {
    el.btnDebtPayPartial.addEventListener('click', () => {
      el.btnDebtPayPartial.classList.add('active');
      el.btnDebtPayPartial.style.background = '#f59e0b';
      el.btnDebtPayPartial.style.color = '#0f172a';
      el.btnDebtPayPartial.style.border = 'none';
      el.btnDebtPayFull.classList.remove('active');
      el.btnDebtPayFull.style.background = '#f1f5f9';
      el.btnDebtPayFull.style.color = '#334155';
      el.btnDebtPayFull.style.border = '1.5px solid #cbd5e1';
      el.payDebtAmountInput.value = '';
      el.payDebtAmountInput.focus();
    });
  }
  if (el.payDebtAmountInput) {
    el.payDebtAmountInput.addEventListener('input', (e) => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      if (raw) {
        e.target.value = formatRupiah(Number(raw));
      } else {
        e.target.value = '';
      }
    });
  }
  if (el.btnSubmitPayDebt) {
    el.btnSubmitPayDebt.addEventListener('click', handleCashierPayDebtSubmit);
  }
  if (el.btnCancelPayDebt) {
    el.btnCancelPayDebt.addEventListener('click', () => el.modalPayCashierDebt.style.display = 'none');
  }
  if (el.btnClosePayDebtModal) {
    el.btnClosePayDebtModal.addEventListener('click', () => el.modalPayCashierDebt.style.display = 'none');
  }

  
  
  // Scale Modal Events
  if (el.btnCloseScaleModal) el.btnCloseScaleModal.addEventListener('click', () => el.modalScaleWeight.style.display = 'none');
  if (el.btnCancelScaleModal) el.btnCancelScaleModal.addEventListener('click', () => el.modalScaleWeight.style.display = 'none');
  if (el.btnSubmitScaleToCart) el.btnSubmitScaleToCart.addEventListener('click', handleApplyScaleToCart);

  if (el.tabModeWeight) el.tabModeWeight.addEventListener('click', () => setModalScaleMode('weight'));
  if (el.tabModeMoney) el.tabModeMoney.addEventListener('click', () => setModalScaleMode('money'));

  if (el.inpScaleWeightKg) {
    el.inpScaleWeightKg.addEventListener('input', updateScaleWeightCalc);
  }

  if (el.inpScaleMoneyRp) {
    attachCurrencyAutoFormat(el.inpScaleMoneyRp, updateScaleMoneyCalc);
  }

  // Scale Custom Rate field & Reset button
  if (el.inpScaleCustomRate) {
    attachCurrencyAutoFormat(el.inpScaleCustomRate, () => {
      const val = parseRupiahInput(el.inpScaleCustomRate.value);
      state.scaleCustomRate = val > 0 ? val : null;
      if (state.scaleMode === 'weight') {
        updateScaleWeightCalc();
      } else {
        updateScaleMoneyCalc();
      }
    });
  }

  if (el.btnResetScaleRate) {
    el.btnResetScaleRate.addEventListener('click', () => {
      state.scaleCustomRate = null;
      if (!state.activeScaleProduct) return;
      const defaultRate = Number(state.activeScaleProduct.retail_price);
      el.inpScaleCustomRate.value = formatRupiahNumber(defaultRate);
      if (state.scaleMode === 'weight') {
        updateScaleWeightCalc();
      } else {
        updateScaleMoneyCalc();
      }
      showToast('Tarif dikembalikan ke standar acuan toko', 'info');
    });
  }

  // In-Cart Edit Price Modal Events
  if (el.btnCloseEditCartPriceModal) {
    el.btnCloseEditCartPriceModal.addEventListener('click', () => {
      el.modalEditCartPrice.style.display = 'none';
    });
  }
  if (el.btnCancelEditCartPrice) {
    el.btnCancelEditCartPrice.addEventListener('click', () => {
      el.modalEditCartPrice.style.display = 'none';
    });
  }
  if (el.inpEditCartNewRate) {
    attachCurrencyAutoFormat(el.inpEditCartNewRate, updateEditCartPreview);
  }
  if (el.btnResetToStandardRate) {
    el.btnResetToStandardRate.addEventListener('click', () => {
      if (state.activeEditCartPriceIndex === null) return;
      const item = state.cart[state.activeEditCartPriceIndex];
      if (!item) return;

      delete item.customUnitPrice;
      recalculateCart();
      renderCart();
      el.modalEditCartPrice.style.display = 'none';
      showToast(`Tarif ${item.product.name} dikembalikan ke acuan toko`, 'info');
    });
  }
  if (el.btnSaveEditCartPrice) {
    el.btnSaveEditCartPrice.addEventListener('click', () => {
      if (state.activeEditCartPriceIndex === null) return;
      const item = state.cart[state.activeEditCartPriceIndex];
      if (!item) return;

      const newRate = parseRupiahInput(el.inpEditCartNewRate.value);
      if (newRate <= 0) {
        showToast('Masukkan tarif harga yang valid!', 'error');
        return;
      }

      if (newRate === Number(item.product.retail_price)) {
        item.priceMode = 'eceran';
        item.customUnitPrice = null;
      } else if (newRate === Number(item.product.reseller_price)) {
        item.priceMode = 'karungan';
        item.customUnitPrice = null;
      } else {
        item.customUnitPrice = newRate;
      }

      item.fixedMoney = null;
      recalculateCart();
      renderCart();
      el.modalEditCartPrice.style.display = 'none';
      showToast(`Tarif ${item.product.name} disesuaikan jadi ${formatRupiah(newRate)}/${item.product.unit}`, 'success');
    });
  }

  // Karung Quantity Modal Events
  if (el.btnCloseKarungModal) {
    el.btnCloseKarungModal.addEventListener('click', () => {
      el.modalKarungQty.style.display = 'none';
    });
  }
  if (el.btnCancelKarungModal) {
    el.btnCancelKarungModal.addEventListener('click', () => {
      el.modalKarungQty.style.display = 'none';
    });
  }

  // Preset Buttons (10kg, 20kg, 25kg, 50kg, 100kg, 200kg)
  document.querySelectorAll('.btn-karung-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = parseFloat(btn.dataset.weight);
      if (el.inpKarungTotalKg) el.inpKarungTotalKg.value = w;
      if (el.inpKarungCount && el.selKgPerKarung) {
        if (w % 50 === 0) {
          el.inpKarungCount.value = w / 50;
          el.selKgPerKarung.value = '50';
        } else if (w % 25 === 0) {
          el.inpKarungCount.value = w / 25;
          el.selKgPerKarung.value = '25';
        } else if (w % 20 === 0) {
          el.inpKarungCount.value = w / 20;
          el.selKgPerKarung.value = '20';
        } else {
          el.inpKarungCount.value = w / 10;
          el.selKgPerKarung.value = '10';
        }
      }
      updateKarungModalPreview();
    });
  });

  // Stepper Karung Count (+ / -)
  if (el.btnMinusKarungCount) {
    el.btnMinusKarungCount.addEventListener('click', () => {
      let count = parseInt(el.inpKarungCount.value, 10) || 1;
      if (count > 1) {
        count--;
        el.inpKarungCount.value = count;
        const kgPerBag = parseFloat(el.selKgPerKarung.value) || 25;
        el.inpKarungTotalKg.value = count * kgPerBag;
        updateKarungModalPreview();
      }
    });
  }
  if (el.btnPlusKarungCount) {
    el.btnPlusKarungCount.addEventListener('click', () => {
      let count = parseInt(el.inpKarungCount.value, 10) || 1;
      count++;
      el.inpKarungCount.value = count;
      const kgPerBag = parseFloat(el.selKgPerKarung.value) || 25;
      el.inpKarungTotalKg.value = count * kgPerBag;
      updateKarungModalPreview();
    });
  }
  if (el.inpKarungCount) {
    el.inpKarungCount.addEventListener('input', () => {
      const count = parseInt(el.inpKarungCount.value, 10) || 1;
      const kgPerBag = parseFloat(el.selKgPerKarung.value) || 25;
      el.inpKarungTotalKg.value = count * kgPerBag;
      updateKarungModalPreview();
    });
  }
  if (el.selKgPerKarung) {
    el.selKgPerKarung.addEventListener('change', () => {
      const count = parseInt(el.inpKarungCount.value, 10) || 1;
      const kgPerBag = parseFloat(el.selKgPerKarung.value) || 25;
      el.inpKarungTotalKg.value = count * kgPerBag;
      updateKarungModalPreview();
    });
  }

  // Direct Total Kg input
  if (el.inpKarungTotalKg) {
    el.inpKarungTotalKg.addEventListener('input', () => {
      updateKarungModalPreview();
    });
  }

  // Apply Button
  if (el.btnApplyKarungQty) {
    el.btnApplyKarungQty.addEventListener('click', () => {
      if (state.activeKarungModalIndex === null) return;
      const item = state.cart[state.activeKarungModalIndex];
      if (!item) return;

      const totalKg = parseFloat(el.inpKarungTotalKg.value);
      if (isNaN(totalKg) || totalKg <= 0) {
        showToast('Masukkan kuantitas atau berat karung yang valid!', 'error');
        return;
      }

      item.qty = Math.round(totalKg * 100) / 100;
      item.priceMode = 'karungan';
      item.tier = 'karungan';
      item.fixedMoney = null;

      recalculateCart();
      renderCart();
      el.modalKarungQty.style.display = 'none';
      showToast(`📦 Kuantitas karung ${item.product.name} diatur: ${item.qty} ${item.product.unit} (${formatRupiah(item.subtotal)})`, 'success');
    });
  }

  // Weight chips
  document.querySelectorAll('.btn-scale-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = parseFloat(btn.dataset.weight);
      el.inpScaleWeightKg.value = w.toFixed(2);
      updateScaleWeightCalc();
    });
  });

  // Fine-tune buttons (+/- 0.05, 0.1, 0.2 kg)
  document.querySelectorAll('.btn-finetune').forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = parseFloat(btn.dataset.delta);
      let current = parseFloat(el.inpScaleWeightKg.value) || 0;
      let next = Math.max(0.05, Math.round((current + delta) * 100) / 100);
      el.inpScaleWeightKg.value = next.toFixed(2);
      updateScaleWeightCalc();
    });
  });

  // Money chips
  document.querySelectorAll('.btn-scale-money-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = Number(btn.dataset.money);
      el.inpScaleMoneyRp.value = formatRupiahNumber(m);
      updateScaleMoneyCalc();
    });
  });

  // Currency auto formatting
  attachCurrencyAutoFormat(el.startingCashInput);
  attachCurrencyAutoFormat(el.cashTenderedInput, calculateChangeDue);

  const tenderNumpadEl = document.getElementById('tenderNumpad');
  if (tenderNumpadEl) {
    tenderNumpadEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-num');
      if (!btn) return;
      const currentTotal = getCartTotal();
      let currentTender = parseRupiahInput(el.cashTenderedInput.value);

      if (btn.dataset.val === 'pas') {
        el.cashTenderedInput.value = formatRupiahNumber(currentTotal);
      } else if (btn.dataset.val === 'clear') {
        el.cashTenderedInput.value = '';
      } else if (btn.dataset.val === 'backspace') {
        const raw = String(currentTender);
        const sliced = raw.length > 1 ? raw.slice(0, -1) : '';
        el.cashTenderedInput.value = sliced ? formatRupiahNumber(Number(sliced)) : '';
      } else if (btn.dataset.add) {
        const addVal = Number(btn.dataset.add) || 0;
        el.cashTenderedInput.value = formatRupiahNumber(currentTender + addVal);
      } else if (btn.dataset.num !== undefined) {
        const digit = String(btn.dataset.num);
        const currentStr = currentTender > 0 ? String(currentTender) : '';
        const newStr = currentStr + digit;
        if (newStr.length <= 11) {
          el.cashTenderedInput.value = formatRupiahNumber(Number(newStr));
        }
      }
      calculateChangeDue();
    });
  }

  // Toggle native tablet keyboard mode vs touch numpad
  const btnToggleKbd = document.getElementById('btnToggleKeyboardMode');
  if (btnToggleKbd && el.cashTenderedInput) {
    btnToggleKbd.addEventListener('click', () => {
      const isReadonly = el.cashTenderedInput.hasAttribute('readonly');
      if (isReadonly) {
        el.cashTenderedInput.removeAttribute('readonly');
        el.cashTenderedInput.setAttribute('inputmode', 'numeric');
        btnToggleKbd.textContent = '🔒 Kunci Keypad';
        btnToggleKbd.style.color = '#34d399';
        btnToggleKbd.style.borderColor = '#10b981';
        el.cashTenderedInput.focus();
      } else {
        el.cashTenderedInput.setAttribute('readonly', 'true');
        el.cashTenderedInput.setAttribute('inputmode', 'none');
        btnToggleKbd.textContent = '⌨️ Buka Keyboard Tab';
        btnToggleKbd.style.color = '#94a3b8';
        btnToggleKbd.style.borderColor = 'rgba(255,255,255,0.2)';
      }
    });
  }

  // Cash preset bar
  el.cashPresetsBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-preset');
    if (!btn) return;
    const amount = btn.dataset.amount;
    const total = getCartTotal();
    openPaymentModal();
    if (amount === 'exact') {
      el.cashTenderedInput.value = formatRupiahNumber(total);
    } else {
      el.cashTenderedInput.value = formatRupiahNumber(amount);
    }
    calculateChangeDue();
  });

  el.btnProcessPayment.addEventListener('click', handleProcessOrder);

  // Receipt Modal
  const closeReceiptModal = () => {
    el.receiptModal.style.display = 'none';
    state.lastCompletedExpense = null;
    if (el.receiptModalTitle) el.receiptModalTitle.textContent = 'Transaksi Berhasil';
    if (el.btnNextOrder) el.btnNextOrder.textContent = 'Transaksi Baru Berikutnya';
    switchTabletView('catalog');
  };
  el.btnCloseReceiptModal.addEventListener('click', closeReceiptModal);
  el.btnNextOrder.addEventListener('click', closeReceiptModal);
  
  el.btnPrintReceipt.addEventListener('click', async () => {
    if (state.lastCompletedExpense) {
      const originalText = el.btnPrintReceipt.textContent;
      el.btnPrintReceipt.disabled = true;
      el.btnPrintReceipt.textContent = '⏳ Mencetak ke Printer...';
      try {
        await hardwareManager.printExpense(state.lastCompletedExpense, state.settings, state.lastExpenseIsReprint);
        showToast('🖨️ Struk bukti kas berhasil dicetak!', 'success');
      } catch (err) {
        showToast('Gagal cetak Bluetooth: ' + err.message + '. Membuka dialog cetak...', 'error');
        window.print();
      } finally {
        el.btnPrintReceipt.disabled = false;
        el.btnPrintReceipt.textContent = originalText;
      }
    } else if (state.lastCompletedOrder) {
      const originalText = el.btnPrintReceipt.textContent;
      el.btnPrintReceipt.disabled = true;
      el.btnPrintReceipt.textContent = '⏳ Mencetak ke Printer...';
      try {
        const res = await hardwareManager.printOrder(state.lastCompletedOrder, state.settings, state.lastOrderIsReprint);
        showToast(`Struk dicetak (${res.mode.toUpperCase()})!`, 'success');
      } catch (err) {
        showToast('Gagal cetak Bluetooth: ' + err.message + '. Membuka dialog cetak...', 'error');
        window.print();
      } finally {
        el.btnPrintReceipt.disabled = false;
        el.btnPrintReceipt.textContent = originalText;
      }
    } else {
      window.print();
    }
  });

  // Cashier Dashboard & Daily Balancing Listeners
  if (el.btnOpenCashierDashboard) {
    el.btnOpenCashierDashboard.addEventListener('click', openCashierDashboard);
  }
  if (el.btnDropdownCashierDashboard) {
    el.btnDropdownCashierDashboard.addEventListener('click', () => {
      const storeDropdown = document.getElementById('storeMenuDropdown');
      if (storeDropdown) storeDropdown.classList.remove('active');
      openCashierDashboard();
    });
  }
  if (el.btnUserDropdownShiftDashboard) {
    el.btnUserDropdownShiftDashboard.addEventListener('click', () => {
      const userDropdown = document.getElementById('userMenuDropdown');
      if (userDropdown) userDropdown.classList.remove('active');
      openCashierDashboard();
    });
  }
  if (el.btnCloseCashierDashboard) {
    el.btnCloseCashierDashboard.addEventListener('click', () => {
      if (el.modalCashierDashboard) el.modalCashierDashboard.style.display = 'none';
    });
  }
  if (el.modalCashierDashboard) {
    el.modalCashierDashboard.addEventListener('click', (e) => {
      if (e.target === el.modalCashierDashboard) {
        el.modalCashierDashboard.style.display = 'none';
      }
    });
  }
  if (el.btnRefreshCashierDashboard) {
    el.btnRefreshCashierDashboard.addEventListener('click', refreshCashierDashboardData);
  }
  if (el.btnDrawerKickDashboard) {
    el.btnDrawerKickDashboard.addEventListener('click', async () => {
      try {
        await hardwareManager.kickCashDrawer();
        showToast('💰 Sinyal buka laci kasir (Kick RJ-11) terkirim!', 'success');
      } catch (err) {
        showToast('Gagal membuka laci: ' + err.message, 'warning');
      }
    });
  }
  if (el.btnDashboardPrintReportX) {
    el.btnDashboardPrintReportX.addEventListener('click', handleDashboardPrintReportX);
  }
  if (el.btnDashboardCloseShiftZ) {
    el.btnDashboardCloseShiftZ.addEventListener('click', handleDashboardCloseShiftZ);
  }
  if (el.btnDashResetDenom) {
    el.btnDashResetDenom.addEventListener('click', () => {
      ['dashD100k', 'dashD50k', 'dashD20k', 'dashD10k', 'dashD5k', 'dashD2k', 'dashD1k', 'dashDKoin'].forEach(id => {
        const inp = document.getElementById(id);
        if (inp) inp.value = '0';
      });
      recalculateDashboardDenominations();
    });
  }
  if (el.btnDashQuickAddExpense) {
    el.btnDashQuickAddExpense.addEventListener('click', () => {
      openCashierExpensesModal();
    });
  }
  if (el.btnDashQuickAddIncome) {
    el.btnDashQuickAddIncome.addEventListener('click', () => {
      if (el.modalCashierIncome) el.modalCashierIncome.style.display = 'flex';
    });
  }
  ['dashD100k', 'dashD50k', 'dashD20k', 'dashD10k', 'dashD5k', 'dashD2k', 'dashD1k', 'dashDKoin'].forEach(id => {
    const inp = document.getElementById(id);
    if (inp) {
      inp.addEventListener('input', recalculateDashboardDenominations);
    }
  });

  // Blind Close Shift (Fallback Modal)
  el.btnCloseShift.addEventListener('click', () => {
    const userDropdown = document.getElementById('userMenuDropdown');
    if (userDropdown) userDropdown.classList.remove('active');
    openCashierDashboard();
  });
  el.btnCloseCloseShiftModal.addEventListener('click', () => el.closeShiftModal.style.display = 'none');
  el.btnCancelCloseShiftModal.addEventListener('click', () => el.closeShiftModal.style.display = 'none');
  
  ['d100k', 'd50k', 'd20k', 'd10k', 'dKoin'].forEach(id => {
    document.getElementById(id).addEventListener('input', recalculateBlindCashTotal);
  });
  el.btnSubmitBlindClose.addEventListener('click', handleSubmitBlindClose);

  // Waste Modal
  el.btnWaste.addEventListener('click', openWasteModal);
  el.btnCloseWasteModal.addEventListener('click', () => el.wasteModal.style.display = 'none');
  el.btnCancelWaste.addEventListener('click', () => el.wasteModal.style.display = 'none');
  el.btnSubmitWaste.addEventListener('click', handleSubmitWaste);

  // History & Void Modal
  el.btnHistory.addEventListener('click', openHistoryModal);
  el.btnCloseHistoryModal.addEventListener('click', () => el.historyModal.style.display = 'none');

  // History Date Filters & Search
  if (el.historyDateFilter) {
    el.historyDateFilter.addEventListener('change', () => {
      updateHistoryDatePills();
      renderFilteredHistoryTable();
    });
  }
  if (el.btnFilterToday) {
    el.btnFilterToday.addEventListener('click', () => {
      if (el.historyDateFilter) el.historyDateFilter.value = getLocalDateStr();
      updateHistoryDatePills();
      renderFilteredHistoryTable();
    });
  }
  if (el.btnFilterYesterday) {
    el.btnFilterYesterday.addEventListener('click', () => {
      const yDate = new Date();
      yDate.setDate(yDate.getDate() - 1);
      if (el.historyDateFilter) el.historyDateFilter.value = getLocalDateStr(yDate);
      updateHistoryDatePills();
      renderFilteredHistoryTable();
    });
  }
  if (el.btnFilterAllDates) {
    el.btnFilterAllDates.addEventListener('click', () => {
      if (el.historyDateFilter) el.historyDateFilter.value = '';
      updateHistoryDatePills();
      renderFilteredHistoryTable();
    });
  }
  if (el.historySearchInput) {
    el.historySearchInput.addEventListener('input', () => {
      renderFilteredHistoryTable();
    });
  }

  // Initialize Lock Screen System (Manual & 10 Min Inactivity Auto-Lock)
  initLockScreenEvents();
  initLockInactivityListeners();

  // Void Auth Modal
  el.btnCancelVoid.addEventListener('click', () => el.voidAuthModal.style.display = 'none');
  el.btnConfirmVoid.addEventListener('click', handleConfirmVoid);

  // Logout
  el.btnLogout.addEventListener('click', () => {
    api.clearSession();
    state.user = null;
    state.shift = null;
    el.activeCashierName.textContent = 'Belum Login';
    el.activeShiftMeta.textContent = 'Shift Belum Dibuka';
    const userDisplayNameEl = document.getElementById('dropdownUserDisplayName');
    const userRoleEl = document.getElementById('dropdownUserRole');
    if (userDisplayNameEl) userDisplayNameEl.textContent = 'Belum Login';
    if (userRoleEl) userRoleEl.textContent = 'Sesi Kasir Berakhir';
    if (el.btnOwnerPanel) el.btnOwnerPanel.style.display = 'none';
    if (el.btnStockOpname) el.btnStockOpname.style.display = 'none';
    if (el.btnEditIdentity) el.btnEditIdentity.style.display = 'none';
    showLoginModal();
    showToast('Berhasil keluar. Silakan masukkan PIN untuk bertugas.', 'info');
  });
}

// -----------------------------------------------------------------------------
// LOGIN & SHIFT LOGIC
// -----------------------------------------------------------------------------
function showLoginModal() {
  if (el.btnOwnerPanel) el.btnOwnerPanel.style.display = 'none';
  if (el.btnStockOpname) el.btnStockOpname.style.display = 'none';
  if (el.btnEditIdentity) el.btnEditIdentity.style.display = 'none';
  el.loginModal.style.display = 'flex';
  el.pinInput.value = '';
}

async function submitPinLogin(pin) {
  try {
    const res = await api.login(pin);
    api.setSession(res.token, res.user);
    state.user = res.user;

    // Jika pengguna login sebagai Owner, langsung arahkan ke Dashboard Owner (owner.html)
    if (state.user && state.user.role === 'owner') {
      window.location.href = '/owner.html';
      return;
    }

    updateRoleUI();
    el.loginModal.style.display = 'none';
    showToast(res.message, 'success');
    el.activeCashierName.textContent = state.user.name;
    await syncShift();
    await loadInitialData();
  } catch (err) {
    el.pinInput.value = '';
    showToast('Login gagal: ' + err.message, 'error');
  }
}

function showOpenShiftModal() {
  el.openShiftModal.style.display = 'flex';
  el.startingCashInput.value = '200.000';
}

async function handleOpenShift() {
  const amount = parseRupiahInput(el.startingCashInput.value);
  if (isNaN(amount) || amount < 0) {
    showToast('Masukkan jumlah modal awal yang valid', 'error');
    return;
  }
  try {
    const res = await api.openShift(amount);
    state.shift = res.shift;
    el.openShiftModal.style.display = 'none';
    el.activeShiftMeta.textContent = `Shift Aktif #${state.shift.id} (Modal: ${formatRupiah(state.shift.starting_cash)})`;
    showToast('Shift berhasil dibuka! Selamat bertugas.', 'success');
  } catch (err) {
    showToast('Gagal buka shift: ' + err.message, 'error');
  }
}

// -----------------------------------------------------------------------------
// CATALOG & PRODUCTS
// -----------------------------------------------------------------------------
function filterProducts() {
  const search = el.searchProduct.value.toLowerCase().trim();
  state.filteredProducts = state.products.filter(p => {
    let matchCategory = true;
    if (state.activeCategory === 'low_stock') {
      const minAlert = p.min_stock_alert !== undefined && p.min_stock_alert !== null ? Number(p.min_stock_alert) : 15.0;
      matchCategory = Number(p.stock_qty) <= minAlert;
    } else if (state.activeCategory) {
      matchCategory = p.category === state.activeCategory;
    }
    const matchSearch = !search || p.name.toLowerCase().includes(search);
    return matchCategory && matchSearch;
  });
  renderProductGrid();
}

function renderProductGrid() {
  if (el.tabletCatalogCount) {
    el.tabletCatalogCount.textContent = state.filteredProducts.length;
  }

  if (state.filteredProducts.length === 0) {
    el.productGrid.innerHTML = `<div class="empty-cart"><p>Tidak ada komoditas ditemukan</p></div>`;
    return;
  }

  // Pre-calculate cart quantities for each product
  const cartQtyMap = {};
  if (state.cart && state.cart.length > 0) {
    state.cart.forEach(item => {
      const pid = item.product.id;
      cartQtyMap[pid] = (cartQtyMap[pid] || 0) + item.qty;
    });
  }

  el.productGrid.innerHTML = state.filteredProducts.map(p => {
    const productName = (p.name || p.product_name || p.nama || p.title || '').trim() || 'Komoditas';
    const minAlert = p.min_stock_alert !== undefined && p.min_stock_alert !== null ? Number(p.min_stock_alert) : 15.0;
    const isOut = Number(p.stock_qty) <= 0;
    const isLow = !isOut && Number(p.stock_qty) <= minAlert;

    let tagHtml = '';
    let cardClass = '';
    if (isOut) {
      tagHtml = `<span class="stock-tag empty">🚨 Habis</span>`;
      cardClass = 'out-of-stock';
    } else if (isLow) {
      tagHtml = `<span class="stock-tag low">⚠️ Sisa ${p.stock_qty} ${p.unit}</span>`;
      cardClass = 'low-stock-card';
    } else {
      tagHtml = `<span class="stock-tag safe">🟢 ${p.stock_qty} ${p.unit}</span>`;
    }

    const qtyInCart = cartQtyMap[p.id];
    const displayQty = qtyInCart ? ((qtyInCart % 1 === 0) ? qtyInCart : qtyInCart.toFixed(1)) : 0;
    const inCartBadge = qtyInCart 
      ? `<span class="card-in-cart-pill" title="${displayQty} ${p.unit} di keranjang">🛒 ${displayQty} ${p.unit}</span>` 
      : '';
    const inCartClass = qtyInCart ? 'in-cart-highlight' : '';

    return `
      <div class="product-card ${cardClass} ${inCartClass}" data-id="${p.id}" data-unit="${p.unit || 'kg'}" tabindex="0" role="button" aria-label="Tambah ${escapeHtml(productName)} ke keranjang">
        ${inCartBadge}
        <div class="card-header-row card-top">
          <span class="product-emoji">${p.image_emoji || '🥔'}</span>
          ${tagHtml}
        </div>
        <h3 class="product-name" title="${escapeHtml(productName)}" style="display: -webkit-box !important; -webkit-line-clamp: 2 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; text-overflow: ellipsis !important; color: #0f172a !important; font-size: 12px !important; font-weight: 700 !important; line-height: 1.25 !important; min-height: 28px !important; max-height: 32px !important; margin: 2px 0 4px 0 !important; flex-shrink: 0 !important; visibility: visible !important;">${escapeHtml(productName)}</h3>
        <div class="card-pricing">
          <div class="price-row price-row-retail">
            <span class="price-label">Ecer</span>
            <span class="price-val">${formatRupiah(p.retail_price)}</span>
          </div>
          <div class="price-row price-row-wholesale reseller">
            <span class="price-label">Karung</span>
            <span class="price-val">${formatRupiah(p.reseller_price)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Add click listener with tactile pop animation
  el.productGrid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = Number(card.dataset.id);
      const product = state.products.find(p => p.id === id);
      if (product) {
        card.classList.remove('card-just-added');
        void card.offsetWidth;
        card.classList.add('card-just-added');
        setTimeout(() => card.classList.remove('card-just-added'), 280);
        addToCart(product);
      }
    });
  });
}

function updateProductCardInCartBadges() {
  if (!el.productGrid) return;
  const cartQtyMap = {};
  if (state.cart && state.cart.length > 0) {
    state.cart.forEach(item => {
      const pid = item.product.id;
      cartQtyMap[pid] = (cartQtyMap[pid] || 0) + item.qty;
    });
  }

  el.productGrid.querySelectorAll('.product-card').forEach(card => {
    const id = Number(card.dataset.id);
    const qty = cartQtyMap[id];
    let badge = card.querySelector('.card-in-cart-pill');
    if (qty && qty > 0) {
      card.classList.add('in-cart-highlight');
      const unit = card.dataset.unit || 'kg';
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'card-in-cart-pill';
        card.prepend(badge);
      }
      const displayQty = (qty % 1 === 0) ? qty : qty.toFixed(1);
      badge.textContent = `🛒 ${displayQty} ${unit}`;
      badge.style.display = 'inline-flex';
    } else {
      card.classList.remove('in-cart-highlight');
      if (badge) badge.remove();
    }
  });
}

function renderCustomerSelect() {
  // Populate datalist pembeli untuk Kasbon agar kasir bisa langsung autocomplete nama/HP
  if (el.registeredCustomersList && state.customers) {
    el.registeredCustomersList.innerHTML = state.customers.map(c => 
      `<option value="${c.name}">${c.phone ? '📞 ' + c.phone : ''}</option>`
    ).join('');
  }
}

function updateCustomerTierState() {
  // Opsi reseller telah dihapus sesuai instruksi; kasir dapat menyesuaikan harga sendiri secara langsung.
}

// -----------------------------------------------------------------------------
// CART & PRICING ENGINE
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// SMART WEIGHING SCALE & SEADANYA MODAL LOGIC
// -----------------------------------------------------------------------------
function openScaleModal(product, existingQty = null, cartIndex = null) {
  state.activeScaleProduct = product;
  state.activeCartEditIndex = cartIndex;
  state.scaleMode = 'weight';

  const scaleProdName = (product.name || product.product_name || product.nama || '').trim() || 'Komoditas';
  el.scaleProdEmoji.textContent = product.image_emoji || '🥔';
  el.scaleProdName.textContent = scaleProdName;
  el.scaleProdPriceRate.innerHTML = `Eceran: <strong>${formatRupiah(product.retail_price)}/${product.unit}</strong> | Karungan: <strong>${formatRupiah(product.reseller_price)}/${product.unit}</strong>`;

  // Initialize or restore custom unit rate
  const defaultRate = Number(product.retail_price);

  if (cartIndex !== null && state.cart[cartIndex] && state.cart[cartIndex].customUnitPrice) {
    state.scaleCustomRate = state.cart[cartIndex].customUnitPrice;
  } else {
    state.scaleCustomRate = null;
  }

  if (el.scaleRateDefaultHint) {
    el.scaleRateDefaultHint.textContent = `Standar: ${formatRupiah(defaultRate)}/${product.unit} (Ecer: ${formatRupiah(product.retail_price)} | Krgn: ${formatRupiah(product.reseller_price)})`;
  }
  if (el.scaleCustomRateUnit) {
    el.scaleCustomRateUnit.textContent = `/${product.unit}`;
  }
  if (el.inpScaleCustomRate) {
    el.inpScaleCustomRate.value = formatRupiahNumber(state.scaleCustomRate || defaultRate);
  }

  // Default to weight mode
  setModalScaleMode('weight');

  const initialWeight = existingQty ? Number(existingQty) : 1.00;
  el.inpScaleWeightKg.value = initialWeight.toFixed(2);
  el.inpScaleMoneyRp.value = '';

  updateScaleWeightCalc();

  el.modalScaleWeight.style.display = 'flex';
  el.inpScaleWeightKg.focus();
  el.inpScaleWeightKg.select();
}

function setModalScaleMode(mode) {
  state.scaleMode = mode;
  if (mode === 'weight') {
    el.tabModeWeight.classList.add('active');
    el.tabModeMoney.classList.remove('active');
    el.paneScaleWeight.style.display = 'block';
    el.paneScaleMoney.style.display = 'none';
    updateScaleWeightCalc();
  } else {
    el.tabModeMoney.classList.add('active');
    el.tabModeWeight.classList.remove('active');
    el.paneScaleMoney.style.display = 'block';
    el.paneScaleWeight.style.display = 'none';
    if (!el.inpScaleMoneyRp.value) {
      el.inpScaleMoneyRp.value = '10.000';
    }
    updateScaleMoneyCalc();
    el.inpScaleMoneyRp.focus();
  }
}

function updateScaleWeightCalc() {
  if (!state.activeScaleProduct) return;
  const p = state.activeScaleProduct;
  const weight = parseFloat(el.inpScaleWeightKg.value) || 0;

  const standardRate = Number(p.retail_price);
  const rate = (state.scaleCustomRate && state.scaleCustomRate > 0) ? state.scaleCustomRate : standardRate;
  const isCustom = state.scaleCustomRate && state.scaleCustomRate > 0 && state.scaleCustomRate !== standardRate;

  // Round to nearest Rp 100 so weight-based commodity calculations are always clean
  const subtotal = Math.round((weight * rate) / 100) * 100;

  state.scaleCalculatedQty = weight;
  state.scaleCalculatedSubtotal = subtotal;

  el.scaleWeightSubtotal.textContent = formatRupiah(subtotal);
  if (isCustom) {
    el.scaleTierBadge.textContent = 'Harga Kustom / Nego';
    el.scaleTierBadge.className = 'scale-tier-badge highlight';
  } else {
    el.scaleTierBadge.textContent = 'Standar Eceran';
    el.scaleTierBadge.className = 'scale-tier-badge';
  }
}

function updateScaleMoneyCalc() {
  if (!state.activeScaleProduct) return;
  const p = state.activeScaleProduct;
  const money = parseRupiahInput(el.inpScaleMoneyRp.value);

  if (money <= 0) {
    el.scaleMoneyResultKg.textContent = '0.00 kg';
    el.scaleMoneyResultGram.textContent = '(0 gram)';
    state.scaleCalculatedQty = 0;
    state.scaleCalculatedSubtotal = 0;
    return;
  }

  let standardRate = Number(p.retail_price);
  let rate = (state.scaleCustomRate && state.scaleCustomRate > 0) ? state.scaleCustomRate : standardRate;
  let weight = money / rate;

  const roundedWeight = Math.round(weight * 100) / 100;
  const grams = Math.round(weight * 1000);

  state.scaleCalculatedQty = roundedWeight;
  state.scaleCalculatedSubtotal = money;

  el.scaleMoneyResultKg.textContent = `${roundedWeight.toFixed(2)} ${p.unit}`;
  el.scaleMoneyResultGram.textContent = `(${grams} gram seadanya pas ${formatRupiah(money)})`;
}

function handleApplyScaleToCart() {
  if (!state.activeScaleProduct) return;
  if (state.scaleCalculatedQty <= 0) {
    showToast('Masukkan berat timbangan yang valid!', 'error');
    return;
  }

  const product = state.activeScaleProduct;
  const qty = state.scaleCalculatedQty;
  const fixedMoney = state.scaleMode === 'money' ? state.scaleCalculatedSubtotal : null;
  const customUnitPrice = (state.scaleCustomRate && state.scaleCustomRate > 0) ? state.scaleCustomRate : null;

  if (state.activeCartEditIndex !== null && state.cart[state.activeCartEditIndex]) {
    state.cart[state.activeCartEditIndex].qty = qty;
    state.cart[state.activeCartEditIndex].fixedMoney = fixedMoney;
    if (customUnitPrice) {
      state.cart[state.activeCartEditIndex].customUnitPrice = customUnitPrice;
    }
  } else {
    const existingIndex = state.cart.findIndex(i => i.product.id === product.id);
    if (existingIndex > -1) {
      state.cart[existingIndex].qty += qty;
      state.cart[existingIndex].fixedMoney = fixedMoney;
      if (customUnitPrice) {
        state.cart[existingIndex].customUnitPrice = customUnitPrice;
      }
    } else {
      state.cart.push({
        product,
        qty,
        fixedMoney,
        customUnitPrice
      });
    }
  }

  const prodName = product.name || product.product_name || 'Komoditas';
  el.modalScaleWeight.style.display = 'none';
  recalculateCart();
  renderCart();
  showToast(`${prodName} (${qty.toFixed(2)} ${product.unit || 'kg'}) berhasil dimasukkan ke keranjang!`, 'success');
}

function addToCart(product) {
  const prodName = product.name || product.product_name || 'Komoditas';
  if (Number(product.stock_qty) <= 0) {
    showToast(`⚠️ Stok ${prodName} telah habis (0 ${product.unit || 'kg'}). Tidak dapat ditambahkan ke keranjang.`, 'warning');
    return;
  }
  const existingIndex = state.cart.findIndex(i => i.product.id === product.id);
  if (existingIndex > -1) {
    state.cart[existingIndex].qty = Math.round((state.cart[existingIndex].qty + 1) * 100) / 100;
  } else {
    state.cart.push({
      product,
      qty: 1,
      priceMode: 'eceran',
      tier: 'retail',
      customUnitPrice: null,
      fixedMoney: null
    });
  }
  recalculateCart();
  renderCart();
}

function recalculateCart() {
  state.cart.forEach(item => {
    if (!item.priceMode) {
      item.priceMode = (item.tier === 'reseller' || item.tier === 'karungan') ? 'karungan' : 'eceran';
    }

    item.tier = item.priceMode === 'karungan' ? 'karungan' : 'retail';

    // If cashier set a custom unit price (nego / penyesuaian pasar), respect it!
    if (item.customUnitPrice && Number(item.customUnitPrice) > 0) {
      item.unitPrice = Number(item.customUnitPrice);
      item.isCustomPrice = true;
    } else {
      item.unitPrice = item.priceMode === 'karungan' ? Number(item.product.reseller_price) : Number(item.product.retail_price);
      item.isCustomPrice = false;
    }

    // If customer buys by exact money nominal (e.g. 10.000 / 15.000), total MUST be exactly that nominal!
    if (item.fixedMoney) {
      item.subtotal = item.fixedMoney;
      // Calculate weight based on exact money:
      item.qty = Math.round((item.fixedMoney / item.unitPrice) * 1000) / 1000;
    } else {
      // In Indonesian commodity retail, round to nearest 100 so no 9.996 or 5.004 ever occurs!
      const raw = item.qty * item.unitPrice;
      item.subtotal = Math.round(raw / 100) * 100;
    }
  });
}

function renderCart() {
  recalculateCart();
  saveCartToStorage();

  if (state.cart.length === 0) {
    el.cartItemsList.innerHTML = `
      <div class="empty-cart">
        <span class="empty-icon">🛒</span>
        <p class="empty-title">Keranjang Masih Kosong</p>
        <p class="empty-desc">Ketuk produk di sebelah kiri untuk menimbang dan menambah belanjaan.</p>
      </div>
    `;
    el.btnClearCart.style.display = 'none';
    el.btnCheckout.disabled = true;
    el.totalWeightText.textContent = '0.00 kg';
    el.totalAmountText.textContent = 'Rp 0';
    updateTabletCartIndicators(0, 0, 0);
    updateProductCardInCartBadges();
    return;
  }

  el.btnClearCart.style.display = 'inline-flex';
  el.btnCheckout.disabled = false;

  let totalWeight = 0;
  let totalAmount = 0;

  el.cartItemsList.innerHTML = state.cart.map((item, index) => {
    totalWeight += item.qty;
    totalAmount += item.subtotal;

    const itemName = (item.product && (item.product.name || item.product.product_name || item.product.nama)) || 'Komoditas';

    return `
      <div class="cart-item-card">
        <div class="cart-item-top">
          <div class="item-info">
            <span class="item-title">${escapeHtml(itemName)}</span>
            <span class="item-badge ${item.priceMode === 'karungan' ? 'karungan' : 'eceran'}">${item.priceMode === 'karungan' ? '📦 Karung' : '🛒 Ecer'}</span>
            ${item.isCustomPrice ? '<span class="custom-price-pill">Nego</span>' : ''}
          </div>
          <div class="cart-item-top-right">
            <span class="item-subtotal">${formatRupiah(item.subtotal)}</span>
            <button class="btn-remove-item" data-index="${index}" title="Hapus">✕</button>
          </div>
        </div>

        <!-- Pilihan 2 Harga Kasir: Eceran vs Karungan -->
        <div class="cart-price-mode-pills">
          <button type="button" 
                  class="btn-price-mode ${item.priceMode !== 'karungan' ? 'active-eceran' : ''}" 
                  data-set-mode="eceran" 
                  data-index="${index}"
                  title="Gunakan Harga Eceran">
            🛒 Ecer: <strong>${formatRupiah(item.product.retail_price)}</strong>
          </button>
          <button type="button" 
                  class="btn-price-mode ${item.priceMode === 'karungan' ? 'active-karungan' : ''}" 
                  data-set-mode="karungan" 
                  data-index="${index}"
                  title="Gunakan Harga Karungan & Isi Kuantitas">
            📦 Karung: <strong>${formatRupiah(item.product.reseller_price)}</strong>
          </button>
        </div>
        ${item.priceMode === 'karungan' ? `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
          <button type="button" class="btn-open-karung-modal" data-open-karung-modal="${index}" title="Klik untuk isi / sesuaikan kuantitas karung">
            📦 Berat Karung: <strong>${item.qty} ${item.product.unit}</strong> <span style="font-size:10.5px; opacity:0.85;">(Isi Kg ✏️)</span>
          </button>
        </div>` : ''}

        <div class="cart-item-bottom">
          <div class="qty-control">
            <button class="btn-qty btn-minus" data-index="${index}" title="Kurang 1 kg">-1</button>
            <button class="btn-qty btn-mini-step" data-step="-0.1" data-index="${index}" title="Kurang 1 ons (-0.1 kg)">-0.1</button>
            <input type="text" inputmode="decimal" class="input-qty font-mono" data-index="${index}" value="${item.qty}" placeholder="1.15" title="Ketik berat (1.15) atau uang (10rb)">
            <button class="btn-qty btn-mini-step" data-step="0.1" data-index="${index}" title="Tambah 1 ons (+0.1 kg)">+0.1</button>
            <button class="btn-qty btn-plus" data-index="${index}" title="Tambah 1 kg">+1</button>
            <button class="btn-scale-cart" data-scale-index="${index}" title="Kalkulator Timbangan Lengkap">⚖️</button>
          </div>
          <div class="item-pricing-calc">
            <button type="button" class="btn-edit-item-price" data-price-index="${index}" title="Klik untuk sesuaikan tarif satuan / nego">
              ✏️ @${formatRupiah(item.unitPrice)}/${item.product.unit}${item.isCustomPrice ? ' <span class="custom-price-pill">Nego</span>' : ''}
              ${item.fixedMoney ? ' <span style="color:#059669;font-weight:700;font-size:11px;">(Pas)</span>' : ''}
            </button>
          </div>
        </div>

        <!-- Bar Kuantitas Cepat: Khusus Karungan vs Eceran -->
        ${item.priceMode === 'karungan' ? `
        <div class="item-quick-seadanya item-quick-karungan">
          <span class="quick-seadanya-lbl" style="color:#065f46;">Kuantitas:</span>
          <button type="button" class="btn-karung-pill ${item.qty === 10 ? 'active' : ''}" data-set-karung="10" data-index="${index}">10 kg</button>
          <button type="button" class="btn-karung-pill ${item.qty === 20 ? 'active' : ''}" data-set-karung="20" data-index="${index}">20 kg</button>
          <button type="button" class="btn-karung-pill ${item.qty === 25 ? 'active' : ''}" data-set-karung="25" data-index="${index}">25 kg</button>
          <button type="button" class="btn-karung-pill ${item.qty === 50 ? 'active' : ''}" data-set-karung="50" data-index="${index}">50 kg</button>
          <button type="button" class="btn-karung-pill" data-delta-karung="25" data-index="${index}">+25 kg</button>
          <button type="button" class="btn-karung-pill" data-delta-karung="50" data-index="${index}">+50 kg</button>
          <button type="button" class="btn-karung-pill btn-karung-open-modal" data-open-karung-modal="${index}">📦 Isi Berat...</button>
        </div>` : `
        <div class="item-quick-seadanya">
          <span class="quick-seadanya-lbl">Seadanya:</span>
          <button class="btn-seadanya-pill" data-set-weight="0.5" data-index="${index}">½ kg</button>
          <button class="btn-seadanya-pill" data-set-weight="1" data-index="${index}">1 kg</button>
          <button class="btn-seadanya-pill" data-delta-weight="0.1" data-index="${index}">+1 ons (+0.1)</button>
          <button class="btn-seadanya-pill" data-delta-weight="0.15" data-index="${index}">+1.5 ons (+0.15)</button>
          <button class="btn-seadanya-pill" data-delta-weight="0.2" data-index="${index}">+2 ons (+0.2)</button>
          <button class="btn-seadanya-pill pill-money" data-set-money="10000" data-index="${index}">💵 10rb</button>
          <button class="btn-seadanya-pill pill-money" data-set-money="15000" data-index="${index}">💵 15rb</button>
          <button class="btn-seadanya-pill pill-money" data-set-money="20000" data-index="${index}">💵 20rb</button>
        </div>`}
      </div>
    `;
  }).join('');

  el.totalWeightText.textContent = `${totalWeight.toFixed(2)} kg`;
  el.totalAmountText.textContent = formatRupiah(totalAmount);
  updateTabletCartIndicators(state.cart.length, totalWeight, totalAmount);

  // Bind cart item controls
  el.cartItemsList.querySelectorAll('.btn-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.index);
      state.cart[idx].fixedMoney = null; // Clear fixed money when adjusting weight
      if (state.cart[idx].qty > 1) {
        state.cart[idx].qty = Math.round((state.cart[idx].qty - 1) * 100) / 100;
      } else {
        state.cart.splice(idx, 1);
      }
      renderCart();
    });
  });

  el.cartItemsList.querySelectorAll('.btn-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.index);
      state.cart[idx].fixedMoney = null; // Clear fixed money when adjusting weight
      state.cart[idx].qty = Math.round((state.cart[idx].qty + 1) * 100) / 100;
      renderCart();
    });
  });

  // Mini step buttons (-0.1 and +0.1)
  el.cartItemsList.querySelectorAll('.btn-mini-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.index);
      state.cart[idx].fixedMoney = null; // Clear fixed money when adjusting weight
      const step = parseFloat(btn.dataset.step);
      let newQty = Math.round((state.cart[idx].qty + step) * 100) / 100;
      if (newQty >= 0.05) {
        state.cart[idx].qty = newQty;
        renderCart();
      }
    });
  });

  // Smart input-qty: supports direct decimal (1.15) OR money shortcuts (10rb, 15rb)
  el.cartItemsList.querySelectorAll('.input-qty').forEach(input => {
    input.addEventListener('change', (e) => {
      const idx = Number(input.dataset.index);
      const raw = input.value.trim().toLowerCase();

      if (raw.endsWith('rb') || raw.endsWith('k') || raw.endsWith('jt')) {
        const money = parseRupiahInput(raw);
        state.cart[idx].fixedMoney = money; // Exact round nominal!
      } else {
        state.cart[idx].fixedMoney = null; // Pure weight entered
        const val = parseFloat(raw.replace(',', '.'));
        if (!isNaN(val) && val > 0) {
          state.cart[idx].qty = Math.round(val * 100) / 100;
        }
      }
      renderCart();
    });
  });

  // Quick Seadanya pill buttons
  el.cartItemsList.querySelectorAll('.btn-seadanya-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.index);
      const item = state.cart[idx];
      if (!item) return;

      if (btn.dataset.setWeight) {
        item.fixedMoney = null;
        item.qty = parseFloat(btn.dataset.setWeight);
      } else if (btn.dataset.deltaWeight) {
        item.fixedMoney = null;
        const delta = parseFloat(btn.dataset.deltaWeight);
        item.qty = Math.round((item.qty + delta) * 100) / 100;
      } else if (btn.dataset.setMoney) {
        // EXACT MONEY NOMINAL (e.g. 10.000 / 15.000)
        item.fixedMoney = Number(btn.dataset.setMoney);
      }

      renderCart();
    });
  });

  // Quick Karungan pill buttons (10kg, 20kg, 25kg, 50kg, +25kg, +50kg)
  el.cartItemsList.querySelectorAll('.btn-karung-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.index);
      const item = state.cart[idx];
      if (!item) return;

      if (btn.dataset.setKarung) {
        item.fixedMoney = null;
        item.qty = parseFloat(btn.dataset.setKarung);
        recalculateCart();
        renderCart();
      } else if (btn.dataset.deltaKarung) {
        item.fixedMoney = null;
        const delta = parseFloat(btn.dataset.deltaKarung);
        item.qty = Math.round((item.qty + delta) * 100) / 100;
        recalculateCart();
        renderCart();
      }
    });
  });

  // Buttons to open Karung Quantity Modal
  el.cartItemsList.querySelectorAll('[data-open-karung-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.openKarungModal);
      openKarungQtyModal(idx);
    });
  });

  // 2-Harga Selector (Pilihan Kasir: Eceran vs Karungan)
  el.cartItemsList.querySelectorAll('.btn-price-mode').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.index);
      const mode = btn.dataset.setMode;
      const item = state.cart[idx];
      if (!item) return;

      const wasAlreadyKarung = item.priceMode === 'karungan';
      item.priceMode = mode;
      item.tier = mode === 'karungan' ? 'karungan' : 'retail';
      item.customUnitPrice = null; // Reset custom nego back to selected standard tier

      if (mode === 'karungan') {
        // If it was currently at 1 kg (default), set to 25 kg
        if (item.qty <= 1) {
          item.qty = (item.product.wholesale_min_qty && Number(item.product.wholesale_min_qty) > 1) 
            ? Number(item.product.wholesale_min_qty) 
            : 25;
        }
        recalculateCart();
        renderCart();
        // Immediately open Karung Quantity modal so cashier can fill in its quantity!
        openKarungQtyModal(idx);
      } else {
        recalculateCart();
        renderCart();
      }
    });
  });

  el.cartItemsList.querySelectorAll('[data-scale-index]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.scaleIndex);
      const item = state.cart[idx];
      if (item) openScaleModal(item.product, item.qty, idx);
    });
  });

  // Edit item unit price in cart (Nego / Custom Rate)
  el.cartItemsList.querySelectorAll('[data-price-index]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.priceIndex);
      openEditCartPriceModal(idx);
    });
  });

  el.cartItemsList.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.index);
      state.cart.splice(idx, 1);
      renderCart();
    });
  });

  updateProductCardInCartBadges();
}

// -----------------------------------------------------------------------------
// TABLET UI / UX ERGONOMICS & VIEW SWITCHER
// -----------------------------------------------------------------------------
function updateTabletCartIndicators(itemCount, totalWeight, totalAmount) {
  if (el.tabletCartCountBadge) {
    el.tabletCartCountBadge.textContent = itemCount;
  }
  if (el.tabletCartTotalBadge) {
    el.tabletCartTotalBadge.textContent = formatRupiah(totalAmount);
  }
  if (el.floatingCartBadge) {
    el.floatingCartBadge.textContent = itemCount;
  }
  if (el.floatingCartWeightText) {
    el.floatingCartWeightText.textContent = `${totalWeight.toFixed(2)} kg`;
  }
  if (el.floatingCartAmountText) {
    el.floatingCartAmountText.textContent = formatRupiah(totalAmount);
  }
  if (el.tabletFloatingCartBar) {
    const isViewingCart = el.posContainer && el.posContainer.classList.contains('view-cart');
    if (itemCount > 0 && !isViewingCart) {
      el.tabletFloatingCartBar.classList.add('show');
    } else {
      el.tabletFloatingCartBar.classList.remove('show');
    }
  }
}

function switchTabletView(viewName) {
  if (!el.posContainer) return;
  if (viewName === 'cart') {
    el.posContainer.classList.add('view-cart');
    if (el.tabCartView) el.tabCartView.classList.add('active');
    if (el.tabCatalogView) el.tabCatalogView.classList.remove('active');
    if (el.tabletFloatingCartBar) el.tabletFloatingCartBar.classList.remove('show');
  } else {
    el.posContainer.classList.remove('view-cart');
    if (el.tabCatalogView) el.tabCatalogView.classList.add('active');
    if (el.tabCartView) el.tabCartView.classList.remove('active');
    if (state.cart.length > 0 && el.tabletFloatingCartBar) {
      el.tabletFloatingCartBar.classList.add('show');
    }
  }
}

function initTabletViewSwitcher() {
  if (el.tabCatalogView) {
    el.tabCatalogView.addEventListener('click', () => switchTabletView('catalog'));
  }
  if (el.tabCartView) {
    el.tabCartView.addEventListener('click', () => switchTabletView('cart'));
  }
  if (el.btnOpenCartDrawer) {
    el.btnOpenCartDrawer.addEventListener('click', () => switchTabletView('cart'));
  }
  if (el.btnFloatingCheckout) {
    el.btnFloatingCheckout.addEventListener('click', () => {
      switchTabletView('cart');
      if (state.cart.length > 0) {
        openPaymentModal();
      }
    });
  }
}

// -----------------------------------------------------------------------------
// HEADER SUB-MENUS & DROPDOWNS
// -----------------------------------------------------------------------------
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
    backdrop.addEventListener('click', (e) => {
      e.preventDefault();
      closeAllDropdowns();
    });
    backdrop.addEventListener('touchstart', (e) => {
      e.preventDefault();
      closeAllDropdowns();
    }, { passive: false });
  }

  // Close dropdown when clicking any item inside either menu
  document.querySelectorAll('.header-dropdown-menu .header-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      closeAllDropdowns();
    });
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.header-dropdown')) {
      closeAllDropdowns();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllDropdowns();
    }
  });

  // Reposition on window resize if open
  window.addEventListener('resize', () => {
    if (storeDropdown?.classList.contains('active')) positionDropdownOnMobile(storeDropdown);
    if (userDropdown?.classList.contains('active')) positionDropdownOnMobile(userDropdown);
  });
}

function openEditCartPriceModal(idx) {
  const item = state.cart[idx];
  if (!item) return;

  state.activeEditCartPriceIndex = idx;
  const p = item.product;

  el.editCartItemName.textContent = `Ubah Tarif: ${p.name}`;
  el.editCartWeightText.textContent = `${item.qty.toFixed(2)} ${p.unit}`;
  el.editCartStandardRate.innerHTML = `Ecer: <strong>${formatRupiah(p.retail_price)}</strong> | Karungan: <strong>${formatRupiah(p.reseller_price)}</strong>`;

  const currentRate = item.unitPrice || Number(p.retail_price);
  el.inpEditCartNewRate.value = formatRupiahNumber(currentRate);

  // Quick rate presets chips
  const retailP = Number(p.retail_price);
  const resellerP = Number(p.reseller_price);
  const presets = [
    { label: `Ecer (${formatRupiah(retailP)})`, val: retailP },
    { label: `Karungan (${formatRupiah(resellerP)})`, val: resellerP }
  ];

  // Common nearby round steps (e.g. -1000, -500, +500, +1000)
  const nearbySteps = [retailP - 1000, retailP - 500, retailP + 500, retailP + 1000].filter(v => v > 0 && v !== retailP && v !== resellerP);
  nearbySteps.forEach(v => {
    presets.push({ label: formatRupiah(v), val: v });
  });

  el.editCartRatePresets.innerHTML = presets.map(pr => `
    <button type="button" class="btn-rate-preset" data-val="${pr.val}" style="padding: 6px 13px; font-size: 12.5px; font-family: var(--font-mono); font-weight: 700; border-radius: 8px; background: #f1f5f9; border: 1.5px solid #cbd5e1; color: #0f172a; cursor: pointer; transition: all 0.15s ease;">
      ${pr.label}
    </button>
  `).join('');

  el.editCartRatePresets.querySelectorAll('.btn-rate-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = Number(btn.dataset.val);
      el.inpEditCartNewRate.value = formatRupiahNumber(v);
      updateEditCartPreview();
    });
  });

  updateEditCartPreview();

  el.modalEditCartPrice.style.display = 'flex';
  el.inpEditCartNewRate.focus();
  el.inpEditCartNewRate.select();
}

function updateEditCartPreview() {
  if (state.activeEditCartPriceIndex === null) return;
  const item = state.cart[state.activeEditCartPriceIndex];
  if (!item) return;

  const newRate = parseRupiahInput(el.inpEditCartNewRate.value);
  const previewSubtotal = Math.round((item.qty * newRate) / 100) * 100;
  el.editCartNewSubtotalText.textContent = formatRupiah(previewSubtotal);
}

function openKarungQtyModal(idx) {
  const item = state.cart[idx];
  if (!item) return;

  state.activeKarungModalIndex = idx;
  const p = item.product;

  if (el.karungModalItemName) el.karungModalItemName.textContent = `Isi Kuantitas Karung: ${p.name}`;
  if (el.karungModalSubtitle) el.karungModalSubtitle.textContent = `Tentukan total berat atau isi karung untuk ${p.name}.`;
  if (el.karungModalUnitPriceText) el.karungModalUnitPriceText.textContent = `${formatRupiah(p.reseller_price)} / ${p.unit}`;
  if (el.karungModalStockText) el.karungModalStockText.textContent = `${p.stock_qty} ${p.unit}`;

  // Default weight logic:
  // If item.qty is still <= 1 (default when adding 1 item), default to standard 25 kg
  let initWeight = 25;
  if (item.qty && item.qty > 1) {
    initWeight = item.qty;
  } else if (p.wholesale_min_qty && Number(p.wholesale_min_qty) > 1) {
    initWeight = Number(p.wholesale_min_qty);
  }

  if (el.inpKarungTotalKg) el.inpKarungTotalKg.value = initWeight;

  // Initialize Karung multiplier
  if (el.inpKarungCount && el.selKgPerKarung) {
    if (initWeight % 50 === 0) {
      el.inpKarungCount.value = Math.max(1, initWeight / 50);
      el.selKgPerKarung.value = '50';
    } else if (initWeight % 25 === 0) {
      el.inpKarungCount.value = Math.max(1, initWeight / 25);
      el.selKgPerKarung.value = '25';
    } else if (initWeight % 20 === 0) {
      el.inpKarungCount.value = Math.max(1, initWeight / 20);
      el.selKgPerKarung.value = '20';
    } else if (initWeight % 10 === 0) {
      el.inpKarungCount.value = Math.max(1, initWeight / 10);
      el.selKgPerKarung.value = '10';
    } else {
      el.inpKarungCount.value = 1;
      el.selKgPerKarung.value = '25';
    }
  }

  updateKarungModalPreview();

  if (el.modalKarungQty) {
    el.modalKarungQty.style.display = 'flex';
  }
  if (el.inpKarungTotalKg) {
    el.inpKarungTotalKg.focus();
    el.inpKarungTotalKg.select();
  }
}

function updateKarungModalPreview() {
  if (state.activeKarungModalIndex === null) return;
  const item = state.cart[state.activeKarungModalIndex];
  if (!item) return;

  const p = item.product;
  const totalKg = parseFloat(el.inpKarungTotalKg.value) || 0;
  const rate = Number(p.reseller_price);
  const subtotal = Math.round((totalKg * rate) / 100) * 100;

  if (el.previewKarungKgText) el.previewKarungKgText.textContent = `${totalKg.toFixed(2)} ${p.unit}`;
  if (el.previewKarungRateText) el.previewKarungRateText.textContent = formatRupiah(rate);
  if (el.previewKarungSubtotalText) el.previewKarungSubtotalText.textContent = formatRupiah(subtotal);

  // Update preset button active highlight
  document.querySelectorAll('.btn-karung-preset').forEach(btn => {
    const w = parseFloat(btn.dataset.weight);
    if (w === totalKg) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function getCartTotal() {
  return state.cart.reduce((sum, item) => sum + item.subtotal, 0);
}

// -----------------------------------------------------------------------------
// CHECKOUT & PAYMENT
// -----------------------------------------------------------------------------
function openPaymentModal() {
  if (!state.shift) {
    showToast('Shift kasir belum aktif! Buka shift terlebih dahulu.', 'warning');
    showOpenShiftModal();
    return;
  }

  const total = getCartTotal();
  el.payModalTotal.textContent = formatRupiah(total);
  el.cashTenderedInput.value = '';
  el.changeDueText.textContent = 'Rp 0';
  if (el.tempoCustomerNameInput) el.tempoCustomerNameInput.value = '';
  if (el.tempoCustomerPhoneInput) el.tempoCustomerPhoneInput.value = '';
  if (el.tempoDpInput) el.tempoDpInput.value = '';

  document.querySelectorAll('.btn-method').forEach(b => {
    b.classList.toggle('active', b.dataset.method === state.paymentMethod);
  });

  if (state.paymentMethod === 'cash') {
    el.cashPaymentSection.style.display = 'block';
    el.nonCashPaymentSection.style.display = 'none';
    if (el.tempoPaymentSection) el.tempoPaymentSection.style.display = 'none';
  } else if (state.paymentMethod === 'tempo') {
    el.cashPaymentSection.style.display = 'none';
    el.nonCashPaymentSection.style.display = 'none';
    if (el.tempoPaymentSection) {
      el.tempoPaymentSection.style.display = 'block';
      updateTempoCalculation();
    }
  } else {
    el.cashPaymentSection.style.display = 'none';
    el.nonCashPaymentSection.style.display = 'block';
    if (el.tempoPaymentSection) el.tempoPaymentSection.style.display = 'none';
  }

  el.paymentModal.style.display = 'flex';
  if (state.paymentMethod === 'cash') {
    el.cashTenderedInput.focus();
  } else if (state.paymentMethod === 'tempo' && el.tempoCustomerNameInput) {
    setTimeout(() => el.tempoCustomerNameInput.focus(), 60);
  }
}

function updateTempoCalculation() {
  const total = getCartTotal();
  if (el.tempoTotalAmount) {
    el.tempoTotalAmount.textContent = formatRupiah(total);
  }
  if (el.tempoDueDateInput && !el.tempoDueDateInput.value) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    el.tempoDueDateInput.value = d.toISOString().split('T')[0];
  }

  const rawDp = el.tempoDpInput ? el.tempoDpInput.value.replace(/[^0-9]/g, '') : '';
  const dp = Number(rawDp) || 0;
  const remaining = Math.max(0, total - dp);

  if (el.tempoDpAmount) {
    el.tempoDpAmount.textContent = formatRupiah(dp);
  }
  if (el.tempoRemainingAmount) {
    el.tempoRemainingAmount.textContent = formatRupiah(remaining);
  }
}

function calculateChangeDue() {
  const total = getCartTotal();
  const tendered = parseRupiahInput(el.cashTenderedInput.value);
  const change = Math.max(0, tendered - total);
  el.changeDueText.textContent = formatRupiah(change);
}

async function handleProcessOrder() {
  const total = getCartTotal();
  let buyerName = 'Pelanggan Umum';
  let buyerPhone = '';

  if (state.paymentMethod === 'tempo') {
    buyerName = el.tempoCustomerNameInput ? el.tempoCustomerNameInput.value.trim() : '';
    buyerPhone = el.tempoCustomerPhoneInput ? el.tempoCustomerPhoneInput.value.trim() : '';

    if (!buyerName) {
      showToast('Wajib memasukkan nama pembeli yang kasbon / berhutang!', 'error');
      if (el.tempoCustomerNameInput) el.tempoCustomerNameInput.focus();
      return;
    }
    if (!buyerPhone) {
      showToast('Wajib memasukkan nomor HP pembeli agar jelas siapa yang berhutang!', 'error');
      if (el.tempoCustomerPhoneInput) el.tempoCustomerPhoneInput.focus();
      return;
    }
  }

  let tendered = total;
  if (state.paymentMethod === 'cash') {
    tendered = parseRupiahInput(el.cashTenderedInput.value);
    if (tendered < total) {
      showToast(`Uang tunai kurang! Tagihan: ${formatRupiah(total)}`, 'error');
      return;
    }
  } else if (state.paymentMethod === 'tempo') {
    const rawDp = el.tempoDpInput ? el.tempoDpInput.value.replace(/[^0-9]/g, '') : '';
    tendered = Number(rawDp) || 0;
  }

  // Cari apakah ada data pelanggan yang cocok berdasarkan nama/no HP
  let matchedCustomerId = null;
  if (state.customers && buyerName) {
    const found = state.customers.find(c => 
      (buyerPhone && c.phone === buyerPhone) || 
      c.name.toLowerCase() === buyerName.toLowerCase()
    );
    if (found) matchedCustomerId = found.id;
  }

  const orderPayload = {
    shift_id: state.shift.id,
    customer_id: matchedCustomerId,
    customer_name: buyerName,
    customer_phone: buyerPhone,
    payment_method: state.paymentMethod,
    cash_tendered: tendered,
    due_date: state.paymentMethod === 'tempo' && el.tempoDueDateInput ? el.tempoDueDateInput.value : null,
    items: state.cart.map(item => ({
      product_id: item.product.id,
      product_name: item.product.name,
      qty: item.qty,
      unit_price: item.unitPrice,
      price_tier: item.priceMode === 'karungan' ? 'karungan' : 'retail',
      is_custom_price: item.isCustomPrice || false,
      cost_price: Number(item.product.cost_price || 0),
      subtotal: item.subtotal
    }))
  };

  try {
    el.btnProcessPayment.disabled = true;
    el.btnProcessPayment.textContent = 'Memproses...';

    let orderResult = null;
    let isOfflineSaved = false;

    // 1. Try online createOrder first if connected
    if (navigator.onLine) {
      try {
        const res = await api.createOrder(orderPayload);
        orderResult = res.order;
        // Save in local outbox with synced status
        await enqueueOrderLocal({ ...orderResult, status: 'synced' });
      } catch (netErr) {
        console.warn('Online order failed, falling back to offline storage:', netErr.message);
        isOfflineSaved = true;
      }
    } else {
      isOfflineSaved = true;
    }

    // 2. OFFLINE FALLBACK ENGINE
    if (isOfflineSaved || !orderResult) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const rand = Math.floor(1000 + Math.random() * 9000);
      const offlineOrderNo = `TR-${yyyy}${mm}${dd}-OFF-${rand}`;

      const totalBill = state.cart.reduce((sum, item) => sum + item.subtotal, 0);

      orderResult = {
        ...orderPayload,
        order_no: offlineOrderNo,
        total_amount: totalBill,
        change_due: Math.max(0, (tendered || totalBill) - totalBill),
        status: state.paymentMethod === 'tempo' ? 'tempo' : 'completed',
        cashier_name: state.user ? state.user.name : 'Kasir',
        customer_name: buyerName,
        customer_phone: buyerPhone,
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };

      // Save to IndexedDB outbox
      await enqueueOrderLocal(orderResult);

      // Deduct stock locally
      for (const itm of state.cart) {
        await deductProductStockLocal(itm.product.id, itm.qty);
        const prod = state.products.find(p => p.id === itm.product.id);
        if (prod) prod.stock_qty = Math.max(0, Number(prod.stock_qty) - Number(itm.qty));
      }

      // Trigger silent background sync in case connection was restored
      syncEngine.syncNow({ silent: true });
    }

    el.paymentModal.style.display = 'none';

    // Show thermal receipt
    if (el.receiptModalTitle) el.receiptModalTitle.textContent = 'Transaksi Berhasil';
    if (el.btnNextOrder) el.btnNextOrder.textContent = 'Transaksi Baru Berikutnya';
    state.lastCompletedOrder = orderResult;
    state.lastOrderIsReprint = false;
    renderThermalReceipt(orderResult, false);
    el.receiptModal.style.display = 'flex';

    // Auto-open Panda cash drawer on Cash or Tempo payment
    if (hardwareManager.config.autoDrawer && (orderResult.payment_method === 'cash' || orderResult.payment_method === 'tempo')) {
      hardwareManager.kickCashDrawer().catch(e => console.warn('[Hardware] Auto drawer kick error:', e));
    }

    // Reset Cart & refresh products
    state.cart = [];
    renderCart();
    renderProductGrid();

    if (isOfflineSaved) {
      showToast('Transaksi disimpan di tablet (Offline)! Otomatis terkirim saat ada sinyal.', 'success');
    } else {
      showToast('Transaksi berhasil!', 'success');
    }
  } catch (err) {
    showToast('Gagal memproses transaksi: ' + err.message, 'error');
  } finally {
    el.btnProcessPayment.disabled = false;
    el.btnProcessPayment.textContent = 'Konfirmasi & Cetak Struk (Enter)';
  }
}

function renderThermalReceipt(order, isReprint = false) {
  const dateStr = parseSafeDate(order.created_at).toLocaleString('id-ID');

  const itemsHtml = (order.items || []).map(i => {
    const formattedQty = Number(i.qty).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
    const formattedUnitPrice = Number(i.unit_price).toLocaleString('id-ID');
    const formattedSubtotal = Number(i.subtotal).toLocaleString('id-ID');
    return `
      <div class="receipt-row">
        <span>${i.product_name} (${formattedQty} kg @${formattedUnitPrice})</span>
        <span class="font-bold">${formattedSubtotal}</span>
      </div>
    `;
  }).join('');

  const sName = (state.settings && state.settings.store_name) || 'PD. HASIL BUMI RAYA 1';
  const sTagline = (state.settings && state.settings.store_tagline) || 'Pusat Umbi, Bawang & Komoditas';
  const sAddress = (state.settings && state.settings.store_address) || '';
  const sPhone = (state.settings && state.settings.store_phone) || '';
  const sFooter = (state.settings && state.settings.receipt_footer) || '*** TERIMA KASIH ***\nBarang yang sudah dibeli telah ditimbang akurat.';

  el.thermalReceipt.innerHTML = `
    <div class="receipt-header">
      <div class="receipt-title">${sName}</div>
      <div>${sTagline}</div>
      ${sAddress ? `<div style="font-size:11px; margin-top:2px;">${sAddress}</div>` : ''}
      ${sPhone ? `<div style="font-size:11px;">Telp/WA: ${sPhone}</div>` : ''}
      ${isReprint ? '<div class="receipt-reprint-tag">*** SALINAN / CETAK ULANG ***</div>' : ''}
      ${order.payment_method === 'tempo' ? '<div class="receipt-reprint-tag" style="background:#000; color:#fff; font-weight:800; padding:2px 0; margin:4px 0; text-align:center;">*** NOTA KASBON / TEMPO ***</div><div style="font-weight:700; color:#b91c1c;">STATUS: BELUM LUNAS</div>' : ''}
      <div>Nota: ${order.order_no}</div>
      <div>Waktu: ${dateStr}</div>
      <div>Kasir: ${order.cashier_name || (state.user ? state.user.name : 'Kasir')}</div>
      <div>Pembeli: ${order.customer_name || 'Pelanggan Umum'}${order.customer_phone ? ` (HP: ${order.customer_phone})` : ''}</div>
      ${order.due_date ? `<div>Jatuh Tempo: ${order.due_date}</div>` : ''}
    </div>
    <div class="receipt-divider"></div>
    ${itemsHtml}
    <div class="receipt-divider"></div>
    <div class="receipt-row bold">
      <span>TOTAL TAGIHAN</span>
      <span>${formatRupiah(order.total_amount)}</span>
    </div>
    ${order.payment_method === 'tempo' ? `
      <div class="receipt-row">
        <span>Uang Muka (DP)</span>
        <span>${formatRupiah(order.cash_tendered || 0)}</span>
      </div>
      <div class="receipt-row bold" style="font-size:13px; margin-top:2px;">
        <span>SISA KASBON</span>
        <span>${formatRupiah(Math.max(0, Number(order.total_amount) - Number(order.cash_tendered || 0)))}</span>
      </div>
    ` : `
      <div class="receipt-row">
        <span>Bayar (${(order.payment_method || 'CASH').toUpperCase()})</span>
        <span>${formatRupiah(order.cash_tendered)}</span>
      </div>
      <div class="receipt-row">
        <span>Kembali</span>
        <span>${formatRupiah(order.change_due)}</span>
      </div>
    `}
    <div class="receipt-divider"></div>
    <div class="receipt-footer">
      ${sFooter.split('\n').map(line => `<p>${line}</p>`).join('')}
    </div>
  `;
}

// -----------------------------------------------------------------------------
// BLIND CLOSE SHIFT
// -----------------------------------------------------------------------------
function openCloseShiftModal() {
  if (!state.shift) {
    showToast('Tidak ada shift aktif yang bisa ditutup.', 'warning');
    return;
  }
  ['d100k', 'd50k', 'd20k', 'd10k', 'dKoin'].forEach(id => document.getElementById(id).value = '0');
  el.closingNotes.value = '';
  recalculateBlindCashTotal();
  el.closeShiftModal.style.display = 'flex';
}

function recalculateBlindCashTotal() {
  const d100 = (Number(document.getElementById('d100k').value) || 0) * 100000;
  const d50 = (Number(document.getElementById('d50k').value) || 0) * 50000;
  const d20 = (Number(document.getElementById('d20k').value) || 0) * 20000;
  const d10 = (Number(document.getElementById('d10k').value) || 0) * 10000;
  const dKoin = Number(document.getElementById('dKoin').value) || 0;

  document.getElementById('sub100k').textContent = formatRupiah(d100);
  document.getElementById('sub50k').textContent = formatRupiah(d50);
  document.getElementById('sub20k').textContent = formatRupiah(d20);
  document.getElementById('sub10k').textContent = formatRupiah(d10);
  document.getElementById('subKoin').textContent = formatRupiah(dKoin);

  const total = d100 + d50 + d20 + d10 + dKoin;
  el.totalCountedText.textContent = formatRupiah(total);
  return { total, breakdown: { d100, d50, d20, d10, dKoin } };
}

async function handleSubmitBlindClose() {
  const { total, breakdown } = recalculateBlindCashTotal();
  if (total <= 0) {
    if (!confirm('Uang fisik dihitung Rp 0. Apakah Anda yakin ingin melanjutkan tutup kasir?')) {
      return;
    }
  }

  try {
    el.btnSubmitBlindClose.disabled = true;
    el.btnSubmitBlindClose.textContent = 'Menyimpan...';

    const res = await api.closeShift(
      state.shift.id,
      total,
      breakdown,
      el.closingNotes.value
    );

    el.closeShiftModal.style.display = 'none';
    const sum = res.summary;
    const isBalanced = sum.is_balanced;
    const diff = sum.cash_difference;

    let alertMsg = `Shift Kasir Berhasil Ditutup!\nTotal Fisik: ${formatRupiah(sum.actual_cash_input)}`;
    if (isBalanced) {
      alertMsg += '\nStatus: KAS BALANCE (Sesuai Sistem)';
    } else if (diff < 0) {
      alertMsg += `\n⚠️ PERHATIAN: Selisih KURANG ${formatRupiah(Math.abs(diff))} (Tercatat ke Log Owner)`;
    } else {
      alertMsg += `\nStatus: Selisih LEBIH ${formatRupiah(diff)}`;
    }

    alert(alertMsg);
    await syncShift();
  } catch (err) {
    showToast('Gagal menutup shift: ' + err.message, 'error');
  } finally {
    el.btnSubmitBlindClose.disabled = false;
    el.btnSubmitBlindClose.textContent = 'Kirim & Tutup Shift Sekarang';
  }
}

// -----------------------------------------------------------------------------
// WASTE / SUSUT
// -----------------------------------------------------------------------------
function openWasteModal() {
  if (state.products.length === 0) return;
  el.wasteProductSelect.innerHTML = state.products.map(p => `
    <option value="${p.id}">${p.name} (Stok: ${p.stock_qty} kg)</option>
  `).join('');
  el.wasteQtyInput.value = '';
  el.wasteNotesInput.value = '';
  el.wasteModal.style.display = 'flex';
}

async function handleSubmitWaste() {
  const prodId = Number(el.wasteProductSelect.value);
  const type = el.wasteTypeSelect.value;
  const qty = parseFloat(el.wasteQtyInput.value);
  const notes = el.wasteNotesInput.value;

  if (isNaN(qty) || qty <= 0) {
    showToast('Masukkan berat kg yang valid', 'error');
    return;
  }

  try {
    el.btnSubmitWaste.disabled = true;
    let savedOffline = false;

    if (navigator.onLine) {
      try {
        await api.recordWaste(prodId, state.shift ? state.shift.id : null, type, qty, notes);
      } catch (e) {
        savedOffline = true;
      }
    } else {
      savedOffline = true;
    }

    if (savedOffline) {
      await enqueueAdjustmentLocal({
        product_id: prodId,
        shift_id: state.shift ? state.shift.id : null,
        user_id: state.user ? state.user.id : 1,
        type,
        qty_kg: qty,
        notes,
        created_at: new Date().toISOString()
      });
      await deductProductStockLocal(prodId, qty);
      syncEngine.syncNow({ silent: true });
    }

    el.wasteModal.style.display = 'none';
    showToast(`Catatan ${type} sebesar ${qty} kg berhasil disimpan${savedOffline ? ' (Lokal)' : ''}!`, 'success');
    await loadInitialData();
  } catch (err) {
    showToast('Gagal mencatat susut: ' + err.message, 'error');
  } finally {
    el.btnSubmitWaste.disabled = false;
  }
}

// -----------------------------------------------------------------------------
// HISTORY & STRICT VOID
// -----------------------------------------------------------------------------
function getLocalDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function updateHistoryDatePills() {
  const currentVal = el.historyDateFilter ? el.historyDateFilter.value : '';
  const todayStr = getLocalDateStr();
  const yObj = new Date();
  yObj.setDate(yObj.getDate() - 1);
  const yesterdayStr = getLocalDateStr(yObj);

  const setPillStyle = (btn, isActive) => {
    if (!btn) return;
    if (isActive) {
      btn.style.background = '#3b82f6';
      btn.style.color = '#ffffff';
      btn.style.borderColor = '#3b82f6';
      btn.style.fontWeight = '700';
    } else {
      btn.style.background = '#ffffff';
      btn.style.color = '#475569';
      btn.style.borderColor = '#cbd5e1';
      btn.style.fontWeight = '600';
    }
  };

  setPillStyle(el.btnFilterToday, currentVal === todayStr);
  setPillStyle(el.btnFilterYesterday, currentVal === yesterdayStr);
  setPillStyle(el.btnFilterAllDates, currentVal === '');
}

async function openHistoryModal() {
  el.historyModal.style.display = 'flex';
  el.historyTableBody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 24px;">Memuat data riwayat...</td></tr>';

  // Default to today's date if empty or not set
  const todayStr = getLocalDateStr();
  if (el.historyDateFilter && !el.historyDateFilter.value) {
    el.historyDateFilter.value = todayStr;
  }
  updateHistoryDatePills();

  try {
    let orders = [];
    if (navigator.onLine) {
      try {
        const res = await api.getOrders();
        orders = res.orders || [];
      } catch (e) {
        console.warn('Gagal ambil riwayat online, membaca lokal...');
      }
    }

    // Merge with local offline orders
    const localOrders = await getAllLocalOrders();
    const existingOrderNos = new Set(orders.map(o => o.order_no));
    for (const lo of localOrders) {
      if (!existingOrderNos.has(lo.order_no)) {
        orders.unshift(lo);
      }
    }

    state.allOrdersHistory = orders;
    renderFilteredHistoryTable();
  } catch (err) {
    el.historyTableBody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 24px; color: #dc2626;">Gagal memuat: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderFilteredHistoryTable() {
  const allOrders = state.allOrdersHistory || [];
  const selectedDate = el.historyDateFilter ? el.historyDateFilter.value : '';
  const searchQ = (el.historySearchInput ? el.historySearchInput.value : '').toLowerCase().trim();

  const filtered = allOrders.filter(o => {
    if (selectedDate) {
      const orderDate = getLocalDateStr(parseSafeDate(o.created_at));
      if (orderDate !== selectedDate) return false;
    }
    if (searchQ) {
      const noMatch = (o.order_no || '').toLowerCase().includes(searchQ);
      const custMatch = (o.customer_name || '').toLowerCase().includes(searchQ);
      const payMatch = (o.payment_method || '').toLowerCase().includes(searchQ);
      if (!noMatch && !custMatch && !payMatch) return false;
    }
    return true;
  });

  // Calculate live summary
  const totalAmount = filtered.reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0);
  const todayStr = getLocalDateStr();
  const yObj = new Date();
  yObj.setDate(yObj.getDate() - 1);
  const yesterdayStr = getLocalDateStr(yObj);

  let summaryLabel = '';
  if (selectedDate === todayStr) {
    summaryLabel = `Menampilkan ${filtered.length} transaksi Hari Ini • Total: ${formatRupiah(totalAmount)}`;
  } else if (selectedDate === yesterdayStr) {
    summaryLabel = `Menampilkan ${filtered.length} transaksi Kemarin • Total: ${formatRupiah(totalAmount)}`;
  } else if (selectedDate) {
    summaryLabel = `Menampilkan ${filtered.length} transaksi (${selectedDate}) • Total: ${formatRupiah(totalAmount)}`;
  } else {
    summaryLabel = `Menampilkan semua (${filtered.length} transaksi) • Total: ${formatRupiah(totalAmount)}`;
  }
  if (el.historySummaryText) {
    el.historySummaryText.textContent = summaryLabel;
  }

  if (filtered.length === 0) {
    el.historyTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 32px 16px; color: #94a3b8; font-size: 13px;">
          Tidak ada transaksi ${selectedDate ? `pada tanggal ${selectedDate}` : ''} ${searchQ ? `dengan kata kunci "${escapeHtml(searchQ)}"` : ''}.
        </td>
      </tr>
    `;
    return;
  }

  el.historyTableBody.innerHTML = filtered.map(o => {
    const isCompleted = o.status === 'completed';
    const timeStr = parseSafeDate(o.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const statusLabel = o.status === 'completed' ? 'Selesai' : (o.status === 'void' ? 'Batal' : o.status);

    return `
      <tr>
        <td><strong>${escapeHtml(o.order_no)}</strong></td>
        <td>${timeStr}</td>
        <td>${escapeHtml(o.customer_name || 'Umum')}</td>
        <td>${escapeHtml((o.payment_method || 'cash').toUpperCase())}</td>
        <td><strong>${formatRupiah(o.total_amount)}</strong></td>
        <td><span class="status-badge ${o.status}">${statusLabel}</span></td>
        <td>
          <div style="display:inline-flex; gap:6px; align-items:center;">
            <button class="btn-table-print" data-id="${o.id}" data-no="${escapeHtml(o.order_no)}" title="Cetak Ulang Struk Thermal">
              🖨️ Cetak
            </button>
            ${isCompleted ? `<button class="btn-table-void" data-id="${o.id}" data-no="${escapeHtml(o.order_no)}">Batalkan</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Re-bind Reprint Receipt buttons
  el.historyTableBody.querySelectorAll('.btn-table-print').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.id;
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '⏳ Memuat...';

      try {
        const res = await api.getOrder(orderId);
        if (!res.order) throw new Error('Data transaksi tidak ditemukan');

        state.lastCompletedOrder = res.order;
        state.lastOrderIsReprint = true;
        renderThermalReceipt(res.order, true);
        if (el.receiptModalTitle) el.receiptModalTitle.textContent = 'Cetak Ulang Struk (Salinan)';
        if (el.btnNextOrder) el.btnNextOrder.textContent = 'Kembali ke Riwayat';
        el.receiptModal.style.zIndex = '1300';
        el.receiptModal.style.display = 'flex';
      } catch (err) {
        showToast('Gagal memuat struk: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  });

  el.historyTableBody.querySelectorAll('.btn-table-void').forEach(btn => {
    btn.addEventListener('click', () => {
      state.pendingVoidOrder = {
        id: btn.dataset.id,
        orderNo: btn.dataset.no
      };
      el.voidOrderNo.value = state.pendingVoidOrder.orderNo;
      el.voidReasonInput.value = '';
      el.voidOwnerPinInput.value = '';
      el.voidAuthModal.style.display = 'flex';
    });
  });
}

// -----------------------------------------------------------------------------
// INACTIVITY AUTO-LOCK & MANUAL LOCK SYSTEM (10 MENIT)
// -----------------------------------------------------------------------------
let lockInactivityTimer = null;
const LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 menit

function resetLockTimer() {
  clearTimeout(lockInactivityTimer);
  if (state.user && el.modalLockScreen && el.modalLockScreen.style.display !== 'flex') {
    lockInactivityTimer = setTimeout(() => {
      lockPosScreen('auto');
    }, LOCK_TIMEOUT_MS);
  }
}

function initLockInactivityListeners() {
  const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
  events.forEach(evt => {
    window.addEventListener(evt, () => {
      resetLockTimer();
    }, { passive: true });
  });
  resetLockTimer();
}

function lockPosScreen(reason = 'manual') {
  if (!state.user) return;
  clearTimeout(lockInactivityTimer);
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

async function unlockPosScreen() {
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
          state.token = res.token;
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
      resetLockTimer();
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

function initLockScreenEvents() {
  if (el.btnManualLock) {
    el.btnManualLock.addEventListener('click', () => {
      const userDropdown = document.getElementById('userMenuDropdown');
      if (userDropdown) userDropdown.classList.remove('active');
      lockPosScreen('manual');
    });
  }

  if (el.btnUnlockScreen) {
    el.btnUnlockScreen.addEventListener('click', unlockPosScreen);
  }

  if (el.inpLockPin) {
    el.inpLockPin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        unlockPosScreen();
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
        if (el.modalLockScreen) el.modalLockScreen.style.display = 'none';
        api.clearSession();
        state.user = null;
        state.shift = null;
        el.activeCashierName.textContent = 'Belum Login';
        el.activeShiftMeta.textContent = 'Shift Belum Dibuka';
        showLoginModal();
        showToast('Berhasil keluar. Silakan masukkan PIN untuk bertugas.', 'info');
      }
    });
  }
}

async function handleConfirmVoid() {
  const ownerPin = el.voidOwnerPinInput.value.trim();
  const reason = el.voidReasonInput.value.trim();

  if (!ownerPin || !reason) {
    showToast('PIN Owner dan alasan pembatalan wajib diisi', 'error');
    return;
  }

  try {
    el.btnConfirmVoid.disabled = true;
    const res = await api.voidOrder(state.pendingVoidOrder.id, ownerPin, reason);
    el.voidAuthModal.style.display = 'none';
    showToast(res.message, 'success');
    await openHistoryModal(); // Refresh table
    await loadInitialData(); // Refresh product stock
  } catch (err) {
    showToast('Gagal membatalkan transaksi: ' + err.message, 'error');
  } finally {
    el.btnConfirmVoid.disabled = false;
  }
}

// Run App on DOM load

// -----------------------------------------------------------------------------
// BUKU PIUTANG KASIR & MANAJEMEN KASBON LENGKAP
// -----------------------------------------------------------------------------
async function openCashierDebtsModal() {
  if (el.cashierDebtsModal) {
    el.cashierDebtsModal.style.display = 'flex';
    await loadCashierDebts();
  }
}

async function loadCashierDebts() {
  if (!el.cashierDebtsTableBody) return;

  try {
    el.cashierDebtsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 25px; color: #94a3b8;">Memuat data piutang...</td></tr>';

    const searchVal = el.searchCashierDebt ? el.searchCashierDebt.value.trim() : '';
    const res = await api.getDebts({
      status: state.cashierDebtFilter || 'unpaid',
      search: searchVal
    });

    if (!res.success) {
      el.cashierDebtsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #ef4444;">Gagal memuat: ${res.message}</td></tr>`;
      return;
    }

    state.cashierDebts = res.debts || [];

    if (state.cashierDebts.length === 0) {
      el.cashierDebtsTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 30px; color: #94a3b8;">
            🎉 Tidak ada tagihan piutang pada filter "${state.cashierDebtFilter || 'unpaid'}".
          </td>
        </tr>
      `;
      return;
    }

    el.cashierDebtsTableBody.innerHTML = state.cashierDebts.map(d => {
      const orderDate = parseSafeDate(d.order_date).toLocaleString('id-ID', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });

      let dueDateFormatted = '-';
      if (d.due_date) {
        const parts = d.due_date.split('-');
        if (parts.length === 3) {
          dueDateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }

      const isPaid = Number(d.remaining_amount) <= 0;

      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px 14px;">
            <strong style="color: #0f172a; font-family: monospace; font-size: 13.5px;">${d.order_no}</strong>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${orderDate}</div>
          </td>
          <td style="padding: 12px 14px;">
            <strong style="color: #0f172a; font-size: 14px;">${d.customer_name}</strong>
            <div style="font-size: 12px; color: #047857; font-weight: 600; margin-top: 2px;">📞 ${d.customer_phone || '-'}</div>
          </td>
          <td style="padding: 12px 14px; text-align: right; color: #475569; font-family: monospace; font-weight: 600;">${formatRupiah(d.total_amount)}</td>
          <td style="padding: 12px 14px; text-align: right; font-weight: 800; color: ${isPaid ? '#047857' : '#b45309'}; font-family: monospace; font-size: 13.5px;">
            ${formatRupiah(d.remaining_amount)}
          </td>
          <td style="padding: 12px 14px; text-align: center; font-size: 12px; color: ${d.is_overdue ? '#dc2626' : '#334155'}; font-weight: ${d.is_overdue ? '800' : '600'};">
            ${dueDateFormatted}
            ${d.is_overdue ? '<div style="color: #dc2626; font-size: 11px; font-weight: 800; margin-top: 2px;">⚠️ Lewat Tempo</div>' : ''}
            ${isPaid ? '<div style="color: #047857; font-size: 11px; font-weight: 800; margin-top: 2px;">✅ Lunas</div>' : ''}
          </td>
          <td style="padding: 12px 14px; text-align: center;">
            <div style="display: inline-flex; gap: 6px; align-items: center;">
              <button class="btn-debt-action btn-debt-detail btn-open-detail-debt" data-debt-id="${d.id}" title="Lihat detail belanja & riwayat bayar">
                👁️ Detail
              </button>
              <button class="btn-debt-action btn-debt-edit btn-open-edit-debt" data-debt-id="${d.id}" title="Edit kontak pembeli atau tagihan">
                ✏️ Edit
              </button>
              ${!isPaid ? `
                <button class="btn-debt-action btn-debt-pay btn-pay-cashier-debt" data-debt-id="${d.id}" title="Catat pembayaran cicilan/lunas">
                  💵 Bayar
                </button>
              ` : `
                <span class="badge-debt-lunas">Lunas</span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    el.cashierDebtsTableBody.querySelectorAll('.btn-open-detail-debt').forEach(btn => {
      btn.addEventListener('click', () => {
        openDetailDebtModal(Number(btn.dataset.debtId));
      });
    });

    el.cashierDebtsTableBody.querySelectorAll('.btn-open-edit-debt').forEach(btn => {
      btn.addEventListener('click', () => {
        openEditDebtModal(Number(btn.dataset.debtId));
      });
    });

    el.cashierDebtsTableBody.querySelectorAll('.btn-pay-cashier-debt').forEach(btn => {
      btn.addEventListener('click', () => {
        openPayCashierDebtModal(Number(btn.dataset.debtId));
      });
    });
  } catch (err) {
    el.cashierDebtsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #ef4444;">Terjadi kesalahan: ${err.message}</td></tr>`;
  }
}

// Detail Piutang Modal
async function openDetailDebtModal(debtId) {
  state.activeDetailDebtId = debtId;
  if (!el.modalDetailDebt) return;

  el.modalDetailDebt.style.display = 'flex';
  if (el.detailDebtCustomerName) el.detailDebtCustomerName.textContent = 'Memuat rincian...';
  if (el.detailDebtItemsBody) el.detailDebtItemsBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:12px; color:#94a3b8;">Memuat data...</td></tr>';
  if (el.detailDebtPaymentsBody) el.detailDebtPaymentsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:12px; color:#94a3b8;">Memuat data...</td></tr>';

  try {
    const res = await api.getDebtDetail(debtId);
    if (!res.success) {
      showToast('Gagal memuat detail piutang: ' + res.message, 'error');
      return;
    }
    const d = res.debt;

    if (el.detailDebtSubtitle) el.detailDebtSubtitle.textContent = `Nota: ${d.order_no} • Kasbon Pelanggan`;
    if (el.detailDebtCustomerName) el.detailDebtCustomerName.textContent = d.customer_name;
    if (el.detailDebtCustomerPhone) el.detailDebtCustomerPhone.textContent = d.customer_phone || '-';

    if (el.detailDebtWhatsAppLink) {
      if (d.customer_phone) {
        let cleanPhone = d.customer_phone.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
        el.detailDebtWhatsAppLink.href = `https://wa.me/${cleanPhone}?text=Halo%20${encodeURIComponent(d.customer_name)},%20ini%20informasi%20tagihan%20nota%20${encodeURIComponent(d.order_no)}%20sebesar%20${encodeURIComponent(formatRupiah(d.remaining_amount))}`;
        el.detailDebtWhatsAppLink.style.display = 'inline';
      } else {
        el.detailDebtWhatsAppLink.style.display = 'none';
      }
    }

    if (el.detailDebtOrderNo) el.detailDebtOrderNo.textContent = d.order_no;
    if (el.detailDebtDueDate) {
      let dueDateFormatted = '-';
      if (d.due_date) {
        const parts = d.due_date.split('-');
        if (parts.length === 3) dueDateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      el.detailDebtDueDate.textContent = dueDateFormatted;
    }

    if (el.detailDebtStatusBadge) {
      if (d.remaining_amount <= 0) {
        el.detailDebtStatusBadge.textContent = '✅ Sudah Lunas';
        el.detailDebtStatusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        el.detailDebtStatusBadge.style.color = '#34d399';
      } else if (d.is_overdue) {
        el.detailDebtStatusBadge.textContent = '⚠️ Lewat Tempo';
        el.detailDebtStatusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
        el.detailDebtStatusBadge.style.color = '#ef4444';
      } else if (d.paid_amount > 0) {
        el.detailDebtStatusBadge.textContent = '🪙 Cicilan Berjalan';
        el.detailDebtStatusBadge.style.background = 'rgba(56, 189, 248, 0.2)';
        el.detailDebtStatusBadge.style.color = '#38bdf8';
      } else {
        el.detailDebtStatusBadge.textContent = '⏳ Belum Lunas';
        el.detailDebtStatusBadge.style.background = 'rgba(245, 158, 11, 0.2)';
        el.detailDebtStatusBadge.style.color = '#f59e0b';
      }
    }

    if (el.detailDebtTotalAmount) el.detailDebtTotalAmount.textContent = formatRupiah(d.total_amount);
    if (el.detailDebtPaidAmount) el.detailDebtPaidAmount.textContent = formatRupiah(d.paid_amount);
    if (el.detailDebtRemainingAmount) el.detailDebtRemainingAmount.textContent = formatRupiah(d.remaining_amount);

    if (el.btnTriggerPayFromDetail) {
      el.btnTriggerPayFromDetail.style.display = d.remaining_amount > 0 ? 'inline-block' : 'none';
    }

    // Render items
    if (el.detailDebtItemsBody) {
      if (!d.items || d.items.length === 0) {
        el.detailDebtItemsBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:14px; color:#64748b;">Item nota tidak ditemukan.</td></tr>';
      } else {
        el.detailDebtItemsBody.innerHTML = d.items.map(item => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 12px; color: #0f172a; font-weight: 700;">${item.product_name}</td>
            <td style="padding: 8px 12px; text-align: right; color: #475569; font-weight: 600;">${item.qty_kg} kg</td>
            <td style="padding: 8px 12px; text-align: right; color: #64748b; font-family: monospace;">${formatRupiah(item.unit_price)}</td>
            <td style="padding: 8px 12px; text-align: right; color: #0f172a; font-weight: 800; font-family: monospace;">${formatRupiah(item.subtotal)}</td>
          </tr>
        `).join('');
      }
    }

    // Render payments
    if (el.detailDebtPaymentsBody) {
      if (!d.payments || d.payments.length === 0) {
        el.detailDebtPaymentsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:14px; color:#64748b;">Belum ada catatan cicilan atau pelunasan.</td></tr>';
      } else {
        el.detailDebtPaymentsBody.innerHTML = d.payments.map(p => {
          const dateStr = parseSafeDate(p.payment_date).toLocaleString('id-ID', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
          });
          return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 12px; color: #475569; font-size: 12px;">${dateStr}</td>
              <td style="padding: 8px 12px; text-align: right; font-weight: 800; color: #047857; font-family: monospace;">${formatRupiah(p.amount_paid)}</td>
              <td style="padding: 8px 12px; text-transform: uppercase; color: #64748b; font-weight: 600; font-size: 11px;">${p.payment_method}</td>
              <td style="padding: 8px 12px; color: #0f172a; font-weight: 600;">${p.recorded_by_name || 'Kasir'}</td>
              <td style="padding: 8px 12px; color: #64748b;">${p.notes || '-'}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    showToast('Terjadi kesalahan memuat detail: ' + err.message, 'error');
  }
}

// Edit Piutang Modal
function openEditDebtModal(debtId) {
  const debt = state.cashierDebts.find(d => d.id === debtId);
  if (!debt) return;

  if (el.editDebtId) el.editDebtId.value = debt.id;
  if (el.editDebtOrderNo) el.editDebtOrderNo.value = debt.order_no;
  if (el.editDebtCustomerName) el.editDebtCustomerName.value = debt.customer_name || '';
  if (el.editDebtCustomerPhone) el.editDebtCustomerPhone.value = debt.customer_phone || '';
  if (el.editDebtDueDate) el.editDebtDueDate.value = debt.due_date || '';
  if (el.editDebtRemainingAmount) el.editDebtRemainingAmount.value = debt.remaining_amount;
  if (el.editDebtNotes) el.editDebtNotes.value = debt.notes || '';

  if (el.editDebtSubtitle) {
    el.editDebtSubtitle.textContent = `Nota: ${debt.order_no} • Total Awal: ${formatRupiah(debt.total_amount)}`;
  }

  if (el.modalEditDebt) {
    el.modalEditDebt.style.display = 'flex';
  }
}

async function handleSaveEditDebt() {
  const debtId = el.editDebtId ? el.editDebtId.value : null;
  if (!debtId) return;

  const customerName = el.editDebtCustomerName.value.trim();
  const customerPhone = el.editDebtCustomerPhone.value.trim();
  const dueDate = el.editDebtDueDate.value;
  const remainingAmount = Number(el.editDebtRemainingAmount.value);
  const notes = el.editDebtNotes.value.trim();

  if (!customerName) {
    showToast('Nama pembeli/pelanggan tidak boleh kosong!', 'error');
    el.editDebtCustomerName.focus();
    return;
  }

  if (isNaN(remainingAmount) || remainingAmount < 0) {
    showToast('Sisa hutang tidak valid!', 'error');
    el.editDebtRemainingAmount.focus();
    return;
  }

  try {
    el.btnSaveEditDebt.disabled = true;
    el.btnSaveEditDebt.textContent = 'Menyimpan...';

    const res = await api.updateDebt(debtId, {
      customer_name: customerName,
      customer_phone: customerPhone,
      due_date: dueDate,
      remaining_amount: remainingAmount,
      notes: notes
    });

    if (res.success) {
      showToast('Data piutang & kontak pembeli berhasil diperbarui!', 'success');
      el.modalEditDebt.style.display = 'none';
      await loadCashierDebts();
      if (state.activeDetailDebtId === Number(debtId) && el.modalDetailDebt && el.modalDetailDebt.style.display === 'flex') {
        openDetailDebtModal(Number(debtId));
      }
    } else {
      showToast('Gagal update piutang: ' + res.message, 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan: ' + err.message, 'error');
  } finally {
    el.btnSaveEditDebt.disabled = false;
    el.btnSaveEditDebt.textContent = 'Simpan Perubahan';
  }
}

// -----------------------------------------------------------------------------
// KATALOG & MARGIN LABA (KASIR & ADMIN KIOS)
// -----------------------------------------------------------------------------
function openCatalogMarginModal() {
  if (!el.modalCatalogMargin) return;
  el.modalCatalogMargin.style.display = 'flex';
  renderCatalogMarginTable();
}

function renderCatalogMarginTable() {
  if (!el.catalogMarginTableBody) return;
  const q = el.searchCatalogMarginInput ? el.searchCatalogMarginInput.value.toLowerCase().trim() : '';

  const prods = state.products.filter(p => !q || p.name.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q)));

  if (prods.length === 0) {
    el.catalogMarginTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 25px; color: #94a3b8;">Tidak ada komoditas yang cocok dengan pencarian.</td></tr>';
    return;
  }

  el.catalogMarginTableBody.innerHTML = prods.map(p => {
    const cost = Number(p.cost_price) || 0;
    const retail = Number(p.retail_price) || 0;
    const karung = Number(p.reseller_price) || 0;

    const marginEcer = retail - cost;
    const pctEcer = cost > 0 ? ((marginEcer / cost) * 100).toFixed(1) : 0;

    const marginKarung = karung - cost;
    const pctKarung = cost > 0 ? ((marginKarung / cost) * 100).toFixed(1) : 0;

    const stock = Number(p.stock_qty) || 0;
    const isLow = stock <= (p.min_stock_alert || 15);

    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px 14px;">
          <div style="font-weight: 700; color: #0f172a; font-size: 14px;">
            ${p.image_emoji || '🥔'} ${p.name}
          </div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; margin-top: 2px;">
            Kategori: ${p.category || 'Umbi'} • Satuan: ${p.unit || 'kg'}
          </div>
          <div style="margin-top: 5px; font-size: 11.5px; display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
            ${p.last_restock_date ? `
              <span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 1.5px 7px; border-radius: 6px; font-weight: 600;">
                📅 Masuk: ${parseSafeDate(p.last_restock_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <span style="background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; padding: 1.5px 7px; border-radius: 6px; font-weight: 700;">
                👤 ${escapeHtml(p.last_supplier_name || 'Supplier')} (+${Number(p.last_restock_qty || 0).toLocaleString('id-ID')} ${p.unit || 'kg'})
              </span>
            ` : `
              <span style="color: #94a3b8; font-style: italic; font-size: 11px;">📦 Belum ada riwayat kulakan</span>
            `}
          </div>
        </td>
        <td style="padding: 12px 14px; text-align: right;">
          <strong style="color: ${isLow ? '#dc2626' : '#0f172a'}; font-size: 14px;">
            ${stock.toLocaleString('id-ID')}
          </strong>
          <span style="font-size: 11.5px; color: #64748b;">${p.unit || 'kg'}</span>
          ${isLow ? '<div style="font-size: 10px; color: #dc2626; font-weight: 800; margin-top: 2px;">⚠️ Menipis</div>' : ''}
        </td>
        <td style="padding: 12px 14px; text-align: right; color: #b45309; font-weight: 800; font-family: monospace; font-size: 13.5px;">
          ${formatRupiah(cost)}
        </td>
        <td style="padding: 12px 14px; text-align: right; color: #047857; font-weight: 800; font-family: monospace; font-size: 13.5px;">
          ${formatRupiah(retail)}
        </td>
        <td style="padding: 12px 14px; text-align: center;">
          <div class="margin-badge-pill ecer">
            <span>+${formatRupiah(marginEcer)}</span>
            <small style="opacity: 0.9;">(${pctEcer}%)</small>
          </div>
        </td>
        <td style="padding: 12px 14px; text-align: right; color: #0369a1; font-weight: 800; font-family: monospace; font-size: 13.5px;">
          ${formatRupiah(karung)}
        </td>
        <td style="padding: 12px 14px; text-align: center;">
          <div class="margin-badge-pill karung">
            <span>+${formatRupiah(marginKarung)}</span>
            <small style="opacity: 0.9;">(${pctKarung}%)</small>
          </div>
        </td>
        <td style="padding: 12px 14px; text-align: center;">
          <div style="display: inline-flex; gap: 6px;">
            <button class="btn-debt-action btn-debt-detail btn-cat-history-row" data-id="${p.id}" title="Lihat riwayat tanggal masuk & nama juragan supplier" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">
              📜 Riwayat
            </button>
            <button class="btn-debt-action btn-debt-detail btn-cat-restock-row" data-id="${p.id}" title="Tambah stok kulakan masuk">
              📦 +Stok
            </button>
            <button class="btn-debt-action btn-debt-edit btn-cat-edit-row" data-id="${p.id}" title="Edit harga kulakan, eceran & karungan">
              ✏️ Edit
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  el.catalogMarginTableBody.querySelectorAll('.btn-cat-history-row').forEach(btn => {
    btn.addEventListener('click', () => {
      openCashierProductRestockHistoryModal(Number(btn.dataset.id));
    });
  });

  el.catalogMarginTableBody.querySelectorAll('.btn-cat-edit-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const prod = state.products.find(p => p.id === Number(btn.dataset.id));
      if (prod) openEditProductModal(prod);
    });
  });

  el.catalogMarginTableBody.querySelectorAll('.btn-cat-restock-row').forEach(btn => {
    btn.addEventListener('click', () => {
      openRestockModal(Number(btn.dataset.id));
    });
  });
}

// -----------------------------------------------------------------------------
// MODAL: RIWAYAT STOK MASUK KOMODITAS (KASIR)
// -----------------------------------------------------------------------------
let currentCashierRestockHistoryProductId = null;

async function openCashierProductRestockHistoryModal(productId) {
  currentCashierRestockHistoryProductId = productId;
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  if (el.modalProductRestockHistoryCashier) {
    el.modalProductRestockHistoryCashier.style.display = 'flex';
  }

  if (el.cashierProdRestockIconBadge) el.cashierProdRestockIconBadge.textContent = prod.image_emoji || '📦';
  if (el.cashierProdRestockModalTitle) el.cashierProdRestockModalTitle.textContent = `Riwayat Stok Masuk: ${prod.name}`;
  if (el.cashierProdRestockModalSubtitle) {
    el.cashierProdRestockModalSubtitle.textContent = `Kategori: ${(prod.category || 'umbi').toUpperCase()} • Satuan: ${prod.unit || 'kg'} • Modal Saat Ini: ${formatRupiah(prod.cost_price)}`;
  }

  if (el.cashierStatCurrentStock) el.cashierStatCurrentStock.textContent = `${Number(prod.stock_qty || 0).toLocaleString('id-ID')} ${prod.unit || 'kg'}`;
  if (el.cashierStatTotalReceived) el.cashierStatTotalReceived.textContent = 'Memuat...';
  if (el.cashierStatEntriesCount) el.cashierStatEntriesCount.textContent = '...';

  if (el.cashierProdRestockTableBody) {
    el.cashierProdRestockTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 25px; color: #64748b;">Memuat riwayat barang masuk...</td></tr>';
  }

  try {
    const res = await api.getProductRestockHistory(productId);
    if (!res || !res.success) throw new Error(res?.message || 'Gagal memuat riwayat');

    const summary = res.summary || {};
    const purchases = res.purchases || [];

    if (el.cashierStatTotalReceived) {
      el.cashierStatTotalReceived.textContent = `${(Number(summary.total_qty_received) || 0).toLocaleString('id-ID')} ${prod.unit || 'kg'}`;
    }
    if (el.cashierStatEntriesCount) {
      el.cashierStatEntriesCount.textContent = `${summary.total_entries || 0}x Kulakan Masuk`;
    }

    if (purchases.length === 0) {
      el.cashierProdRestockTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 35px 20px; color: #64748b;">
            <div style="font-size: 30px; margin-bottom: 6px;">📦</div>
            <strong style="color: #0f172a; font-size: 14px;">Belum Ada Riwayat Kulakan Masuk</strong>
            <p style="margin: 4px 0 0 0; font-size: 12.5px;">Klik tombol "+ Tambah Stok Kulakan" untuk mencatat pasokan barang masuk dari juragan.</p>
          </td>
        </tr>
      `;
      return;
    }

    el.cashierProdRestockTableBody.innerHTML = purchases.map(p => {
      const timeFormatted = parseSafeDate(p.created_at).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      let statusBadge = '<span style="font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #ecfdf5; color: #065f46; font-weight: 700;">🟢 Lunas</span>';
      if (p.remaining_amount > 0) {
        statusBadge = `<span style="font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #fffbeb; color: #b45309; font-weight: 700;">⏳ Tempo (${formatRupiah(p.remaining_amount)})</span>`;
      }

      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-weight: 600; color: #0f172a; white-space: nowrap;">
            📅 ${timeFormatted}
          </td>
          <td style="padding: 10px 12px;">
            <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700;">${p.purchase_no || '-'}</code>
          </td>
          <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">
            👤 ${escapeHtml(p.supplier_name || 'Tanpa Nama / Non-Supplier')}
            ${p.supplier_phone ? `<span style="font-size: 11px; color: #64748b; font-weight: 400; display: block;">📞 ${p.supplier_phone}</span>` : ''}
          </td>
          <td style="padding: 10px 12px; text-align: right; font-weight: 800; color: #059669; font-family: monospace; white-space: nowrap;">
            +${Number(p.qty_kg).toLocaleString('id-ID')} ${prod.unit || 'kg'}
          </td>
          <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-weight: 600; color: #475569; white-space: nowrap;">
            ${formatRupiah(p.cost_price)}
          </td>
          <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a; white-space: nowrap;">
            ${formatRupiah(p.total_cost)}
          </td>
          <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
            ${statusBadge}
          </td>
          <td style="padding: 10px 12px; font-size: 12px; color: #64748b; white-space: nowrap;">
            ${escapeHtml(p.recorded_by_name || 'Kasir')}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error fetching cashier restock history:', err);
    if (el.cashierProdRestockTableBody) {
      el.cashierProdRestockTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #dc2626; padding: 20px;">Gagal: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

if (el.btnCloseCashierProdRestockModal) {
  el.btnCloseCashierProdRestockModal.addEventListener('click', () => {
    if (el.modalProductRestockHistoryCashier) el.modalProductRestockHistoryCashier.style.display = 'none';
  });
}
if (el.btnCloseCashierProdRestockModalFooter) {
  el.btnCloseCashierProdRestockModalFooter.addEventListener('click', () => {
    if (el.modalProductRestockHistoryCashier) el.modalProductRestockHistoryCashier.style.display = 'none';
  });
}
if (el.btnCashierQuickRestockFromHistory) {
  el.btnCashierQuickRestockFromHistory.addEventListener('click', () => {
    if (el.modalProductRestockHistoryCashier) el.modalProductRestockHistoryCashier.style.display = 'none';
    if (currentCashierRestockHistoryProductId) {
      openRestockModal(currentCashierRestockHistoryProductId);
    }
  });
}

function updateLiveMarginPreview() {
  const cost = Number(document.getElementById('editCostPrice').value) || 0;
  const retail = Number(document.getElementById('editRetailPrice').value) || 0;
  const karung = Number(document.getElementById('editResellerPrice').value) || 0;

  const marginEcer = retail - cost;
  const pctEcer = cost > 0 ? ((marginEcer / cost) * 100).toFixed(1) : 0;

  const marginKarung = karung - cost;
  const pctKarung = cost > 0 ? ((marginKarung / cost) * 100).toFixed(1) : 0;

  const elEcer = document.getElementById('previewMarginEcer');
  const elKarung = document.getElementById('previewMarginKarung');

  if (elEcer) {
    elEcer.textContent = `${marginEcer >= 0 ? '+' : ''}${formatRupiah(marginEcer)} / kg (${pctEcer}%)`;
    elEcer.style.color = marginEcer >= 0 ? '#047857' : '#dc2626';
  }
  if (elKarung) {
    elKarung.textContent = `${marginKarung >= 0 ? '+' : ''}${formatRupiah(marginKarung)} / kg (${pctKarung}%)`;
    elKarung.style.color = marginKarung >= 0 ? '#0369a1' : '#dc2626';
  }
}

function openPayCashierDebtModal(debtId) {
  const debt = state.cashierDebts.find(d => d.id === debtId);
  if (!debt) return;

  state.activeDebtForPayment = debt;
  if (el.payDebtCustomerSubtitle) {
    el.payDebtCustomerSubtitle.textContent = `${debt.customer_name} • Nota: ${debt.order_no}`;
  }
  if (el.payDebtRemainingText) {
    el.payDebtRemainingText.textContent = formatRupiah(debt.remaining_amount);
  }

  // Default to Full Pay
  if (el.btnDebtPayFull) {
    el.btnDebtPayFull.classList.add('active');
    el.btnDebtPayFull.style.background = '#10b981';
    el.btnDebtPayFull.style.color = '#fff';
  }
  if (el.btnDebtPayPartial) {
    el.btnDebtPayPartial.classList.remove('active');
    el.btnDebtPayPartial.style.background = 'rgba(255,255,255,0.08)';
    el.btnDebtPayPartial.style.color = '#e2e8f0';
  }

  if (el.payDebtAmountInput) {
    el.payDebtAmountInput.value = formatRupiah(debt.remaining_amount);
  }
  if (el.payDebtNotesInput) {
    el.payDebtNotesInput.value = '';
  }

  if (el.modalPayCashierDebt) {
    el.modalPayCashierDebt.style.display = 'flex';
  }
}

async function handleCashierPayDebtSubmit() {
  if (!state.activeDebtForPayment) return;

  const rawAmount = el.payDebtAmountInput.value.replace(/[^0-9]/g, '');
  const amount = Number(rawAmount);

  if (isNaN(amount) || amount <= 0) {
    showToast('Nominal pembayaran wajib diisi dan harus lebih dari Rp 0!', 'error');
    el.payDebtAmountInput.focus();
    return;
  }

  if (amount > state.activeDebtForPayment.remaining_amount) {
    showToast(`Nominal melebihi sisa hutang (${formatRupiah(state.activeDebtForPayment.remaining_amount)})!`, 'error');
    return;
  }

  const method = el.payDebtMethodSelect.value;
  const notes = el.payDebtNotesInput.value.trim();

  try {
    el.btnSubmitPayDebt.disabled = true;
    el.btnSubmitPayDebt.textContent = 'Menyimpan...';

    let savedOffline = false;
    let res = null;

    if (navigator.onLine) {
      try {
        res = await api.payDebt(state.activeDebtForPayment.id, {
          amount_paid: amount,
          payment_method: method,
          notes: notes
        });
      } catch (e) {
        savedOffline = true;
      }
    } else {
      savedOffline = true;
    }

    if (savedOffline) {
      await enqueueDebtPaymentLocal({
        debt_id: state.activeDebtForPayment.id,
        customer_id: state.activeDebtForPayment.customer_id,
        amount_paid: amount,
        payment_method: method,
        notes: notes,
        payment_date: new Date().toISOString()
      });
      syncEngine.syncNow({ silent: true });
      showToast('Pembayaran kasbon disimpan di tablet (Offline)!', 'success');
      el.modalPayCashierDebt.style.display = 'none';
    } else if (res && res.success) {
      showToast(res.message, 'success');
      el.modalPayCashierDebt.style.display = 'none';
      await loadCashierDebts();
      if (state.shift) await syncShift();
    } else {
      showToast('Gagal: ' + (res ? res.message : 'Kesalahan sistem'), 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan: ' + err.message, 'error');
  } finally {
    el.btnSubmitPayDebt.disabled = false;
    el.btnSubmitPayDebt.textContent = 'Simpan Pembayaran';
  }
}

window.addEventListener('DOMContentLoaded', initApp);


// Owner DOM Elements
el.btnOwnerPanel = document.getElementById('btnOwnerPanel');
el.ownerModal = document.getElementById('ownerModal');
el.btnCloseOwnerModal = document.getElementById('btnCloseOwnerModal');
el.btnCloseOwnerModalBottom = document.getElementById('btnCloseOwnerModalBottom');
el.btnRefreshOwnerData = document.getElementById('btnRefreshOwnerData');
el.editProductModal = document.getElementById('editProductModal');
el.btnCloseEditProduct = document.getElementById('btnCloseEditProduct');
el.btnCancelEditProduct = document.getElementById('btnCancelEditProduct');
el.btnSaveProductPrice = document.getElementById('btnSaveProductPrice');

// Tampilkan wewenang & tombol aksi sesuai peran pengguna
function updateRoleUI() {
  const isOwner = state.user && (state.user.role === 'owner' || state.user.role === 'admin');

  // Akses Langsung Panel Owner: Tampil terdepan & prestisius bagi Pak Haji / Owner
  if (el.btnOwnerPanel) {
    el.btnOwnerPanel.style.display = isOwner ? 'inline-flex' : 'none';
  }

  // Fasilitas Stok Opname & Edit Identitas Kios: Kasir bertindak sebagai admin kios
  if (el.btnCatalogMargin) {
    el.btnCatalogMargin.style.display = 'inline-flex';
  }
  if (el.btnStockOpname) {
    el.btnStockOpname.style.display = 'inline-flex';
  }
  if (el.btnEditIdentity) {
    el.btnEditIdentity.style.display = 'inline-flex';
  }
  if (el.btnDebtsModal) {
    el.btnDebtsModal.style.display = 'inline-flex';
  }

  // Sinkronisasi info profil kasir pada Sub-Menu Akun & Shift
  if (state.user) {
    const userDisplayNameEl = document.getElementById('dropdownUserDisplayName');
    const userRoleEl = document.getElementById('dropdownUserRole');
    if (userDisplayNameEl) userDisplayNameEl.textContent = state.user.name || 'Kasir (Admin)';
    if (userRoleEl) {
      const roleText = (state.user.role === 'owner') ? '👑 Owner / Pemilik Kios' :
                       (state.user.role === 'admin') ? 'Admin Kios' : 'Kasir Kios';
      userRoleEl.textContent = roleText;
    }
  }
}

// Owner Panel Event Bindings
el.btnOwnerPanel.addEventListener('click', () => { window.location.href = '/owner.html'; });
el.btnCloseOwnerModal.addEventListener('click', () => el.ownerModal.style.display = 'none');
el.btnCloseOwnerModalBottom.addEventListener('click', () => el.ownerModal.style.display = 'none');
el.btnRefreshOwnerData.addEventListener('click', loadOwnerDashboardData);

// Tab switching
document.querySelectorAll('.owner-tabs-bar .tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.owner-tabs-bar .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.owner-modal-body .tab-content').forEach(c => {
      c.classList.remove('active');
      c.style.display = 'none';
    });
    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.tab);
    if (target) {
      target.classList.add('active');
      target.style.display = 'block';
    }
  });
});

async function openOwnerModal() {
  el.ownerModal.style.display = 'flex';
  await loadOwnerDashboardData();
}

async function loadOwnerDashboardData() {
  try {
    const [dashRes, shiftRes, auditRes] = await Promise.all([
      api.getDashboardReport(),
      api.getShiftHistory(),
      api.getAuditLogs(20)
    ]);

    // 1. KPI Cards
    const summary = dashRes.summary;
    document.getElementById('kpiCashInDrawer').textContent = formatRupiah(summary.cash_in_drawer);
    document.getElementById('kpiTotalRevenue').textContent = formatRupiah(summary.total_revenue);
    document.getElementById('kpiTotalOrders').textContent = `${summary.total_orders} Nota Selesai (${summary.void_count} Dibatalkan)`;
    document.getElementById('kpiNonCash').textContent = formatRupiah(Number(summary.total_qris) + Number(summary.total_transfer));

    if (dashRes.active_shift) {
      document.getElementById('kpiActiveCashier').textContent = `Kasir Aktif: ${dashRes.active_shift.cashier_name} (Modal: ${formatRupiah(dashRes.active_shift.starting_cash)})`;
    } else {
      document.getElementById('kpiActiveCashier').textContent = 'Tidak ada shift kasir aktif';
    }

    // 2. Anti Fraud Ratio
    const fraud = dashRes.anti_fraud;
    const ratioFill = document.getElementById('ratioFill');
    const retailText = document.getElementById('retailRatioText');
    const resellerText = document.getElementById('resellerRatioText');
    const banner = document.getElementById('antiFraudBanner');
    const badge = document.getElementById('anomalyBadge');

    ratioFill.style.width = `${fraud.retail_percentage}%`;
    retailText.textContent = `Eceran: ${fraud.retail_percentage}%`;
    resellerText.textContent = `Grosir: ${fraud.reseller_percentage}%`;

    if (fraud.is_ratio_anomalous) {
      banner.className = 'anti-fraud-banner alert-danger';
      badge.className = 'badge-indicator danger';
      badge.textContent = '⚠️ WASPADA ANOMALI';
      document.getElementById('anomalyTip').innerHTML = '🚨 <strong>Peringatan:</strong> Penjualan grosir &gt; 75%. Kasir mungkin menjual eceran tapi menginput harga grosir untuk mengambil selisih uang!';
    } else {
      banner.className = 'anti-fraud-banner';
      badge.className = 'badge-indicator';
      badge.textContent = '🟢 NORMAL';
      document.getElementById('anomalyTip').innerHTML = 'ℹ️ Rasio penjualan wajar. Kasir tidak terindikasi memanipulasi tier harga.';
    }

    // 3. Shift History (Check shortages)
    const shifts = shiftRes.shifts || [];
    const shiftTbody = document.getElementById('shiftHistoryBody');
    if (shifts.length === 0) {
      shiftTbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada riwayat shift</td></tr>';
    } else {
      shiftTbody.innerHTML = shifts.map(s => {
        const isClosed = s.status === 'closed';
        const diff = Number(s.cash_difference) || 0;
        let diffBadge = '<span class="text-muted">Masih Berjalan</span>';
        if (isClosed) {
          if (diff === 0) diffBadge = '<span class="text-success">✅ BALANCE</span>';
          else if (diff < 0) diffBadge = `<span class="text-danger">⚠️ MINUS ${formatRupiah(Math.abs(diff))}</span>`;
          else diffBadge = `<span class="text-success">+ LEBIH ${formatRupiah(diff)}</span>`;
        }

        const endTimeStr = s.end_time ? new Date(s.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';

        return `
          <tr>
            <td>${endTimeStr}</td>
            <td><strong>${s.cashier_name}</strong></td>
            <td>${formatRupiah(s.system_cash || 0)}</td>
            <td>${formatRupiah(s.actual_cash || 0)}</td>
            <td>${diffBadge}</td>
          </tr>
        `;
      }).join('');
    }

    // 4. Products with Cost & Margin
    renderOwnerProductsTable();

    // 5. Audit logs
    const auditLogs = auditRes.logs || [];
    const auditTbody = document.getElementById('auditLogsTableBody');
    if (auditLogs.length === 0) {
      auditTbody.innerHTML = '<tr><td colspan="4" class="text-center">Belum ada rekaman audit</td></tr>';
    } else {
      auditTbody.innerHTML = auditLogs.map(a => {
        const time = new Date(a.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `
          <tr>
            <td>${time}</td>
            <td><strong>${a.user_name || 'Sistem'}</strong> (${a.user_role || '-'})</td>
            <td><code>${a.action}</code></td>
            <td><small>${a.details || '-'}</small></td>
          </tr>
        `;
      }).join('');
    }

  } catch (err) {
    showToast('Gagal memuat data owner: ' + err.message, 'error');
  }
}

function renderOwnerProductsTable() {
  const tbody = document.getElementById('ownerProductsTableBody');
  tbody.innerHTML = state.products.map(p => {
    const margin = Number(p.retail_price) - Number(p.cost_price);
    const marginReseller = Number(p.reseller_price) - Number(p.cost_price);

    return `
      <tr>
        <td><strong>${p.image_emoji} ${p.name}</strong></td>
        <td>${formatRupiah(p.cost_price)}</td>
        <td>${formatRupiah(p.retail_price)}</td>
        <td>${formatRupiah(p.reseller_price)}</td>
        <td>
          <span class="text-success">+${formatRupiah(margin)} (Ecer)</span><br>
          <small class="text-muted">+${formatRupiah(marginReseller)} (Karung)</small>
        </td>
        <td>
          <button class="btn-restock-row" data-id="${p.id}">📦 + Stok</button>
          <button class="btn-edit-price" data-id="${p.id}">✏️ Edit Harga</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-restock-row').forEach(btn => {
      btn.addEventListener('click', () => {
        openRestockModal(Number(btn.dataset.id));
      });
    });

    tbody.querySelectorAll('.btn-edit-price').forEach(btn => {
    btn.addEventListener('click', () => {
      const prod = state.products.find(p => p.id === Number(btn.dataset.id));
      if (prod) openEditProductModal(prod);
    });
  });
}

function openEditProductModal(p) {
  document.getElementById('editProductId').value = p.id;
  document.getElementById('editProductName').value = p.name;
  document.getElementById('editCostPrice').value = p.cost_price;
  document.getElementById('editRetailPrice').value = p.retail_price;
  document.getElementById('editResellerPrice').value = p.reseller_price;
  document.getElementById('editWholesaleQty').value = p.wholesale_min_qty || 10;
  updateLiveMarginPreview();
  el.editProductModal.style.display = 'flex';
}

el.btnCloseEditProduct.addEventListener('click', () => el.editProductModal.style.display = 'none');
el.btnCancelEditProduct.addEventListener('click', () => el.editProductModal.style.display = 'none');

el.btnSaveProductPrice.addEventListener('click', async () => {
  const id = document.getElementById('editProductId').value;
  const nameVal = document.getElementById('editProductName').value.trim();
  const payload = {
    name: nameVal || undefined,
    cost_price: Number(document.getElementById('editCostPrice').value),
    retail_price: Number(document.getElementById('editRetailPrice').value),
    reseller_price: Number(document.getElementById('editResellerPrice').value),
    wholesale_min_qty: Number(document.getElementById('editWholesaleQty').value)
  };

  try {
    el.btnSaveProductPrice.disabled = true;
    el.btnSaveProductPrice.textContent = 'Menyimpan...';
    await api.updateProduct(id, payload);
    el.editProductModal.style.display = 'none';
    showToast('Harga & margin komoditas berhasil diperbarui!', 'success');
    await loadInitialData();
    renderCatalogMarginTable();
    if (document.getElementById('ownerProductsTableBody')) {
      renderOwnerProductsTable();
    }
  } catch (err) {
    showToast('Gagal update harga: ' + err.message, 'error');
  } finally {
    el.btnSaveProductPrice.disabled = false;
    el.btnSaveProductPrice.textContent = 'Simpan Perubahan';
  }
});


// Restock DOM elements
el.restockModal = document.getElementById('restockModal');
el.btnOpenRestockModal = document.getElementById('btnOpenRestockModal');
el.btnCloseRestockModal = document.getElementById('btnCloseRestockModal');
el.btnCancelRestockModal = document.getElementById('btnCancelRestockModal');
el.btnConfirmRestock = document.getElementById('btnConfirmRestock');
el.restockProductSelect = document.getElementById('restockProductSelect');
el.restockCurrentStock = document.getElementById('restockCurrentStock');
el.restockQtyInput = document.getElementById('restockQtyInput');
el.restockCostInput = document.getElementById('restockCostInput');
el.restockNotesInput = document.getElementById('restockNotesInput');

if (el.btnOpenRestockModal) {
  el.btnOpenRestockModal.addEventListener('click', () => openRestockModal());
}
if (el.btnCloseRestockModal) {
  el.btnCloseRestockModal.addEventListener('click', () => el.restockModal.style.display = 'none');
}
if (el.btnCancelRestockModal) {
  el.btnCancelRestockModal.addEventListener('click', () => el.restockModal.style.display = 'none');
}
if (el.restockProductSelect) {
  el.restockProductSelect.addEventListener('change', () => updateRestockCurrentStock());
}
if (el.btnConfirmRestock) {
  el.btnConfirmRestock.addEventListener('click', handleConfirmRestock);
}

function openRestockModal(targetProductId = null, preselectedSupplierId = null) {
  if (!el.restockModal) el.restockModal = document.getElementById('restockModal');
  if (!el.restockProductSelect) el.restockProductSelect = document.getElementById('restockProductSelect');
  if (!el.restockQtyInput) el.restockQtyInput = document.getElementById('restockQtyInput');
  if (!el.restockCostInput) el.restockCostInput = document.getElementById('restockCostInput');
  if (!el.restockNotesInput) el.restockNotesInput = document.getElementById('restockNotesInput');
  if (!el.restockCurrentStock) el.restockCurrentStock = document.getElementById('restockCurrentStock');
  if (!el.restockSupplierSelect) el.restockSupplierSelect = document.getElementById('restockSupplierSelect');
  if (!el.restockPaymentStatus) el.restockPaymentStatus = document.getElementById('restockPaymentStatus');
  if (!el.restockTempoContainer) el.restockTempoContainer = document.getElementById('restockTempoContainer');
  if (!el.restockDueDate) el.restockDueDate = document.getElementById('restockDueDate');
  if (!el.restockDpAmount) el.restockDpAmount = document.getElementById('restockDpAmount');

  if (state.products.length === 0) return;
  el.restockProductSelect.innerHTML = state.products.map(p => `
    <option value="${p.id}" ${targetProductId === p.id ? 'selected' : ''}>${p.image_emoji || '🥔'} ${p.name}</option>
  `).join('');

  if (targetProductId) {
    el.restockProductSelect.value = targetProductId;
  }

  // Populate supplier dropdown
  if (el.restockSupplierSelect) {
    el.restockSupplierSelect.innerHTML = `
      <option value="">-- Pembelian Bebas / Tanpa Supplier --</option>
      ${(state.suppliers || []).map(s => `
        <option value="${s.id}" ${preselectedSupplierId === s.id ? 'selected' : ''}>🚛 ${s.name} (${s.address || 'Umum'})</option>
      `).join('')}
    `;
    if (preselectedSupplierId) {
      el.restockSupplierSelect.value = preselectedSupplierId;
    }
  }

  if (el.restockPaymentStatus) el.restockPaymentStatus.value = 'lunas';
  if (el.restockTempoContainer) el.restockTempoContainer.style.display = 'none';
  if (el.restockDueDate) el.restockDueDate.value = '';
  if (el.restockDpAmount) el.restockDpAmount.value = '';

  updateRestockCurrentStock();
  el.restockQtyInput.value = '';
  el.restockCostInput.value = '';
  el.restockNotesInput.value = '';
  if (el.restockModal) el.restockModal.style.display = 'flex';
  setTimeout(() => {
    if (el.restockQtyInput) el.restockQtyInput.focus();
  }, 50);
}

function updateRestockCurrentStock() {
  const prodId = Number(el.restockProductSelect.value);
  const prod = state.products.find(p => p.id === prodId);
  if (prod) {
    el.restockCurrentStock.value = `${prod.stock_qty} ${prod.unit}`;
    el.restockCostInput.placeholder = `Modal saat ini: Rp ${Number(prod.cost_price).toLocaleString('id-ID')}`;
  }
}

async function handleConfirmRestock() {
  const prodId = Number(el.restockProductSelect.value);
  const qty = parseFloat(el.restockQtyInput.value);
  const cost = el.restockCostInput.value ? Number(el.restockCostInput.value) : null;
  const notes = el.restockNotesInput.value.trim();
  const supplierId = el.restockSupplierSelect && el.restockSupplierSelect.value ? Number(el.restockSupplierSelect.value) : null;
  const paymentStatus = el.restockPaymentStatus ? el.restockPaymentStatus.value : 'lunas';
  const dueDate = el.restockDueDate ? el.restockDueDate.value : null;
  const dpAmount = el.restockDpAmount ? Number(el.restockDpAmount.value) : 0;

  if (isNaN(qty) || qty <= 0) {
    showToast('Masukkan jumlah kg barang masuk yang valid', 'error');
    return;
  }

  try {
    el.btnConfirmRestock.disabled = true;
    el.btnConfirmRestock.textContent = 'Menyimpan...';

    const res = await api.restockProduct(prodId, qty, cost, notes, supplierId, paymentStatus, dpAmount, dueDate);
    el.restockModal.style.display = 'none';
    showToast(res.message, 'success');

    // Refresh products & suppliers in memory and UI
    await loadInitialData();
    await loadCashierSuppliers();
    renderCatalogMarginTable();
    if (document.getElementById('ownerProductsTableBody')) {
      renderOwnerProductsTable();
    }
  } catch (err) {
    showToast('Gagal menambah stok: ' + err.message, 'error');
  } finally {
    el.btnConfirmRestock.disabled = false;
    el.btnConfirmRestock.textContent = 'Simpan & Tambah Stok';
  }
}

// Cashier Suppliers & Kulakan & Tempo Functions
async function loadCashierSuppliers() {
  try {
    const [supRes, purRes] = await Promise.all([
      api.getSuppliers(),
      api.getPurchases()
    ]);

    if (supRes && supRes.success) {
      state.suppliers = supRes.suppliers || [];
      state.supplierSummary = supRes.summary || {};

      // Update KPI cards
      const summary = state.supplierSummary;
      if (el.kpiCashierTotalSuppliers) {
        el.kpiCashierTotalSuppliers.textContent = `${summary.total_suppliers || 0} Juragan`;
      }
      if (el.kpiCashierMonthlyPurchases) {
        el.kpiCashierMonthlyPurchases.textContent = formatRupiah(summary.total_purchases_month || 0);
      }
      if (el.kpiCashierTotalDebt) {
        el.kpiCashierTotalDebt.textContent = formatRupiah(summary.total_debt_outstanding || 0);
      }
      if (el.kpiCashierDebtsCountText) {
        el.kpiCashierDebtsCountText.textContent = `${summary.total_suppliers_with_debt || 0} pemasok belum lunas`;
      }
      if (el.kpiCashierOverdueDebt) {
        el.kpiCashierOverdueDebt.textContent = formatRupiah(summary.total_overdue_debt || 0);
      }
    }

    if (purRes && purRes.success) {
      state.purchases = purRes.purchases || [];
      const tempoPurchases = state.purchases.filter(p => Number(p.remaining_amount) > 0);
      if (el.badgeCashierTempoCount) {
        el.badgeCashierTempoCount.textContent = tempoPurchases.length;
      }
    }

    // Render active tab view
    if (state.cashierActiveSupplierTab === 'juragan') {
      renderCashierSuppliersList();
    } else if (state.cashierActiveSupplierTab === 'purchases') {
      renderCashierPurchasesTable();
    } else if (state.cashierActiveSupplierTab === 'tempo') {
      renderCashierTempoDebtsTable();
    }
  } catch (err) {
    console.warn('Gagal memuat data pemasok & kulakan di kasir:', err);
  }
}

function switchCashierSupplierTab(tab) {
  state.cashierActiveSupplierTab = tab;

  // Toggle active button style
  if (el.tabCashierSupJuragan) el.tabCashierSupJuragan.classList.toggle('active', tab === 'juragan');
  if (el.tabCashierSupPurchases) el.tabCashierSupPurchases.classList.toggle('active', tab === 'purchases');
  if (el.tabCashierSupTempo) el.tabCashierSupTempo.classList.toggle('active', tab === 'tempo');

  // Toggle containers
  if (el.cashierViewJuraganContainer) el.cashierViewJuraganContainer.style.display = tab === 'juragan' ? 'block' : 'none';
  if (el.cashierViewPurchasesContainer) el.cashierViewPurchasesContainer.style.display = tab === 'purchases' ? 'block' : 'none';
  if (el.cashierViewTempoContainer) el.cashierViewTempoContainer.style.display = tab === 'tempo' ? 'block' : 'none';

  // Render view
  if (tab === 'juragan') renderCashierSuppliersList();
  else if (tab === 'purchases') renderCashierPurchasesTable();
  else if (tab === 'tempo') renderCashierTempoDebtsTable();
}

function renderCashierSuppliersList() {
  if (!el.cashierSuppliersContainer) return;
  const q = el.cashierSearchSupplierInput ? el.cashierSearchSupplierInput.value.toLowerCase().trim() : '';
  const filterStatus = el.cashierSupplierStatusFilter ? el.cashierSupplierStatusFilter.value : 'all';

  const list = (state.suppliers || []).filter(s => {
    const matchSearch = !q || s.name.toLowerCase().includes(q) || (s.address && s.address.toLowerCase().includes(q)) || (s.supplied_commodities && s.supplied_commodities.toLowerCase().includes(q));
    const debt = Number(s.total_debt_remaining) || 0;
    let matchFilter = true;
    if (filterStatus === 'has_debt') matchFilter = debt > 0;
    else if (filterStatus === 'lunas') matchFilter = debt === 0;
    return matchSearch && matchFilter;
  });

  if (list.length === 0) {
    el.cashierSuppliersContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #94a3b8;">Tidak ada pemasok yang cocok dengan pencarian.</div>';
    return;
  }

  el.cashierSuppliersContainer.innerHTML = list.map(s => {
    const phoneClean = s.phone ? s.phone.replace(/[^0-9]/g, '') : '';
    const waPhone = phoneClean.startsWith('0') ? '62' + phoneClean.slice(1) : phoneClean;
    const debtRemaining = Number(s.total_debt_remaining) || 0;

    return `
      <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <strong style="color: #0f172a; font-size: 14.5px; font-weight: 800;">${escapeHtml(s.name)}</strong>
            <span style="font-size: 11px; padding: 3px 8px; border-radius: 6px; background: #e0f2fe; color: #0369a1; font-weight: 700;">📍 ${escapeHtml(s.address || 'Umum')}</span>
          </div>
          <div style="font-size: 12px; color: #475569; margin-top: 5px; display: flex; align-items: center; gap: 6px;">
            <span>📦 Pasokan:</span>
            <span style="font-weight: 600; color: #334155;">${escapeHtml(s.supplied_commodities || 'Hasil bumi pasar')}</span>
          </div>
          ${s.bank_info ? `
            <div style="font-size: 11.5px; color: #0284c7; margin-top: 4px; font-family: monospace; background: #ffffff; padding: 3px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
              🏦 ${escapeHtml(s.bank_info)}
            </div>
          ` : ''}
          ${debtRemaining > 0 ? `
            <div style="margin-top: 6px; font-size: 12px; color: #b45309; font-weight: 700;">
              ⏳ Sisa Hutang Tempo: <span style="color: #dc2626; font-family: monospace; font-size: 13px;">${formatRupiah(debtRemaining)}</span>
            </div>
          ` : ''}
        </div>

        <div style="display: flex; gap: 8px; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          ${waPhone ? `
            <a href="https://wa.me/${waPhone}" target="_blank" rel="noopener" style="flex: 1; height: 34px; background: #25d366; color: #ffffff; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 4px; text-decoration: none; font-size: 12px; font-weight: 700; box-shadow: 0 1px 3px rgba(37,211,102,0.3);">
              <span>💬</span> Hubungi WA
            </a>
          ` : ''}
          <button type="button" class="btn-cashier-restock-sup" data-id="${s.id}" style="flex: 1.2; height: 34px; background: #059669; color: #ffffff; border: none; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 12px; font-weight: 700; cursor: pointer;">
            <span>📦</span> + Kulakan Masuk
          </button>
        </div>
      </div>
    `;
  }).join('');

  el.cashierSuppliersContainer.querySelectorAll('.btn-cashier-restock-sup').forEach(btn => {
    btn.addEventListener('click', () => {
      const supId = Number(btn.dataset.id);
      if (el.modalCashierSuppliers) el.modalCashierSuppliers.style.display = 'none';
      openRestockModal(null, supId);
    });
  });
}

function renderCashierPurchasesTable() {
  if (!el.cashierPurchasesTableBody) return;
  const q = el.cashierSearchSupplierInput ? el.cashierSearchSupplierInput.value.toLowerCase().trim() : '';
  const filterStatus = el.cashierSupplierStatusFilter ? el.cashierSupplierStatusFilter.value : 'all';

  const list = (state.purchases || []).filter(p => {
    const matchSearch = !q || (p.purchase_no && p.purchase_no.toLowerCase().includes(q)) || (p.supplier_name && p.supplier_name.toLowerCase().includes(q)) || (p.product_name && p.product_name.toLowerCase().includes(q));
    const debt = Number(p.remaining_amount) || 0;
    let matchFilter = true;
    if (filterStatus === 'has_debt') matchFilter = debt > 0;
    else if (filterStatus === 'lunas') matchFilter = debt === 0;
    return matchSearch && matchFilter;
  });

  if (list.length === 0) {
    el.cashierPurchasesTableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 30px; color: #94a3b8;">Tidak ada riwayat kulakan masuk yang cocok.</td></tr>';
    return;
  }

  el.cashierPurchasesTableBody.innerHTML = list.map(p => {
    const timeFormatted = parseSafeDate(p.created_at).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const remaining = Number(p.remaining_amount) || 0;
    let statusBadge = '<span style="font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #ecfdf5; color: #065f46; font-weight: 700;">🟢 Lunas</span>';
    if (remaining > 0) {
      if (p.is_overdue) {
        statusBadge = '<span style="font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #fff1f2; color: #dc2626; font-weight: 700;">🚨 Lewat Tempo</span>';
      } else {
        statusBadge = '<span style="font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #fffbeb; color: #b45309; font-weight: 700;">⏳ Tempo</span>';
      }
    }

    const payBtn = remaining > 0 
      ? `<button type="button" class="btn-cashier-pay-debt" data-id="${p.id}" style="padding: 4px 10px; background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 6px; color: #065f46; font-weight: 700; cursor: pointer; font-size: 11.5px;">💵 Bayar</button>`
      : '<span style="color: #94a3b8; font-size: 11.5px;">-</span>';

    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 12px;">
          <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #0f172a;">${p.purchase_no || '-'}</code>
        </td>
        <td style="padding: 10px 12px; font-size: 12px; color: #0f172a; white-space: nowrap;">
          ${timeFormatted}
        </td>
        <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">
          👤 ${escapeHtml(p.supplier_name || 'Tanpa Nama')}
        </td>
        <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">
          ${p.product_emoji || '🥔'} ${escapeHtml(p.product_name || '-')}
        </td>
        <td style="padding: 10px 12px; text-align: right; font-weight: 800; color: #059669; font-family: monospace; white-space: nowrap;">
          +${Number(p.qty_kg).toLocaleString('id-ID')} ${p.product_unit || 'kg'}
        </td>
        <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-weight: 600; color: #475569; white-space: nowrap;">
          ${formatRupiah(p.cost_price)}
        </td>
        <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a; white-space: nowrap;">
          ${formatRupiah(p.total_cost)}
        </td>
        <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
          ${statusBadge}
        </td>
        <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-weight: 800; color: ${remaining > 0 ? '#dc2626' : '#059669'}; white-space: nowrap;">
          ${formatRupiah(remaining)}
        </td>
        <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
          ${payBtn}
        </td>
      </tr>
    `;
  }).join('');

  el.cashierPurchasesTableBody.querySelectorAll('.btn-cashier-pay-debt').forEach(btn => {
    btn.addEventListener('click', () => {
      openCashierPaySupplierDebtModal(Number(btn.dataset.id));
    });
  });
}

function renderCashierTempoDebtsTable() {
  if (!el.cashierTempoDebtsTableBody) return;
  const q = el.cashierSearchSupplierInput ? el.cashierSearchSupplierInput.value.toLowerCase().trim() : '';

  const tempoList = (state.purchases || [])
    .filter(p => Number(p.remaining_amount) > 0)
    .filter(p => !q || (p.purchase_no && p.purchase_no.toLowerCase().includes(q)) || (p.supplier_name && p.supplier_name.toLowerCase().includes(q)) || (p.product_name && p.product_name.toLowerCase().includes(q)));

  if (tempoList.length === 0) {
    el.cashierTempoDebtsTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px 20px; color: #059669;">
          <div style="font-size: 32px; margin-bottom: 6px;">🎉</div>
          <strong style="font-size: 15px;">Alhamdulillah, Semua Hutang Kulakan Lunas!</strong>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Tidak ada tagihan tempo komoditas yang belum dibayar ke juragan petani.</p>
        </td>
      </tr>
    `;
    return;
  }

  el.cashierTempoDebtsTableBody.innerHTML = tempoList.map(p => {
    const timeFormatted = parseSafeDate(p.created_at).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    const isOverdue = Boolean(p.is_overdue);
    const dueDateText = p.due_date 
      ? parseSafeDate(p.due_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Tanpa Tempo';

    return `
      <tr style="border-bottom: 1px solid #fef3c7; background: ${isOverdue ? '#fff1f2' : '#ffffff'};">
        <td style="padding: 10px 12px;">
          <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #0f172a;">${p.purchase_no || '-'}</code>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">📅 ${timeFormatted}</div>
        </td>
        <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">
          👤 ${escapeHtml(p.supplier_name || 'Tanpa Nama')}
          ${p.supplier_phone ? `<span style="font-size: 11px; color: #64748b; font-weight: 400; display: block;">📞 ${p.supplier_phone}</span>` : ''}
        </td>
        <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">
          ${p.product_emoji || '🥔'} ${escapeHtml(p.product_name || '-')}
          <span style="font-size: 11px; color: #64748b; font-weight: 400;">(${p.qty_kg} ${p.product_unit})</span>
        </td>
        <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-weight: 700; color: #475569; white-space: nowrap;">
          ${formatRupiah(p.total_cost)}
        </td>
        <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-weight: 700; color: #059669; white-space: nowrap;">
          ${formatRupiah(p.paid_amount || 0)}
        </td>
        <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-weight: 800; color: #dc2626; font-size: 14px; white-space: nowrap;">
          ${formatRupiah(p.remaining_amount)}
        </td>
        <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
          <div style="font-weight: 700; font-size: 12px; color: ${isOverdue ? '#dc2626' : '#b45309'};">
            ${dueDateText}
          </div>
          ${isOverdue ? '<span style="font-size: 10px; padding: 1px 6px; border-radius: 4px; background: #dc2626; color: #fff; font-weight: 800;">🚨 Lewat Tempo</span>' : ''}
        </td>
        <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
          <button type="button" class="btn-cashier-pay-tempo-row" data-id="${p.id}" style="padding: 6px 14px; background: #059669; border: none; border-radius: 8px; color: #fff; font-weight: 700; cursor: pointer; font-size: 12px; display: inline-flex; align-items: gap: 4px; box-shadow: 0 2px 4px rgba(5,150,105,0.25);">
            <span>💵</span> Bayar Tempo
          </button>
        </td>
      </tr>
    `;
  }).join('');

  el.cashierTempoDebtsTableBody.querySelectorAll('.btn-cashier-pay-tempo-row').forEach(btn => {
    btn.addEventListener('click', () => {
      openCashierPaySupplierDebtModal(Number(btn.dataset.id));
    });
  });
}

function openCashierPaySupplierDebtModal(purchaseId) {
  const purchase = (state.purchases || []).find(p => p.id === purchaseId);
  if (!purchase) return;

  state.cashierActivePurchaseForPayment = purchase;
  if (el.cashierSupPayPurchaseId) el.cashierSupPayPurchaseId.value = purchase.id;
  if (el.cashierSupPayRemainingText) el.cashierSupPayRemainingText.textContent = formatRupiah(purchase.remaining_amount);
  if (el.cashierSupPayNoteDetails) {
    el.cashierSupPayNoteDetails.textContent = `${purchase.purchase_no} • ${purchase.supplier_name || 'Supplier'} • ${purchase.product_name}`;
  }
  if (el.cashierSupPayAmountInput) el.cashierSupPayAmountInput.value = purchase.remaining_amount;
  if (el.cashierSupPayNotesInput) el.cashierSupPayNotesInput.value = '';

  if (el.modalCashierPaySupplierDebt) el.modalCashierPaySupplierDebt.style.display = 'flex';
  setTimeout(() => {
    if (el.cashierSupPayAmountInput) el.cashierSupPayAmountInput.focus();
  }, 50);
}

async function handleSaveCashierSupplierPayment() {
  const purchase = state.cashierActivePurchaseForPayment;
  if (!purchase) return;

  const amount = Number(el.cashierSupPayAmountInput.value);
  const payment_method = el.cashierSupPayMethodSelect ? el.cashierSupPayMethodSelect.value : 'cash';
  const notes = el.cashierSupPayNotesInput ? el.cashierSupPayNotesInput.value.trim() : '';

  if (isNaN(amount) || amount <= 0) {
    showToast('Masukkan nominal pembayaran yang valid!', 'error');
    return;
  }
  if (amount > purchase.remaining_amount) {
    showToast(`Nominal bayar (${formatRupiah(amount)}) melebihi sisa hutang (${formatRupiah(purchase.remaining_amount)})!`, 'error');
    return;
  }

  try {
    el.btnSubmitCashierSupplierPay.disabled = true;
    el.btnSubmitCashierSupplierPay.textContent = 'Menyimpan...';

    const res = await api.paySupplierDebt(purchase.id, {
      amount,
      payment_method,
      notes
    });

    if (el.modalCashierPaySupplierDebt) el.modalCashierPaySupplierDebt.style.display = 'none';
    showToast(res.message || 'Pembayaran hutang kulakan berhasil dicatat!', 'success');

    // Reload suppliers & purchases
    await loadCashierSuppliers();
  } catch (err) {
    showToast('Gagal memproses pembayaran: ' + err.message, 'error');
  } finally {
    el.btnSubmitCashierSupplierPay.disabled = false;
    el.btnSubmitCashierSupplierPay.textContent = 'Simpan Pembayaran';
  }
}

function openCashierNewSupplierModal() {
  if (el.quickSupName) el.quickSupName.value = '';
  if (el.quickSupPhone) el.quickSupPhone.value = '';
  if (el.quickSupAddress) el.quickSupAddress.value = '';
  if (el.quickSupCommodities) el.quickSupCommodities.value = '';
  if (el.quickSupBank) el.quickSupBank.value = '';
  if (el.quickSupNotes) el.quickSupNotes.value = '';
  if (el.modalNewSupplierQuick) el.modalNewSupplierQuick.style.display = 'flex';
  setTimeout(() => {
    if (el.quickSupName) el.quickSupName.focus();
  }, 50);
}

async function handleSaveNewSupplierQuick() {
  const name = el.quickSupName ? el.quickSupName.value.trim() : '';
  const phone = el.quickSupPhone ? el.quickSupPhone.value.trim() : '';
  const address = el.quickSupAddress ? el.quickSupAddress.value.trim() : '';
  const commodities = el.quickSupCommodities ? el.quickSupCommodities.value.trim() : '';
  const bank = el.quickSupBank ? el.quickSupBank.value.trim() : '';
  const notes = el.quickSupNotes ? el.quickSupNotes.value.trim() : '';

  if (!name || !phone) {
    showToast('Nama pemasok dan nomor WhatsApp wajib diisi!', 'error');
    return;
  }

  try {
    el.btnSaveNewSupplierQuick.disabled = true;
    el.btnSaveNewSupplierQuick.textContent = 'Menyimpan...';

    const res = await api.createSupplier({
      name,
      phone,
      address,
      supplied_commodities: commodities,
      bank_info: bank,
      notes
    });

    if (el.modalNewSupplierQuick) el.modalNewSupplierQuick.style.display = 'none';
    showToast(`Pemasok "${name}" berhasil didaftarkan!`, 'success');
    await loadCashierSuppliers();
  } catch (err) {
    showToast('Gagal menyimpan pemasok: ' + err.message, 'error');
  } finally {
    el.btnSaveNewSupplierQuick.disabled = false;
    el.btnSaveNewSupplierQuick.textContent = 'Simpan Pemasok';
  }
}


// New Product DOM Elements
el.newProductModal = document.getElementById('newProductModal');
el.btnOpenNewProductModal = document.getElementById('btnOpenNewProductModal');
el.btnCloseNewProductModal = document.getElementById('btnCloseNewProductModal');
el.btnCancelNewProductModal = document.getElementById('btnCancelNewProductModal');
el.btnSaveNewProduct = document.getElementById('btnSaveNewProduct');

if (el.btnOpenNewProductModal) {
  el.btnOpenNewProductModal.addEventListener('click', () => openNewProductModal());
}
if (el.btnCloseNewProductModal) {
  el.btnCloseNewProductModal.addEventListener('click', () => el.newProductModal.style.display = 'none');
}
if (el.btnCancelNewProductModal) {
  el.btnCancelNewProductModal.addEventListener('click', () => el.newProductModal.style.display = 'none');
}
if (el.btnSaveNewProduct) {
  el.btnSaveNewProduct.addEventListener('click', handleSaveNewProduct);
}

function openNewProductModal() {
  document.getElementById('newProdName').value = '';
  document.getElementById('newProdEmoji').value = '🥔';
  document.getElementById('newProdCategory').value = 'umbi';
  document.getElementById('newProdUnit').value = 'kg';
  document.getElementById('newProdCostPrice').value = '';
  document.getElementById('newProdRetailPrice').value = '';
  document.getElementById('newProdResellerPrice').value = '';
  document.getElementById('newProdWholesaleQty').value = '10';
  document.getElementById('newProdInitialStock').value = '50';
  if (!el.newProductModal) el.newProductModal = document.getElementById('newProductModal');
  if (el.newProductModal) el.newProductModal.style.display = 'flex';
  setTimeout(() => {
    const input = document.getElementById('newProdName');
    if (input) input.focus();
  }, 50);
}

async function handleSaveNewProduct() {
  const name = document.getElementById('newProdName').value.trim();
  const emoji = document.getElementById('newProdEmoji').value.trim() || '🥔';
  const category = document.getElementById('newProdCategory').value;
  const unit = document.getElementById('newProdUnit').value;
  const costPrice = Number(document.getElementById('newProdCostPrice').value);
  const retailPrice = Number(document.getElementById('newProdRetailPrice').value);
  const resellerPrice = Number(document.getElementById('newProdResellerPrice').value);
  const wholesaleQty = Number(document.getElementById('newProdWholesaleQty').value) || 10;
  const initialStock = Number(document.getElementById('newProdInitialStock').value) || 0;

  if (!name || isNaN(costPrice) || isNaN(retailPrice) || isNaN(resellerPrice)) {
    showToast('Mohon lengkapi nama komoditas dan seluruh harga (modal, eceran, grosir)!', 'error');
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
    image_emoji: emoji
  };

  try {
    el.btnSaveNewProduct.disabled = true;
    el.btnSaveNewProduct.textContent = 'Menyimpan...';

    const res = await api.createProduct(payload);
    el.newProductModal.style.display = 'none';
    showToast(`Komoditas "${name}" berhasil ditambahkan ke katalog!`, 'success');

    // Refresh catalog & owner table
    await loadInitialData();
    renderCatalogMarginTable();
    if (document.getElementById('ownerProductsTableBody')) {
      renderOwnerProductsTable();
    }
  } catch (err) {
    showToast('Gagal menambah komoditas: ' + err.message, 'error');
  } finally {
    el.btnSaveNewProduct.disabled = false;
    el.btnSaveNewProduct.textContent = 'Simpan Komoditas ke Katalog';
  }
}


// =============================================================================
// STOK OPNAME FISIK (AUDIT STOK NYATA PASAR)
// =============================================================================
state.opnameCategory = 'all';
state.opnameSearch = '';

function initStockOpnameEvents() {
  if (el.btnStockOpname) {
    el.btnStockOpname.addEventListener('click', openStockOpnameModal);
  }
  if (el.btnCloseStockOpname) {
    el.btnCloseStockOpname.addEventListener('click', () => {
      el.modalStockOpname.style.display = 'none';
    });
  }
  if (el.btnCancelStockOpname) {
    el.btnCancelStockOpname.addEventListener('click', () => {
      el.modalStockOpname.style.display = 'none';
    });
  }
  if (el.modalStockOpname) {
    el.modalStockOpname.addEventListener('click', (e) => {
      if (e.target === el.modalStockOpname) el.modalStockOpname.style.display = 'none';
    });
  }

  // Search input
  if (el.inpOpnameSearch) {
    el.inpOpnameSearch.addEventListener('input', (e) => {
      state.opnameSearch = e.target.value.toLowerCase().trim();
      renderStockOpnameTable();
    });
  }

  // Category filter pills
  if (el.opnameCategoryFilters) {
    el.opnameCategoryFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-filter-opname');
      if (!btn) return;
      el.opnameCategoryFilters.querySelectorAll('.btn-filter-opname').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.opnameCategory = btn.dataset.cat;
      renderStockOpnameTable();
    });
  }
}

async function openStockOpnameModal() {
  if (el.inpOpnameSearch) el.inpOpnameSearch.value = '';
  state.opnameSearch = '';
  state.opnameCategory = 'all';
  if (el.opnameCategoryFilters) {
    el.opnameCategoryFilters.querySelectorAll('.btn-filter-opname').forEach(b => {
      b.classList.toggle('active', b.dataset.cat === 'all');
    });
  }

  // Refresh products list
  try {
    const res = await api.getProducts();
    if (res && res.products) {
      state.products = res.products;
    }
  } catch (err) {
    console.warn('Gagal refresh produk untuk opname, menggunakan cache lokal:', err);
  }

  renderStockOpnameTable();
  el.modalStockOpname.style.display = 'flex';
}

function renderStockOpnameTable() {
  if (!el.opnameTableBody) return;

  const filtered = state.products.filter(p => {
    const matchCat = state.opnameCategory === 'all' || p.category === state.opnameCategory;
    const matchSearch = !state.opnameSearch || p.name.toLowerCase().includes(state.opnameSearch);
    return matchCat && matchSearch;
  });

  if (el.opnameCountSummary) {
    el.opnameCountSummary.textContent = `Menampilkan ${filtered.length} dari total ${state.products.length} komoditas`;
  }

  if (filtered.length === 0) {
    el.opnameTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 30px; text-align: center; color: var(--text-muted);">
          🔍 Tidak ditemukan komoditas dengan filter atau kata kunci tersebut.
        </td>
      </tr>
    `;
    return;
  }

  el.opnameTableBody.innerHTML = filtered.map(p => {
    const currentStock = parseFloat(p.stock_qty || 0);
    return `
      <tr class="opname-row" data-id="${p.id}">
        <td style="padding: 10px 14px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">${p.image_emoji || '🥔'}</span>
            <div>
              <strong style="font-size: 13px; color: var(--text-main); display: block;">${p.name}</strong>
              <span style="font-size: 11px; color: var(--text-muted); text-transform: capitalize;">${p.category || 'umbi'} • Satuan: ${p.unit || 'kg'}</span>
            </div>
          </div>
        </td>
        <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: #1e293b;">
          ${currentStock.toFixed(2)} ${p.unit || 'kg'}
        </td>
        <td style="padding: 10px 14px; text-align: center;">
          <input type="number" step="0.1" min="0" class="opname-input-qty" data-prod-id="${p.id}" data-current="${currentStock}" value="${currentStock.toFixed(2)}">
        </td>
        <td style="padding: 10px 14px; text-align: right;" class="opname-diff-cell">
          <span class="opname-diff-badge matched">✓ 0.00 kg Sesuai</span>
        </td>
        <td style="padding: 10px 14px;">
          <input type="text" class="opname-input-notes" placeholder="Catatan selisih / opname...">
        </td>
        <td style="padding: 10px 14px; text-align: center;">
          <button type="button" class="btn-opname-save" data-prod-id="${p.id}">Simpan</button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach live calculation and save handlers to rows
  el.opnameTableBody.querySelectorAll('.opname-row').forEach(row => {
    const prodId = Number(row.dataset.id);
    const prod = state.products.find(p => p.id === prodId);
    if (!prod) return;

    const inputQty = row.querySelector('.opname-input-qty');
    const diffCell = row.querySelector('.opname-diff-cell');
    const inputNotes = row.querySelector('.opname-input-notes');
    const btnSave = row.querySelector('.btn-opname-save');

    const updateDiff = () => {
      const physicalVal = parseFloat(inputQty.value);
      if (isNaN(physicalVal) || physicalVal < 0) {
        diffCell.innerHTML = `<span class="opname-diff-badge deficit">Wajib &ge; 0</span>`;
        btnSave.disabled = true;
        return;
      }
      btnSave.disabled = false;
      const current = parseFloat(prod.stock_qty || 0);
      const diff = physicalVal - current;

      if (Math.abs(diff) < 0.001) {
        diffCell.innerHTML = `<span class="opname-diff-badge matched">✓ 0.00 kg Sesuai</span>`;
      } else if (diff < 0) {
        diffCell.innerHTML = `<span class="opname-diff-badge deficit">▼ ${diff.toFixed(2)} kg Susut</span>`;
      } else {
        diffCell.innerHTML = `<span class="opname-diff-badge surplus">▲ +${diff.toFixed(2)} kg Surplus</span>`;
      }
    };

    inputQty.addEventListener('input', updateDiff);

    btnSave.addEventListener('click', async () => {
      const physicalVal = parseFloat(inputQty.value);
      if (isNaN(physicalVal) || physicalVal < 0) {
        showToast('Kuantiti fisik tidak boleh kosong atau negatif!', 'error');
        return;
      }

      const notes = inputNotes.value.trim();
      try {
        btnSave.disabled = true;
        btnSave.textContent = 'Menyimpan...';

        const shiftId = state.currentShift ? state.currentShift.id : null;
        const res = await api.applyStockOpname(prodId, physicalVal, shiftId, notes);

        // Update local state
        prod.stock_qty = physicalVal;

        // Refresh UI
        renderProductGrid();
        showToast(res.message || `Stok opname ${prod.name} berhasil disimpan!`, 'success');

        // Update row status
        row.querySelector('td:nth-child(2)').textContent = `${physicalVal.toFixed(2)} ${prod.unit || 'kg'}`;
        inputQty.dataset.current = physicalVal;
        updateDiff();
      } catch (err) {
        showToast('Gagal menyimpan stok opname: ' + err.message, 'error');
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = 'Simpan';
      }
    });
  });
}

// =============================================================================
// EDIT IDENTITAS TOKO & KASIR/ADMIN
// =============================================================================
function initEditIdentityEvents() {
  if (el.btnEditIdentity) {
    el.btnEditIdentity.addEventListener('click', openEditIdentityModal);
  }
  if (el.btnCloseEditIdentity) {
    el.btnCloseEditIdentity.addEventListener('click', () => {
      el.modalEditIdentity.style.display = 'none';
    });
  }
  if (el.btnCancelEditIdentity) {
    el.btnCancelEditIdentity.addEventListener('click', () => {
      el.modalEditIdentity.style.display = 'none';
    });
  }
  if (el.modalEditIdentity) {
    el.modalEditIdentity.addEventListener('click', (e) => {
      if (e.target === el.modalEditIdentity) el.modalEditIdentity.style.display = 'none';
    });
  }

  // Tab switching inside Identity Modal
  if (el.tabIdentityStore) {
    el.tabIdentityStore.addEventListener('click', () => {
      el.tabIdentityStore.classList.add('active');
      el.tabIdentityCashier.classList.remove('active');
      el.paneIdentityStore.style.display = 'block';
      el.paneIdentityCashier.style.display = 'none';
    });
  }
  if (el.tabIdentityCashier) {
    el.tabIdentityCashier.addEventListener('click', () => {
      el.tabIdentityCashier.classList.add('active');
      el.tabIdentityStore.classList.remove('active');
      el.paneIdentityCashier.style.display = 'block';
      el.paneIdentityStore.style.display = 'none';
    });
  }

  // Live Thermal Preview Listeners
  const bindLivePreview = (inputEl, previewEl, defaultText = '') => {
    if (!inputEl || !previewEl) return;
    inputEl.addEventListener('input', () => {
      previewEl.textContent = inputEl.value.trim() || defaultText;
    });
  };

  bindLivePreview(el.inpStoreName, el.previewStoreName, 'PD. HASIL BUMI RAYA 1');
  bindLivePreview(el.inpStoreTagline, el.previewStoreTagline, 'Pusat Umbi, Bawang & Komoditas Pasar');
  bindLivePreview(el.inpStoreAddress, el.previewStoreAddress, 'Pasar induk modern, Cikopo, Kec. Campaka, Kabupaten Purwakarta, Jawa Barat 41183');
  if (el.inpStorePhone && el.previewStorePhone) {
    el.inpStorePhone.addEventListener('input', () => {
      el.previewStorePhone.textContent = el.inpStorePhone.value.trim() ? `Telp/WA: ${el.inpStorePhone.value.trim()}` : 'Telp/WA: -';
    });
  }
  bindLivePreview(el.inpReceiptFooter, el.previewReceiptFooter, 'Terima kasih atas kunjungan Anda!');
  bindLivePreview(el.inpCashierName, el.previewCashierName, 'Kasir');

  // Save Store Identity Button
  if (el.btnSaveStoreIdentity) {
    el.btnSaveStoreIdentity.addEventListener('click', handleSaveStoreIdentity);
  }

  // Save Cashier Identity Button
  if (el.btnSaveCashierIdentity) {
    el.btnSaveCashierIdentity.addEventListener('click', handleSaveCashierIdentity);
  }
}

async function openEditIdentityModal() {
  try {
    const res = await api.getSettings().catch(() => null);
    const s = (res && res.settings) ? res.settings : {};

    if (el.inpStoreName) el.inpStoreName.value = s.store_name || 'PD. HASIL BUMI RAYA 1';
    if (el.inpStoreTagline) el.inpStoreTagline.value = s.store_tagline || 'Pusat Umbi, Bawang & Komoditas Pasar';
    if (el.inpStoreAddress) el.inpStoreAddress.value = s.store_address || 'Pasar induk modern, Cikopo, Kec. Campaka, Kabupaten Purwakarta, Jawa Barat 41183';
    if (el.inpStorePhone) el.inpStorePhone.value = s.store_phone || '0812-3456-7890';
    if (el.inpReceiptFooter) el.inpReceiptFooter.value = s.receipt_footer || 'Terima kasih atas kunjungan Anda!\nBarang yang sudah ditimbang & dibeli tidak dapat ditukar/dikembalikan.';

    // Populate preview
    if (el.previewStoreName) el.previewStoreName.textContent = el.inpStoreName.value;
    if (el.previewStoreTagline) el.previewStoreTagline.textContent = el.inpStoreTagline.value;
    if (el.previewStoreAddress) el.previewStoreAddress.textContent = el.inpStoreAddress.value;
    if (el.previewStorePhone) el.previewStorePhone.textContent = `Telp/WA: ${el.inpStorePhone.value}`;
    if (el.previewReceiptFooter) el.previewReceiptFooter.textContent = el.inpReceiptFooter.value;

    // Cashier identity
    const currentName = (state.user && state.user.name) ? state.user.name : (el.activeCashierName.textContent || 'Kasir');
    if (el.inpCashierName) el.inpCashierName.value = currentName;
    if (el.previewCashierName) el.previewCashierName.textContent = currentName;
    if (el.inpOldPin) el.inpOldPin.value = '';
    if (el.inpNewPin) el.inpNewPin.value = '';

    el.modalEditIdentity.style.display = 'flex';
  } catch (err) {
    showToast('Gagal memuat pengaturan toko: ' + err.message, 'error');
  }
}

async function handleSaveStoreIdentity() {
  const store_name = el.inpStoreName.value.trim();
  const store_tagline = el.inpStoreTagline.value.trim();
  const store_address = el.inpStoreAddress.value.trim();
  const store_phone = el.inpStorePhone.value.trim();
  const receipt_footer = el.inpReceiptFooter.value.trim();

  if (!store_name) {
    showToast('Nama toko tidak boleh kosong!', 'error');
    return;
  }

  try {
    el.btnSaveStoreIdentity.disabled = true;
    el.btnSaveStoreIdentity.textContent = 'Menyimpan...';

    const res = await api.updateSettings({
      store_name,
      store_tagline,
      store_address,
      store_phone,
      receipt_footer
    });

    showToast(res.message || 'Identitas toko & struk berhasil diperbarui!', 'success');
  } catch (err) {
    showToast('Gagal memperbarui identitas toko: ' + err.message, 'error');
  } finally {
    el.btnSaveStoreIdentity.disabled = false;
    el.btnSaveStoreIdentity.textContent = '💾 Simpan Identitas Toko';
  }
}

async function handleSaveCashierIdentity() {
  const name = el.inpCashierName.value.trim();
  const oldPin = el.inpOldPin.value.trim();
  const newPin = el.inpNewPin.value.trim();

  if (!name) {
    showToast('Nama kasir/admin tidak boleh kosong!', 'error');
    return;
  }

  if (newPin && (newPin.length < 4 || newPin.length > 6 || isNaN(Number(newPin)))) {
    showToast('PIN baru harus 4 sampai 6 digit angka!', 'error');
    return;
  }

  try {
    el.btnSaveCashierIdentity.disabled = true;
    el.btnSaveCashierIdentity.textContent = 'Menyimpan...';

    const res = await api.updateProfile(name, oldPin || null, newPin || null);

    if (state.user) {
      state.user.name = name;
    }
    if (el.activeCashierName) {
      el.activeCashierName.textContent = name;
    }

    if (el.inpOldPin) el.inpOldPin.value = '';
    if (el.inpNewPin) el.inpNewPin.value = '';

    showToast(res.message || 'Profil identitas kasir/admin berhasil diperbarui!', 'success');
  } catch (err) {
    showToast('Gagal memperbarui profil kasir: ' + err.message, 'error');
  } finally {
    el.btnSaveCashierIdentity.disabled = false;
    el.btnSaveCashierIdentity.textContent = '💾 Simpan Profil Kasir / Admin';
  }
}

// -----------------------------------------------------------------------------
// HARDWARE SUPPORT (PANDA BLUETOOTH PRINTER & CASH DRAWER RJ-11)
// -----------------------------------------------------------------------------
function updateHardwareUI(hwState) {
  if (el.printerStatusPill) {
    el.printerStatusPill.className = `printer-status-pill ${hwState.isConnected ? 'online' : 'offline'}`;
  }
  if (el.printerStatusLabel) {
    if (hwState.isConnected) {
      el.printerStatusLabel.textContent = `🖨️ ${hwState.deviceName || 'Printer Thermal'}`;
    } else {
      el.printerStatusLabel.textContent = '🖨️ Printer: Putus';
    }
  }
  if (el.printerSubLabel) {
    if (hwState.isConnected) {
      el.printerSubLabel.textContent = `Konek (${hwState.config.mode.toUpperCase()})`;
    } else {
      el.printerSubLabel.textContent = `Bluetooth / RJ-11`;
    }
  }
  if (el.hwPrinterIndicator) {
    el.hwPrinterIndicator.className = hwState.isConnected ? 'status-indicator-circle connected' : 'status-indicator-circle';
  }
  if (el.hwDeviceNameDisplay) {
    el.hwDeviceNameDisplay.textContent = hwState.isConnected ? (hwState.deviceName || 'Printer Thermal') : 'Belum Terhubung';
  }
  if (el.hwDeviceStatusText) {
    el.hwDeviceStatusText.textContent = hwState.isConnected ? 'Siap mencetak & kick laci kasir' : 'Nyalakan Bluetooth printer & tablet';
  }
  if (el.btnConnectBluetooth) {
    el.btnConnectBluetooth.style.display = hwState.isConnected ? 'none' : 'inline-block';
  }
  if (el.btnDisconnectBluetooth) {
    el.btnDisconnectBluetooth.style.display = hwState.isConnected ? 'inline-block' : 'none';
  }
  if (el.hwPrintMode) el.hwPrintMode.value = hwState.config.mode;
  if (el.hwPaperSize) el.hwPaperSize.value = hwState.config.paperSize;
  if (el.hwAutoDrawer) el.hwAutoDrawer.checked = hwState.config.autoDrawer;
}

function initHardwareSupport() {
  hardwareManager.subscribeState(updateHardwareUI);

  // Header Pill Click -> Open Hardware Modal
  if (el.printerStatusPill) {
    el.printerStatusPill.addEventListener('click', (e) => {
      if (el.hardwareModal) el.hardwareModal.style.display = 'flex';
    });
  }

  // Dropdown Item Click
  if (el.btnHardwareDropdownItem) {
    el.btnHardwareDropdownItem.addEventListener('click', () => {
      if (el.hardwareModal) el.hardwareModal.style.display = 'flex';
      const dd = document.getElementById('storeDropdownContent');
      if (dd) dd.classList.remove('show');
    });
  }

  // Close Hardware Modal
  if (el.btnCloseHardwareModal) {
    el.btnCloseHardwareModal.addEventListener('click', () => {
      if (el.hardwareModal) el.hardwareModal.style.display = 'none';
    });
  }

  // Connect Bluetooth
  if (el.btnConnectBluetooth) {
    el.btnConnectBluetooth.addEventListener('click', async () => {
      el.btnConnectBluetooth.disabled = true;
      el.btnConnectBluetooth.textContent = '⏳ Mencari Printer...';
      try {
        const res = await hardwareManager.connectBluetooth();
        showToast(`Terhubung ke ${res.deviceName}!`, 'success');
      } catch (err) {
        showToast('Gagal konek Bluetooth: ' + err.message, 'error');
      } finally {
        el.btnConnectBluetooth.disabled = false;
        el.btnConnectBluetooth.textContent = '🔵 Hubungkan Printer';
      }
    });
  }

  // Disconnect Bluetooth
  if (el.btnDisconnectBluetooth) {
    el.btnDisconnectBluetooth.addEventListener('click', async () => {
      await hardwareManager.disconnectBluetooth();
      showToast('Printer Bluetooth diputuskan', 'info');
    });
  }

  // Quick Cash Drawer Kick (Header Button)
  if (el.btnQuickOpenDrawer) {
    el.btnQuickOpenDrawer.addEventListener('click', async () => {
      try {
        const res = await hardwareManager.kickCashDrawer();
        if (res.success) {
          showToast('Sinyal buka laci terkirim ke laci RJ-11!', 'success');
        } else {
          showToast(res.message || 'Gagal buka laci', 'warning');
        }
      } catch (err) {
        showToast('Error buka laci: ' + err.message, 'error');
      }
    });
  }

  // Receipt Modal Drawer Kick Button
  if (el.btnReceiptOpenDrawer) {
    el.btnReceiptOpenDrawer.addEventListener('click', async () => {
      try {
        await hardwareManager.kickCashDrawer();
        showToast('Sinyal buka laci terkirim!', 'success');
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    });
  }

  // Test Drawer Kick
  if (el.btnTestDrawer) {
    el.btnTestDrawer.addEventListener('click', async () => {
      try {
        await hardwareManager.kickCashDrawer();
        showToast('Sinyal kick RJ-11 dikirim ke printer!', 'success');
      } catch (err) {
        showToast('Gagal test laci: ' + err.message, 'error');
      }
    });
  }

  // Test Print
  if (el.btnTestPrint) {
    el.btnTestPrint.addEventListener('click', async () => {
      el.btnTestPrint.disabled = true;
      el.btnTestPrint.textContent = '⏳ Mencetak test...';
      try {
        await hardwareManager.printTest();
        showToast('Cetak struk uji coba berhasil!', 'success');
      } catch (err) {
        showToast('Gagal test print: ' + err.message, 'error');
      } finally {
        el.btnTestPrint.disabled = false;
        el.btnTestPrint.textContent = '🖨️ Cetak Struk Uji Coba (Test Print)';
      }
    });
  }

  // Save Hardware Settings
  if (el.btnSaveHardwareSettings) {
    el.btnSaveHardwareSettings.addEventListener('click', () => {
      hardwareManager.saveConfig({
        mode: el.hwPrintMode ? el.hwPrintMode.value : 'bluetooth',
        paperSize: el.hwPaperSize ? el.hwPaperSize.value : '58mm',
        autoDrawer: el.hwAutoDrawer ? el.hwAutoDrawer.checked : true
      });
      showToast('Pengaturan hardware disimpan!', 'success');
      if (el.hardwareModal) el.hardwareModal.style.display = 'none';
    });
  }
}

// Cashier Expenses & Petty Cash Functions
async function loadCashierExpenses() {
  try {
    const [expRes, catRes, shiftRes] = await Promise.all([
      api.getExpenses(),
      api.getExpenseCategories(),
      api.getCurrentShift()
    ]);

    if (catRes && catRes.success) {
      state.expenseCategories = catRes.categories || [];
      renderExpenseCategoriesGrid();
      populateExpenseCategoryFilter();
    }

    if (expRes && expRes.success) {
      state.expenses = expRes.expenses || [];
      state.expenseSummary = expRes.summary || {};

      const summary = state.expenseSummary;
      if (el.kpiExpenseTodayTotal) {
        el.kpiExpenseTodayTotal.textContent = formatRupiah(summary.today_expenses || 0);
      }
      if (el.kpiExpenseDrawerOut) {
        el.kpiExpenseDrawerOut.textContent = formatRupiah(summary.today_cash_drawer_out || 0);
      }
      if (el.kpiExpenseTransferOut) {
        el.kpiExpenseTransferOut.textContent = formatRupiah(summary.total_transfer_out || 0);
      }
      if (el.kpiExpenseLiveDrawer && shiftRes && shiftRes.shift) {
        el.kpiExpenseLiveDrawer.textContent = formatRupiah(shiftRes.shift.current_drawer_cash || 0);
      }
    }

    if (shiftRes && shiftRes.shift) {
      state.currentShiftCash = Number(shiftRes.shift.current_drawer_cash) || 0;
      if (el.expenseActiveShiftName) {
        el.expenseActiveShiftName.textContent = `${shiftRes.shift.cashier_name} (Shift #${shiftRes.shift.id})`;
      }
    } else {
      state.currentShiftCash = 0;
      if (el.expenseActiveShiftName) {
        el.expenseActiveShiftName.textContent = 'Tidak Ada Shift Aktif';
      }
    }

    checkCashierExpenseSufficiency();

    if (state.activeExpenseTab === 'history') {
      renderCashierExpensesHistoryTable();
    }
  } catch (err) {
    console.warn('Gagal memuat data biaya operasional kasir:', err);
  }
}

function checkCashierExpenseSufficiency() {
  if (!el.cashierExpenseShortageAlert) return;
  const isCash = el.sourceCash && el.sourceCash.checked;
  const amount = Number(el.inputExpenseAmount ? el.inputExpenseAmount.value : 0) || 0;
  const drawerCash = Number(state.currentShiftCash) || 0;

  if (isCash && amount > drawerCash) {
    const shortage = amount - drawerCash;
    if (el.lblCashierDrawerAvail) el.lblCashierDrawerAvail.textContent = formatRupiah(drawerCash);
    if (el.lblCashierDrawerShortage) el.lblCashierDrawerShortage.textContent = formatRupiah(shortage);
    el.cashierExpenseShortageAlert.style.display = 'block';
    if (el.btnSubmitExpense) {
      el.btnSubmitExpense.style.background = '#94a3b8';
      el.btnSubmitExpense.style.boxShadow = 'none';
      el.btnSubmitExpense.title = 'Saldo kas laci tidak mencukupi. Tambahkan modal kas terlebih dahulu.';
    }
  } else {
    el.cashierExpenseShortageAlert.style.display = 'none';
    if (el.btnSubmitExpense) {
      el.btnSubmitExpense.style.background = '#dc2626';
      el.btnSubmitExpense.style.boxShadow = '0 4px 6px -1px rgba(220, 38, 38, 0.3)';
      el.btnSubmitExpense.title = '';
    }
  }
}

function renderExpenseCategoriesGrid() {
  if (!el.expenseCategoryGrid) return;
  const categories = (state.expenseCategories && state.expenseCategories.length > 0)
    ? state.expenseCategories
    : [
        { key: 'makan_rokok', name: 'Makan, Minum & Rokok', icon: '🍱', color: '#f59e0b' },
        { key: 'parkir_retribusi', name: 'Parkir & Retribusi Pasar', icon: '🛵', color: '#3b82f6' },
        { key: 'kuli_bongkar', name: 'Kuli Panggul & Bongkar Muat', icon: '🚚', color: '#8b5cf6' },
        { key: 'perlengkapan', name: 'Perlengkapan Kios (Karung/Plastik/Rafia)', icon: '📦', color: '#ec4899' },
        { key: 'listrik_token', name: 'Listrik & Token PLN', icon: '⚡', color: '#eab308' },
        { key: 'wifi_pulsa', name: 'WiFi, Internet & Pulsa', icon: '📶', color: '#06b6d4' },
        { key: 'gaji_karyawan', name: 'Gaji / Uang Saku Karyawan', icon: '👥', color: '#10b981' },
        { key: 'perbaikan_alat', name: 'Perbaikan Kios & Timbangan', icon: '🛠️', color: '#64748b' },
        { key: 'lain_lain', name: 'Lain-Lain / Operasional Umum', icon: '📝', color: '#6b7280' }
      ];

  el.expenseCategoryGrid.innerHTML = categories
    .filter(c => c.key !== 'kas_masuk_modal')
    .map(c => {
      const isSelected = c.key === state.selectedExpenseCategory;
      return `
        <button type="button" class="btn-expense-cat-chip ${isSelected ? 'active' : ''}" data-key="${c.key}" style="
          display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px;
          border: ${isSelected ? '2px solid #d97706' : '1.5px solid #e2e8f0'};
          background: ${isSelected ? '#fffbeb' : '#ffffff'};
          color: ${isSelected ? '#92400e' : '#334155'};
          cursor: pointer; text-align: left; transition: all 0.15s ease;
          box-shadow: ${isSelected ? '0 2px 4px rgba(217,119,6,0.15)' : 'none'};
        ">
          <span style="font-size: 18px;">${c.icon}</span>
          <span style="font-size: 12.5px; font-weight: ${isSelected ? '800' : '600'}; line-height: 1.2;">${escapeHtml(c.name)}</span>
        </button>
      `;
    }).join('');

  el.expenseCategoryGrid.querySelectorAll('.btn-expense-cat-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedExpenseCategory = btn.dataset.key;
      renderExpenseCategoriesGrid();
    });
  });
}

function populateExpenseCategoryFilter() {
  if (!el.filterExpenseCategory) return;
  const currentVal = el.filterExpenseCategory.value;
  const options = ['<option value="all">Semua Kategori</option>'];
  (state.expenseCategories || []).forEach(c => {
    options.push(`<option value="${c.key}">${c.icon} ${escapeHtml(c.name)}</option>`);
  });
  el.filterExpenseCategory.innerHTML = options.join('');
  if (currentVal) el.filterExpenseCategory.value = currentVal;
}

function switchCashierExpenseTab(tab) {
  state.activeExpenseTab = tab;
  if (el.tabExpenseRecord) el.tabExpenseRecord.classList.toggle('active', tab === 'record');
  if (el.tabExpenseHistory) el.tabExpenseHistory.classList.toggle('active', tab === 'history');

  if (el.viewExpenseRecordForm) el.viewExpenseRecordForm.style.display = tab === 'record' ? 'block' : 'none';
  if (el.viewExpenseHistoryTable) el.viewExpenseHistoryTable.style.display = tab === 'history' ? 'block' : 'none';

  if (tab === 'history') {
    renderCashierExpensesHistoryTable();
  }
}

function renderCashierExpensesHistoryTable() {
  if (!el.cashierExpensesTableBody) return;
  const q = el.searchExpenseHistoryInput ? el.searchExpenseHistoryInput.value.toLowerCase().trim() : '';
  const filterCat = el.filterExpenseCategory ? el.filterExpenseCategory.value : 'all';
  const filterSrc = el.filterExpenseSource ? el.filterExpenseSource.value : 'all';

  const list = (state.expenses || []).filter(e => {
    const matchSearch = !q || (e.expense_no && e.expense_no.toLowerCase().includes(q)) || (e.category_name && e.category_name.toLowerCase().includes(q)) || (e.notes && e.notes.toLowerCase().includes(q));
    const matchCat = filterCat === 'all' || e.category === filterCat;
    const matchSrc = filterSrc === 'all' || e.source === filterSrc;
    return matchSearch && matchCat && matchSrc;
  });

  if (list.length === 0) {
    el.cashierExpensesTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px; color: #94a3b8;">Belum ada catatan pengeluaran/kas masuk yang cocok.</td></tr>';
    return;
  }

  el.cashierExpensesTableBody.innerHTML = list.map(e => {
    const timeFormatted = parseSafeDate(e.created_at).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    const isIncome = e.type === 'income';
    const isCash = e.source === 'cash';

    return `
      <tr style="border-bottom: 1px solid #f1f5f9; background: ${isIncome ? '#f0fdf4' : '#ffffff'};">
        <td style="padding: 10px 12px;">
          <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #0f172a;">${e.expense_no}</code>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">🕒 ${timeFormatted}</div>
        </td>
        <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">
          ${escapeHtml(e.category_name)}
        </td>
        <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-weight: 800; font-size: 13.5px; color: ${isIncome ? '#059669' : '#dc2626'}; white-space: nowrap;">
          ${isIncome ? '+' : '-'}${formatRupiah(e.amount)}
        </td>
        <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
          <span style="font-size: 11px; padding: 2px 8px; border-radius: 6px; background: ${isCash ? '#fee2e2' : '#eff6ff'}; color: ${isCash ? '#dc2626' : '#2563eb'}; font-weight: 700;">
            ${isCash ? '💵 Kas Laci' : '🏦 Transfer'}
          </span>
        </td>
        <td style="padding: 10px 12px; color: #334155; font-size: 12px;">
          ${escapeHtml(e.notes || '-')}
        </td>
        <td style="padding: 10px 12px; font-size: 11.5px; color: #64748b; white-space: nowrap;">
          👤 ${escapeHtml(e.recorded_by_name || 'Kasir')}
        </td>
        <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
          <div style="display: flex; gap: 4px; justify-content: center;">
            <button type="button" class="btn-print-cashier-expense" data-id="${e.id}" style="padding: 4px 8px; border-radius: 6px; background: #e0f2fe; border: 1px solid #bae6fd; color: #0284c7; cursor: pointer; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;" title="Cetak Ulang Bukti Kas / Biaya (Printer Thermal)">
              <span>🖨️</span> Cetak
            </button>
            <button type="button" class="btn-delete-cashier-expense" data-id="${e.id}" style="padding: 4px 8px; border-radius: 6px; background: #fee2e2; border: 1px solid #fecdd3; color: #dc2626; cursor: pointer; font-size: 11px; font-weight: 700;" title="Hapus Catatan">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  el.cashierExpensesTableBody.querySelectorAll('.btn-print-cashier-expense').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const exp = (state.expenses || []).find(x => x.id === id);
      if (exp) {
        state.lastCompletedExpense = exp;
        state.lastCompletedOrder = null;
        state.lastExpenseIsReprint = true;
        renderThermalExpenseReceipt(exp, true);
        if (el.receiptModalTitle) el.receiptModalTitle.textContent = exp.type === 'income' ? 'Pratinjau Bukti Kas Masuk' : 'Pratinjau Voucher Biaya Kas';
        if (el.btnNextOrder) el.btnNextOrder.textContent = 'Tutup Pratinjau';
        if (el.receiptModal) {
          el.receiptModal.style.zIndex = '13000';
          el.receiptModal.style.display = 'flex';
        }
      }
    });
  });

  el.cashierExpensesTableBody.querySelectorAll('.btn-delete-cashier-expense').forEach(btn => {
    btn.addEventListener('click', () => {
      handleDeleteCashierExpense(Number(btn.dataset.id));
    });
  });
}

function renderThermalExpenseReceipt(expense, isReprint = false) {
  if (!el.thermalReceipt) return;
  const isIncome = expense.type === 'income';
  const timeFormatted = parseSafeDate(expense.created_at || Date.now()).toLocaleString('id-ID');
  const sName = (state.settings && state.settings.store_name) || 'PD. HASIL BUMI RAYA 1';
  const sTagline = (state.settings && state.settings.store_tagline) || 'Pusat Umbi, Bawang & Komoditas';
  const sAddress = (state.settings && state.settings.store_address) || '';
  const sPhone = (state.settings && state.settings.store_phone) || '';

  el.thermalReceipt.innerHTML = `
    <div class="receipt-header">
      <div class="receipt-title">${escapeHtml(sName)}</div>
      <div>${escapeHtml(sTagline)}</div>
      ${sAddress ? `<div style="font-size:11px; margin-top:2px;">${escapeHtml(sAddress)}</div>` : ''}
      ${sPhone ? `<div style="font-size:11px;">Telp/WA: ${escapeHtml(sPhone)}</div>` : ''}
      <div class="receipt-divider"></div>
      <div style="font-weight: 800; font-size: 13px; text-transform: uppercase; margin: 4px 0;">
        ${isIncome ? '*** BUKTI KAS MASUK TOKO ***' : '*** VOUCHER BIAYA OPERASIONAL ***'}
      </div>
      <div style="font-size: 11px; color: #475569;">
        ${isIncome ? '(TAMBAH MODAL / DANA LACI)' : '(BUKTI PENGELUARAN KAS KIOS)'}
      </div>
      ${isReprint ? '<div class="receipt-reprint-tag" style="background:#0f172a; color:#fff; font-weight:800; padding:2px 4px; margin:4px 0; border-radius:4px; text-align:center;">*** SALINAN / CETAK ULANG ***</div>' : ''}
      <div style="margin-top: 6px;">No. Bukti : ${escapeHtml(expense.expense_no || '-')}</div>
      <div>Waktu     : ${timeFormatted}</div>
      <div>Petugas   : ${escapeHtml(expense.recorded_by_name || (state.user ? state.user.name : 'Kasir'))}</div>
      <div>Sumber Kas: ${expense.source === 'cash' ? '💵 Kas Laci Kasir' : '🏦 Transfer Bank'}</div>
      <div>Kategori  : ${escapeHtml(expense.category_name || '-')}</div>
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
    <div class="receipt-divider" style="margin-top: 8px;"></div>
    <div style="display: flex; justify-content: space-between; text-align: center; font-size: 10.5px; margin-top: 8px; padding: 0 4px;">
      <div style="width: 46%;">
        Kasir / Petugas,<br><br>
        ( ............... )
      </div>
      <div style="width: 46%;">
        Penerima Dana,<br><br>
        ( ............... )
      </div>
    </div>
    <div class="receipt-divider" style="margin-top: 10px;"></div>
    <div class="receipt-footer">
      <p style="margin: 0; font-size: 10px; color: #64748b;">Harap simpan struk ini sebagai bukti sah pembukuan kios.</p>
    </div>
  `;
}

async function handleSaveCashierExpense() {
  const category = state.selectedExpenseCategory || 'makan_rokok';
  const amount = Number(el.inputExpenseAmount ? el.inputExpenseAmount.value : 0);
  const source = el.sourceCash && el.sourceCash.checked ? 'cash' : 'transfer';
  const notes = el.inputExpenseNotes ? el.inputExpenseNotes.value.trim() : '';

  if (isNaN(amount) || amount <= 0) {
    showToast('Masukkan nominal pengeluaran yang valid!', 'error');
    if (el.inputExpenseAmount) el.inputExpenseAmount.focus();
    return;
  }

  // Pre-check drawer cash balance if source is cash
  if (source === 'cash' && amount > (Number(state.currentShiftCash) || 0)) {
    const shortage = amount - (Number(state.currentShiftCash) || 0);
    showToast(`Saldo kas laci tidak mencukupi! Kurang ${formatRupiah(shortage)}. Tambah dana kas/modal laci terlebih dahulu.`, 'error');
    checkCashierExpenseSufficiency();
    return;
  }

  try {
    if (el.btnSubmitExpense) {
      el.btnSubmitExpense.disabled = true;
      el.btnSubmitExpense.textContent = 'Menyimpan & Mencetak...';
    }

    const res = await api.createExpense({
      category,
      amount,
      source,
      notes,
      type: 'expense'
    });

    showToast(res.message || 'Pengeluaran berhasil dicatat!', 'success');

    // Show voucher preview modal first
    if (res.expense) {
      state.lastCompletedExpense = res.expense;
      state.lastCompletedOrder = null;
      state.lastExpenseIsReprint = false;
      renderThermalExpenseReceipt(res.expense, false);
      if (el.receiptModalTitle) el.receiptModalTitle.textContent = 'Pratinjau Voucher Biaya Kas Laci';
      if (el.btnNextOrder) el.btnNextOrder.textContent = 'Tutup Pratinjau';
      if (el.receiptModal) {
        el.receiptModal.style.zIndex = '13000';
        el.receiptModal.style.display = 'flex';
      }
    }

    if (el.inputExpenseAmount) el.inputExpenseAmount.value = '';
    if (el.inputExpenseNotes) el.inputExpenseNotes.value = '';

    await loadCashierExpenses();
  } catch (err) {
    showToast('Gagal mencatat pengeluaran: ' + err.message, 'error');
  } finally {
    if (el.btnSubmitExpense) {
      el.btnSubmitExpense.disabled = false;
      el.btnSubmitExpense.innerHTML = '<span>💸</span> Simpan & Cetak Pengeluaran';
    }
  }
}

async function handleSaveCashierIncome() {
  const category = el.incomeCategorySelect ? el.incomeCategorySelect.value : 'kas_masuk_modal';
  const amount = Number(el.inputIncomeAmount ? el.inputIncomeAmount.value : 0);
  const source = el.incomeSourceSelect ? el.incomeSourceSelect.value : 'cash';
  const notes = el.inputIncomeNotes ? el.inputIncomeNotes.value.trim() : '';

  if (isNaN(amount) || amount <= 0) {
    showToast('Masukkan nominal kas masuk yang valid!', 'error');
    if (el.inputIncomeAmount) el.inputIncomeAmount.focus();
    return;
  }

  try {
    if (el.btnSubmitCashierIncome) {
      el.btnSubmitCashierIncome.disabled = true;
      el.btnSubmitCashierIncome.textContent = 'Menyimpan & Mencetak...';
    }

    const res = await api.createExpense({
      category,
      amount,
      source,
      notes,
      type: 'income'
    });

    showToast(res.message || 'Kas masuk berhasil dicatat!', 'success');

    // Show voucher preview modal first
    if (res.expense) {
      state.lastCompletedExpense = res.expense;
      state.lastCompletedOrder = null;
      state.lastExpenseIsReprint = false;
      renderThermalExpenseReceipt(res.expense, false);
      if (el.receiptModalTitle) el.receiptModalTitle.textContent = 'Pratinjau Bukti Kas Masuk Laci';
      if (el.btnNextOrder) el.btnNextOrder.textContent = 'Tutup Pratinjau';
      if (el.receiptModal) {
        el.receiptModal.style.zIndex = '13000';
        el.receiptModal.style.display = 'flex';
      }
    }

    if (el.inputIncomeAmount) el.inputIncomeAmount.value = '';
    if (el.inputIncomeNotes) el.inputIncomeNotes.value = '';
    if (el.modalCashierIncome) el.modalCashierIncome.style.display = 'none';

    await loadCashierExpenses();
  } catch (err) {
    showToast('Gagal mencatat kas masuk: ' + err.message, 'error');
  } finally {
    if (el.btnSubmitCashierIncome) {
      el.btnSubmitCashierIncome.disabled = false;
      el.btnSubmitCashierIncome.textContent = 'Simpan & Cetak Kas Masuk';
    }
  }
}

async function handleDeleteCashierExpense(id) {
  if (!confirm('Yakin ingin menghapus catatan biaya ini?')) return;
  try {
    const res = await api.deleteExpense(id);
    showToast(res.message || 'Catatan biaya berhasil dihapus', 'success');
    await loadCashierExpenses();
  } catch (err) {
    showToast('Gagal menghapus biaya: ' + err.message, 'error');
  }
}

// -----------------------------------------------------------------------------
// CASHIER DASHBOARD & DAILY BALANCING (REKONSILIASI KAS HARIAN)
// Halaman Penuh Mandiri Khusus Kasir (/cashier.html)
// -----------------------------------------------------------------------------
async function openCashierDashboard() {
  window.location.href = '/cashier.html';
}

async function refreshCashierDashboardData() {
  try {
    if (el.btnRefreshCashierDashboard) {
      el.btnRefreshCashierDashboard.innerHTML = '<span>⏳</span> Memuat...';
      el.btnRefreshCashierDashboard.disabled = true;
    }

    const res = await api.getCurrentShift().catch(() => null);
    if (!res || !res.has_active_shift) {
      if (el.modalCashierDashboard) el.modalCashierDashboard.style.display = 'none';
      showToast('Shift kasir belum dibuka. Silakan buka shift terlebih dahulu.', 'warning');
      showOpenShiftModal();
      return;
    }

    state.shift = res.shift;
    const s = state.shift;

    if (el.dashShiftBadge) {
      el.dashShiftBadge.textContent = `Shift #${s.id} Aktif`;
    }
    if (el.dashShiftMetaSubtitle) {
      const startTimeStr = parseSafeDate(s.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      el.dashShiftMetaSubtitle.textContent = `Petugas: ${s.cashier_name || (state.user ? state.user.name : 'Kasir')} • Buka: ${startTimeStr} WIB • Modal: ${formatRupiah(s.starting_cash)}`;
    }

    // 4 KPI Cards
    if (el.dashKpiStartingCash) {
      el.dashKpiStartingCash.textContent = formatRupiah(s.starting_cash || 0);
    }
    if (el.dashKpiCashSales) {
      el.dashKpiCashSales.textContent = formatRupiah(s.cash_sales || 0);
    }
    if (el.dashKpiCashSalesCount) {
      el.dashKpiCashSalesCount.textContent = `${s.total_orders || 0} transaksi lunas tunai`;
    }
    if (el.dashKpiIncomeDebt) {
      const totalIn = Number(s.cash_income || 0) + Number(s.cash_debt_collected || 0);
      el.dashKpiIncomeDebt.textContent = `+${formatRupiah(totalIn)}`;
    }
    if (el.dashKpiIncomeDebtMeta) {
      el.dashKpiIncomeDebtMeta.textContent = `Masuk: ${formatRupiah(s.cash_income || 0)} | Bon: ${formatRupiah(s.cash_debt_collected || 0)}`;
    }
    if (el.dashKpiExpensesCash) {
      el.dashKpiExpensesCash.textContent = `-${formatRupiah(s.cash_expenses || 0)}`;
    }
    if (el.dashKpiExpensesCount) {
      const expCount = (s.recent_expenses && s.recent_expenses.length) || 0;
      el.dashKpiExpensesCount.textContent = `${expCount} pengeluaran laci`;
    }

    // Formula explanation & Expected cash
    const starting = Number(s.starting_cash || 0);
    const cashSales = Number(s.cash_sales || 0);
    const debtIn = Number(s.cash_debt_collected || 0);
    const incIn = Number(s.cash_income || 0);
    const expOut = Number(s.cash_expenses || 0);
    const supOut = Number(s.cash_supplier_payments || 0);
    const expected = starting + cashSales + debtIn + incIn - expOut - supOut;

    if (el.dashFormulaExplanation) {
      el.dashFormulaExplanation.textContent = `Modal [${formatRupiah(starting)}] + Tunai [${formatRupiah(cashSales)}] + Pelunasan [${formatRupiah(debtIn)}] + Kas Masuk [${formatRupiah(incIn)}] - Biaya [${formatRupiah(expOut)}] = Saldo Laci Seharusnya`;
    }
    if (el.dashExpectedCashValue) {
      el.dashExpectedCashValue.textContent = formatRupiah(expected);
    }

    // Transactions breakdown
    if (el.dashTotalOrdersBadge) {
      el.dashTotalOrdersBadge.textContent = `${s.total_orders || 0} Nota Transaksi`;
    }
    if (el.dashSalesCash) el.dashSalesCash.textContent = formatRupiah(cashSales);
    if (el.dashSalesQris) el.dashSalesQris.textContent = formatRupiah(s.qris_sales || 0);
    if (el.dashSalesTransfer) el.dashSalesTransfer.textContent = formatRupiah(s.transfer_sales || 0);
    if (el.dashSalesTempo) el.dashSalesTempo.textContent = formatRupiah(s.tempo_sales || 0);
    if (el.dashTotalOmset) el.dashTotalOmset.textContent = formatRupiah(s.total_omset || 0);

    // Recent Expenses in Cash Drawer
    if (el.dashExpensesListContainer) {
      if (s.recent_expenses && s.recent_expenses.length > 0) {
        el.dashExpensesListContainer.innerHTML = s.recent_expenses.map(e => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: #fff5f5; border: 1px solid #fee2e2; border-radius: 8px; padding: 6px 10px; font-size: 12px;">
            <div>
              <strong style="color: #991b1b; display: block;">${escapeHtml(e.category || 'Biaya Operasional')}</strong>
              <span style="color: #64748b; font-size: 11px;">${escapeHtml(e.notes || '-')} • ${parseSafeDate(e.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <strong style="font-family: monospace; color: #b91c1c; font-size: 13px;">-${formatRupiah(e.amount)}</strong>
          </div>
        `).join('');
      } else {
        el.dashExpensesListContainer.innerHTML = `
          <div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 18px;">
            Belum ada pengeluaran kas laci pada shift ini.
          </div>
        `;
      }
    }

    recalculateDashboardDenominations();
  } catch (err) {
    showToast('Gagal memuat dashboard kasir: ' + err.message, 'error');
  } finally {
    if (el.btnRefreshCashierDashboard) {
      el.btnRefreshCashierDashboard.innerHTML = '<span>🔄</span> Segarkan';
      el.btnRefreshCashierDashboard.disabled = false;
    }
  }
}

function recalculateDashboardDenominations() {
  const d100 = (Number(el.dashD100k ? el.dashD100k.value : 0) || 0) * 100000;
  const d50 = (Number(el.dashD50k ? el.dashD50k.value : 0) || 0) * 50000;
  const d20 = (Number(el.dashD20k ? el.dashD20k.value : 0) || 0) * 20000;
  const d10 = (Number(el.dashD10k ? el.dashD10k.value : 0) || 0) * 10000;
  const d5 = (Number(el.dashD5k ? el.dashD5k.value : 0) || 0) * 5000;
  const d2 = (Number(el.dashD2k ? el.dashD2k.value : 0) || 0) * 2000;
  const d1 = (Number(el.dashD1k ? el.dashD1k.value : 0) || 0) * 1000;
  const dKoin = Number(el.dashDKoin ? el.dashDKoin.value : 0) || 0;

  if (el.dashSub100k) el.dashSub100k.textContent = formatRupiah(d100);
  if (el.dashSub50k) el.dashSub50k.textContent = formatRupiah(d50);
  if (el.dashSub20k) el.dashSub20k.textContent = formatRupiah(d20);
  if (el.dashSub10k) el.dashSub10k.textContent = formatRupiah(d10);
  if (el.dashSub5k) el.dashSub5k.textContent = formatRupiah(d5);
  if (el.dashSub2k) el.dashSub2k.textContent = formatRupiah(d2);
  if (el.dashSub1k) el.dashSub1k.textContent = formatRupiah(d1);
  if (el.dashSubKoin) el.dashSubKoin.textContent = formatRupiah(dKoin);

  const total = d100 + d50 + d20 + d10 + d5 + d2 + d1 + dKoin;
  if (el.dashTotalCounted) el.dashTotalCounted.textContent = formatRupiah(total);

  // Expected cash
  const s = state.shift || {};
  const starting = Number(s.starting_cash || 0);
  const cashSales = Number(s.cash_sales || 0);
  const debtIn = Number(s.cash_debt_collected || 0);
  const incIn = Number(s.cash_income || 0);
  const expOut = Number(s.cash_expenses || 0);
  const supOut = Number(s.cash_supplier_payments || 0);
  const expected = starting + cashSales + debtIn + incIn - expOut - supOut;

  const diff = total - expected;

  if (el.dashVarianceCard) {
    el.dashVarianceCard.classList.remove('balanced', 'shortage', 'surplus');
    if (diff === 0) {
      el.dashVarianceCard.classList.add('balanced');
      if (el.dashVarianceIcon) el.dashVarianceIcon.textContent = '✅';
      if (el.dashVarianceTitle) el.dashVarianceTitle.textContent = 'KAS BALANCE (SESUAI)';
      if (el.dashVarianceSubtitle) el.dashVarianceSubtitle.textContent = 'Uang fisik tepat sesuai dengan kalkulasi sistem.';
      if (el.dashVarianceNominal) {
        el.dashVarianceNominal.textContent = 'Selisih: Rp 0';
        el.dashVarianceNominal.style.color = '#059669';
      }
    } else if (diff < 0) {
      el.dashVarianceCard.classList.add('shortage');
      if (el.dashVarianceIcon) el.dashVarianceIcon.textContent = '⚠️';
      if (el.dashVarianceTitle) el.dashVarianceTitle.textContent = 'SELISIH KURANG (MINUS TEKOR)';
      if (el.dashVarianceSubtitle) el.dashVarianceSubtitle.textContent = 'Uang fisik di laci kurang dari catatan sistem. Periksa kembali kembalian atau nota bon.';
      if (el.dashVarianceNominal) {
        el.dashVarianceNominal.textContent = `Kurang: -${formatRupiah(Math.abs(diff))}`;
        el.dashVarianceNominal.style.color = '#dc2626';
      }
    } else {
      el.dashVarianceCard.classList.add('surplus');
      if (el.dashVarianceIcon) el.dashVarianceIcon.textContent = 'ℹ️';
      if (el.dashVarianceTitle) el.dashVarianceTitle.textContent = 'SELISIH LEBIH (SURPLUS)';
      if (el.dashVarianceSubtitle) el.dashVarianceSubtitle.textContent = 'Uang fisik di laci lebih banyak daripada catatan sistem.';
      if (el.dashVarianceNominal) {
        el.dashVarianceNominal.textContent = `Lebih: +${formatRupiah(diff)}`;
        el.dashVarianceNominal.style.color = '#d97706';
      }
    }
  }

  const breakdown = { d100k: d100, d50k: d50, d20k: d20, d10k: d10, d5k: d5, d2k: d2, d1k: d1, dKoin };
  return { total, breakdown, diff, expected };
}

async function handleDashboardPrintReportX() {
  if (!state.shift) {
    showToast('Tidak ada shift aktif yang bisa dicetak.', 'warning');
    return;
  }

  const { total, breakdown, diff, expected } = recalculateDashboardDenominations();
  const reportData = {
    ...state.shift,
    cashier_name: state.shift.cashier_name || (state.user ? state.user.name : 'Kasir'),
    actual_cash: total,
    breakdown,
    expected_system_cash: expected,
    cash_difference: diff,
    closing_notes: el.dashClosingNotes ? el.dashClosingNotes.value : ''
  };

  try {
    if (el.btnDashboardPrintReportX) {
      el.btnDashboardPrintReportX.disabled = true;
      el.btnDashboardPrintReportX.innerHTML = '<span>⏳</span> Mencetak Laporan X...';
    }

    renderThermalShiftReceipt(reportData, 'X');
    const settings = state.settings || {};
    await hardwareManager.printShiftReport(reportData, 'X', settings);
    showToast('🖨️ Struk Laporan X (Cek Kas Berjalan) berhasil dicetak ke printer kasir!', 'success');
  } catch (err) {
    showToast('Gagal mencetak Laporan X: ' + err.message, 'error');
  } finally {
    if (el.btnDashboardPrintReportX) {
      el.btnDashboardPrintReportX.disabled = false;
      el.btnDashboardPrintReportX.innerHTML = '<span>🖨️</span> Cetak Laporan X (Cek Kas Berjalan)';
    }
  }
}

async function handleDashboardCloseShiftZ() {
  if (!state.shift) {
    showToast('Tidak ada shift aktif yang bisa ditutup.', 'warning');
    return;
  }

  const { total, breakdown, diff, expected } = recalculateDashboardDenominations();

  let confirmMsg = `Konfirmasi Tutup Shift #${state.shift.id}?\n\nTotal Fisik Dihitung: ${formatRupiah(total)}\nSaldo Seharusnya: ${formatRupiah(expected)}`;
  if (diff === 0) {
    confirmMsg += '\n\n✅ Status: KAS BALANCE (Rp 0)';
  } else if (diff < 0) {
    confirmMsg += `\n\n⚠️ PERHATIAN: Terdapat SELISIH KURANG sebesar ${formatRupiah(Math.abs(diff))}!\nSelisih akan tercatat ke laporan Owner. Pastikan catatan telah diisi.`;
  } else {
    confirmMsg += `\n\nℹ️ Status: SELISIH LEBIH ${formatRupiah(diff)}`;
  }
  confirmMsg += '\n\nSistem akan menutup shift dan otomatis mencetak Struk Laporan Z ke printer thermal.';

  if (!confirm(confirmMsg)) return;

  try {
    if (el.btnDashboardCloseShiftZ) {
      el.btnDashboardCloseShiftZ.disabled = true;
      el.btnDashboardCloseShiftZ.innerHTML = '<span>⏳</span> Menutup Shift & Mencetak...';
    }

    const notes = el.dashClosingNotes ? el.dashClosingNotes.value : '';
    const res = await api.closeShift(
      state.shift.id,
      total,
      breakdown,
      notes
    );

    const sum = res.summary;

    // Print Report Z
    try {
      renderThermalShiftReceipt(sum, 'Z');
      const settings = state.settings || {};
      await hardwareManager.printShiftReport(sum, 'Z', settings);
    } catch (printErr) {
      console.warn('[Hardware] Gagal mencetak Laporan Z:', printErr);
    }

    if (el.modalCashierDashboard) el.modalCashierDashboard.style.display = 'none';

    let alertMsg = `Shift Kasir #${sum.shift_id} Berhasil Ditutup!\nTotal Fisik: ${formatRupiah(sum.actual_cash_input)}`;
    if (sum.is_balanced) {
      alertMsg += '\nStatus: KAS BALANCE (Sesuai Sistem)';
    } else if (sum.cash_difference < 0) {
      alertMsg += `\n⚠️ PERHATIAN: Selisih KURANG ${formatRupiah(Math.abs(sum.cash_difference))} (Tercatat ke Log Owner)`;
    } else {
      alertMsg += `\nStatus: Selisih LEBIH ${formatRupiah(sum.cash_difference)}`;
    }
    alertMsg += '\n\nStruk Laporan Z telah dicetak ke printer kasir.';

    alert(alertMsg);
    await syncShift();
  } catch (err) {
    showToast('Gagal menutup shift: ' + err.message, 'error');
  } finally {
    if (el.btnDashboardCloseShiftZ) {
      el.btnDashboardCloseShiftZ.disabled = false;
      el.btnDashboardCloseShiftZ.innerHTML = '<span>🔒</span> Tutup Shift & Cetak Laporan Z';
    }
  }
}

function renderThermalShiftReceipt(shiftData, type = 'X') {
  if (!el.thermalReceipt) return;
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

  el.thermalReceipt.innerHTML = `
    <div class="receipt-header">
      <div class="receipt-title">${escapeHtml(sName)}</div>
      <div>${escapeHtml(sTagline)}</div>
      ${sAddress ? `<div style="font-size:11px; margin-top:2px;">${escapeHtml(sAddress)}</div>` : ''}
      ${sPhone ? `<div style="font-size:11px;">Telp/WA: ${escapeHtml(sPhone)}</div>` : ''}
      <div class="receipt-divider"></div>
      <div style="font-weight: 800; font-size: 13px; text-transform: uppercase; margin: 4px 0;">
        ${isZ ? '*** LAPORAN Z (TUTUP SHIFT KASIR) ***' : '*** LAPORAN X (CEK SALDO BERJALAN) ***'}
      </div>
      <div style="font-size: 11px; color: #475569;">
        ${isZ ? '(REKONSILIASI KAS & SERAH TERIMA SHIFT)' : '(RINGKASAN SEMENTARA TENGAH SHIFT)'}
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
    ${shiftData.closing_notes || shiftData.notes ? `
      <div class="receipt-divider"></div>
      <div style="font-size:11px;">
        <strong>Catatan Kasir:</strong><br>
        <span>${escapeHtml(shiftData.closing_notes || shiftData.notes)}</span>
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


