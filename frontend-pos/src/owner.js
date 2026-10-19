import { api } from './api.js';
import Chart from 'chart.js/auto';
import { hardwareManager } from './hardware.js';
import { initSubscriptionGuard } from './subscription.js';

function parseSafeDate(dateInput) {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  let s = String(dateInput).trim();
  if (s.includes(' ') && !s.includes('T')) {
    s = s.replace(' ', 'T');
  }
  return new Date(s);
}

function getLocalDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  activeDebtForPayment: null,
  revenueChartInstance: null,
  reportSalesChartInstance: null,
  currentChartTimeView: '7days',
  suppliers: [],
  supplierSummary: {},
  purchases: [],
  currentSupplierView: 'suppliers',
  activeSupplierDebtFilter: 'all',
  activePurchaseForPayment: null,
  ownerExpenses: [],
  ownerExpenseSummary: {},
  ownerExpenseCategories: []
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
  kpiTotalExpenseToday: document.getElementById('kpiTotalExpenseToday'),
  kpiExpenseSubLabel: document.getElementById('kpiExpenseSubLabel'),
  kpiNetProfitToday: document.getElementById('kpiNetProfitToday'),
  kpiProfitSubLabel: document.getElementById('kpiProfitSubLabel'),
  cardNetProfitWrap: document.getElementById('cardNetProfitWrap'),

  // Liquidity & Working Capital Snapshot
  lblWorkingCapitalStatus: document.getElementById('lblWorkingCapitalStatus'),
  liqCashDrawer: document.getElementById('liqCashDrawer'),
  liqBankIncoming: document.getElementById('liqBankIncoming'),
  liqCustomerDebts: document.getElementById('liqCustomerDebts'),
  liqCustomerDebtorsCount: document.getElementById('liqCustomerDebtorsCount'),
  liqSupplierDebts: document.getElementById('liqSupplierDebts'),
  liqSuppliersCount: document.getElementById('liqSuppliersCount'),

  // Daily Cashflow Movement Ledger
  netCashflowPill: document.getElementById('netCashflowPill'),
  lblNetCashflowVal: document.getElementById('lblNetCashflowVal'),
  cashInflowCount: document.getElementById('cashInflowCount'),
  cfInflowCashSales: document.getElementById('cfInflowCashSales'),
  cfInflowDigitalSales: document.getElementById('cfInflowDigitalSales'),
  cfInflowDebtCollected: document.getElementById('cfInflowDebtCollected'),
  cfInflowOtherIncome: document.getElementById('cfInflowOtherIncome'),
  cfTotalInflow: document.getElementById('cfTotalInflow'),
  cashOutflowCount: document.getElementById('cashOutflowCount'),
  cfOutflowStoreCash: document.getElementById('cfOutflowStoreCash'),
  cfOutflowStoreTransfer: document.getElementById('cfOutflowStoreTransfer'),
  cfOutflowSupplierCash: document.getElementById('cfOutflowSupplierCash'),
  cfOutflowSupplierTransfer: document.getElementById('cfOutflowSupplierTransfer'),
  cfTotalOutflow: document.getElementById('cfTotalOutflow'),

  // Anti-fraud Void & Waste
  kpiVoidCountBadge: document.getElementById('kpiVoidCountBadge'),
  voidListContainer: document.getElementById('voidListContainer'),

  // Recent Activity Feeds
  badgeRecentOrdersCount: document.getElementById('badgeRecentOrdersCount'),
  recentOrdersList: document.getElementById('recentOrdersList'),
  badgeRecentExpensesCount: document.getElementById('badgeRecentExpensesCount'),
  recentExpensesList: document.getElementById('recentExpensesList'),
  badgeRecentPurchasesCount: document.getElementById('badgeRecentPurchasesCount'),
  recentPurchasesList: document.getElementById('recentPurchasesList'),
  btnGoToSalesReport: document.getElementById('btnGoToSalesReport'),
  btnGoToExpensesTab: document.getElementById('btnGoToExpensesTab'),
  btnGoToSuppliersTab: document.getElementById('btnGoToSuppliersTab'),

  // Revenue & Sales Charts
  revenueTrendChart: document.getElementById('revenueTrendChart'),
  chartTotalRevenue: document.getElementById('chartTotalRevenue'),
  chartTotalOrders: document.getElementById('chartTotalOrders'),
  chartAvgRevenue: document.getElementById('chartAvgRevenue'),
  chartPeakSales: document.getElementById('chartPeakSales'),
  reportSalesTrendChart: document.getElementById('reportSalesTrendChart'),

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

  // Tablet Heartbeat Sync Elements
  ownerTabletSyncPill: document.getElementById('ownerTabletSyncPill'),
  tabletPulseDot: document.getElementById('tabletPulseDot'),
  ownerTabletName: document.getElementById('ownerTabletName'),
  ownerTabletLastSync: document.getElementById('ownerTabletLastSync'),

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

  // Hardware Kios: Printer Panda & Cash Drawer RJ-11
  ownerHwPrinterIndicator: document.getElementById('ownerHwPrinterIndicator'),
  ownerHwDeviceNameDisplay: document.getElementById('ownerHwDeviceNameDisplay'),
  ownerHwDeviceStatusText: document.getElementById('ownerHwDeviceStatusText'),
  ownerBtnConnectBluetooth: document.getElementById('ownerBtnConnectBluetooth'),
  ownerBtnDisconnectBluetooth: document.getElementById('ownerBtnDisconnectBluetooth'),
  ownerHwPrintMode: document.getElementById('ownerHwPrintMode'),
  ownerHwPaperSize: document.getElementById('ownerHwPaperSize'),
  ownerHwAutoDrawer: document.getElementById('ownerHwAutoDrawer'),
  ownerBtnTestDrawer: document.getElementById('ownerBtnTestDrawer'),
  ownerBtnTestPrint: document.getElementById('ownerBtnTestPrint'),
  ownerBtnSaveHardware: document.getElementById('ownerBtnSaveHardware'),

  
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
  modalConfirmDeleteCashier: document.getElementById('modalConfirmDeleteCashier'),
  btnCloseModalDeleteCashier: document.getElementById('btnCloseModalDeleteCashier'),
  btnCancelModalDeleteCashier: document.getElementById('btnCancelModalDeleteCashier'),
  btnConfirmDeleteCashierSubmit: document.getElementById('btnConfirmDeleteCashierSubmit'),
  deleteCashierUserId: document.getElementById('deleteCashierUserId'),
  deleteCashierNameText: document.getElementById('deleteCashierNameText'),
  deleteCashierUsernameText: document.getElementById('deleteCashierUsernameText'),
  toastContainer: document.getElementById('toastContainer'),

  // Mobile Navigation & Sheet Elements
  mobileBottomNav: document.getElementById('mobileBottomNav'),
  btnOpenMobileMenu: document.getElementById('btnOpenMobileMenu'),
  mobileSheetBackdrop: document.getElementById('mobileSheetBackdrop'),
  btnCloseMobileSheet: document.getElementById('btnCloseMobileSheet'),
  sheetBtnToPos: document.getElementById('sheetBtnToPos'),
  sheetBtnLogout: document.getElementById('sheetBtnLogout'),
  bnavDebtBadge: document.getElementById('bnavDebtBadge'),
  bnavProductBadge: document.getElementById('bnavProductBadge'),
  sheetAuditBadge: document.getElementById('sheetAuditBadge'),
  sheetCashierBadge: document.getElementById('sheetCashierBadge'),
  sheetExpenseBadge: document.getElementById('sheetExpenseBadge'),

  // Mobile Header Telemetry Elements (Hari, Waktu & Kasir Online)
  mobileDayDate: document.getElementById('mobileDayDate'),
  mobileClockText: document.getElementById('mobileClockText'),
  mobileShiftDot: document.getElementById('mobileShiftDot'),
  mobileCashierName: document.getElementById('mobileCashierName'),

  // Manajemen Pemasok & Kulakan
  kpiTotalSuppliers: document.getElementById('kpiTotalSuppliers'),
  kpiMonthlyPurchases: document.getElementById('kpiMonthlyPurchases'),
  kpiTotalSupplierDebt: document.getElementById('kpiTotalSupplierDebt'),
  kpiSuppliersWithDebtText: document.getElementById('kpiSuppliersWithDebtText'),
  kpiOverdueSupplierDebt: document.getElementById('kpiOverdueSupplierDebt'),
  btnViewSuppliersList: document.getElementById('btnViewSuppliersList'),
  btnViewPurchasesList: document.getElementById('btnViewPurchasesList'),
  searchSupplierInput: document.getElementById('searchSupplierInput'),
  filterSupplierDebt: document.getElementById('filterSupplierDebt'),
  btnRefreshSuppliers: document.getElementById('btnRefreshSuppliers'),
  viewSuppliersContainer: document.getElementById('viewSuppliersContainer'),
  viewPurchasesContainer: document.getElementById('viewPurchasesContainer'),
  suppliersTableBody: document.getElementById('suppliersTableBody'),
  purchasesTableBody: document.getElementById('purchasesTableBody'),

  // Modal Tambah/Edit Supplier
  btnOpenAddSupplierModal: document.getElementById('btnOpenAddSupplierModal'),
  modalEditSupplier: document.getElementById('modalEditSupplier'),
  modalSupplierTitle: document.getElementById('modalSupplierTitle'),
  btnCloseModalSupplier: document.getElementById('btnCloseModalSupplier'),
  btnCancelSupplierModal: document.getElementById('btnCancelSupplierModal'),
  btnSaveSupplierSubmit: document.getElementById('btnSaveSupplierSubmit'),
  supplierEditId: document.getElementById('supplierEditId'),
  supInputName: document.getElementById('supInputName'),
  supInputPhone: document.getElementById('supInputPhone'),
  supInputAddress: document.getElementById('supInputAddress'),
  supInputCommodities: document.getElementById('supInputCommodities'),
  supInputBank: document.getElementById('supInputBank'),
  supInputNotes: document.getElementById('supInputNotes'),

  // Modal Supplier Detail
  modalSupplierDetail: document.getElementById('modalSupplierDetail'),
  supDetailName: document.getElementById('supDetailName'),
  supDetailSubtitle: document.getElementById('supDetailSubtitle'),
  btnCloseSupplierDetail: document.getElementById('btnCloseSupplierDetail'),
  btnCloseSupplierDetailBottom: document.getElementById('btnCloseSupplierDetailBottom'),
  supProfileCard: document.getElementById('supProfileCard'),
  btnSupTabPurchases: document.getElementById('btnSupTabPurchases'),
  btnSupTabPayments: document.getElementById('btnSupTabPayments'),
  supPurchasesCount: document.getElementById('supPurchasesCount'),
  supPaymentsCount: document.getElementById('supPaymentsCount'),
  supPurchasesContainer: document.getElementById('supPurchasesContainer'),
  supPaymentsContainer: document.getElementById('supPaymentsContainer'),
  supPurchasesTableBody: document.getElementById('supPurchasesTableBody'),
  supPaymentsTableBody: document.getElementById('supPaymentsTableBody'),

  // Modal Bayar Hutang Supplier
  modalSupplierPay: document.getElementById('modalSupplierPay'),
  btnCloseSupplierPay: document.getElementById('btnCloseSupplierPay'),
  btnCancelSupplierPay: document.getElementById('btnCancelSupplierPay'),
  supPaySubtitle: document.getElementById('supPaySubtitle'),
  supPayPurchaseId: document.getElementById('supPayPurchaseId'),
  supPayRemainingText: document.getElementById('supPayRemainingText'),
  supPayNoteDetails: document.getElementById('supPayNoteDetails'),
  supPayAmountInput: document.getElementById('supPayAmountInput'),
  btnSupPayFull: document.getElementById('btnSupPayFull'),
  supPayMethodSelect: document.getElementById('supPayMethodSelect'),
  supPayNotesInput: document.getElementById('supPayNotesInput'),
  btnSubmitSupplierPay: document.getElementById('btnSubmitSupplierPay'),

  // Modal Catat Kulakan Masuk
  btnOpenRecordPurchaseModal: document.getElementById('btnOpenRecordPurchaseModal'),
  modalOwnerRecordPurchase: document.getElementById('modalOwnerRecordPurchase'),
  btnCloseOwnerRecordPurchase: document.getElementById('btnCloseOwnerRecordPurchase'),
  btnCancelOwnerRecordPurchase: document.getElementById('btnCancelOwnerRecordPurchase'),
  ownerPurchaseSupplierSelect: document.getElementById('ownerPurchaseSupplierSelect'),
  ownerPurchaseProductSelect: document.getElementById('ownerPurchaseProductSelect'),
  ownerPurchaseQtyInput: document.getElementById('ownerPurchaseQtyInput'),
  ownerPurchaseCostInput: document.getElementById('ownerPurchaseCostInput'),
  ownerPurchaseTotalVal: document.getElementById('ownerPurchaseTotalVal'),
  ownerPurchasePaymentStatus: document.getElementById('ownerPurchasePaymentStatus'),
  ownerPurchaseTempoFields: document.getElementById('ownerPurchaseTempoFields'),
  ownerPurchaseDueDate: document.getElementById('ownerPurchaseDueDate'),
  ownerPurchaseDpAmount: document.getElementById('ownerPurchaseDpAmount'),
  ownerPurchaseNotesInput: document.getElementById('ownerPurchaseNotesInput'),
  btnSubmitOwnerRecordPurchase: document.getElementById('btnSubmitOwnerRecordPurchase'),

  // Modal Riwayat Stok Masuk Komoditas (Katalog)
  modalProductRestockHistory: document.getElementById('modalProductRestockHistory'),
  btnCloseProdRestockModal: document.getElementById('btnCloseProdRestockModal'),
  btnCloseProdRestockModalFooter: document.getElementById('btnCloseProdRestockModalFooter'),
  btnQuickRestockFromHistory: document.getElementById('btnQuickRestockFromHistory'),
  prodRestockModalTitle: document.getElementById('prodRestockModalTitle'),
  prodRestockModalSubtitle: document.getElementById('prodRestockModalSubtitle'),
  prodRestockIconBadge: document.getElementById('prodRestockIconBadge'),
  statProdCurrentStock: document.getElementById('statProdCurrentStock'),
  statProdTotalReceived: document.getElementById('statProdTotalReceived'),
  statProdEntriesCount: document.getElementById('statProdEntriesCount'),
  statProdTotalCost: document.getElementById('statProdTotalCost'),
  statProdDebtRemaining: document.getElementById('statProdDebtRemaining'),
  prodRestockTableBody: document.getElementById('prodRestockTableBody'),

  // Buku Biaya & Kas Operasional Toko (Owner)
  expenseCountBadge: document.getElementById('expenseCountBadge'),
  ownerKpiMonthExpenses: document.getElementById('ownerKpiMonthExpenses'),
  ownerKpiExpensesCount: document.getElementById('ownerKpiExpensesCount'),
  ownerKpiDrawerExpenses: document.getElementById('ownerKpiDrawerExpenses'),
  ownerKpiTransferExpenses: document.getElementById('ownerKpiTransferExpenses'),
  ownerKpiTotalIncome: document.getElementById('ownerKpiTotalIncome'),
  ownerExpenseCategoryBars: document.getElementById('ownerExpenseCategoryBars'),
  ownerSearchExpenseInput: document.getElementById('ownerSearchExpenseInput'),
  ownerFilterExpenseCategory: document.getElementById('ownerFilterExpenseCategory'),
  ownerFilterExpenseSource: document.getElementById('ownerFilterExpenseSource'),
  btnRefreshOwnerExpenses: document.getElementById('btnRefreshOwnerExpenses'),
  ownerExpensesTableBody: document.getElementById('ownerExpensesTableBody'),
  btnOwnerAddExpense: document.getElementById('btnOwnerAddExpense'),
  btnOwnerAddIncome: document.getElementById('btnOwnerAddIncome'),
  modalOwnerAddExpense: document.getElementById('modalOwnerAddExpense'),
  btnCloseOwnerAddExpense: document.getElementById('btnCloseOwnerAddExpense'),
  btnCancelOwnerAddExpense: document.getElementById('btnCancelOwnerAddExpense'),
  btnSubmitOwnerAddExpense: document.getElementById('btnSubmitOwnerAddExpense'),
  ownerExpenseCategorySelect: document.getElementById('ownerExpenseCategorySelect'),
  ownerSourceCash: document.getElementById('ownerSourceCash'),
  ownerSourceTransfer: document.getElementById('ownerSourceTransfer'),
  ownerExpenseAmountInput: document.getElementById('ownerExpenseAmountInput'),
  ownerExpenseNotesInput: document.getElementById('ownerExpenseNotesInput'),
  modalOwnerAddIncome: document.getElementById('modalOwnerAddIncome'),
  btnCloseOwnerAddIncome: document.getElementById('btnCloseOwnerAddIncome'),
  btnCancelOwnerAddIncome: document.getElementById('btnCancelOwnerAddIncome'),
  btnSubmitOwnerAddIncome: document.getElementById('btnSubmitOwnerAddIncome'),
  ownerIncomeCategorySelect: document.getElementById('ownerIncomeCategorySelect'),
  ownerIncomeAmountInput: document.getElementById('ownerIncomeAmountInput'),
  ownerIncomeSourceSelect: document.getElementById('ownerIncomeSourceSelect'),
  ownerIncomeNotesInput: document.getElementById('ownerIncomeNotesInput'),
  ownerExpenseShortageAlert: document.getElementById('ownerExpenseShortageAlert'),
  lblOwnerDrawerAvail: document.getElementById('lblOwnerDrawerAvail'),
  lblOwnerDrawerShortage: document.getElementById('lblOwnerDrawerShortage'),
  btnOwnerQuickAddIncomeFromAlert: document.getElementById('btnOwnerQuickAddIncomeFromAlert'),

  // Owner Direct Login & Logout Confirmation Elements
  ownerLoginModal: document.getElementById('ownerLoginModal'),
  ownerLoginDialog: document.querySelector('.owner-login-dialog'),
  ownerLoginAlert: document.getElementById('ownerLoginAlert'),
  ownerLoginStoreName: document.getElementById('ownerLoginStoreName'),
  ownerPinInput: document.getElementById('ownerPinInput'),
  ownerPinDisplayWrap: document.getElementById('ownerPinDisplayWrap'),
  ownerPinDots: document.getElementById('ownerPinDots'),
  ownerLoginNumpad: document.getElementById('ownerLoginNumpad'),
  modalConfirmLogoutOwner: document.getElementById('modalConfirmLogoutOwner'),
  btnCloseModalLogoutOwner: document.getElementById('btnCloseModalLogoutOwner'),
  btnCancelModalLogoutOwner: document.getElementById('btnCancelModalLogoutOwner'),
  btnConfirmLogoutOwnerSubmit: document.getElementById('btnConfirmLogoutOwnerSubmit')
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

