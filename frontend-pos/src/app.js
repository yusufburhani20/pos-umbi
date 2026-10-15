import { api } from './api.js';

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
  activeCartEditIndex: null,
  scaleCalculatedQty: 1,
  scaleCalculatedSubtotal: 0,
  paymentMethod: 'cash',
  pendingVoidOrder: null,
  cashierDebts: [],
  activeDebtForPayment: null
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
  tempoCustomerName: document.getElementById('tempoCustomerName'),
  tempoCustomerPhone: document.getElementById('tempoCustomerPhone'),
  tempoDueDateInput: document.getElementById('tempoDueDateInput'),
  tempoDpInput: document.getElementById('tempoDpInput'),
  tempoTotalAmount: document.getElementById('tempoTotalAmount'),
  tempoDpAmount: document.getElementById('tempoDpAmount'),
  tempoRemainingAmount: document.getElementById('tempoRemainingAmount'),

  // Cashier Debts Modal
  cashierDebtsModal: document.getElementById('cashierDebtsModal'),
  searchCashierDebt: document.getElementById('searchCashierDebt'),
  btnRefreshCashierDebts: document.getElementById('btnRefreshCashierDebts'),
  cashierDebtsTableBody: document.getElementById('cashierDebtsTableBody'),
  btnCloseCashierDebtsModal: document.getElementById('btnCloseCashierDebtsModal'),
  btnCloseCashierDebtsFooter: document.getElementById('btnCloseCashierDebtsFooter'),

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

  voidAuthModal: document.getElementById('voidAuthModal'),
  voidOrderNo: document.getElementById('voidOrderNo'),
  voidReasonInput: document.getElementById('voidReasonInput'),
  voidOwnerPinInput: document.getElementById('voidOwnerPinInput'),
  btnCancelVoid: document.getElementById('btnCancelVoid'),
  btnConfirmVoid: document.getElementById('btnConfirmVoid'),

  btnLogout: document.getElementById('btnLogout'),
  toastContainer: document.getElementById('toastContainer')
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
// INITIALIZATION
// -----------------------------------------------------------------------------
async function initApp() {
  bindEvents();
  updateLiveDateTime();
  setInterval(updateLiveDateTime, 1000);

  // Check if session exists
  if (!api.token) {
    showLoginModal();
    return;
  }

  try {
    const meRes = await api.getMe();
    state.user = meRes.user;
    el.activeCashierName.textContent = state.user.name;
    updateRoleUI();

    // Check shift
    await syncShift();
    await loadInitialData();
  } catch (err) {
    console.error('Session expired or error:', err);
    api.clearSession();
    showLoginModal();
  }
}

async function syncShift() {
  const shiftRes = await api.getCurrentShift();
  if (shiftRes.has_active_shift) {
    state.shift = shiftRes.shift;
    el.activeShiftMeta.textContent = `Shift Aktif #${state.shift.id} (Modal: ${formatRupiah(state.shift.starting_cash)})`;
  } else {
    state.shift = null;
    el.activeShiftMeta.textContent = 'Shift Belum Dibuka';
    showOpenShiftModal();
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
    const [prodRes, custRes, settingsRes] = await Promise.all([
      api.getProducts(),
      api.getCustomers(),
      api.getSettings().catch(() => ({ settings: {} }))
    ]);

    state.products = prodRes.products || [];
    state.filteredProducts = [...state.products];
    state.customers = custRes.customers || [];
    state.settings = (settingsRes && settingsRes.settings) || {};
    updateStoreHeaderUI();

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

    renderProductGrid();
    renderCustomerSelect();
  } catch (err) {
    showToast('Gagal memuat data komoditas: ' + err.message, 'error');
  }
}