function formatShortRupiah(num) {
  const val = Number(num || 0);
  if (Math.abs(val) >= 1_000_000_000) {
    return 'Rp ' + (val / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' M';
  }
  if (Math.abs(val) >= 1_000_000) {
    return 'Rp ' + (val / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';
  }
  if (Math.abs(val) >= 1_000) {
    return 'Rp ' + (val / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 }) + ' rb';
  }
  return 'Rp ' + val.toLocaleString('id-ID');
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : (type === 'info' ? '📱' : '⚠️'));
  toast.innerHTML = `<span>${icon}</span> ${message}`;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

// -----------------------------------------------------------------------------
// OWNER AUTHENTICATION & DIRECT PHONE LOGIN ENGINE
// -----------------------------------------------------------------------------
let ownerPollingTimer = null;
let ownerEnteredPin = '';

function startOwnerAutoPolling() {
  if (ownerPollingTimer) clearInterval(ownerPollingTimer);
  ownerPollingTimer = setInterval(() => {
    if (!api.token || !state.user || state.user.role !== 'owner') return;
    checkTabletSyncHeartbeat();
    api.getDashboardReport().then(dashRes => {
      state.dashboard = dashRes;
      renderKPIs();
      renderLiquiditySnapshot();
      renderDailyCashflowLedger();
      renderRevenueChart();
      renderAnomalyRadar();
      renderLowStockRadar();
      renderVoidDetails();
      renderRecentFeeds();
    }).catch(() => {});
  }, 30000);
}

function showOwnerLoginModal(initialMsg = null) {
  if (!el.ownerLoginModal) return;
  ownerEnteredPin = '';
  if (el.ownerPinInput) el.ownerPinInput.value = '';
  updateOwnerPinDots();

  if (el.ownerLoginAlert) {
    if (initialMsg) {
      el.ownerLoginAlert.textContent = initialMsg;
      el.ownerLoginAlert.style.display = 'block';
    } else {
      el.ownerLoginAlert.textContent = '';
      el.ownerLoginAlert.style.display = 'none';
    }
  }

  if (el.ownerLoginStoreName) {
    const storeName = (state.settings && state.settings.store_name) || localStorage.getItem('pos_store_name') || 'PD. HASIL BUMI RAYA 1';
    el.ownerLoginStoreName.textContent = storeName;
  }

  el.ownerLoginModal.style.display = 'flex';
  setTimeout(() => {
    if (el.ownerPinInput) el.ownerPinInput.focus();
  }, 100);
}

function hideOwnerLoginModal() {
  if (el.ownerLoginModal) {
    el.ownerLoginModal.style.display = 'none';
  }
  ownerEnteredPin = '';
  if (el.ownerPinInput) el.ownerPinInput.value = '';
  updateOwnerPinDots();
}

function updateOwnerPinDots() {
  if (!el.ownerPinDots) return;
  const dots = el.ownerPinDots.querySelectorAll('.pin-dot');
  dots.forEach((dot, idx) => {
    if (idx < ownerEnteredPin.length) {
      dot.classList.add('filled');
    } else {
      dot.classList.remove('filled');
    }
  });
}

function shakeOwnerLoginDialog() {
  if (!el.ownerLoginDialog) return;
  el.ownerLoginDialog.classList.remove('shake');
  void el.ownerLoginDialog.offsetWidth;
  el.ownerLoginDialog.classList.add('shake');
}

function showOwnerLoginError(msg) {
  if (el.ownerLoginAlert) {
    el.ownerLoginAlert.textContent = msg;
    el.ownerLoginAlert.style.display = 'block';
  }
  shakeOwnerLoginDialog();
  ownerEnteredPin = '';
  if (el.ownerPinInput) el.ownerPinInput.value = '';
  updateOwnerPinDots();
}

async function submitOwnerPinLogin(pin) {
  if (!pin || pin.length < 4) return;
  if (el.ownerLoginAlert) el.ownerLoginAlert.style.display = 'none';

  try {
    const res = await api.login(pin);
    if (!res.user || res.user.role !== 'owner') {
      const roleName = res.user && res.user.name ? `Kasir (${res.user.name})` : 'Kasir';
      showOwnerLoginError(`Akses Ditolak: PIN ini terdaftar sebagai ${roleName}. Dashboard eksekutif ini khusus Pemilik Toko (Owner).`);
      return;
    }

    api.setSession(res.token, res.user);
    state.user = res.user;
    hideOwnerLoginModal();
    showToast(`Selamat datang, ${state.user.name || 'Owner'}! Dashboard aktif.`, 'success');

    await loadAllData();
    await checkTabletSyncHeartbeat();
    startOwnerAutoPolling();
  } catch (err) {
    console.error('Owner PIN login error:', err);
    showOwnerLoginError(err.message || 'PIN salah. Silakan coba lagi.');
  }
}

function openLogoutModal() {
  if (el.modalConfirmLogoutOwner) {
    el.modalConfirmLogoutOwner.style.display = 'flex';
  } else {
    if (confirm('Keluar dari sesi Owner?')) {
      handleOwnerLogoutExecution();
    }
  }
}

function closeLogoutModal() {
  if (el.modalConfirmLogoutOwner) {
    el.modalConfirmLogoutOwner.style.display = 'none';
  }
}

function handleOwnerLogoutExecution() {
  if (ownerPollingTimer) {
    clearInterval(ownerPollingTimer);
    ownerPollingTimer = null;
  }
  api.clearSession();
  state.user = null;
  showToast('Sesi Owner telah diakhiri secara aman.', 'info');
  showOwnerLoginModal('Sesi telah diakhiri. Masukkan PIN Owner untuk masuk kembali.');
}

function bindOwnerLoginEvents() {
  if (el.ownerPinDisplayWrap && el.ownerPinInput) {
    el.ownerPinDisplayWrap.addEventListener('click', () => {
      el.ownerPinInput.focus();
    });
  }

  if (el.ownerPinInput) {
    el.ownerPinInput.addEventListener('input', (e) => {
      const cleanDigits = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
      ownerEnteredPin = cleanDigits;
      e.target.value = cleanDigits;
      updateOwnerPinDots();
      if (cleanDigits.length === 6) {
        submitOwnerPinLogin(cleanDigits);
      }
    });

    el.ownerPinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (ownerEnteredPin.length >= 4) {
          submitOwnerPinLogin(ownerEnteredPin);
        }
      }
    });
  }

  if (el.ownerLoginNumpad) {
    el.ownerLoginNumpad.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-owner-num');
      if (!btn) return;
      const key = btn.dataset.key;
      if (key === 'clear') {
        ownerEnteredPin = '';
        if (el.ownerPinInput) el.ownerPinInput.value = '';
        updateOwnerPinDots();
        if (el.ownerLoginAlert) el.ownerLoginAlert.style.display = 'none';
      } else if (key === 'backspace') {
        ownerEnteredPin = ownerEnteredPin.slice(0, -1);
        if (el.ownerPinInput) el.ownerPinInput.value = ownerEnteredPin;
        updateOwnerPinDots();
      } else if (key) {
        if (ownerEnteredPin.length < 6) {
          ownerEnteredPin += key;
          if (el.ownerPinInput) el.ownerPinInput.value = ownerEnteredPin;
          updateOwnerPinDots();
          if (ownerEnteredPin.length === 6) {
            submitOwnerPinLogin(ownerEnteredPin);
          }
        }
      }
    });
  }

  if (el.btnCloseModalLogoutOwner) {
    el.btnCloseModalLogoutOwner.addEventListener('click', closeLogoutModal);
  }
  if (el.btnCancelModalLogoutOwner) {
    el.btnCancelModalLogoutOwner.addEventListener('click', closeLogoutModal);
  }
  if (el.btnConfirmLogoutOwnerSubmit) {
    el.btnConfirmLogoutOwnerSubmit.addEventListener('click', () => {
      closeLogoutModal();
      handleOwnerLogoutExecution();
    });
  }
}

// -----------------------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------------------
async function initOwnerApp() {
  bindEvents();
  bindOwnerLoginEvents();
  initOwnerHardwareSupport();
  updateClock();
  setInterval(updateClock, 1000);

  // Check Subscription & License Status
  initSubscriptionGuard({ isOwner: true });

  if (!api.token) {
    showOwnerLoginModal();
    return;
  }

  try {
    const meRes = await api.getMe();
    state.user = meRes.user;

    if (state.user.role !== 'owner') {
      api.clearSession();
      showOwnerLoginModal('Akses Ditolak: Anda sebelumnya login sebagai Kasir. Masukkan PIN Pemilik (Owner).');
      return;
    }

    hideOwnerLoginModal();
    await loadAllData();
    await checkTabletSyncHeartbeat();
    startOwnerAutoPolling();
  } catch (err) {
    console.error('Session error:', err);
    api.clearSession();
    showOwnerLoginModal('Sesi login telah kedaluwarsa. Masukkan PIN Owner kembali.');
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
  if (el.mobileDayDate) {
    el.mobileDayDate.textContent = now.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  }
  if (el.mobileClockText) {
    el.mobileClockText.textContent = now.toLocaleTimeString('id-ID') + ' WIB';
  }
}

function bindEvents() {
  el.btnRefreshData.addEventListener('click', loadAllData);
  if (el.btnRefreshAudit) el.btnRefreshAudit.addEventListener('click', loadAllData);
  el.btnBackToPos.addEventListener('click', () => { window.location.href = '/?mode=pos'; });

  if (el.btnOwnerLogout) {
    el.btnOwnerLogout.addEventListener('click', (e) => {
      e.preventDefault();
      openLogoutModal();
    });
  }

  // Revenue Chart Time Toggles (7 Days vs Today Hourly)
  document.querySelectorAll('.btn-chart-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-chart-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentChartTimeView = btn.dataset.view;
      renderRevenueChart();
    });
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

function switchTab(tabId) {
  if (!tabId) return;

  // 1. Sync Top Subnav Pills
  document.querySelectorAll('.tab-pill').forEach(b => {
    const isTarget = b.dataset.tab === tabId;
    b.classList.toggle('active', isTarget);
    b.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    if (isTarget) {
      b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  });

  // 2. Sync Bottom Nav Items
  document.querySelectorAll('.bottom-nav-item[data-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });

  // 3. Show target section, hide others
  document.querySelectorAll('.exec-section').forEach(s => {
    const isTarget = s.id === tabId;
    s.classList.toggle('active', isTarget);
    s.style.display = isTarget ? 'flex' : 'none';
  });

  // 4. Trigger section-specific loaders / charts
  if (tabId === 'tab-reports') {
    loadSalesReport();
    if (state.reportSalesChartInstance) {
      setTimeout(() => state.reportSalesChartInstance && state.reportSalesChartInstance.resize(), 60);
    }
  } else if (tabId === 'tab-cashflow') {
    if (state.revenueChartInstance) {
      state.revenueChartInstance.resize();
    } else {
      renderRevenueChart();
    }
  } else if (tabId === 'tab-debts') {
    loadDebtsData();
  } else if (tabId === 'tab-suppliers') {
    loadSuppliersData();
    loadPurchasesData();
  } else if (tabId === 'tab-expenses') {
    loadOwnerExpensesData();
  } else if (tabId === 'tab-settings') {
    renderLiveReceiptPreview();
    loadOwnerLicenseCard();
  }

  // 5. Close Mobile Action Sheet if open
  if (el.mobileSheetBackdrop) {
    el.mobileSheetBackdrop.style.display = 'none';
  }

  // Smooth scroll to top when switching
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

  // Tab switching (Desktop Subnav & Mobile Bottom Nav)
  document.querySelectorAll('.tab-pill').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll('.bottom-nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll('.sheet-tile-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Recent Feeds Quick Navigation Links
  if (el.btnGoToSalesReport) {
    el.btnGoToSalesReport.addEventListener('click', () => switchTab('tab-reports'));
  }
  if (el.btnGoToExpensesTab) {
    el.btnGoToExpensesTab.addEventListener('click', () => switchTab('tab-expenses'));
  }
  if (el.btnGoToSuppliersTab) {
    el.btnGoToSuppliersTab.addEventListener('click', () => switchTab('tab-suppliers'));
  }

  // Mobile Bottom Sheet Trigger & Dismiss
  if (el.btnOpenMobileMenu && el.mobileSheetBackdrop) {
    el.btnOpenMobileMenu.addEventListener('click', () => {
      el.mobileSheetBackdrop.style.display = 'flex';
    });
  }

  if (el.btnCloseMobileSheet && el.mobileSheetBackdrop) {
    el.btnCloseMobileSheet.addEventListener('click', () => {
      el.mobileSheetBackdrop.style.display = 'none';
    });
  }

  if (el.mobileSheetBackdrop) {
    el.mobileSheetBackdrop.addEventListener('click', (e) => {
      if (e.target === el.mobileSheetBackdrop) {
        el.mobileSheetBackdrop.style.display = 'none';
      }
    });
  }

  if (el.sheetBtnToPos) {
    el.sheetBtnToPos.addEventListener('click', () => {
      window.location.href = '/?mode=pos';
    });
  }

  if (el.sheetBtnLogout) {
    el.sheetBtnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      openLogoutModal();
    });
  }

  // Tablet Sync Pill Tap (Show Device Info Toast)
  if (el.ownerTabletSyncPill) {
    el.ownerTabletSyncPill.addEventListener('click', () => {
      const info = el.ownerTabletSyncPill.getAttribute('title') || 'Tablet Kios Pasar Aktif';
      showToast(info, 'info');
    });
  }

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
    el.btnApplyReportFilter.addEventListener('click', () => {
      state.activeReportPeriod = null;
      if (el.reportPresetGroup) {
        el.reportPresetGroup.querySelectorAll('.btn-period-chip').forEach(btn => btn.classList.remove('active'));
      }
      loadSalesReport();
    });
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

  if (el.btnCloseModalDeleteCashier) el.btnCloseModalDeleteCashier.addEventListener('click', closeDeleteCashierModal);
  if (el.btnCancelModalDeleteCashier) el.btnCancelModalDeleteCashier.addEventListener('click', closeDeleteCashierModal);
  if (el.btnConfirmDeleteCashierSubmit) el.btnConfirmDeleteCashierSubmit.addEventListener('click', handleConfirmDeleteCashier);

  // Settings & Live Receipt Preview Listeners
  ['setStoreName', 'setStoreTagline', 'setStoreAddress', 'setStorePhone', 'setReceiptFooter'].forEach(id => {
    const inputEl = document.getElementById(id);
    if (inputEl) inputEl.addEventListener('input', renderLiveReceiptPreview);
  });
  if (el.btnSaveStoreSettings) el.btnSaveStoreSettings.addEventListener('click', handleSaveStoreSettings);
  if (el.btnChangeOwnerPin) el.btnChangeOwnerPin.addEventListener('click', handleChangeOwnerPin);

  // License & Subscription Settings Listeners
  const btnOwnerCopyAcc = document.getElementById('btnOwnerCopyAcc');
  if (btnOwnerCopyAcc) {
    btnOwnerCopyAcc.addEventListener('click', async () => {
      const accEl = document.getElementById('ownerLicenseAccount');
      if (!accEl) return;
      const textToCopy = accEl.textContent.trim().replace(/[^0-9]/g, '');
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(textToCopy);
        }
        btnOwnerCopyAcc.textContent = '✅ Tersalin!';
        setTimeout(() => { btnOwnerCopyAcc.textContent = '📋 Salin No. Rekening'; }, 2000);
      } catch (err) {}
    });
  }

  const btnOwnerCheckSub = document.getElementById('btnOwnerCheckSubStatus');
  if (btnOwnerCheckSub) {
    btnOwnerCheckSub.addEventListener('click', async () => {
      btnOwnerCheckSub.disabled = true;
      btnOwnerCheckSub.textContent = '⏳ Memeriksa...';
      try {
        await loadOwnerLicenseCard();
        showToast('Status lisensi langganan berhasil diperiksa!', 'success');
      } finally {
        btnOwnerCheckSub.disabled = false;
        btnOwnerCheckSub.textContent = '🔄 Periksa Status Lisensi Sekarang';
      }
    });
  }

  // Supplier View Toggle
  if (el.btnViewSuppliersList) {
    el.btnViewSuppliersList.addEventListener('click', () => {
      state.currentSupplierView = 'suppliers';
      el.btnViewSuppliersList.classList.add('active');
      if (el.btnViewPurchasesList) el.btnViewPurchasesList.classList.remove('active');
      if (el.viewSuppliersContainer) el.viewSuppliersContainer.style.display = 'block';
      if (el.viewPurchasesContainer) el.viewPurchasesContainer.style.display = 'none';
      loadSuppliersData();
    });
  }

  if (el.btnViewPurchasesList) {
    el.btnViewPurchasesList.addEventListener('click', () => {
      state.currentSupplierView = 'purchases';
      el.btnViewPurchasesList.classList.add('active');
      if (el.btnViewSuppliersList) el.btnViewSuppliersList.classList.remove('active');
      if (el.viewSuppliersContainer) el.viewSuppliersContainer.style.display = 'none';
      if (el.viewPurchasesContainer) el.viewPurchasesContainer.style.display = 'block';
      loadPurchasesData();
    });
  }

  // Supplier Search & Filter
  if (el.searchSupplierInput) {
    let supSearchTimeout;
    el.searchSupplierInput.addEventListener('input', () => {
      clearTimeout(supSearchTimeout);
      supSearchTimeout = setTimeout(() => {
        if (state.currentSupplierView === 'suppliers') {
          loadSuppliersData();
        } else {
          loadPurchasesData();
        }
      }, 300);
    });
  }

  if (el.filterSupplierDebt) {
    el.filterSupplierDebt.addEventListener('change', () => {
      state.activeSupplierDebtFilter = el.filterSupplierDebt.value;
      loadSuppliersData();
    });
  }

  if (el.btnRefreshSuppliers) {
    el.btnRefreshSuppliers.addEventListener('click', () => {
      loadSuppliersData();
      loadPurchasesData();
    });
  }

  // Supplier Modal Add / Edit
  if (el.btnOpenAddSupplierModal) {
    el.btnOpenAddSupplierModal.addEventListener('click', () => openSupplierModal(null));
  }
  if (el.btnCloseModalSupplier) {
    el.btnCloseModalSupplier.addEventListener('click', () => { if (el.modalEditSupplier) el.modalEditSupplier.style.display = 'none'; });
  }
  if (el.btnCancelSupplierModal) {
    el.btnCancelSupplierModal.addEventListener('click', () => { if (el.modalEditSupplier) el.modalEditSupplier.style.display = 'none'; });
  }
  if (el.btnSaveSupplierSubmit) {
    el.btnSaveSupplierSubmit.addEventListener('click', handleSaveSupplierSubmit);
  }

  // Supplier Detail Modal
  if (el.btnCloseSupplierDetail) {
    el.btnCloseSupplierDetail.addEventListener('click', () => { if (el.modalSupplierDetail) el.modalSupplierDetail.style.display = 'none'; });
  }
  if (el.btnCloseSupplierDetailBottom) {
    el.btnCloseSupplierDetailBottom.addEventListener('click', () => { if (el.modalSupplierDetail) el.modalSupplierDetail.style.display = 'none'; });
  }
  if (el.btnSupTabPurchases) {
    el.btnSupTabPurchases.addEventListener('click', () => {
      el.btnSupTabPurchases.classList.add('active');
      if (el.btnSupTabPayments) el.btnSupTabPayments.classList.remove('active');
      if (el.supPurchasesContainer) el.supPurchasesContainer.style.display = 'block';
      if (el.supPaymentsContainer) el.supPaymentsContainer.style.display = 'none';
    });
  }
  if (el.btnSupTabPayments) {
    el.btnSupTabPayments.addEventListener('click', () => {
      el.btnSupTabPayments.classList.add('active');
      if (el.btnSupTabPurchases) el.btnSupTabPurchases.classList.remove('active');
      if (el.supPurchasesContainer) el.supPurchasesContainer.style.display = 'none';
      if (el.supPaymentsContainer) el.supPaymentsContainer.style.display = 'block';
    });
  }

  // Supplier Pay Modal
  if (el.btnCloseSupplierPay) {
    el.btnCloseSupplierPay.addEventListener('click', () => { if (el.modalSupplierPay) el.modalSupplierPay.style.display = 'none'; });
  }
  if (el.btnCancelSupplierPay) {
    el.btnCancelSupplierPay.addEventListener('click', () => { if (el.modalSupplierPay) el.modalSupplierPay.style.display = 'none'; });
  }
  if (el.btnSupPayFull) {
    el.btnSupPayFull.addEventListener('click', () => {
      if (state.activePurchaseForPayment && el.supPayAmountInput) {
        el.supPayAmountInput.value = state.activePurchaseForPayment.remaining_amount;
      }
    });
  }
  if (el.btnSubmitSupplierPay) {
    el.btnSubmitSupplierPay.addEventListener('click', handleSubmitSupplierPay);
  }

  // Owner Record Purchase Modal
  if (el.btnOpenRecordPurchaseModal) {
    el.btnOpenRecordPurchaseModal.addEventListener('click', () => openOwnerRecordPurchaseModal());
  }
  if (el.btnCloseOwnerRecordPurchase) {
    el.btnCloseOwnerRecordPurchase.addEventListener('click', () => { if (el.modalOwnerRecordPurchase) el.modalOwnerRecordPurchase.style.display = 'none'; });
  }
  if (el.btnCancelOwnerRecordPurchase) {
    el.btnCancelOwnerRecordPurchase.addEventListener('click', () => { if (el.modalOwnerRecordPurchase) el.modalOwnerRecordPurchase.style.display = 'none'; });
  }
  if (el.ownerPurchaseProductSelect) {
    el.ownerPurchaseProductSelect.addEventListener('change', () => {
      const opt = el.ownerPurchaseProductSelect.options[el.ownerPurchaseProductSelect.selectedIndex];
      if (opt && opt.dataset.cost && el.ownerPurchaseCostInput) {
        el.ownerPurchaseCostInput.value = opt.dataset.cost;
      }
      updateOwnerPurchaseTotal();
    });
  }
  if (el.ownerPurchaseQtyInput) {
    el.ownerPurchaseQtyInput.addEventListener('input', updateOwnerPurchaseTotal);
  }
  if (el.ownerPurchaseCostInput) {
    el.ownerPurchaseCostInput.addEventListener('input', updateOwnerPurchaseTotal);
  }
  if (el.ownerPurchasePaymentStatus) {
    el.ownerPurchasePaymentStatus.addEventListener('change', () => {
      if (el.ownerPurchaseTempoFields) {
        el.ownerPurchaseTempoFields.style.display = (el.ownerPurchasePaymentStatus.value === 'tempo') ? 'block' : 'none';
      }
    });
  }
  if (el.btnSubmitOwnerRecordPurchase) {
    el.btnSubmitOwnerRecordPurchase.addEventListener('click', handleSubmitOwnerRecordPurchase);
  }

  // Owner Expenses & Petty Cash Listeners
  if (el.btnOwnerAddExpense) {
    el.btnOwnerAddExpense.addEventListener('click', () => {
      if (el.modalOwnerAddExpense) el.modalOwnerAddExpense.style.display = 'flex';
      if (el.ownerExpenseAmountInput) el.ownerExpenseAmountInput.value = '';
      if (el.ownerExpenseNotesInput) el.ownerExpenseNotesInput.value = '';
    });
  }
  if (el.btnCloseOwnerAddExpense) {
    el.btnCloseOwnerAddExpense.addEventListener('click', () => {
      if (el.modalOwnerAddExpense) el.modalOwnerAddExpense.style.display = 'none';
    });
  }
  if (el.btnCancelOwnerAddExpense) {
    el.btnCancelOwnerAddExpense.addEventListener('click', () => {
      if (el.modalOwnerAddExpense) el.modalOwnerAddExpense.style.display = 'none';
    });
  }
  if (el.ownerExpenseAmountInput) {
    el.ownerExpenseAmountInput.addEventListener('input', checkOwnerExpenseSufficiency);
  }
  if (el.ownerSourceCash) {
    el.ownerSourceCash.addEventListener('change', checkOwnerExpenseSufficiency);
  }
  if (el.ownerSourceTransfer) {
    el.ownerSourceTransfer.addEventListener('change', checkOwnerExpenseSufficiency);
  }
  if (el.btnOwnerQuickAddIncomeFromAlert) {
    el.btnOwnerQuickAddIncomeFromAlert.addEventListener('click', () => {
      const amount = Number(el.ownerExpenseAmountInput ? el.ownerExpenseAmountInput.value : 0) || 0;
      const drawerCash = Number(state.currentDrawerCash) || 0;
      const shortage = Math.max(50000, amount - drawerCash);
      if (el.modalOwnerAddExpense) el.modalOwnerAddExpense.style.display = 'none';
      if (el.modalOwnerAddIncome) el.modalOwnerAddIncome.style.display = 'flex';
      if (el.ownerIncomeAmountInput) el.ownerIncomeAmountInput.value = shortage;
      if (el.ownerIncomeNotesInput) el.ownerIncomeNotesInput.value = 'Tambah modal kas laci toko';
    });
  }
  if (el.btnSubmitOwnerAddExpense) {
    el.btnSubmitOwnerAddExpense.addEventListener('click', handleSaveOwnerExpense);
  }

  if (el.btnOwnerAddIncome) {
    el.btnOwnerAddIncome.addEventListener('click', () => {
      if (el.modalOwnerAddIncome) el.modalOwnerAddIncome.style.display = 'flex';
      if (el.ownerIncomeAmountInput) el.ownerIncomeAmountInput.value = '';
      if (el.ownerIncomeNotesInput) el.ownerIncomeNotesInput.value = '';
    });
  }
  if (el.btnCloseOwnerAddIncome) {
    el.btnCloseOwnerAddIncome.addEventListener('click', () => {
      if (el.modalOwnerAddIncome) el.modalOwnerAddIncome.style.display = 'none';
    });
  }
  if (el.btnCancelOwnerAddIncome) {
    el.btnCancelOwnerAddIncome.addEventListener('click', () => {
      if (el.modalOwnerAddIncome) el.modalOwnerAddIncome.style.display = 'none';
    });
  }
  if (el.btnSubmitOwnerAddIncome) {
    el.btnSubmitOwnerAddIncome.addEventListener('click', handleSaveOwnerIncome);
  }

  if (el.ownerSearchExpenseInput) {
    el.ownerSearchExpenseInput.addEventListener('input', renderOwnerExpensesTable);
  }
  if (el.ownerFilterExpenseCategory) {
    el.ownerFilterExpenseCategory.addEventListener('change', renderOwnerExpensesTable);
  }
  if (el.ownerFilterExpenseSource) {
    el.ownerFilterExpenseSource.addEventListener('change', renderOwnerExpensesTable);
  }
  if (el.btnRefreshOwnerExpenses) {
    el.btnRefreshOwnerExpenses.addEventListener('click', () => loadOwnerExpensesData());
  }
}

async function checkTabletSyncHeartbeat() {
  try {
    const statusRes = await api.getSyncStatus();
    if (!statusRes || !statusRes.success) return;

    if (el.ownerTabletLastSync) {
      const lastSyncDate = statusRes.last_sync_updated_at ? new Date(statusRes.last_sync_updated_at.replace(' ', 'T')) : null;
      if (lastSyncDate && !isNaN(lastSyncDate.getTime())) {
        const diffMinutes = (Date.now() - lastSyncDate.getTime()) / 60000;
        const timeStr = lastSyncDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
        if (diffMinutes <= 2) {
          el.ownerTabletLastSync.textContent = `🟢 Online (${timeStr})`;
          el.ownerTabletLastSync.style.color = '#34d399';
        } else if (diffMinutes <= 10) {
          el.ownerTabletLastSync.textContent = `Sync: ${timeStr}`;
          el.ownerTabletLastSync.style.color = '#f59e0b';
        } else {
          el.ownerTabletLastSync.textContent = `Offline sejak ${timeStr}`;
          el.ownerTabletLastSync.style.color = '#f87171';
        }
      } else if (statusRes.last_sync) {
        el.ownerTabletLastSync.textContent = `Sync: ${statusRes.last_sync}`;
      } else {
        el.ownerTabletLastSync.textContent = 'Belum pernah sync';
      }
    }

    if (el.ownerTabletName && statusRes.device_info) {
      const devClean = statusRes.device_info.split(' ')[0];
      const cashierName = statusRes.active_shift ? ` (${statusRes.active_shift.cashier_name.split(' ')[0]})` : '';
      el.ownerTabletName.textContent = `📱 ${devClean}${cashierName}`;
    }

    if (el.ownerTabletSyncPill) {
      const syncStatusText = statusRes.last_sync ? `Sync: ${statusRes.last_sync}` : 'Sinkronisasi Aktif';
      el.ownerTabletSyncPill.setAttribute('title', `Tablet Kios: ${statusRes.device_info || 'Online'} • ${syncStatusText}`);
    }

    if (el.tabletPulseDot) {
      if (statusRes.last_sync_updated_at) {
        const lastSyncDate = new Date(statusRes.last_sync_updated_at.replace(' ', 'T'));
        const diffMinutes = (Date.now() - lastSyncDate.getTime()) / 60000;
        if (diffMinutes <= 3) {
          el.tabletPulseDot.style.backgroundColor = '#22c55e';
          el.tabletPulseDot.style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.8)';
        } else if (diffMinutes <= 10) {
          el.tabletPulseDot.style.backgroundColor = '#f59e0b';
          el.tabletPulseDot.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.8)';
        } else {
          el.tabletPulseDot.style.backgroundColor = '#ef4444';
          el.tabletPulseDot.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.8)';
        }
      }
    }
  } catch (e) {
    console.warn('Gagal cek heartbeat tablet:', e);
  }
}

function setRefreshButtonState(isLoading) {
  if (!el.btnRefreshData) return;
  if (isLoading) {
    el.btnRefreshData.classList.add('loading');
    el.btnRefreshData.innerHTML = '<span class="icon">⏳</span><span class="btn-text-full">Memuat...</span>';
  } else {
    el.btnRefreshData.classList.remove('loading');
    el.btnRefreshData.innerHTML = '<span class="icon">🔄</span><span class="btn-text-full">Segarkan</span>';
  }
}

// -----------------------------------------------------------------------------
// DATA FETCHING
// -----------------------------------------------------------------------------
async function loadAllData() {
  try {
    setRefreshButtonState(true);
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
    if (el.bnavProductBadge) el.bnavProductBadge.textContent = state.products.length;

    el.auditCountBadge.textContent = state.auditLogs.length;
    if (el.sheetAuditBadge) el.sheetAuditBadge.textContent = state.auditLogs.length;

    const activeCashiers = state.users.filter(u => u.role === 'cashier' && (u.is_active === 1 || u.is_active === true || u.is_active === undefined));
    if (el.cashierCountBadge) el.cashierCountBadge.textContent = activeCashiers.length;
    if (el.sheetCashierBadge) el.sheetCashierBadge.textContent = activeCashiers.length;

    renderKPIs();
    renderLiquiditySnapshot();
    renderDailyCashflowLedger();
    renderRecentFeeds();
    renderRevenueChart();
    renderAnomalyRadar();
    renderLowStockRadar();
    renderShifts();
    renderVoidDetails();
    renderWaste();
    renderProductsGrid();
    filterAuditLogs();
    renderCashiers();
    await loadDebtsData();
    await loadSuppliersData();
    await loadOwnerExpensesData();
    populateSettingsForm();
    renderLiveReceiptPreview();
    await loadOwnerLicenseCard();
    await checkTabletSyncHeartbeat();

    showToast('Data toko berhasil diperbarui real-time!', 'success');
  } catch (err) {
    showToast('Gagal memuat data dashboard: ' + err.message, 'error');
  } finally {
    setRefreshButtonState(false);
  }
}

// -----------------------------------------------------------------------------
// TAB 1 RENDERERS (EXECUTIVE CASHFLOW & FRAUD INTELLIGENCE)
// -----------------------------------------------------------------------------
function renderKPIs() {
  const s = state.dashboard.summary || {};
  if (el.kpiCashDrawer) el.kpiCashDrawer.textContent = formatRupiah(s.cash_in_drawer || 0);
  if (el.kpiRevenueToday) el.kpiRevenueToday.textContent = formatRupiah(s.total_revenue || 0);
  if (el.kpiOrdersCount) el.kpiOrdersCount.textContent = `${s.total_orders || 0} Nota Selesai Diproses`;

  // Total Kas Keluar Hari Ini (Store Expenses + Supplier Payments)
  const totalOutflow = s.total_cash_outflow_today || 0;
  if (el.kpiTotalExpenseToday) el.kpiTotalExpenseToday.textContent = formatRupiah(totalOutflow);
  if (el.kpiExpenseSubLabel) {
    const storeExp = s.total_expenses_today || 0;
    const supExp = s.total_supplier_paid_today || 0;
    el.kpiExpenseSubLabel.textContent = `Operasional: ${formatRupiah(storeExp)} | Kulakan: ${formatRupiah(supExp)}`;
  }

  // Laba Bersih Riil Toko (Net Operating Profit)
  const netProfit = s.net_profit_today !== undefined ? s.net_profit_today : 0;
  if (el.kpiNetProfitToday) el.kpiNetProfitToday.textContent = formatRupiah(netProfit);
  if (el.cardNetProfitWrap) {
    el.cardNetProfitWrap.className = netProfit >= 0 ? 'kpi-card-v2 kpi-emerald' : 'kpi-card-v2 kpi-rose';
  }
  if (el.kpiProfitSubLabel) {
    const marginPct = s.gross_margin_pct || 0;
    if (netProfit >= 0) {
      el.kpiProfitSubLabel.innerHTML = `<span class="sub-dot green"></span><span>Margin: ${marginPct}% (Net Profit)</span>`;
    } else {
      el.kpiProfitSubLabel.innerHTML = `<span class="sub-dot red"></span><span style="color:#e11d48; font-weight:600;">Defisit Pengeluaran Hari Ini</span>`;
    }
  }

  const shiftDot = document.getElementById('quickShiftDot');
  if (state.dashboard.active_shift) {
    const act = state.dashboard.active_shift;
    const displayName = act.cashier_name === 'Owner' ? 'Owner (Kasir Bertugas)' : (act.cashier_name || 'Kasir Bertugas');
    if (el.quickCashierName) el.quickCashierName.textContent = displayName;
    if (shiftDot) shiftDot.classList.add('active');
    if (el.mobileCashierName) el.mobileCashierName.textContent = displayName;
    if (el.mobileShiftDot) el.mobileShiftDot.classList.add('active');
    if (el.kpiDrawerStatus) el.kpiDrawerStatus.innerHTML = `<span class="sub-dot green"></span> Shift #${act.id} Aktif: ${displayName} (Modal: ${formatRupiah(act.starting_cash)})`;
    if (act.current_total_sales !== undefined && act.current_order_count !== undefined && el.kpiOrdersCount) {
      el.kpiOrdersCount.textContent = `${s.total_orders || 0} Nota Hari Ini (Shift Aktif: ${act.current_order_count} Nota / ${formatRupiah(act.current_total_sales)})`;
    }
  } else {
    if (el.quickCashierName) el.quickCashierName.textContent = 'Tidak Ada Shift Aktif';
    if (shiftDot) shiftDot.classList.remove('active');
    if (el.mobileCashierName) el.mobileCashierName.textContent = 'Tidak Ada Shift';
    if (el.mobileShiftDot) el.mobileShiftDot.classList.remove('active');
    if (el.kpiDrawerStatus) el.kpiDrawerStatus.textContent = 'Tidak ada shift kasir yang aktif';
  }
}