// -----------------------------------------------------------------------------
// EVENT BINDINGS
// -----------------------------------------------------------------------------
function bindEvents() {
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

  // Customer Select
  el.customerSelect.addEventListener('change', (e) => {
    state.selectedCustomerId = e.target.value;
    state.selectedCustomer = state.customers.find(c => String(c.id) === state.selectedCustomerId) || null;
    updateCustomerTierState();
    recalculateCart();
  });

  // Cart actions
  el.btnClearCart.addEventListener('click', () => {
    if (confirm('Kosongkan keranjang belanja?')) {
      state.cart = [];
      renderCart();
    }
  });

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

  document.getElementById('presetKasir').addEventListener('click', () => submitPinLogin('112233'));
  const btnPresetSiti = document.getElementById('presetSiti');
  if (btnPresetSiti) btnPresetSiti.addEventListener('click', () => submitPinLogin('223344'));
  document.getElementById('presetOwner').addEventListener('click', () => submitPinLogin('123456'));

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
      const method = target.dataset.method;

      if (method === 'tempo') {
        if (!state.selectedCustomer) {
          showToast('Wajib pilih pelanggan terdaftar terlebih dahulu untuk transaksi Kasbon / Tempo!', 'warning');
          el.paymentModal.style.display = 'none';
          el.customerSelect.focus();
          return;
        }
      }

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

  // Cashier Debts Modal Events
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

  // Cashier Pay Debt Modal
  if (el.btnDebtPayFull) {
    el.btnDebtPayFull.addEventListener('click', () => {
      el.btnDebtPayFull.classList.add('active');
      el.btnDebtPayFull.style.background = '#10b981';
      el.btnDebtPayFull.style.color = '#fff';
      el.btnDebtPayPartial.classList.remove('active');
      el.btnDebtPayPartial.style.background = 'rgba(255,255,255,0.08)';
      el.btnDebtPayPartial.style.color = '#e2e8f0';
      if (state.activeDebtForPayment) {
        el.payDebtAmountInput.value = formatRupiah(state.activeDebtForPayment.remaining_amount);
      }
    });
  }
  if (el.btnDebtPayPartial) {
    el.btnDebtPayPartial.addEventListener('click', () => {
      el.btnDebtPayPartial.classList.add('active');
      el.btnDebtPayPartial.style.background = '#f59e0b';
      el.btnDebtPayPartial.style.color = '#fff';
      el.btnDebtPayFull.classList.remove('active');
      el.btnDebtPayFull.style.background = 'rgba(255,255,255,0.08)';
      el.btnDebtPayFull.style.color = '#e2e8f0';
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

  
  document.getElementById('tenderNumpad').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-num');
    if (!btn) return;
    const val = btn.dataset.val;
    const currentTotal = getCartTotal();
    let currentTender = parseRupiahInput(el.cashTenderedInput.value);

    if (val === 'pas') {
      el.cashTenderedInput.value = formatRupiahNumber(currentTotal);
    } else if (val === 'clear') {
      el.cashTenderedInput.value = '';
    } else {
      el.cashTenderedInput.value = formatRupiahNumber(currentTender + Number(val));
    }
    calculateChangeDue();
  });

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
    if (el.receiptModalTitle) el.receiptModalTitle.textContent = 'Transaksi Berhasil';
    if (el.btnNextOrder) el.btnNextOrder.textContent = 'Transaksi Baru Berikutnya';
  };
  el.btnCloseReceiptModal.addEventListener('click', closeReceiptModal);
  el.btnNextOrder.addEventListener('click', closeReceiptModal);
  el.btnPrintReceipt.addEventListener('click', () => window.print());

  // Blind Close Shift
  el.btnCloseShift.addEventListener('click', openCloseShiftModal);
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
    if (el.btnOwnerPanel) el.btnOwnerPanel.style.display = 'none';
    showLoginModal();
    showToast('Berhasil keluar. Silakan masukkan PIN untuk bertugas.', 'info');
  });
}