function renderLiquiditySnapshot() {
  const liq = state.dashboard.liquidity_snapshot || {};
  if (el.liqCashDrawer) el.liqCashDrawer.textContent = formatRupiah(liq.cash_in_drawer || 0);
  if (el.liqBankIncoming) el.liqBankIncoming.textContent = formatRupiah(liq.bank_incoming_today || 0);
  if (el.liqCustomerDebts) el.liqCustomerDebts.textContent = formatRupiah(liq.total_customer_debts || 0);
  if (el.liqCustomerDebtorsCount) el.liqCustomerDebtorsCount.textContent = `${liq.total_debtors || 0} Pelanggan belum lunas`;
  if (el.liqSupplierDebts) el.liqSupplierDebts.textContent = formatRupiah(liq.total_supplier_debt || 0);
  if (el.liqSuppliersCount) el.liqSuppliersCount.textContent = `${liq.total_suppliers_debt || 0} Pemasok tempo aktif`;

  if (el.lblWorkingCapitalStatus) {
    const cashTotal = (liq.cash_in_drawer || 0) + (liq.bank_incoming_today || 0);
    const supplierPayables = liq.total_supplier_debt || 0;
    if (cashTotal >= supplierPayables) {
      el.lblWorkingCapitalStatus.style.background = '#ecfdf5';
      el.lblWorkingCapitalStatus.style.borderColor = '#a7f3d0';
      el.lblWorkingCapitalStatus.style.color = '#059669';
      el.lblWorkingCapitalStatus.innerHTML = '🟢 Likuiditas Aman Terkendali';
    } else {
      el.lblWorkingCapitalStatus.style.background = '#fff1f2';
      el.lblWorkingCapitalStatus.style.borderColor = '#fecdd3';
      el.lblWorkingCapitalStatus.style.color = '#e11d48';
      el.lblWorkingCapitalStatus.innerHTML = '⚠️ Perhatian: Hutang Supplier > Kas Toko';
    }
  }
}

function renderDailyCashflowLedger() {
  const cf = state.dashboard.cashflow_today || { inflow: {}, outflow: {} };
  const inf = cf.inflow || {};
  const outf = cf.outflow || {};

  if (el.cfInflowCashSales) el.cfInflowCashSales.textContent = formatRupiah(inf.cash_sales || 0);
  if (el.cfInflowDigitalSales) el.cfInflowDigitalSales.textContent = formatRupiah(inf.digital_sales || 0);
  if (el.cfInflowDebtCollected) el.cfInflowDebtCollected.textContent = formatRupiah(inf.debt_collected || 0);
  if (el.cfInflowOtherIncome) el.cfInflowOtherIncome.textContent = formatRupiah(inf.other_income || 0);
  if (el.cfTotalInflow) el.cfTotalInflow.textContent = formatRupiah(inf.total_inflow || 0);

  if (el.cfOutflowStoreCash) el.cfOutflowStoreCash.textContent = formatRupiah(outf.store_expenses_cash || 0);
  if (el.cfOutflowStoreTransfer) el.cfOutflowStoreTransfer.textContent = formatRupiah(outf.store_expenses_transfer || 0);
  if (el.cfOutflowSupplierCash) el.cfOutflowSupplierCash.textContent = formatRupiah(outf.supplier_paid_cash || 0);
  if (el.cfOutflowSupplierTransfer) el.cfOutflowSupplierTransfer.textContent = formatRupiah(outf.supplier_paid_transfer || 0);
  if (el.cfTotalOutflow) el.cfTotalOutflow.textContent = formatRupiah(outf.total_cash_outflow || 0);

  const netCf = cf.net_cashflow !== undefined ? cf.net_cashflow : ((inf.total_inflow || 0) - (outf.total_cash_outflow || 0));
  if (el.lblNetCashflowVal) el.lblNetCashflowVal.textContent = (netCf >= 0 ? '+' : '') + formatRupiah(netCf);

  if (el.netCashflowPill) {
    if (netCf >= 0) {
      el.netCashflowPill.style.background = '#ecfdf5';
      el.netCashflowPill.style.color = '#059669';
      el.netCashflowPill.style.borderColor = '#a7f3d0';
      el.netCashflowPill.innerHTML = `<span>Surplus Kas Bersih:</span> <strong id="lblNetCashflowVal" style="font-family: monospace;">+${formatRupiah(netCf)}</strong>`;
    } else {
      el.netCashflowPill.style.background = '#fff1f2';
      el.netCashflowPill.style.color = '#e11d48';
      el.netCashflowPill.style.borderColor = '#fecdd3';
      el.netCashflowPill.innerHTML = `<span>Defisit Kas Bersih:</span> <strong id="lblNetCashflowVal" style="font-family: monospace;">${formatRupiah(netCf)}</strong>`;
    }
  }
}

function formatDateTimeDetailed(dateInput) {
  if (!dateInput) return '-';
  const d = parseSafeDate(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const dateStr = d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const timeStr = d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  }).replace('.', ':');

  return `${dateStr} • ${timeStr} WIB`;
}