// -----------------------------------------------------------------------------
// LOGIN & SHIFT LOGIC
// -----------------------------------------------------------------------------
function showLoginModal() {
  if (el.btnOwnerPanel) el.btnOwnerPanel.style.display = 'none';
  el.loginModal.style.display = 'flex';
  el.pinInput.value = '';
}

async function submitPinLogin(pin) {
  try {
    const res = await api.login(pin);
    api.setSession(res.token, res.user);
    state.user = res.user;
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
  if (state.filteredProducts.length === 0) {
    el.productGrid.innerHTML = `<div class="empty-cart"><p>Tidak ada komoditas ditemukan</p></div>`;
    return;
  }

  el.productGrid.innerHTML = state.filteredProducts.map(p => {
    const minAlert = p.min_stock_alert !== undefined && p.min_stock_alert !== null ? Number(p.min_stock_alert) : 15.0;
    const isOut = Number(p.stock_qty) <= 0;
    const isLow = !isOut && Number(p.stock_qty) <= minAlert;

    let tagHtml = '';
    let cardClass = '';
    if (isOut) {
      tagHtml = `<span class="stock-tag empty">🚨 Habis (0 ${p.unit})</span>`;
      cardClass = 'out-of-stock';
    } else if (isLow) {
      tagHtml = `<span class="stock-tag low">⚠️ Sisa ${p.stock_qty} ${p.unit}</span>`;
      cardClass = 'low-stock-card';
    } else {
      tagHtml = `<span class="stock-tag safe">🟢 ${p.stock_qty} ${p.unit}</span>`;
    }

    return `
      <div class="product-card ${cardClass}" data-id="${p.id}">
        <div>
          <div class="card-top">
            <span class="product-emoji">${p.image_emoji || '🥔'}</span>
            ${tagHtml}
          </div>
          <h3 class="product-name">${p.name}</h3>
        </div>
        <div class="card-pricing">
          <div class="price-row">
            <span class="price-label">Eceran:</span>
            <span class="price-val">${formatRupiah(p.retail_price)}</span>
          </div>
          <div class="price-row reseller">
            <span class="price-label">
              Grosir: <span class="threshold-badge">&ge;${p.wholesale_min_qty}${p.unit}</span>
            </span>
            <span class="price-val">${formatRupiah(p.reseller_price)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Add click listener
  el.productGrid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = Number(card.dataset.id);
      const product = state.products.find(p => p.id === id);
      if (product) addToCart(product);
    });
  });
}

function renderCustomerSelect() {
  const resellerOptions = state.customers
    .filter(c => c.tier === 'reseller')
    .map(c => `<option value="${c.id}">⭐ [Reseller] ${c.name} (${c.phone || '-'})</option>`)
    .join('');

  el.customerSelect.innerHTML = `
    <option value="">👤 Pembeli Umum / Walk-in (Eceran)</option>
    ${resellerOptions}
  `;
}

function updateCustomerTierState() {
  const isReseller = state.selectedCustomer && state.selectedCustomer.tier === 'reseller';
  if (isReseller) {
    el.currentTierLabel.textContent = 'Grosir / Reseller';
    el.currentTierLabel.className = 'tier-status-pill reseller';
    el.tierHintText.textContent = `⭐ Member Reseller: ${state.selectedCustomer.name}. Semua item otomatis dapat harga grosir!`;
  } else {
    el.currentTierLabel.textContent = 'Eceran';
    el.currentTierLabel.className = 'tier-status-pill';
    el.tierHintText.innerHTML = 'ℹ️ Beli &ge; 10 kg otomatis dapat harga grosir/reseller.';
  }
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

  el.scaleProdEmoji.textContent = product.image_emoji || '🥔';
  el.scaleProdName.textContent = product.name;
  el.scaleProdPriceRate.innerHTML = `Eceran: <strong>${formatRupiah(product.retail_price)}/${product.unit}</strong> | Grosir: <strong>${formatRupiah(product.reseller_price)}/${product.unit}</strong> (Min. ${product.wholesale_min_qty} ${product.unit})`;

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

  const isCustomerReseller = state.selectedCustomer && state.selectedCustomer.tier === 'reseller';
  const meetsWholesale = weight >= Number(p.wholesale_min_qty);
  const isWholesale = isCustomerReseller || meetsWholesale;

  const rate = isWholesale ? Number(p.reseller_price) : Number(p.retail_price);
  // Round to nearest Rp 100 so weight-based commodity calculations are always clean
  const subtotal = Math.round((weight * rate) / 100) * 100;

  state.scaleCalculatedQty = weight;
  state.scaleCalculatedSubtotal = subtotal;

  el.scaleWeightSubtotal.textContent = formatRupiah(subtotal);
  el.scaleTierBadge.textContent = isWholesale ? 'Grosir / Reseller' : 'Eceran';
  el.scaleTierBadge.className = `scale-tier-badge ${isWholesale ? 'highlight' : ''}`;
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

  const isCustomerReseller = state.selectedCustomer && state.selectedCustomer.tier === 'reseller';
  let rate = isCustomerReseller ? Number(p.reseller_price) : Number(p.retail_price);
  let weight = money / rate;

  if (!isCustomerReseller && weight >= Number(p.wholesale_min_qty)) {
    rate = Number(p.reseller_price);
    weight = money / rate;
  }

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

  if (state.activeCartEditIndex !== null && state.cart[state.activeCartEditIndex]) {
    state.cart[state.activeCartEditIndex].qty = qty;
    state.cart[state.activeCartEditIndex].fixedMoney = fixedMoney;
  } else {
    const existingIndex = state.cart.findIndex(i => i.product.id === product.id);
    if (existingIndex > -1) {
      state.cart[existingIndex].qty += qty;
      state.cart[existingIndex].fixedMoney = fixedMoney;
    } else {
      state.cart.push({
        product,
        qty,
        fixedMoney
      });
    }
  }

  el.modalScaleWeight.style.display = 'none';
  recalculateCart();
  renderCart();
  showToast(`${product.name} (${qty.toFixed(2)} ${product.unit}) berhasil dimasukkan ke keranjang!`, 'success');
}

function addToCart(product) {
  if (Number(product.stock_qty) <= 0) {
    showToast(`⚠️ Stok ${product.name} telah habis (0 ${product.unit}). Tidak dapat ditambahkan ke keranjang.`, 'warning');
    return;
  }
  const existingIndex = state.cart.findIndex(i => i.product.id === product.id);
  if (existingIndex > -1) {
    state.cart[existingIndex].qty = Math.round((state.cart[existingIndex].qty + 1) * 100) / 100;
  } else {
    state.cart.push({
      product,
      qty: 1
    });
  }
  recalculateCart();
  renderCart();
}

function recalculateCart() {
  const isCustomerReseller = state.selectedCustomer && state.selectedCustomer.tier === 'reseller';

  state.cart.forEach(item => {
    const meetsWholesaleQty = item.qty >= Number(item.product.wholesale_min_qty);
    const eligibleForReseller = isCustomerReseller || meetsWholesaleQty;

    item.tier = eligibleForReseller ? 'reseller' : 'retail';
    item.unitPrice = eligibleForReseller ? Number(item.product.reseller_price) : Number(item.product.retail_price);

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
    return;
  }

  el.btnClearCart.style.display = 'block';
  el.btnCheckout.disabled = false;

  let totalWeight = 0;
  let totalAmount = 0;

  el.cartItemsList.innerHTML = state.cart.map((item, index) => {
    totalWeight += item.qty;
    totalAmount += item.subtotal;

    return `
      <div class="cart-item-card">
        <div class="cart-item-top">
          <div class="item-info">
            <span class="item-title">${item.product.name}</span>
            <span class="item-badge ${item.tier}">${item.tier === 'reseller' ? 'Grosir' : 'Ecer'}</span>
          </div>
          <button class="btn-remove-item" data-index="${index}" title="Hapus">✕</button>
        </div>
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
            <div class="item-unit-rate">@${formatRupiah(item.unitPrice)}/${item.product.unit}${item.fixedMoney ? ' <span style="color:#059669;font-weight:700;">(Nominal Pas)</span>' : ''}</div>
            <div class="item-subtotal">${formatRupiah(item.subtotal)}</div>
          </div>
        </div>

        <!-- Bar Cepat Seadanya (1-Tap Super Simpel) -->
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
        </div>
      </div>
    `;
  }).join('');

  el.totalWeightText.textContent = `${totalWeight.toFixed(2)} kg`;
  el.totalAmountText.textContent = formatRupiah(totalAmount);

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

  
  el.cartItemsList.querySelectorAll('[data-scale-index]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.scaleIndex);
      const item = state.cart[idx];
      if (item) openScaleModal(item.product, item.qty, idx);
    });
  });

  el.cartItemsList.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.index);
      state.cart.splice(idx, 1);
      renderCart();
    });
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

  if (state.paymentMethod === 'tempo' && !state.selectedCustomer) {
    state.paymentMethod = 'cash';
  }

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
  }
}

function updateTempoCalculation() {
  const total = getCartTotal();
  if (el.tempoCustomerName) {
    el.tempoCustomerName.textContent = state.selectedCustomer ? state.selectedCustomer.name : 'Pilih Pelanggan Terlebih Dahulu';
  }
  if (el.tempoCustomerPhone) {
    el.tempoCustomerPhone.textContent = state.selectedCustomer ? (state.selectedCustomer.phone || '-') : '-';
  }
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

  if (state.paymentMethod === 'tempo') {
    if (!state.selectedCustomer) {
      showToast('Wajib memilih pelanggan terdaftar untuk transaksi Kasbon/Tempo!', 'error');
      el.paymentModal.style.display = 'none';
      el.customerSelect.focus();
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

  const orderPayload = {
    shift_id: state.shift.id,
    customer_id: state.selectedCustomerId ? Number(state.selectedCustomerId) : null,
    payment_method: state.paymentMethod,
    cash_tendered: tendered,
    due_date: state.paymentMethod === 'tempo' && el.tempoDueDateInput ? el.tempoDueDateInput.value : null,
    items: state.cart.map(item => ({
      product_id: item.product.id,
      qty: item.qty,
      subtotal: item.subtotal
    }))
  };

  try {
    el.btnProcessPayment.disabled = true;
    el.btnProcessPayment.textContent = 'Memproses...';

    const res = await api.createOrder(orderPayload);
    el.paymentModal.style.display = 'none';

    // Show thermal receipt
    if (el.receiptModalTitle) el.receiptModalTitle.textContent = 'Transaksi Berhasil';
    if (el.btnNextOrder) el.btnNextOrder.textContent = 'Transaksi Baru Berikutnya';
    renderThermalReceipt(res.order, false);
    el.receiptModal.style.display = 'flex';

    // Reset Cart & refresh products (for updated stocks)
    state.cart = [];
    renderCart();
    await loadInitialData();
    showToast('Transaksi berhasil!', 'success');
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

  const sName = (state.settings && state.settings.store_name) || 'TOKO UMBI JAYA';
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
      <div>Pembeli: ${order.customer_name || 'Pelanggan Umum'}</div>
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
    await api.recordWaste(prodId, state.shift ? state.shift.id : null, type, qty, notes);
    el.wasteModal.style.display = 'none';
    showToast(`Catatan ${type} sebesar ${qty} kg berhasil disimpan!`, 'success');
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
async function openHistoryModal() {
  el.historyModal.style.display = 'flex';
  el.historyTableBody.innerHTML = '<tr><td colspan="7" class="text-center">Memuat data riwayat...</td></tr>';

  try {
    // Fetch all transactions today across shifts so history data is never lost
    const res = await api.getOrders();
    const orders = res.orders || [];

    if (orders.length === 0) {
      el.historyTableBody.innerHTML = '<tr><td colspan="7" class="text-center">Belum ada transaksi hari ini</td></tr>';
      return;
    }

    el.historyTableBody.innerHTML = orders.map(o => {
      const isCompleted = o.status === 'completed';
      const timeStr = parseSafeDate(o.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const statusLabel = o.status === 'completed' ? 'Selesai' : (o.status === 'void' ? 'Batal' : o.status);

      return `
        <tr>
          <td><strong>${o.order_no}</strong></td>
          <td>${timeStr}</td>
          <td>${o.customer_name || 'Umum'}</td>
          <td>${o.payment_method.toUpperCase()}</td>
          <td>${formatRupiah(o.total_amount)}</td>
          <td><span class="status-badge ${o.status}">${statusLabel}</span></td>
          <td>
            <div style="display:inline-flex; gap:6px; align-items:center;">
              <button class="btn-table-print" data-id="${o.id}" data-no="${o.order_no}" title="Cetak Ulang Struk Thermal">
                🖨️ Cetak Struk
              </button>
              ${isCompleted ? `<button class="btn-table-void" data-id="${o.id}" data-no="${o.order_no}">Batalkan</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind Reprint Receipt buttons
    el.historyTableBody.querySelectorAll('.btn-table-print').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orderId = btn.dataset.id;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '⏳ Memuat...';

        try {
          const res = await api.getOrder(orderId);
          if (!res.order) throw new Error('Data transaksi tidak ditemukan');

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
  } catch (err) {
    el.historyTableBody.innerHTML = `<tr><td colspan="7" class="text-center">Gagal memuat: ${err.message}</td></tr>`;
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
// BUKU KASBON KASIR & PELUNASAN CEPAT
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
    el.cashierDebtsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 25px; color: #94a3b8;">Memuat data kasbon...</td></tr>';

    const searchVal = el.searchCashierDebt ? el.searchCashierDebt.value.trim() : '';
    const res = await api.getDebts({
      status: 'unpaid',
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
            🎉 Tidak ada tagihan kasbon aktif saat ini.
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

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
          <td style="padding: 10px 12px;">
            <strong style="color: #f8fafc;">${d.order_no}</strong>
            <div style="font-size: 11px; color: #94a3b8;">${orderDate}</div>
          </td>
          <td style="padding: 10px 12px;">
            <strong style="color: #f1f5f9;">${d.customer_name}</strong>
            <div style="font-size: 11px; color: #6ee7b7;">📞 ${d.customer_phone || '-'}</div>
          </td>
          <td style="padding: 10px 12px; text-align: right; color: #cbd5e1;">${formatRupiah(d.total_amount)}</td>
          <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #f59e0b;">${formatRupiah(d.remaining_amount)}</td>
          <td style="padding: 10px 12px; text-align: center; font-size: 12px; color: ${d.is_overdue ? '#ef4444' : '#cbd5e1'}; font-weight: ${d.is_overdue ? '700' : 'normal'};">
            ${dueDateFormatted}
            ${d.is_overdue ? '<div style="color: #ef4444; font-size: 10px;">(Lewat Tempo)</div>' : ''}
          </td>
          <td style="padding: 10px 12px; text-align: center;">
            <button class="btn-pay-cashier-debt" data-debt-id="${d.id}" style="padding: 5px 12px; font-size: 12px; background: #10b981; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
              💵 Bayar
            </button>
          </td>
        </tr>
      `;
    }).join('');

    el.cashierDebtsTableBody.querySelectorAll('.btn-pay-cashier-debt').forEach(btn => {
      btn.addEventListener('click', () => {
        openPayCashierDebtModal(Number(btn.dataset.debtId));
      });
    });
  } catch (err) {
    el.cashierDebtsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #ef4444;">Terjadi kesalahan: ${err.message}</td></tr>`;
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

    const res = await api.payDebt(state.activeDebtForPayment.id, {
      amount_paid: amount,
      payment_method: method,
      notes: notes
    });

    if (res.success) {
      showToast(res.message, 'success');
      el.modalPayCashierDebt.style.display = 'none';
      await loadCashierDebts();
      if (state.shift) await syncShift();
    } else {
      showToast('Gagal: ' + res.message, 'error');
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

// Check and show Owner button if role === 'owner'
function updateRoleUI() {
  if (state.user && state.user.role === 'owner') {
    el.btnOwnerPanel.style.display = 'inline-flex';
  } else {
    el.btnOwnerPanel.style.display = 'none';
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
        <td>&ge; ${p.wholesale_min_qty} ${p.unit}</td>
        <td>
          <span class="text-success">+${formatRupiah(margin)} (Ecer)</span><br>
          <small class="text-muted">+${formatRupiah(marginReseller)} (Grosir)</small>
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
  document.getElementById('editWholesaleQty').value = p.wholesale_min_qty;
  el.editProductModal.style.display = 'flex';
}

el.btnCloseEditProduct.addEventListener('click', () => el.editProductModal.style.display = 'none');
el.btnCancelEditProduct.addEventListener('click', () => el.editProductModal.style.display = 'none');

el.btnSaveProductPrice.addEventListener('click', async () => {
  const id = document.getElementById('editProductId').value;
  const payload = {
    cost_price: Number(document.getElementById('editCostPrice').value),
    retail_price: Number(document.getElementById('editRetailPrice').value),
    reseller_price: Number(document.getElementById('editResellerPrice').value),
    wholesale_min_qty: Number(document.getElementById('editWholesaleQty').value)
  };

  try {
    el.btnSaveProductPrice.disabled = true;
    await api.updateProduct(id, payload);
    el.editProductModal.style.display = 'none';
    showToast('Harga produk berhasil diperbarui!', 'success');
    await loadInitialData();
    renderOwnerProductsTable();
  } catch (err) {
    showToast('Gagal update harga: ' + err.message, 'error');
  } finally {
    el.btnSaveProductPrice.disabled = false;
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

function openRestockModal(targetProductId = null) {
  if (state.products.length === 0) return;
  el.restockProductSelect.innerHTML = state.products.map(p => `
    <option value="${p.id}" ${targetProductId === p.id ? 'selected' : ''}>${p.image_emoji || '🥔'} ${p.name}</option>
  `).join('');

  if (targetProductId) {
    el.restockProductSelect.value = targetProductId;
  }
  updateRestockCurrentStock();
  el.restockQtyInput.value = '';
  el.restockCostInput.value = '';
  el.restockNotesInput.value = '';
  el.restockModal.style.display = 'flex';
  el.restockQtyInput.focus();
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

  if (isNaN(qty) || qty <= 0) {
    showToast('Masukkan jumlah kg barang masuk yang valid', 'error');
    return;
  }

  try {
    el.btnConfirmRestock.disabled = true;
    el.btnConfirmRestock.textContent = 'Menyimpan...';

    const res = await api.restockProduct(prodId, qty, cost, notes);
    el.restockModal.style.display = 'none';
    showToast(res.message, 'success');

    // Refresh products in memory and UI
    await loadInitialData();
    renderOwnerProductsTable();
  } catch (err) {
    showToast('Gagal menambah stok: ' + err.message, 'error');
  } finally {
    el.btnConfirmRestock.disabled = false;
    el.btnConfirmRestock.textContent = 'Simpan & Tambah Stok';
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
  el.newProductModal.style.display = 'flex';
  document.getElementById('newProdName').focus();
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
    renderOwnerProductsTable();
  } catch (err) {
    showToast('Gagal menambah komoditas: ' + err.message, 'error');
  } finally {
    el.btnSaveNewProduct.disabled = false;
    el.btnSaveNewProduct.textContent = 'Simpan Komoditas ke Katalog';
  }
}