function renderRecentFeeds() {
  const dash = state.dashboard || {};
  const orders = dash.recent_orders || [];
  const expenses = dash.recent_expenses || [];
  const purchases = dash.recent_purchases || [];

  // 1. Recent Sales Orders
  if (el.badgeRecentOrdersCount) {
    el.badgeRecentOrdersCount.textContent = `${orders.length} Nota`;
  }
  if (el.recentOrdersList) {
    if (orders.length === 0) {
      el.recentOrdersList.innerHTML = `
        <div style="color: #64748b; font-size: 12px; padding: 20px; text-align: center; background: #f8fafc; border-radius: 8px;">
          Belum ada transaksi penjualan yang dicatat.
        </div>
      `;
    } else {
      el.recentOrdersList.innerHTML = orders.map(o => {
        const fullTimeStr = formatDateTimeDetailed(o.created_at);
        const isCash = o.payment_method === 'cash';
        const methodBadge = isCash 
          ? '<span style="font-size: 10px; background: #ecfdf5; color: #059669; padding: 1px 6px; border-radius: 4px; font-weight: 700;">TUNAI</span>'
          : (o.payment_method === 'tempo'
              ? '<span style="font-size: 10px; background: #fffbeb; color: #d97706; padding: 1px 6px; border-radius: 4px; font-weight: 700;">TEMPO</span>'
              : `<span style="font-size: 10px; background: #eff6ff; color: #2563eb; padding: 1px 6px; border-radius: 4px; font-weight: 700;">${escapeHtml(o.payment_method ? o.payment_method.toUpperCase() : 'NON-TUNAI')}</span>`);

        return `
          <div class="feed-item-card feed-order">
            <div class="feed-card-main">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <strong style="font-size: 13px; color: #0f172a;">#${escapeHtml(o.order_no)}</strong>
                ${methodBadge}
              </div>
              <div style="font-size: 11.5px; color: #334155; margin-top: 3px; word-break: break-word;">
                ${escapeHtml(o.customer_name || 'Pelanggan Umum')} • <span style="color: #64748b;">Kasir: ${escapeHtml(o.cashier_name || 'Kasir')}</span>
              </div>
              <div style="margin-top: 4px;">
                <span class="feed-time-chip">📅 ${fullTimeStr}</span>
              </div>
            </div>
            <div class="feed-card-side">
              <div style="font-family: monospace; font-size: 14px; font-weight: 800; color: #2563eb;">
                ${formatRupiah(o.total_amount)}
              </div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                ${o.total_kg > 0 ? `${o.total_kg} kg` : `${o.item_count || 1} item`}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 2. Recent Store Expenses
  if (el.badgeRecentExpensesCount) {
    el.badgeRecentExpensesCount.textContent = `${expenses.length} Biaya`;
  }
  if (el.recentExpensesList) {
    if (expenses.length === 0) {
      el.recentExpensesList.innerHTML = `
        <div style="color: #64748b; font-size: 12px; padding: 20px; text-align: center; background: #f8fafc; border-radius: 8px;">
          Belum ada catatan biaya operasional toko.
        </div>
      `;
    } else {
      el.recentExpensesList.innerHTML = expenses.map(e => {
        const fullTimeStr = formatDateTimeDetailed(e.created_at);
        const isIncome = e.type === 'income';
        const sourceLabel = e.source === 'cash' ? '💵 Laci' : '🏦 Bank';
        const cardClass = isIncome ? 'feed-item-card feed-income' : 'feed-item-card feed-expense';
        const amountColor = isIncome ? '#059669' : '#e11d48';
        const amountPrefix = isIncome ? '+' : '-';

        return `
          <div class="${cardClass}">
            <div class="feed-card-main">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <strong style="font-size: 13px; color: #0f172a;">${escapeHtml(e.category_name)}</strong>
                <span style="font-size: 10px; background: #f1f5f9; color: #475569; padding: 1px 6px; border-radius: 4px; font-weight: 600;">${sourceLabel}</span>
              </div>
              <div style="font-size: 11.5px; color: #334155; margin-top: 3px; word-break: break-word;">
                ${escapeHtml(e.notes || 'Biaya operasional')} • <span style="color: #64748b;">Oleh: ${escapeHtml(e.recorded_by_name || 'Staff')}</span>
              </div>
              <div style="margin-top: 4px;">
                <span class="feed-time-chip">📅 ${fullTimeStr}</span>
              </div>
            </div>
            <div class="feed-card-side">
              <div style="font-family: monospace; font-size: 14px; font-weight: 800; color: ${amountColor};">
                ${amountPrefix}${formatRupiah(e.amount)}
              </div>
              <div style="font-size: 11px; color: ${amountColor}; margin-top: 2px; font-weight: 700;">
                ${isIncome ? 'KAS MASUK' : 'KAS KELUAR'}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 3. Recent Supplier Purchases (Stock Restock)
  if (el.badgeRecentPurchasesCount) {
    el.badgeRecentPurchasesCount.textContent = `${purchases.length} Kulakan`;
  }
  if (el.recentPurchasesList) {
    if (purchases.length === 0) {
      el.recentPurchasesList.innerHTML = `
        <div style="color: #64748b; font-size: 12px; padding: 20px; text-align: center; background: #f8fafc; border-radius: 8px;">
          Belum ada riwayat kulakan komoditas dari supplier.
        </div>
      `;
    } else {
      el.recentPurchasesList.innerHTML = purchases.map(p => {
        const fullTimeStr = formatDateTimeDetailed(p.created_at);
        const isTempo = p.payment_status === 'tempo' || Number(p.remaining_amount) > 0;
        const statusBadge = isTempo
          ? `<span style="font-size: 10px; background: #fff1f2; color: #e11d48; padding: 1px 6px; border-radius: 4px; font-weight: 700;">TEMPO (Sisa ${formatRupiah(p.remaining_amount)})</span>`
          : '<span style="font-size: 10px; background: #ecfdf5; color: #059669; padding: 1px 6px; border-radius: 4px; font-weight: 700;">LUNAS</span>';

        return `
          <div class="feed-item-card feed-purchase">
            <div class="feed-card-main">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <strong style="font-size: 13px; color: #0f172a;">${escapeHtml(p.supplier_name)}</strong>
                ${statusBadge}
              </div>
              <div style="font-size: 11.5px; color: #334155; margin-top: 3px; word-break: break-word;">
                <strong>${escapeHtml(p.product_name)}</strong>: ${p.qty_kg} kg @ ${formatRupiah(p.cost_price)}
                ${p.notes ? ` • <em>"${escapeHtml(p.notes)}"</em>` : ''}
              </div>
              <div style="margin-top: 4px;">
                <span class="feed-time-chip">📅 ${fullTimeStr}</span>
              </div>
            </div>
            <div class="feed-card-side">
              <div style="font-family: monospace; font-size: 14px; font-weight: 800; color: #059669;">
                ${formatRupiah(p.total_cost)}
              </div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                +${p.qty_kg} kg stok
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function renderVoidDetails() {
  const voidDetails = state.dashboard.void_today_details || [];
  const s = state.dashboard.summary || {};
  const count = s.void_count !== undefined ? s.void_count : voidDetails.length;

  if (el.kpiVoidCountBadge) {
    el.kpiVoidCountBadge.textContent = `${count} Void`;
    el.kpiVoidCountBadge.style.background = count > 0 ? '#fee2e2' : '#f1f5f9';
    el.kpiVoidCountBadge.style.color = count > 0 ? '#dc2626' : '#64748b';
  }

  if (!el.voidListContainer) return;

  if (voidDetails.length === 0) {
    el.voidListContainer.innerHTML = `
      <div style="color: #64748b; font-size: 12.5px; padding: 18px 12px; text-align: center; background: #f8fafc; border-radius: 8px;">
        ✅ Tidak ada nota dibatalkan hari ini (Integritas Aman).
      </div>
    `;
    return;
  }

  el.voidListContainer.innerHTML = voidDetails.map(v => {
    const time = parseSafeDate(v.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 1px solid #fee2e2; background: #fff5f5; border-radius: 8px; margin-bottom: 6px;">
        <div>
          <div style="font-weight: 700; font-size: 13px; color: #991b1b; display: flex; align-items: center; gap: 6px;">
            <span>🚫 #${v.order_no}</span>
            <span style="font-size: 11px; background: #fee2e2; color: #dc2626; padding: 1px 6px; border-radius: 4px; font-weight: 600;">${time}</span>
          </div>
          <div style="font-size: 11.5px; color: #475569; margin-top: 3px;">
            Kasir: <strong>${escapeHtml(v.cashier_name || 'Kasir')}</strong>
            ${v.void_reason ? ` • <em>"${escapeHtml(v.void_reason)}"</em>` : ''}
          </div>
        </div>
        <div style="font-family: monospace; font-size: 13.5px; font-weight: 800; color: #b91c1c;">
          ${formatRupiah(v.total_amount)}
        </div>
      </div>
    `;
  }).join('');
}

function renderRevenueChart() {
  if (!el.revenueTrendChart || !state.dashboard || !state.dashboard.trends) return;

  const isToday = state.currentChartTimeView === 'today';
  const data = isToday 
    ? (state.dashboard.trends.hourly_today || []) 
    : (state.dashboard.trends.last_7_days || []);

  const labels = data.map(d => isToday ? d.hour : (d.label || d.date));
  const revenues = data.map(d => Number(d.revenue) || 0);
  const ordersCount = data.map(d => Number(d.orders_count) || 0);

  // Compute telemetry summary
  const totalRevenue = revenues.reduce((acc, v) => acc + v, 0);
  const totalOrders = ordersCount.reduce((acc, v) => acc + v, 0);
  const avgBasket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  
  // Find peak
  let peakItem = null;
  let peakVal = 0;
  data.forEach(d => {
    const rev = Number(d.revenue) || 0;
    if (rev > peakVal) {
      peakVal = rev;
      peakItem = d;
    }
  });

  if (el.chartTotalRevenue) el.chartTotalRevenue.textContent = formatRupiah(totalRevenue);
  if (el.chartTotalOrders) el.chartTotalOrders.textContent = `${totalOrders} Nota`;
  if (el.chartAvgRevenue) el.chartAvgRevenue.textContent = formatRupiah(avgBasket);
  if (el.chartPeakSales) {
    if (peakItem && peakVal > 0) {
      const peakLabel = isToday ? peakItem.hour : peakItem.label;
      el.chartPeakSales.textContent = `${peakLabel} (${formatShortRupiah(peakVal)})`;
    } else {
      el.chartPeakSales.textContent = '-';
    }
  }

  // Destroy previous chart instance
  if (state.revenueChartInstance) {
    state.revenueChartInstance.destroy();
    state.revenueChartInstance = null;
  }

  const ctx = el.revenueTrendChart.getContext('2d');
  if (!ctx) return;

  // Linear gradient for revenue line fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, 'rgba(37, 99, 235, 0.28)');
  gradient.addColorStop(1, 'rgba(37, 99, 235, 0.01)');

  state.revenueChartInstance = new Chart(ctx, {
    data: {
      labels: labels,
      datasets: [
        {
          type: 'line',
          label: 'Omzet Penjualan (Rp)',
          data: revenues,
          borderColor: '#2563eb',
          borderWidth: 2.5,
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointRadius: isToday ? 2.5 : 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#2563eb',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          yAxisID: 'yRevenue',
          order: 1
        },
        {
          type: 'bar',
          label: 'Jumlah Transaksi (Nota)',
          data: ordersCount,
          backgroundColor: 'rgba(16, 185, 129, 0.65)',
          hoverBackgroundColor: '#10b981',
          borderRadius: 4,
          maxBarThickness: isToday ? 14 : 26,
          yAxisID: 'yOrders',
          order: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            usePointStyle: true,
            font: { family: 'Plus Jakarta Sans', size: 11.5, weight: '600' },
            color: '#475569'
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' },
          bodyFont: { family: 'JetBrains Mono', size: 11.5 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              if (context.dataset.yAxisID === 'yRevenue') {
                return ' Omzet: ' + formatRupiah(context.raw);
              }
              return ' Transaksi: ' + context.raw + ' Nota';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'Plus Jakarta Sans', size: 11 },
            color: '#64748b',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: isToday ? 8 : 7
          }
        },
        yRevenue: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          grid: {
            color: 'rgba(226, 232, 240, 0.6)',
            drawBorder: false
          },
          ticks: {
            font: { family: 'JetBrains Mono', size: 10.5 },
            color: '#64748b',
            callback: (val) => formatShortRupiah(val)
          }
        },
        yOrders: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          grid: { display: false },
          ticks: {
            stepSize: 1,
            precision: 0,
            font: { family: 'JetBrains Mono', size: 10.5 },
            color: '#059669',
            callback: (val) => Number.isInteger(val) ? val + ' n' : ''
          }
        }
      }
    }
  });
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
              <span class="matrix-label">Nota (Modal)</span>
              <span class="matrix-val">${formatRupiah(p.cost_price)}</span>
            </div>
            <div class="matrix-item">
              <span class="matrix-label">Harga Eceran</span>
              <span class="matrix-val">${formatRupiah(p.retail_price)}</span>
            </div>
            <div class="matrix-item">
              <span class="matrix-label">Harga Karungan</span>
              <span class="matrix-val reseller">${formatRupiah(p.reseller_price)}</span>
            </div>
          </div>

          <!-- Margin Indicator -->
          <div class="margin-indicator-bar">
            <span class="margin-text-left">Laba per ${p.unit}:</span>
            <span class="margin-number">+${formatRupiah(marginRetail)} (${marginPercent}%)</span>
          </div>

          <!-- Incoming Stock Summary Strip (Riwayat Masuk Terakhir & Supplier) -->
          <div class="prod-restock-strip">
            <div class="prod-restock-head">
              <span class="prod-restock-lbl">📦 Pasokan Terakhir:</span>
              <span class="prod-restock-badge ${p.last_restock_date ? 'has-stock' : ''}">
                ${(p.restock_count || 0) > 0 ? `${p.restock_count}x Masuk` : 'Belum Ada'}
              </span>
            </div>
            ${p.last_restock_date ? `
              <div class="prod-restock-detail">
                <div class="prod-restock-date">
                  📅 ${parseSafeDate(p.last_restock_date).toLocaleString('id-ID', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
                <div class="prod-restock-sup">
                  <span title="Juragan Pemasok">👤 ${escapeHtml(p.last_supplier_name || 'Supplier Tanpa Nama')}</span>
                  <span class="prod-restock-qty">+${Number(p.last_restock_qty || 0).toLocaleString('id-ID')} ${p.unit}</span>
                </div>
              </div>
            ` : `
              <div class="prod-restock-empty">Belum pernah tercatat kulakan stok masuk</div>
            `}
          </div>
        </div>

        <div class="prod-card-bottom">
          <button class="btn-card-history" data-id="${p.id}" title="Lihat riwayat lengkap barang masuk & juragan supplier">
            📜 Riwayat
          </button>
          <button class="btn-card-stock" data-id="${p.id}" title="Tambah stok kulakan masuk">
            📦 +Stok
          </button>
          <button class="btn-card-price" data-id="${p.id}" title="Edit harga modal & harga jual">
            ✏️ Edit
          </button>
        </div>
      </div>
    `;
  }).join('');

  el.productsCardsGrid.querySelectorAll('.btn-card-history').forEach(btn => {
    btn.addEventListener('click', () => openProductRestockHistoryModal(Number(btn.dataset.id)));
  });

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
// MODAL: RIWAYAT STOK MASUK KOMODITAS (SUPPLIER & TANGGAL MASUK)
// -----------------------------------------------------------------------------
let currentRestockHistoryProductId = null;

async function openProductRestockHistoryModal(productId) {
  currentRestockHistoryProductId = productId;
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  if (el.modalProductRestockHistory) {
    el.modalProductRestockHistory.style.display = 'flex';
  }

  // Set Header & Subtitle
  if (el.prodRestockIconBadge) el.prodRestockIconBadge.textContent = prod.image_emoji || '📦';
  if (el.prodRestockModalTitle) el.prodRestockModalTitle.textContent = `Riwayat Stok Masuk: ${prod.name}`;
  if (el.prodRestockModalSubtitle) {
    el.prodRestockModalSubtitle.textContent = `Kategori: ${prod.category.toUpperCase()} • Satuan: ${prod.unit} • Harga Modal Saat Ini: ${formatRupiah(prod.cost_price)} / ${prod.unit}`;
  }

  // Set initial placeholders
  if (el.statProdCurrentStock) el.statProdCurrentStock.textContent = `${Number(prod.stock_qty || 0).toLocaleString('id-ID')} ${prod.unit}`;
  if (el.statProdTotalReceived) el.statProdTotalReceived.textContent = 'Memuat...';
  if (el.statProdEntriesCount) el.statProdEntriesCount.textContent = '...';
  if (el.statProdTotalCost) el.statProdTotalCost.textContent = 'Memuat...';
  if (el.statProdDebtRemaining) el.statProdDebtRemaining.textContent = 'Memuat...';

  if (el.prodRestockTableBody) {
    el.prodRestockTableBody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding: 30px; color: #64748b;">Memuat riwayat stok masuk dari juragan...</td></tr>';
  }

  try {
    const res = await api.getProductRestockHistory(productId);
    if (!res || !res.success) throw new Error(res?.message || 'Gagal memuat riwayat stok masuk');

    const summary = res.summary || {};
    const purchases = res.purchases || [];

    if (el.statProdTotalReceived) {
      el.statProdTotalReceived.textContent = `${(Number(summary.total_qty_received) || 0).toLocaleString('id-ID')} ${prod.unit}`;
    }
    if (el.statProdEntriesCount) {
      el.statProdEntriesCount.textContent = `${summary.total_entries || 0}x Kulakan Masuk`;
    }
    if (el.statProdTotalCost) {
      el.statProdTotalCost.textContent = formatRupiah(summary.total_cost_spent || 0);
    }
    if (el.statProdDebtRemaining) {
      const debt = Number(summary.total_debt_remaining) || 0;
      el.statProdDebtRemaining.textContent = formatRupiah(debt);
      el.statProdDebtRemaining.className = debt > 0 ? 'kpi-v2-main text-danger' : 'kpi-v2-main text-success';
    }

    if (purchases.length === 0) {
      el.prodRestockTableBody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center" style="padding: 40px 20px; color: #64748b;">
            <div style="font-size: 32px; margin-bottom: 8px;">📦</div>
            <strong style="color: #0f172a; font-size: 15px; display: block;">Belum Ada Riwayat Kulakan Masuk</strong>
            <p style="margin: 4px 0 16px 0; font-size: 13px;">Belum pernah ada pasokan stok yang dicatat dari juragan petani untuk komoditas ini.</p>
            <button class="btn-action-emerald" id="btnRestockFromEmptyModal" style="margin: 0 auto; padding: 8px 18px; border-radius: 8px;">
              <span>📦</span> + Catat Kulakan Masuk Sekarang
            </button>
          </td>
        </tr>
      `;
      const btnEmpty = document.getElementById('btnRestockFromEmptyModal');
      if (btnEmpty) {
        btnEmpty.addEventListener('click', () => {
          if (el.modalProductRestockHistory) el.modalProductRestockHistory.style.display = 'none';
          openRestockModal(productId);
        });
      }
      return;
    }

    el.prodRestockTableBody.innerHTML = purchases.map(p => {
      const timeFormatted = parseSafeDate(p.created_at).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      let statusBadge = '';
      if (p.payment_status === 'lunas') {
        statusBadge = '<span class="kpi-badge success" style="font-size: 11px;">🟢 Lunas</span>';
      } else if (p.remaining_amount > 0) {
        statusBadge = `<span class="kpi-badge amber" style="font-size: 11px;">⏳ Tempo (Sisa: ${formatRupiah(p.remaining_amount)})</span>`;
      } else {
        statusBadge = '<span class="kpi-badge success" style="font-size: 11px;">🟢 Lunas</span>';
      }

      const waBtn = p.supplier_phone 
        ? `<a href="https://wa.me/${p.supplier_phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}" target="_blank" class="btn-wa-chip" style="padding: 2px 7px; font-size: 11px; margin-left: 6px;" title="Hubungi via WhatsApp">💬 WA</a>`
        : '';

      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="font-weight: 600; color: #0f172a; font-size: 12.5px; white-space: nowrap;">
            📅 ${timeFormatted}
          </td>
          <td>
            <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11.5px; color: #0f172a; font-weight: 700;">${p.purchase_no || '-'}</code>
          </td>
          <td>
            <div style="font-weight: 700; color: #0f172a; font-size: 13px; display: flex; align-items: center;">
              <span>👤 ${escapeHtml(p.supplier_name || 'Tanpa Nama / Non-Supplier')}</span>
              ${waBtn}
            </div>
            ${p.supplier_address ? `<div style="font-size: 11px; color: #64748b;">📍 ${escapeHtml(p.supplier_address)}</div>` : ''}
          </td>
          <td class="text-right" style="font-weight: 800; color: #059669; font-family: var(--font-mono); font-size: 13.5px; white-space: nowrap;">
            +${Number(p.qty_kg).toLocaleString('id-ID')} ${prod.unit}
          </td>
          <td class="text-right" style="font-family: var(--font-mono); font-weight: 600; color: #475569; font-size: 13px; white-space: nowrap;">
            ${formatRupiah(p.cost_price)}
          </td>
          <td class="text-right" style="font-family: var(--font-mono); font-weight: 800; color: #0f172a; font-size: 13.5px; white-space: nowrap;">
            ${formatRupiah(p.total_cost)}
          </td>
          <td class="text-center" style="white-space: nowrap;">
            ${statusBadge}
          </td>
          <td style="font-size: 12px; color: #475569; white-space: nowrap;">
            ${escapeHtml(p.recorded_by_name || 'Admin')}
          </td>
          <td style="font-size: 12px; color: #64748b; max-width: 200px;">
            ${escapeHtml(p.notes || '-')}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading product restock history:', err);
    if (el.prodRestockTableBody) {
      el.prodRestockTableBody.innerHTML = `<tr><td colspan="9" class="text-center text-danger" style="padding: 24px;">Gagal memuat: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

// Hook up restock history modal listeners once
if (el.btnCloseProdRestockModal) {
  el.btnCloseProdRestockModal.addEventListener('click', () => {
    if (el.modalProductRestockHistory) el.modalProductRestockHistory.style.display = 'none';
  });
}
if (el.btnCloseProdRestockModalFooter) {
  el.btnCloseProdRestockModalFooter.addEventListener('click', () => {
    if (el.modalProductRestockHistory) el.modalProductRestockHistory.style.display = 'none';
  });
}
if (el.btnQuickRestockFromHistory) {
  el.btnQuickRestockFromHistory.addEventListener('click', () => {
    if (el.modalProductRestockHistory) el.modalProductRestockHistory.style.display = 'none';
    if (currentRestockHistoryProductId) {
      openRestockModal(currentRestockHistoryProductId);
    }
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
  } else if (type === 'EXPENSE') {
    state.filteredLogs = state.auditLogs.filter(a => a.action.includes('EXPENSE') || a.action.includes('INCOME'));
  } else if (type === 'DEBT') {
    state.filteredLogs = state.auditLogs.filter(a => a.action.includes('DEBT'));
  } else if (type === 'RESTOCK') {
    state.filteredLogs = state.auditLogs.filter(a => a.action.includes('RESTOCK') || a.action.includes('PURCHASE') || a.action.includes('SUPPLIER'));
  } else if (type === 'CASHIER') {
    state.filteredLogs = state.auditLogs.filter(a => a.action.includes('CASHIER') || a.action.includes('LOGIN') || a.action.includes('USER'));
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
    d = typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {});
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
      narrative = `Penambahan stok komoditas <strong>${d.product_name || ''}</strong> sebanyak <strong>+${d.added_qty || 0} kg</strong>. Stok baru: <strong>${d.new_stock || 0} kg</strong>. ${d.notes ? '(Catatan: ' + d.notes + ')' : ''}`;
      break;

    case 'PURCHASE_RESTOCK_CREATED':
      icon = '🚛';
      badgeClass = 'blue';
      badgeTitle = 'Kulakan dari Pemasok';
      narrative = `Kulakan komoditas <strong>${d.product_name || ''}</strong> dari juragan <strong>${d.supplier_name || 'Pemasok'}</strong> (${d.purchase_no || ''}) sebanyak <strong>${d.qty_kg || 0} kg</strong> senilai <strong>${formatRupiah(d.total_cost || 0)}</strong>. Status: <strong>${d.payment_status === 'lunas' ? 'LUNAS' : `TEMPO (Sisa ${formatRupiah(d.remaining_amount || 0)})`}</strong>.`;
      break;

    case 'SUPPLIER_PAYMENT_RECORDED':
      icon = '💳';
      badgeClass = 'emerald';
      badgeTitle = 'Bayar Utang Kulakan';
      narrative = `Pembayaran nota kulakan <strong>${d.purchase_no || ''}</strong> kepada <strong>${d.supplier_name || 'Juragan'}</strong> sebesar <strong>${formatRupiah(d.amount_paid || 0)}</strong>. Sisa utang kulakan: <strong>${formatRupiah(d.remaining_amount || 0)}</strong>.`;
      break;

    case 'EXPENSE_RECORDED':
      icon = '💸';
      badgeClass = 'rose';
      badgeTitle = 'Biaya Operasional Toko';
      narrative = `Biaya pengeluaran dicatat: <strong>${d.category_name || 'Operasional Toko'}</strong> (${d.expense_no || ''}) senilai <strong>${formatRupiah(d.amount || 0)}</strong> diambil dari <strong>${d.source === 'cash' ? '💵 Uang Kas Laci' : '🏦 Rekening Bank'}</strong>.`;
      break;

    case 'CASH_INCOME_RECORDED':
      icon = '💵';
      badgeClass = 'emerald';
      badgeTitle = 'Kas Masuk / Tambah Modal';
      narrative = `Penerimaan kas dicatat: <strong>${d.category_name || 'Kas Masuk'}</strong> (${d.expense_no || ''}) senilai <strong>${formatRupiah(d.amount || 0)}</strong> dimasukkan ke <strong>${d.source === 'cash' ? '💵 Laci Kasir' : '🏦 Bank Toko'}</strong>.`;
      break;

    case 'DEBT_PAYMENT_COLLECTED':
      icon = '💰';
      badgeClass = 'emerald';
      badgeTitle = 'Pelunasan Kasbon Pelanggan';
      narrative = `Pelanggan <strong>${d.customer_name || 'Pelanggan'}</strong> mencicil kasbon nota <strong>${d.order_no || ''}</strong> sebesar <strong>${formatRupiah(d.amount_paid || 0)}</strong> via <strong>${(d.payment_method || 'cash').toUpperCase()}</strong>. Sisa piutang: <strong>${formatRupiah(d.remaining_after || 0)}</strong>.`;
      break;

    case 'DEBT_UPDATED':
      icon = '📝';
      badgeClass = 'amber';
      badgeTitle = 'Update Status Piutang';
      narrative = `Status piutang kasbon nota <strong>${d.order_no || ''}</strong> diperbarui menjadi <strong>${d.status || 'Berjalan'}</strong>.`;
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

    case 'STOCK_OPNAME_APPLIED':
      icon = '📋';
      badgeClass = 'amber';
      badgeTitle = 'Stock Opname Gudang';
      narrative = `Penyesuaian fisik hasil stock opname gudang berhasil diterapkan ke sistem.`;
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

    case 'CASHIER_DELETED':
      icon = '🗑️';
      badgeClass = 'rose';
      badgeTitle = 'Hapus Akun Kasir';
      narrative = `Akun kasir <strong>"${d.target_name || ''}"</strong> (@${d.target_username || ''}) telah dihapus dari sistem oleh Owner.`;
      break;

    case 'PRODUCT_CREATED':
      icon = '✨';
      badgeClass = 'blue';
      badgeTitle = 'Komoditas Baru';
      narrative = `Komoditas baru <strong>"${d.name}"</strong> didaftarkan ke katalog (Eceran: ${formatRupiah(d.retail_price)}, Grosir: ${formatRupiah(d.reseller_price)}).`;
      break;

    case 'PRODUCT_UPDATED':
      icon = '🏷️';
      badgeClass = 'amber';
      badgeTitle = 'Update Harga Produk';
      narrative = `Harga komoditas #${d.product_id || ''} diperbarui. Eceran: <strong>${formatRupiah(d.new ? d.new.retail : 0)}</strong>, Grosir: <strong>${formatRupiah(d.new ? d.new.reseller : 0)}</strong>.`;
      break;

    case 'STORE_SETTINGS_UPDATED':
      icon = '⚙️';
      badgeClass = 'blue';
      badgeTitle = 'Konfigurasi Profil Toko';
      narrative = `Data toko <strong>"${d.store_name || ''}"</strong> dan footer struk kasir diperbarui oleh Owner.`;
      break;

    case 'USER_PROFILE_UPDATED':
      icon = '👤';
      badgeClass = 'blue';
      badgeTitle = 'Update Profil Pengguna';
      narrative = `Profil pengguna toko berhasil diperbarui.`;
      break;

    case 'LOGIN_SUCCESS':
      icon = '🔑';
      badgeClass = 'emerald';
      badgeTitle = 'Masuk Aplikasi Berhasil';
      narrative = `Pengguna berhasil login ke sistem sebagai <strong>${d.role === 'owner' ? 'Owner / Pemilik Toko' : 'Petugas Kasir'}</strong>.`;
      break;

    case 'LOGIN_FAILED':
    case 'LOGIN_FAILED_PIN':
      icon = '🚫';
      badgeClass = 'rose';
      badgeTitle = 'Percobaan Login Ditolak';
      narrative = `Percobaan masuk ditolak karena PIN atau kredensial yang dimasukkan tidak cocok.`;
      break;

    case 'SYNC_BATCH_PROCESSED':
      icon = '🔄';
      badgeClass = 'blue';
      badgeTitle = 'Sinkronisasi Tablet POS';
      narrative = `Perangkat <strong>${d.device_id || 'Tablet Kasir'}</strong> menyinkronkan <strong>${d.orders_synced || 0} nota penjualan</strong>, <strong>${d.debt_payments_synced || 0} pembayaran kasbon</strong>, dan <strong>${d.adjustments_synced || 0} susut komoditas</strong>.`;
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
            ${!isOwner ? `
              <button class="btn-card-action btn-delete-cashier" data-delete-id="${u.id}" data-user-name="${escapeHtml(u.name)}" title="Hapus akun kasir ini">
                <span class="btn-ico">🗑️</span> Hapus
              </button>
            ` : ''}
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

  // Attach handlers to Delete Cashier buttons (Opens in-app Confirmation Modal)
  el.cashierCardsGrid.querySelectorAll('.btn-delete-cashier').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const userId = Number(btn.dataset.deleteId);
      const user = state.users.find(u => Number(u.id) === userId);
      if (!user) {
        showToast('Data kasir tidak ditemukan', 'error');
        return;
      }
      openDeleteCashierModal(user);
    });
  });
}

function openDeleteCashierModal(user) {
  if (!el.modalConfirmDeleteCashier) return;
  el.deleteCashierUserId.value = user.id;
  el.deleteCashierNameText.textContent = user.name;
  el.deleteCashierUsernameText.textContent = '@' + user.username;
  el.modalConfirmDeleteCashier.style.display = 'flex';
}

function closeDeleteCashierModal() {
  if (el.modalConfirmDeleteCashier) {
    el.modalConfirmDeleteCashier.style.display = 'none';
  }
}

async function handleConfirmDeleteCashier() {
  const userId = Number(el.deleteCashierUserId.value);
  if (!userId) return;

  const btn = el.btnConfirmDeleteCashierSubmit;
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span>⏳ Menghapus...</span>';

  try {
    const res = await api.deleteUser(userId);
    closeDeleteCashierModal();
    showToast(res.message || 'Akun kasir berhasil dihapus', 'success');
    await loadAllData();
  } catch (err) {
    showToast('Gagal menghapus kasir: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
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

  if (periodKey === 'active_shift') {
    state.activeReportPeriod = 'active_shift';
    if (el.reportPresetGroup) {
      el.reportPresetGroup.querySelectorAll('.btn-period-chip').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === 'active_shift');
      });
    }
    loadSalesReport();
    return;
  }

  state.activeReportPeriod = null;
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
    const queryParams = {
      payment_method: paymentMethod
    };

    if (state.activeReportPeriod === 'active_shift') {
      queryParams.period = 'active_shift';
    } else {
      queryParams.start_date = startDate;
      queryParams.end_date = endDate;
    }

    const res = await api.getSalesReport(queryParams);

    state.salesReport = res;

    // 1. Render Financial KPIs
    const s = res.summary;
    if (el.repKpiRevenue) el.repKpiRevenue.textContent = formatRupiah(s.total_revenue);
    if (el.repKpiOrdersCount) {
      const activeShiftInfo = res.target_shift || res.shift;
      if (state.activeReportPeriod === 'active_shift' && activeShiftInfo) {
        el.repKpiOrdersCount.textContent = `Shift #${activeShiftInfo.id} Aktif: ${s.total_orders} Nota (${s.total_kg_sold} kg) • Kasir: ${activeShiftInfo.cashier_name || 'Kasir Bertugas'}`;
      } else {
        el.repKpiOrdersCount.textContent = `${s.total_orders} Nota Selesai (${s.total_kg_sold} kg terjual)`;
      }
    }

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

    // 5. Render Sales Trend Chart for Tab 2
    renderReportSalesChart(res.daily_trend || []);
  } catch (err) {
    if (el.repOrdersTableBody) {
      el.repOrdersTableBody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Gagal memuat laporan: ${err.message}</td></tr>`;
    }
    showToast('Gagal memuat laporan penjualan: ' + err.message, 'error');
  }
}

function renderReportSalesChart(dailyTrend = []) {
  if (!el.reportSalesTrendChart) return;

  if (state.reportSalesChartInstance) {
    state.reportSalesChartInstance.destroy();
    state.reportSalesChartInstance = null;
  }

  if (!dailyTrend || dailyTrend.length === 0) {
    return;
  }

  const labels = dailyTrend.map(d => {
    const dt = parseSafeDate(d.date);
    return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  });

  const revenues = dailyTrend.map(d => Number(d.revenue) || 0);
  const profits = dailyTrend.map(d => Number(d.profit) || 0);

  const ctx = el.reportSalesTrendChart.getContext('2d');
  if (!ctx) return;

  state.reportSalesChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Omzet (Penjualan)',
          data: revenues,
          backgroundColor: 'rgba(37, 99, 235, 0.85)',
          hoverBackgroundColor: '#1d4ed8',
          borderRadius: 4,
          maxBarThickness: 32
        },
        {
          label: 'Laba Kotor',
          data: profits,
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          hoverBackgroundColor: '#059669',
          borderRadius: 4,
          maxBarThickness: 32
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' },
          bodyFont: { family: 'JetBrains Mono', size: 11.5 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              return ` ${label}: ${formatRupiah(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'Plus Jakarta Sans', size: 11 },
            color: '#64748b'
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(226, 232, 240, 0.6)',
            drawBorder: false
          },
          ticks: {
            font: { family: 'JetBrains Mono', size: 10.5 },
            color: '#64748b',
            callback: (val) => formatShortRupiah(val)
          }
        }
      }
    }
  });
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

    // Quick badge count on Tab & Mobile Bottom Nav
    if (el.debtCountBadge) {
      const activeCount = state.debtSummary.total_debtors || 0;
      if (activeCount > 0) {
        el.debtCountBadge.textContent = activeCount;
        el.debtCountBadge.style.display = 'inline-block';
        if (el.bnavDebtBadge) {
          el.bnavDebtBadge.textContent = activeCount;
          el.bnavDebtBadge.style.display = 'inline-block';
        }
      } else {
        el.debtCountBadge.style.display = 'none';
        if (el.bnavDebtBadge) el.bnavDebtBadge.style.display = 'none';
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
// TAB: MANAJEMEN PEMASOK / JURAGAN & BUKU KULAKAN (SUPPLIER MANAGEMENT)
// -----------------------------------------------------------------------------
async function loadSuppliersData() {
  try {
    if (el.btnRefreshSuppliers) {
      el.btnRefreshSuppliers.innerHTML = '⏳ Memuat...';
    }

    const searchVal = el.searchSupplierInput ? el.searchSupplierInput.value.trim() : '';
    const hasDebt = state.activeSupplierDebtFilter === 'has_debt' ? 'true' : '';

    const res = await api.getSuppliers({
      search: searchVal,
      has_debt: hasDebt
    });

    if (!res.success) {
      console.error('Failed to load suppliers:', res.message);
      return;
    }

    state.suppliers = res.suppliers || [];
    state.supplierSummary = res.summary || {};

    // Filter lunas locally if selected
    let displayedSuppliers = state.suppliers;
    if (state.activeSupplierDebtFilter === 'lunas') {
      displayedSuppliers = state.suppliers.filter(s => Number(s.total_debt_remaining || 0) <= 0);
    }

    // Update KPI Cards
    if (el.kpiTotalSuppliers) {
      el.kpiTotalSuppliers.textContent = `${state.supplierSummary.total_suppliers || 0} Juragan`;
    }
    if (el.kpiMonthlyPurchases) {
      el.kpiMonthlyPurchases.textContent = formatRupiah(state.supplierSummary.total_purchases_month || 0);
    }
    if (el.kpiTotalSupplierDebt) {
      el.kpiTotalSupplierDebt.textContent = formatRupiah(state.supplierSummary.total_debt_outstanding || 0);
    }
    if (el.kpiSuppliersWithDebtText) {
      el.kpiSuppliersWithDebtText.textContent = `${state.supplierSummary.total_suppliers_with_debt || 0} pemasok belum lunas`;
    }
    if (el.kpiOverdueSupplierDebt) {
      el.kpiOverdueSupplierDebt.textContent = formatRupiah(state.supplierSummary.total_overdue_debt || 0);
    }

    renderSuppliersTable(displayedSuppliers);
  } catch (err) {
    console.error('Error loading suppliers:', err);
  } finally {
    if (el.btnRefreshSuppliers) {
      el.btnRefreshSuppliers.innerHTML = '🔄 Segarkan Data';
    }
  }
}

function renderSuppliersTable(suppliersList) {
  if (!el.suppliersTableBody) return;

  if (!suppliersList || suppliersList.length === 0) {
    el.suppliersTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #94a3b8;">
          Tidak ada data pemasok / juragan yang sesuai.
        </td>
      </tr>
    `;
    return;
  }

  el.suppliersTableBody.innerHTML = suppliersList.map(s => {
    const totalDebt = Number(s.total_debt_remaining || 0);
    const hasOverdue = s.has_overdue_debt === 1;

    let debtBadge = '';
    if (totalDebt <= 0) {
      debtBadge = '<span class="kpi-badge success" style="font-size:11px;">🟢 Lunas</span>';
    } else if (hasOverdue) {
      debtBadge = '<span class="kpi-badge danger" style="font-size:11px;">🚨 Lewat Jatuh Tempo</span>';
    } else {
      debtBadge = '<span class="kpi-badge amber" style="font-size:11px;">⏳ Ada Tempo</span>';
    }

    let phoneClean = (s.phone || '').replace(/[^0-9]/g, '');
    if (phoneClean.startsWith('0')) {
      phoneClean = '62' + phoneClean.slice(1);
    }
    const waLink = phoneClean 
      ? `<a href="https://wa.me/${phoneClean}" target="_blank" rel="noopener noreferrer" class="btn-wa-chip">
          <span>💬</span> ${s.phone || '-'}
        </a>`
      : `<span style="color:#94a3b8;">-</span>`;

    const totalPurchasesFormatted = formatRupiah(s.total_purchases_amount || 0);
    const totalKgFormatted = Number(s.total_purchases_kg || 0).toLocaleString('id-ID');
    const totalDebtFormatted = totalDebt > 0 ? formatRupiah(totalDebt) : 'Rp 0';

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: #0f172a; font-size: 13.5px;">${s.name}</div>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 3px;">
            📍 ${s.address || 'Daerah asal belum diisi'}
            ${s.bank_info ? ` • 🏦 <span style="font-family: var(--font-mono); color: #0284c7; font-weight: 600;">${s.bank_info}</span>` : ''}
          </div>
        </td>
        <td>${waLink}</td>
        <td>
          <span style="display: inline-block; padding: 3px 10px; border-radius: 6px; background: #eff6ff; color: #1d4ed8; font-size: 11.5px; font-weight: 600; border: 1px solid #bfdbfe;">
            ${s.supplied_commodities || 'Semua Komoditas'}
          </span>
        </td>
        <td class="text-right">
          <div style="font-weight: 700; color: #0f172a; font-family: var(--font-mono); font-size: 13px;">${totalPurchasesFormatted}</div>
          <div style="font-size: 11px; color: #64748b;">${totalKgFormatted} kg (${s.total_purchases_count || 0} nota)</div>
        </td>
        <td class="text-right">
          <strong style="font-family: var(--font-mono); font-size: 13.5px; font-weight: 800; color: ${totalDebt > 0 ? (hasOverdue ? '#dc2626' : '#d97706') : '#059669'};">
            ${totalDebtFormatted}
          </strong>
        </td>
        <td class="text-center">${debtBadge}</td>
        <td class="text-center">
          <div style="display: inline-flex; gap: 5px; justify-content: center;">
            <button class="btn-table-action btn-sup-purchase" data-id="${s.id}" data-name="${encodeURIComponent(s.name)}" title="Catat Kulakan Masuk" style="padding: 5px 10px; font-size: 12px; background: #059669; color: #ffffff; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              📦 Masuk
            </button>
            <button class="btn-table-action btn-sup-detail" data-id="${s.id}" title="Lihat Profil & Riwayat" style="padding: 5px 10px; font-size: 12px; background: #2563eb; color: #ffffff; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              📋 Detail
            </button>
            <button class="btn-table-action btn-sup-edit" data-id="${s.id}" title="Edit Data Pemasok" style="padding: 5px 8px; font-size: 12px; background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-weight: 600;">
              ✏️
            </button>
            <button class="btn-table-action btn-sup-delete" data-id="${s.id}" data-name="${encodeURIComponent(s.name)}" title="Nonaktifkan Pemasok" style="padding: 5px 8px; font-size: 12px; background: #fff1f2; color: #e11d48; border: 1px solid #fecdd3; border-radius: 6px; cursor: pointer;">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  el.suppliersTableBody.querySelectorAll('.btn-sup-purchase').forEach(btn => {
    btn.addEventListener('click', () => {
      openOwnerRecordPurchaseModal(Number(btn.dataset.id));
    });
  });

  el.suppliersTableBody.querySelectorAll('.btn-sup-detail').forEach(btn => {
    btn.addEventListener('click', () => {
      openSupplierDetailModal(Number(btn.dataset.id));
    });
  });

  el.suppliersTableBody.querySelectorAll('.btn-sup-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const sup = state.suppliers.find(s => s.id === Number(btn.dataset.id));
      if (sup) openSupplierModal(sup);
    });
  });

  el.suppliersTableBody.querySelectorAll('.btn-sup-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = decodeURIComponent(btn.dataset.name);
      handleDeleteSupplier(Number(btn.dataset.id), name);
    });
  });
}

async function loadPurchasesData() {
  try {
    const searchVal = el.searchSupplierInput ? el.searchSupplierInput.value.trim() : '';
    const res = await api.getPurchases({ search: searchVal });
    if (!res.success) {
      console.error('Failed to load purchases:', res.message);
      return;
    }

    state.purchases = res.purchases || [];
    renderPurchasesTable(state.purchases);
  } catch (err) {
    console.error('Error loading purchases:', err);
  }
}

function renderPurchasesTable(purchasesList) {
  if (!el.purchasesTableBody) return;

  if (!purchasesList || purchasesList.length === 0) {
    el.purchasesTableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px; color: #94a3b8;">
          Belum ada riwayat nota kulakan masuk.
        </td>
      </tr>
    `;
    return;
  }

  el.purchasesTableBody.innerHTML = purchasesList.map(p => {
    const timeFormatted = parseSafeDate(p.created_at).toLocaleString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    let statusBadge = '';
    if (p.payment_status === 'lunas') {
      statusBadge = '<span class="kpi-badge success" style="font-size:11px;">🟢 Lunas</span>';
    } else if (p.is_overdue) {
      statusBadge = '<span class="kpi-badge danger" style="font-size:11px;">🚨 Lewat Tempo</span>';
    } else if (p.payment_status === 'partial') {
      statusBadge = '<span class="kpi-badge amber" style="font-size:11px;">🟡 Sebagian</span>';
    } else {
      statusBadge = '<span class="kpi-badge amber" style="font-size:11px;">⏳ Belum Bayar</span>';
    }

    let dueDateStr = '-';
    if (p.due_date) {
      const parts = p.due_date.split('-');
      if (parts.length === 3) dueDateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    const remaining = Number(p.remaining_amount || 0);

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: #0284c7; font-family: var(--font-mono); font-size: 13px;">${p.purchase_no}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Oleh: ${p.recorded_by_name || 'Owner'}</div>
        </td>
        <td style="color: #475569; font-size: 12px;">${timeFormatted}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${p.supplier_name || 'Bebas'}</div>
          ${p.supplier_phone ? `<div style="font-size: 11px; color: #059669; margin-top: 2px;">📞 ${p.supplier_phone}</div>` : ''}
        </td>
        <td>
          <span style="font-weight: 700; color: #0f172a;">${p.product_emoji || '🥔'} ${p.product_name}</span>
        </td>
        <td class="text-right font-mono font-bold" style="color: #0f172a;">${Number(p.qty_kg).toLocaleString('id-ID')} ${p.product_unit || 'kg'}</td>
        <td class="text-right font-mono" style="color: #475569;">${formatRupiah(p.cost_price)}</td>
        <td class="text-right font-mono font-bold" style="color: #059669; font-size: 13px;">${formatRupiah(p.total_cost)}</td>
        <td class="text-center">${statusBadge}</td>
        <td class="text-right">
          <strong class="font-mono font-bold" style="color: ${remaining > 0 ? (p.is_overdue ? '#dc2626' : '#d97706') : '#059669'}; font-size: 13px;">
            ${formatRupiah(remaining)}
          </strong>
          ${p.due_date ? `<div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Tempo: ${dueDateStr}</div>` : ''}
        </td>
        <td class="text-center">
          ${remaining > 0 ? `
            <button class="btn-table-action btn-pay-purchase" data-id="${p.id}" style="padding: 5px 12px; font-size: 12px; background: #059669; color: #ffffff; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
              💵 Bayar
            </button>
          ` : `
            <span style="font-size: 12px; color: #059669; font-weight: 700;">✅ Beres</span>
          `}
        </td>
      </tr>
    `;
  }).join('');

  el.purchasesTableBody.querySelectorAll('.btn-pay-purchase').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = state.purchases.find(item => item.id === Number(btn.dataset.id));
      if (p) openSupplierPayModal(p);
    });
  });
}

function openSupplierModal(supplier = null) {
  if (supplier) {
    if (el.modalSupplierTitle) el.modalSupplierTitle.textContent = 'Edit Data Pemasok';
    if (el.supplierEditId) el.supplierEditId.value = supplier.id;
    if (el.supInputName) el.supInputName.value = supplier.name || '';
    if (el.supInputPhone) el.supInputPhone.value = supplier.phone || '';
    if (el.supInputAddress) el.supInputAddress.value = supplier.address || '';
    if (el.supInputCommodities) el.supInputCommodities.value = supplier.supplied_commodities || '';
    if (el.supInputBank) el.supInputBank.value = supplier.bank_info || '';
    if (el.supInputNotes) el.supInputNotes.value = supplier.notes || '';
  } else {
    if (el.modalSupplierTitle) el.modalSupplierTitle.textContent = 'Tambah Pemasok / Juragan Baru';
    if (el.supplierEditId) el.supplierEditId.value = '';
    if (el.supInputName) el.supInputName.value = '';
    if (el.supInputPhone) el.supInputPhone.value = '';
    if (el.supInputAddress) el.supInputAddress.value = '';
    if (el.supInputCommodities) el.supInputCommodities.value = '';
    if (el.supInputBank) el.supInputBank.value = '';
    if (el.supInputNotes) el.supInputNotes.value = '';
  }
  if (el.modalEditSupplier) el.modalEditSupplier.style.display = 'flex';
}

async function handleSaveSupplierSubmit() {
  const editId = el.supplierEditId ? el.supplierEditId.value : '';
  const name = el.supInputName ? el.supInputName.value.trim() : '';
  const phone = el.supInputPhone ? el.supInputPhone.value.trim() : '';
  const address = el.supInputAddress ? el.supInputAddress.value.trim() : '';
  const commodities = el.supInputCommodities ? el.supInputCommodities.value.trim() : '';
  const bank = el.supInputBank ? el.supInputBank.value.trim() : '';
  const notes = el.supInputNotes ? el.supInputNotes.value.trim() : '';

  if (!name) {
    showToast('Nama juragan / pemasok wajib diisi!', 'error');
    if (el.supInputName) el.supInputName.focus();
    return;
  }

  const payload = {
    name,
    phone,
    address,
    supplied_commodities: commodities,
    bank_info: bank,
    notes
  };

  try {
    if (el.btnSaveSupplierSubmit) {
      el.btnSaveSupplierSubmit.disabled = true;
      el.btnSaveSupplierSubmit.textContent = 'Menyimpan...';
    }

    let res;
    if (editId) {
      res = await api.updateSupplier(editId, payload);
    } else {
      res = await api.createSupplier(payload);
    }

    if (res.success) {
      showToast(res.message || 'Data pemasok berhasil disimpan!', 'success');
      if (el.modalEditSupplier) el.modalEditSupplier.style.display = 'none';
      await loadSuppliersData();
    } else {
      showToast('Gagal: ' + res.message, 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan: ' + err.message, 'error');
  } finally {
    if (el.btnSaveSupplierSubmit) {
      el.btnSaveSupplierSubmit.disabled = false;
      el.btnSaveSupplierSubmit.textContent = 'Simpan Data Pemasok';
    }
  }
}

async function handleDeleteSupplier(supplierId, name) {
  if (!confirm(`Apakah Anda yakin ingin menonaktifkan pemasok "${name}"? Data riwayat belanja akan tetap tersimpan.`)) {
    return;
  }

  try {
    const res = await api.deleteSupplier(supplierId);
    if (res.success) {
      showToast(res.message || 'Pemasok berhasil dinonaktifkan', 'success');
      await loadSuppliersData();
    } else {
      showToast('Gagal: ' + res.message, 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan: ' + err.message, 'error');
  }
}

async function openSupplierDetailModal(supplierId) {
  try {
    const res = await api.getSupplierDetail(supplierId);
    if (!res.success) {
      showToast('Gagal memuat profil supplier: ' + res.message, 'error');
      return;
    }

    const { supplier, purchases, payments } = res;

    if (el.supDetailName) el.supDetailName.textContent = supplier.name;
    if (el.supDetailSubtitle) {
      el.supDetailSubtitle.textContent = `Pemasok Komoditas • ${supplier.address || 'Asal belum diisi'}`;
    }

    let phoneClean = (supplier.phone || '').replace(/[^0-9]/g, '');
    if (phoneClean.startsWith('0')) phoneClean = '62' + phoneClean.slice(1);
    const waLink = phoneClean
      ? `<a href="https://wa.me/${phoneClean}" target="_blank" rel="noopener noreferrer" class="btn-wa-chip" style="margin-left: 8px;">💬 Chat WhatsApp (${supplier.phone})</a>`
      : '';

    if (el.supProfileCard) {
      el.supProfileCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="font-size: 17px; font-weight: 800; color: #0f172a; display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
              <span>${supplier.name}</span>
              ${waLink}
            </div>
            <div style="font-size: 12.5px; color: #64748b; margin-top: 6px;">
              📍 Daerah / Alamat: <span style="color: #1e293b; font-weight: 600;">${supplier.address || '-'}</span>
            </div>
            <div style="font-size: 12.5px; color: #64748b; margin-top: 3px;">
              🏦 Rekening Bank: <span style="color: #0284c7; font-family: var(--font-mono); font-weight: 700;">${supplier.bank_info || 'Belum diisi'}</span>
            </div>
            <div style="font-size: 12.5px; color: #64748b; margin-top: 3px;">
              📦 Komoditas Pasokan: <span style="color: #059669; font-weight: 700;">${supplier.supplied_commodities || '-'}</span>
            </div>
            ${supplier.notes ? `<div style="font-size: 12px; color: #d97706; margin-top: 6px; font-weight: 500;">📝 Catatan: ${supplier.notes}</div>` : ''}
          </div>
          <div style="text-align: right; background: #ffffff; border: 1px solid #e2e8f0; padding: 12px 18px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Total Belanja Toko:</div>
            <strong style="font-size: 16px; color: #0f172a; font-family: var(--font-mono); font-weight: 800;">${formatRupiah(supplier.total_purchases_amount || 0)}</strong>
            <div style="font-size: 11px; color: #64748b; margin-top: 8px; font-weight: 600; text-transform: uppercase;">Sisa Hutang Toko ke Juragan:</div>
            <strong style="font-size: 19px; color: ${Number(supplier.total_debt_remaining || 0) > 0 ? '#dc2626' : '#059669'}; font-family: var(--font-mono); font-weight: 800;">
              ${formatRupiah(supplier.total_debt_remaining || 0)}
            </strong>
          </div>
        </div>
      `;
    }

    if (el.supPurchasesCount) el.supPurchasesCount.textContent = (purchases || []).length;
    if (el.supPaymentsCount) el.supPaymentsCount.textContent = (payments || []).length;

    // Render Purchases
    if (el.supPurchasesTableBody) {
      if (!purchases || purchases.length === 0) {
        el.supPurchasesTableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 24px; color: #94a3b8;">Belum ada riwayat nota kulakan masuk.</td></tr>';
      } else {
        el.supPurchasesTableBody.innerHTML = purchases.map(p => {
          const timeFormatted = parseSafeDate(p.created_at).toLocaleString('id-ID', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });

          let statusBadge = '';
          if (p.payment_status === 'lunas') {
            statusBadge = '<span class="kpi-badge success" style="font-size:11px;">🟢 Lunas</span>';
          } else if (p.is_overdue) {
            statusBadge = '<span class="kpi-badge danger" style="font-size:11px;">🚨 Lewat Tempo</span>';
          } else {
            statusBadge = '<span class="kpi-badge amber" style="font-size:11px;">⏳ Tempo</span>';
          }

          const rem = Number(p.remaining_amount || 0);

          return `
            <tr>
              <td style="font-family: var(--font-mono); font-weight: 700; color: #0284c7;">${p.purchase_no}</td>
              <td style="font-size: 12px; color: #475569;">${timeFormatted}</td>
              <td style="font-weight: 600; color: #0f172a;">${p.product_emoji || '🥔'} ${p.product_name}</td>
              <td class="text-right font-mono font-bold" style="color: #0f172a;">${Number(p.qty_kg).toLocaleString('id-ID')} ${p.product_unit || 'kg'}</td>
              <td class="text-right font-mono" style="color: #475569;">${formatRupiah(p.cost_price)}</td>
              <td class="text-right font-mono font-bold" style="color: #059669;">${formatRupiah(p.total_cost)}</td>
              <td class="text-center">${statusBadge}</td>
              <td class="text-right font-mono font-bold" style="color: ${rem > 0 ? '#dc2626' : '#059669'};">${formatRupiah(rem)}</td>
              <td class="text-center">
                ${rem > 0 ? `
                  <button class="btn-table-action btn-pay-subpurchase" data-id="${p.id}" style="padding: 4px 10px; font-size: 11px; background: #059669; color: #fff; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;">
                    Bayar
                  </button>
                ` : `<span style="font-size: 11px; color: #059669; font-weight: 700;">Lunas</span>`}
              </td>
            </tr>
          `;
        }).join('');

        el.supPurchasesTableBody.querySelectorAll('.btn-pay-subpurchase').forEach(btn => {
          btn.addEventListener('click', () => {
            const p = purchases.find(item => item.id === Number(btn.dataset.id));
            if (p) {
              if (el.modalSupplierDetail) el.modalSupplierDetail.style.display = 'none';
              openSupplierPayModal(p);
            }
          });
        });
      }
    }

    // Render Payments
    if (el.supPaymentsTableBody) {
      if (!payments || payments.length === 0) {
        el.supPaymentsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: #94a3b8;">Belum ada riwayat pembayaran hutang ke supplier ini.</td></tr>';
      } else {
        el.supPaymentsTableBody.innerHTML = payments.map(pm => {
          const timeFormatted = parseSafeDate(pm.payment_date).toLocaleString('id-ID', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          return `
            <tr>
              <td style="font-size: 12px; color: #475569;">${timeFormatted}</td>
              <td style="font-family: var(--font-mono); font-weight: 700; color: #0284c7;">${pm.purchase_no}</td>
              <td class="text-right font-mono font-bold" style="color: #059669;">${formatRupiah(pm.amount_paid)}</td>
              <td style="text-transform: uppercase; font-size: 11.5px; font-weight: 600; color: #334155;">${pm.payment_method}</td>
              <td style="color: #64748b; font-size: 12px;">${pm.recorded_by_name || 'Owner'}</td>
              <td style="color: #334155; font-size: 12px;">${pm.notes || '-'}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Default to Purchases tab view
    if (el.btnSupTabPurchases) el.btnSupTabPurchases.classList.add('active');
    if (el.btnSupTabPayments) el.btnSupTabPayments.classList.remove('active');
    if (el.supPurchasesContainer) el.supPurchasesContainer.style.display = 'block';
    if (el.supPaymentsContainer) el.supPaymentsContainer.style.display = 'none';

    if (el.modalSupplierDetail) el.modalSupplierDetail.style.display = 'flex';
  } catch (err) {
    showToast('Terjadi kesalahan membuka detail supplier: ' + err.message, 'error');
  }
}

function openSupplierPayModal(purchase) {
  state.activePurchaseForPayment = purchase;
  if (el.supPayPurchaseId) el.supPayPurchaseId.value = purchase.id;
  if (el.supPaySubtitle) {
    el.supPaySubtitle.textContent = `Nota: ${purchase.purchase_no} • ${purchase.product_name} (${purchase.supplier_name || 'Bebas'})`;
  }
  if (el.supPayRemainingText) {
    el.supPayRemainingText.textContent = formatRupiah(purchase.remaining_amount);
  }
  if (el.supPayNoteDetails) {
    el.supPayNoteDetails.textContent = `Total nota: ${formatRupiah(purchase.total_cost)} • Sudah dibayar: ${formatRupiah(purchase.paid_amount || 0)}`;
  }
  if (el.supPayAmountInput) {
    el.supPayAmountInput.value = purchase.remaining_amount;
  }
  if (el.supPayNotesInput) {
    el.supPayNotesInput.value = '';
  }
  if (el.modalSupplierPay) el.modalSupplierPay.style.display = 'flex';
}

async function handleSubmitSupplierPay() {
  if (!state.activePurchaseForPayment) return;

  const purchaseId = state.activePurchaseForPayment.id;
  const remaining = Number(state.activePurchaseForPayment.remaining_amount);
  const amount = Number(el.supPayAmountInput ? el.supPayAmountInput.value : 0);
  const method = el.supPayMethodSelect ? el.supPayMethodSelect.value : 'transfer';
  const notes = el.supPayNotesInput ? el.supPayNotesInput.value.trim() : '';

  if (!amount || amount <= 0) {
    showToast('Nominal pembayaran harus lebih dari Rp 0', 'error');
    if (el.supPayAmountInput) el.supPayAmountInput.focus();
    return;
  }

  if (amount > remaining) {
    showToast(`Nominal bayar (${formatRupiah(amount)}) melebihi sisa hutang (${formatRupiah(remaining)})!`, 'error');
    return;
  }

  try {
    if (el.btnSubmitSupplierPay) {
      el.btnSubmitSupplierPay.disabled = true;
      el.btnSubmitSupplierPay.textContent = 'Menyimpan...';
    }

    const res = await api.paySupplierDebt(purchaseId, {
      amount,
      payment_method: method,
      notes
    });

    if (res.success) {
      showToast(res.message || 'Pembayaran berhasil disimpan!', 'success');
      if (el.modalSupplierPay) el.modalSupplierPay.style.display = 'none';
      await loadSuppliersData();
      await loadPurchasesData();
    } else {
      showToast('Gagal: ' + res.message, 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan: ' + err.message, 'error');
  } finally {
    if (el.btnSubmitSupplierPay) {
      el.btnSubmitSupplierPay.disabled = false;
      el.btnSubmitSupplierPay.textContent = 'Simpan Pembayaran';
    }
  }
}

function openOwnerRecordPurchaseModal(preselectedSupplierId = null) {
  // Populate supplier select
  if (el.ownerPurchaseSupplierSelect) {
    el.ownerPurchaseSupplierSelect.innerHTML = `
      <option value="">-- Bebas (Tanpa Pemasok Terdaftar) --</option>
      ${state.suppliers.map(s => `
        <option value="${s.id}" ${preselectedSupplierId === s.id ? 'selected' : ''}>
          ${s.name} (${s.address || 'Petani'})
        </option>
      `).join('')}
    `;
  }

  // Populate products select
  if (el.ownerPurchaseProductSelect) {
    el.ownerPurchaseProductSelect.innerHTML = state.products.map(p => `
      <option value="${p.id}" data-cost="${p.cost_price || 0}" data-unit="${p.unit || 'kg'}">
        ${p.image_emoji || '🥔'} ${p.name} (Stok: ${p.stock} ${p.unit || 'kg'})
      </option>
    `).join('');

    const firstProduct = state.products[0];
    if (firstProduct && el.ownerPurchaseCostInput) {
      el.ownerPurchaseCostInput.value = firstProduct.cost_price || 0;
    }
  }

  if (el.ownerPurchaseQtyInput) el.ownerPurchaseQtyInput.value = '';
  if (el.ownerPurchasePaymentStatus) el.ownerPurchasePaymentStatus.value = 'lunas';
  if (el.ownerPurchaseTempoFields) el.ownerPurchaseTempoFields.style.display = 'none';
  if (el.ownerPurchaseDpAmount) el.ownerPurchaseDpAmount.value = '';
  if (el.ownerPurchaseNotesInput) el.ownerPurchaseNotesInput.value = '';

  // Set default due date to 14 days ahead
  if (el.ownerPurchaseDueDate) {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    el.ownerPurchaseDueDate.value = getLocalDateStr(d);
  }

  updateOwnerPurchaseTotal();

  if (el.modalOwnerRecordPurchase) el.modalOwnerRecordPurchase.style.display = 'flex';
}

function updateOwnerPurchaseTotal() {
  const qty = parseFloat(el.ownerPurchaseQtyInput ? el.ownerPurchaseQtyInput.value : 0) || 0;
  const cost = parseFloat(el.ownerPurchaseCostInput ? el.ownerPurchaseCostInput.value : 0) || 0;
  const total = qty * cost;
  if (el.ownerPurchaseTotalVal) {
    el.ownerPurchaseTotalVal.textContent = formatRupiah(total);
  }
}

async function handleSubmitOwnerRecordPurchase() {
  const supplierId = el.ownerPurchaseSupplierSelect ? el.ownerPurchaseSupplierSelect.value : '';
  const productId = el.ownerPurchaseProductSelect ? el.ownerPurchaseProductSelect.value : '';
  const qty = parseFloat(el.ownerPurchaseQtyInput ? el.ownerPurchaseQtyInput.value : 0);
  const cost = parseFloat(el.ownerPurchaseCostInput ? el.ownerPurchaseCostInput.value : 0);
  const paymentStatus = el.ownerPurchasePaymentStatus ? el.ownerPurchasePaymentStatus.value : 'lunas';
  const dueDate = (paymentStatus === 'tempo' && el.ownerPurchaseDueDate) ? el.ownerPurchaseDueDate.value : null;
  const dpAmount = (paymentStatus === 'tempo' && el.ownerPurchaseDpAmount) ? parseFloat(el.ownerPurchaseDpAmount.value || 0) : 0;
  const notes = el.ownerPurchaseNotesInput ? el.ownerPurchaseNotesInput.value.trim() : '';

  if (!productId) {
    showToast('Silakan pilih komoditas toko!', 'error');
    return;
  }
  if (!qty || qty <= 0) {
    showToast('Berat riil barang masuk harus lebih dari 0 kg!', 'error');
    if (el.ownerPurchaseQtyInput) el.ownerPurchaseQtyInput.focus();
    return;
  }
  if (!cost || cost <= 0) {
    showToast('Harga modal kulakan harus lebih dari Rp 0!', 'error');
    if (el.ownerPurchaseCostInput) el.ownerPurchaseCostInput.focus();
    return;
  }

  const payload = {
    supplier_id: supplierId ? Number(supplierId) : null,
    product_id: Number(productId),
    qty_kg: qty,
    cost_price: cost,
    payment_status: paymentStatus,
    due_date: dueDate,
    dp_amount: dpAmount,
    notes
  };

  try {
    if (el.btnSubmitOwnerRecordPurchase) {
      el.btnSubmitOwnerRecordPurchase.disabled = true;
      el.btnSubmitOwnerRecordPurchase.textContent = 'Menyimpan...';
    }

    const res = await api.createPurchase(payload);
    if (res.success) {
      showToast(res.message || 'Nota kulakan berhasil dicatat!', 'success');
      if (el.modalOwnerRecordPurchase) el.modalOwnerRecordPurchase.style.display = 'none';
      await loadAllData();
      await loadSuppliersData();
      await loadPurchasesData();
    } else {
      showToast('Gagal: ' + res.message, 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan: ' + err.message, 'error');
  } finally {
    if (el.btnSubmitOwnerRecordPurchase) {
      el.btnSubmitOwnerRecordPurchase.disabled = false;
      el.btnSubmitOwnerRecordPurchase.textContent = 'Simpan & Tambah Stok Masuk';
    }
  }
}


// -----------------------------------------------------------------------------
// TAB 7: IDENTITAS TOKO & FOOTER STRUK (SETTINGS & LIVE PREVIEW)
// -----------------------------------------------------------------------------
function populateSettingsForm() {
  if (!state.settings) return;
  if (el.setStoreName && !el.setStoreName.matches(':focus')) {
    el.setStoreName.value = state.settings.store_name || 'PD. HASIL BUMI RAYA 1';
  }
  if (el.setStoreTagline && !el.setStoreTagline.matches(':focus')) {
    el.setStoreTagline.value = state.settings.store_tagline || 'Pusat Umbi, Bawang & Komoditas Pasar';
  }
  if (el.setStoreAddress && !el.setStoreAddress.matches(':focus')) {
    el.setStoreAddress.value = state.settings.store_address || 'Pasar induk modern, Cikopo, Kec. Campaka, Kabupaten Purwakarta, Jawa Barat 41183';
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

  const sName = (el.setStoreName && el.setStoreName.value.trim()) || 'PD. HASIL BUMI RAYA 1';
  const sTagline = (el.setStoreTagline && el.setStoreTagline.value.trim()) || 'Pusat Umbi, Bawang & Komoditas Pasar';
  const sAddress = (el.setStoreAddress && el.setStoreAddress.value.trim()) || 'Pasar induk modern, Cikopo, Kec. Campaka, Kabupaten Purwakarta, Jawa Barat 41183';
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

// -----------------------------------------------------------------------------
// TAB 7: STATUS LISENSI & LANGGANAN SOFTWARE (SAAS ENFORCEMENT)
// -----------------------------------------------------------------------------
async function loadOwnerLicenseCard() {
  try {
    const res = await api.getSubscriptionStatus();
    if (!res || !res.success) return;

    const badge = document.getElementById('ownerLicenseBadge');
    const dueDate = document.getElementById('ownerLicenseDueDate');
    const diffDays = document.getElementById('ownerLicenseDiffDays');
    const amount = document.getElementById('ownerLicenseAmount');
    const bankName = document.getElementById('ownerLicenseBankName');
    const bankAccount = document.getElementById('ownerLicenseAccount');
    const bankHolder = document.getElementById('ownerLicenseHolder');
    const waBtn = document.getElementById('ownerLicenseWaBtn');

    if (dueDate) dueDate.textContent = `${res.due_date_formatted} (${res.due_date})`;
    if (amount && res.payment_info) amount.textContent = res.payment_info.amount_formatted + ' / bulan';
    if (bankName && res.payment_info) bankName.textContent = res.payment_info.bank_name;
    if (bankAccount && res.payment_info) bankAccount.textContent = res.payment_info.account_number;
    if (bankHolder && res.payment_info) bankHolder.textContent = 'A/N ' + res.payment_info.account_holder;
    if (waBtn && res.payment_info) waBtn.href = res.payment_info.wa_url;

    if (badge && diffDays) {
      if (res.is_locked) {
        badge.textContent = '⛔ TERKUNCI / EXPIRED';
        badge.style.background = '#fee2e2';
        badge.style.color = '#dc2626';
        badge.style.borderColor = '#fca5a5';
        diffDays.textContent = `Telat ${Math.abs(res.diff_days)} hari (Akses Terkunci)`;
        diffDays.style.color = '#dc2626';
      } else if (res.status === 'grace_period') {
        const rem = res.grace_days - Math.abs(res.diff_days);
        badge.textContent = `⏳ MASA TENGGANG (${rem} HARI)`;
        badge.style.background = '#ffedd5';
        badge.style.color = '#c2410c';
        badge.style.borderColor = '#fed7aa';
        diffDays.textContent = `Telat bayar - sisa toleransi ${rem} hari`;
        diffDays.style.color = '#c2410c';
      } else if (res.status === 'warning') {
        badge.textContent = `⚠️ JATUH TEMPO (${res.diff_days} HARI)`;
        badge.style.background = '#fef08a';
        badge.style.color = '#854d0e';
        badge.style.borderColor = '#fde047';
        diffDays.textContent = `Masa aktif segera berakhir dalam ${res.diff_days} hari`;
        diffDays.style.color = '#854d0e';
      } else {
        badge.textContent = '🟢 AKTIF BERLANGGANAN';
        badge.style.background = '#ecfdf5';
        badge.style.color = '#059669';
        badge.style.borderColor = '#a7f3d0';
        diffDays.textContent = `Masa aktif aman (${res.diff_days} hari tersisa)`;
        diffDays.style.color = '#059669';
      }
    }
  } catch (err) {
    console.warn('Gagal memuat status lisensi owner:', err);
  }
}

// -----------------------------------------------------------------------------
// OWNER HARDWARE SUPPORT (PRINTER & CASH DRAWER RJ-11)
// -----------------------------------------------------------------------------
function updateOwnerHardwareUI(hwState) {
  if (el.ownerHwPrinterIndicator) {
    el.ownerHwPrinterIndicator.className = hwState.isConnected ? 'status-indicator-circle connected' : 'status-indicator-circle';
  }
  if (el.ownerHwDeviceNameDisplay) {
    el.ownerHwDeviceNameDisplay.textContent = hwState.isConnected ? (hwState.deviceName || 'Printer Thermal') : 'Belum Terhubung';
  }
  if (el.ownerHwDeviceStatusText) {
    el.ownerHwDeviceStatusText.textContent = hwState.isConnected ? 'Siap mencetak & kick laci kasir' : 'Nyalakan Bluetooth printer & tablet';
  }
  if (el.ownerBtnConnectBluetooth) {
    el.ownerBtnConnectBluetooth.style.display = hwState.isConnected ? 'none' : 'inline-block';
  }
  if (el.ownerBtnDisconnectBluetooth) {
    el.ownerBtnDisconnectBluetooth.style.display = hwState.isConnected ? 'inline-block' : 'none';
  }
  if (el.ownerHwPrintMode) el.ownerHwPrintMode.value = hwState.config.mode;
  if (el.ownerHwPaperSize) el.ownerHwPaperSize.value = hwState.config.paperSize;
  if (el.ownerHwAutoDrawer) el.ownerHwAutoDrawer.checked = hwState.config.autoDrawer;
}

function initOwnerHardwareSupport() {
  hardwareManager.subscribeState(updateOwnerHardwareUI);

  if (el.ownerBtnConnectBluetooth) {
    el.ownerBtnConnectBluetooth.addEventListener('click', async () => {
      el.ownerBtnConnectBluetooth.disabled = true;
      el.ownerBtnConnectBluetooth.textContent = '⏳ Mencari Printer...';
      try {
        const res = await hardwareManager.connectBluetooth();
        showToast(`Terhubung ke ${res.deviceName}!`, 'success');
      } catch (err) {
        showToast('Gagal konek Bluetooth: ' + err.message, 'error');
      } finally {
        el.ownerBtnConnectBluetooth.disabled = false;
        el.ownerBtnConnectBluetooth.textContent = '🔵 Hubungkan Printer';
      }
    });
  }

  if (el.ownerBtnDisconnectBluetooth) {
    el.ownerBtnDisconnectBluetooth.addEventListener('click', async () => {
      await hardwareManager.disconnectBluetooth();
      showToast('Printer Bluetooth diputuskan', 'info');
    });
  }

  if (el.ownerBtnTestDrawer) {
    el.ownerBtnTestDrawer.addEventListener('click', async () => {
      try {
        await hardwareManager.kickCashDrawer();
        showToast('Sinyal kick RJ-11 dikirim ke printer!', 'success');
      } catch (err) {
        showToast('Gagal buka laci: ' + err.message, 'error');
      }
    });
  }

  if (el.ownerBtnTestPrint) {
    el.ownerBtnTestPrint.addEventListener('click', async () => {
      el.ownerBtnTestPrint.disabled = true;
      el.ownerBtnTestPrint.textContent = '⏳ Mencetak test...';
      try {
        await hardwareManager.printTest();
        showToast('Cetak struk uji coba berhasil!', 'success');
      } catch (err) {
        showToast('Gagal test print: ' + err.message, 'error');
      } finally {
        el.ownerBtnTestPrint.disabled = false;
        el.ownerBtnTestPrint.textContent = '🖨️ Cetak Struk Uji Coba (Test Print)';
      }
    });
  }

  if (el.ownerBtnSaveHardware) {
    el.ownerBtnSaveHardware.addEventListener('click', () => {
      hardwareManager.saveConfig({
        mode: el.ownerHwPrintMode ? el.ownerHwPrintMode.value : 'bluetooth',
        paperSize: el.ownerHwPaperSize ? el.ownerHwPaperSize.value : '58mm',
        autoDrawer: el.ownerHwAutoDrawer ? el.ownerHwAutoDrawer.checked : true
      });
      showToast('Pengaturan hardware kios disimpan!', 'success');
    });
  }
}

// Owner Expenses & Petty Cash Management Functions
async function loadOwnerExpensesData() {
  try {
    const [expRes, catRes, shiftRes] = await Promise.all([
      api.getExpenses(),
      api.getExpenseCategories(),
      api.getCurrentShift()
    ]);

    if (shiftRes && shiftRes.shift) {
      state.currentDrawerCash = Number(shiftRes.shift.current_drawer_cash) || 0;
    } else {
      state.currentDrawerCash = 0;
    }

    if (catRes && catRes.success) {
      state.ownerExpenseCategories = catRes.categories || [];
      populateOwnerExpenseCategoryFilter();
    }

    if (expRes && expRes.success) {
      state.ownerExpenses = expRes.expenses || [];
      state.ownerExpenseSummary = expRes.summary || {};

      const summary = state.ownerExpenseSummary;
      if (el.ownerKpiMonthExpenses) {
        el.ownerKpiMonthExpenses.textContent = formatRupiah(summary.month_expenses || summary.total_expenses || 0);
      }
      if (el.ownerKpiExpensesCount) {
        el.ownerKpiExpensesCount.textContent = `${state.ownerExpenses.filter(e => e.type === 'expense').length} transaksi pengeluaran`;
      }
      if (el.ownerKpiDrawerExpenses) {
        el.ownerKpiDrawerExpenses.textContent = formatRupiah(summary.total_cash_drawer_out || 0);
      }
      if (el.ownerKpiTransferExpenses) {
        el.ownerKpiTransferExpenses.textContent = formatRupiah(summary.total_transfer_out || 0);
      }
      if (el.ownerKpiTotalIncome) {
        el.ownerKpiTotalIncome.textContent = formatRupiah(summary.total_income || 0);
      }
      if (el.expenseCountBadge) {
        el.expenseCountBadge.textContent = state.ownerExpenses.length;
        el.expenseCountBadge.style.display = state.ownerExpenses.length > 0 ? 'inline-block' : 'none';
      }
      if (el.sheetExpenseBadge) {
        el.sheetExpenseBadge.textContent = state.ownerExpenses.length;
        el.sheetExpenseBadge.style.display = state.ownerExpenses.length > 0 ? 'inline-block' : 'none';
      }

      renderOwnerExpenseCategoryBars(summary.category_breakdown || []);
      renderOwnerExpensesTable();
    }

    checkOwnerExpenseSufficiency();
  } catch (err) {
    console.warn('Gagal memuat data biaya operasional owner:', err);
  }
}

function checkOwnerExpenseSufficiency() {
  if (!el.ownerExpenseShortageAlert) return;
  const isCash = el.ownerSourceCash && el.ownerSourceCash.checked;
  const amount = Number(el.ownerExpenseAmountInput ? el.ownerExpenseAmountInput.value : 0) || 0;
  const drawerCash = Number(state.currentDrawerCash) || 0;

  if (isCash && amount > drawerCash) {
    const shortage = amount - drawerCash;
    if (el.lblOwnerDrawerAvail) el.lblOwnerDrawerAvail.textContent = formatRupiah(drawerCash);
    if (el.lblOwnerDrawerShortage) el.lblOwnerDrawerShortage.textContent = formatRupiah(shortage);
    el.ownerExpenseShortageAlert.style.display = 'block';
    if (el.btnSubmitOwnerAddExpense) {
      el.btnSubmitOwnerAddExpense.style.background = '#94a3b8';
      el.btnSubmitOwnerAddExpense.title = 'Saldo kas laci kasir tidak mencukupi.';
    }
  } else {
    el.ownerExpenseShortageAlert.style.display = 'none';
    if (el.btnSubmitOwnerAddExpense) {
      el.btnSubmitOwnerAddExpense.style.background = '#e11d48';
      el.btnSubmitOwnerAddExpense.title = '';
    }
  }
}

function populateOwnerExpenseCategoryFilter() {
  if (!el.ownerFilterExpenseCategory) return;
  const currentVal = el.ownerFilterExpenseCategory.value;
  const options = ['<option value="all">Semua Kategori</option>'];
  (state.ownerExpenseCategories || []).forEach(c => {
    options.push(`<option value="${c.key}">${c.icon} ${escapeHtml(c.name)}</option>`);
  });
  el.ownerFilterExpenseCategory.innerHTML = options.join('');
  if (currentVal) el.ownerFilterExpenseCategory.value = currentVal;
}

function renderOwnerExpenseCategoryBars(breakdown = []) {
  if (!el.ownerExpenseCategoryBars) return;
  if (!breakdown || breakdown.length === 0) {
    el.ownerExpenseCategoryBars.innerHTML = '<span style="color: #94a3b8; font-size: 12px;">Belum ada data pengeluaran terdistribusi.</span>';
    return;
  }

  el.ownerExpenseCategoryBars.innerHTML = breakdown.slice(0, 5).map(cat => {
    return `
      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 12px; font-size: 12px; display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 700; color: #0f172a;">${escapeHtml(cat.category_name)}:</span>
        <strong style="color: #e11d48; font-family: monospace;">${formatRupiah(cat.total_amount)}</strong>
        <span style="font-size: 11px; background: #fee2e2; color: #dc2626; padding: 1px 6px; border-radius: 4px; font-weight: 700;">${cat.percentage}%</span>
      </div>
    `;
  }).join('');
}

function renderOwnerExpensesTable() {
  if (!el.ownerExpensesTableBody) return;
  const q = el.ownerSearchExpenseInput ? el.ownerSearchExpenseInput.value.toLowerCase().trim() : '';
  const filterCat = el.ownerFilterExpenseCategory ? el.ownerFilterExpenseCategory.value : 'all';
  const filterSrc = el.ownerFilterExpenseSource ? el.ownerFilterExpenseSource.value : 'all';

  const list = (state.ownerExpenses || []).filter(e => {
    const matchSearch = !q || (e.expense_no && e.expense_no.toLowerCase().includes(q)) || (e.category_name && e.category_name.toLowerCase().includes(q)) || (e.notes && e.notes.toLowerCase().includes(q));
    const matchCat = filterCat === 'all' || e.category === filterCat;
    const matchSrc = filterSrc === 'all' || e.source === filterSrc;
    return matchSearch && matchCat && matchSrc;
  });

  if (list.length === 0) {
    el.ownerExpensesTableBody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 30px; color: #94a3b8;">Tidak ada data pengeluaran yang cocok dengan kriteria.</td></tr>';
    return;
  }

  el.ownerExpensesTableBody.innerHTML = list.map(e => {
    const timeFormatted = parseSafeDate(e.created_at).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const isIncome = e.type === 'income';
    const isCash = e.source === 'cash';

    return `
      <tr style="border-bottom: 1px solid #f1f5f9; background: ${isIncome ? '#f0fdf4' : '#ffffff'};">
        <td style="padding: 10px 12px;">
          <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #0f172a;">${e.expense_no}</code>
        </td>
        <td style="padding: 10px 12px; font-size: 12px; color: #0f172a; white-space: nowrap;">
          ${timeFormatted}
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
        <td style="padding: 10px 12px; font-size: 12px; color: #64748b; white-space: nowrap;">
          👤 ${escapeHtml(e.recorded_by_name || 'Kasir')} <span style="font-size: 10px; color: #94a3b8;">(${e.recorded_by_role || '-'})</span>
        </td>
        <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
          <div style="display: flex; gap: 4px; justify-content: center;">
            <button type="button" class="btn-print-owner-expense" data-id="${e.id}" style="padding: 4px 8px; border-radius: 6px; background: #e0f2fe; border: 1px solid #bae6fd; color: #0284c7; cursor: pointer; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;" title="Cetak Ulang Bukti Kas / Biaya (Printer Thermal)">
              <span>🖨️</span> Cetak
            </button>
            <button type="button" class="btn-delete-owner-expense" data-id="${e.id}" style="padding: 4px 8px; border-radius: 6px; background: #fee2e2; border: 1px solid #fecdd3; color: #dc2626; cursor: pointer; font-size: 11px; font-weight: 700;" title="Hapus Catatan">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  el.ownerExpensesTableBody.querySelectorAll('.btn-print-owner-expense').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const exp = (state.ownerExpenses || []).find(x => x.id === id);
      if (exp) {
        try {
          btn.disabled = true;
          btn.innerHTML = '<span>⏳</span>';
          const settings = state.settings || {};
          await hardwareManager.printExpense(exp, settings, true);
          showToast('🖨️ Bukti kas/biaya berhasil dicetak ke printer!', 'success');
        } catch (err) {
          showToast('Gagal mencetak: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<span>🖨️</span> Cetak';
        }
      }
    });
  });

  el.ownerExpensesTableBody.querySelectorAll('.btn-delete-owner-expense').forEach(btn => {
    btn.addEventListener('click', () => {
      handleDeleteOwnerExpense(Number(btn.dataset.id));
    });
  });
}

async function handleSaveOwnerExpense() {
  const category = el.ownerExpenseCategorySelect ? el.ownerExpenseCategorySelect.value : 'makan_rokok';
  const amount = Number(el.ownerExpenseAmountInput ? el.ownerExpenseAmountInput.value : 0);
  const source = el.ownerSourceCash && el.ownerSourceCash.checked ? 'cash' : 'transfer';
  const notes = el.ownerExpenseNotesInput ? el.ownerExpenseNotesInput.value.trim() : '';

  if (isNaN(amount) || amount <= 0) {
    showToast('Masukkan nominal pengeluaran yang valid!', 'error');
    if (el.ownerExpenseAmountInput) el.ownerExpenseAmountInput.focus();
    return;
  }

  // Pre-check drawer cash balance if source is cash
  if (source === 'cash' && amount > (Number(state.currentDrawerCash) || 0)) {
    const shortage = amount - (Number(state.currentDrawerCash) || 0);
    showToast(`Saldo kas laci tidak mencukupi! Kurang ${formatRupiah(shortage)}. Tambah modal kas laci terlebih dahulu atau gunakan Transfer Bank.`, 'error');
    checkOwnerExpenseSufficiency();
    return;
  }

  try {
    if (el.btnSubmitOwnerAddExpense) {
      el.btnSubmitOwnerAddExpense.disabled = true;
      el.btnSubmitOwnerAddExpense.textContent = 'Menyimpan...';
    }

    const res = await api.createExpense({
      category,
      amount,
      source,
      notes,
      type: 'expense'
    });

    showToast(res.message || 'Pengeluaran berhasil dicatat!', 'success');
    if (el.modalOwnerAddExpense) el.modalOwnerAddExpense.style.display = 'none';

    await loadOwnerExpensesData();
    await loadDashboardData();
  } catch (err) {
    showToast('Gagal mencatat pengeluaran: ' + err.message, 'error');
  } finally {
    if (el.btnSubmitOwnerAddExpense) {
      el.btnSubmitOwnerAddExpense.disabled = false;
      el.btnSubmitOwnerAddExpense.textContent = 'Simpan Pengeluaran';
    }
  }
}

async function handleSaveOwnerIncome() {
  const category = el.ownerIncomeCategorySelect ? el.ownerIncomeCategorySelect.value : 'kas_masuk_modal';
  const amount = Number(el.ownerIncomeAmountInput ? el.ownerIncomeAmountInput.value : 0);
  const source = el.ownerIncomeSourceSelect ? el.ownerIncomeSourceSelect.value : 'cash';
  const notes = el.ownerIncomeNotesInput ? el.ownerIncomeNotesInput.value.trim() : '';

  if (isNaN(amount) || amount <= 0) {
    showToast('Masukkan nominal kas masuk yang valid!', 'error');
    if (el.ownerIncomeAmountInput) el.ownerIncomeAmountInput.focus();
    return;
  }

  try {
    if (el.btnSubmitOwnerAddIncome) {
      el.btnSubmitOwnerAddIncome.disabled = true;
      el.btnSubmitOwnerAddIncome.textContent = 'Menyimpan...';
    }

    const res = await api.createExpense({
      category,
      amount,
      source,
      notes,
      type: 'income'
    });

    showToast(res.message || 'Kas masuk berhasil dicatat!', 'success');
    if (el.modalOwnerAddIncome) el.modalOwnerAddIncome.style.display = 'none';

    await loadOwnerExpensesData();
    await loadDashboardData();
  } catch (err) {
    showToast('Gagal mencatat kas masuk: ' + err.message, 'error');
  } finally {
    if (el.btnSubmitOwnerAddIncome) {
      el.btnSubmitOwnerAddIncome.disabled = false;
      el.btnSubmitOwnerAddIncome.textContent = 'Simpan Kas Masuk';
    }
  }
}

async function handleDeleteOwnerExpense(id) {
  if (!confirm('Yakin ingin menghapus catatan biaya ini?')) return;
  try {
    const res = await api.deleteExpense(id);
    showToast(res.message || 'Catatan biaya berhasil dihapus', 'success');
    await loadOwnerExpensesData();
    await loadDashboardData();
  } catch (err) {
    showToast('Gagal menghapus biaya: ' + err.message, 'error');
  }
}

window.addEventListener('DOMContentLoaded', initOwnerApp);
