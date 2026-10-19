import { api } from './api.js';
import { hardwareManager } from './hardware.js';

// State
const state = {
  shift: null,
  user: null,
  settings: null
};

// Helpers
function formatRupiah(val) {
  return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
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
  d50k: document.getElementById('d50k'),
  d20k: document.getElementById('d20k'),
  d10k: document.getElementById('d10k'),
  d5k: document.getElementById('d5k'),
  d2k: document.getElementById('d2k'),
  d1k: document.getElementById('d1k'),
  dKoin: document.getElementById('dKoin'),
  sub100k: document.getElementById('sub100k'),
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
  thermalReceipt: document.getElementById('thermalReceipt')
};

// -----------------------------------------------------------------------------
// LOAD DATA
// -----------------------------------------------------------------------------
async function initCashierPage() {
  try {
    // 1. Load Store Settings
    const setRes = await api.getSettings().catch(() => null);
    if (setRes && setRes.settings) {
      state.settings = setRes.settings;
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
      if (confirm('Belum ada shift kasir yang aktif saat ini.\nApakah Anda ingin kembali ke halaman kasir utama?')) {
        window.location.href = '/';
      }
      return;
    }

    state.shift = res.shift;
    const s = state.shift;

    // Header Badges
    const cashierName = s.cashier_name || (state.user ? state.user.name : 'Kasir');
    const startTimeStr = parseSafeDate(s.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (el.badgeShiftText) {
      el.badgeShiftText.textContent = `Shift #${s.id} Aktif: ${cashierName}`;
    }
    if (el.pageShiftSubtitle) {
      el.pageShiftSubtitle.textContent = `Petugas: ${cashierName} • Buka: ${startTimeStr} WIB • Modal Awal: ${formatRupiah(s.starting_cash)}`;
    }

    // 4 KPI Cards
    if (el.kpiStartingCash) el.kpiStartingCash.textContent = formatRupiah(s.starting_cash || 0);
    if (el.kpiCashSales) el.kpiCashSales.textContent = formatRupiah(s.cash_sales || 0);
    if (el.kpiCashOrdersCount) el.kpiCashOrdersCount.textContent = `${s.total_orders || 0} nota lunas tunai`;
    
    const totalIn = Number(s.cash_income || 0) + Number(s.cash_debt_collected || 0);
    if (el.kpiIncomeDebt) el.kpiIncomeDebt.textContent = `+${formatRupiah(totalIn)}`;
    if (el.kpiIncomeDebtMeta) {
      el.kpiIncomeDebtMeta.textContent = `Kas Masuk: ${formatRupiah(s.cash_income || 0)} | Bon: ${formatRupiah(s.cash_debt_collected || 0)}`;
    }

    if (el.kpiExpensesCash) el.kpiExpensesCash.textContent = `-${formatRupiah(s.cash_expenses || 0)}`;
    if (el.kpiExpensesCount) {
      const expCount = (s.recent_expenses && s.recent_expenses.length) || 0;
      el.kpiExpensesCount.textContent = `${expCount} pengeluaran kas laci`;
    }

    // Expected Formula
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

    // Recent Expenses
    if (el.expensesListContainer) {
      if (s.recent_expenses && s.recent_expenses.length > 0) {
        el.expensesListContainer.innerHTML = s.recent_expenses.map(e => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: #fff5f5; border: 1px solid #fee2e2; border-radius: 10px; padding: 8px 12px; font-size: 13px;">
            <div>
              <strong style="color: #991b1b; display: block;">${escapeHtml(e.category || 'Biaya Operasional')}</strong>
              <span style="color: #64748b; font-size: 11.5px;">${escapeHtml(e.notes || '-')} • ${parseSafeDate(e.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <strong style="font-family: 'JetBrains Mono', monospace; color: #b91c1c; font-size: 14px;">-${formatRupiah(e.amount)}</strong>
          </div>
        `).join('');
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
  const d50 = (Number(el.d50k ? el.d50k.value : 0) || 0) * 50000;
  const d20 = (Number(el.d20k ? el.d20k.value : 0) || 0) * 20000;
  const d10 = (Number(el.d10k ? el.d10k.value : 0) || 0) * 10000;
  const d5 = (Number(el.d5k ? el.d5k.value : 0) || 0) * 5000;
  const d2 = (Number(el.d2k ? el.d2k.value : 0) || 0) * 2000;
  const d1 = (Number(el.d1k ? el.d1k.value : 0) || 0) * 1000;
  const dKoin = Number(el.dKoin ? el.dKoin.value : 0) || 0;

  if (el.sub100k) el.sub100k.textContent = formatRupiah(d100);
  if (el.sub50k) el.sub50k.textContent = formatRupiah(d50);
  if (el.sub20k) el.sub20k.textContent = formatRupiah(d20);
  if (el.sub10k) el.sub10k.textContent = formatRupiah(d10);
  if (el.sub5k) el.sub5k.textContent = formatRupiah(d5);
  if (el.sub2k) el.sub2k.textContent = formatRupiah(d2);
  if (el.sub1k) el.sub1k.textContent = formatRupiah(d1);
  if (el.subKoin) el.subKoin.textContent = formatRupiah(dKoin);

  const total = d100 + d50 + d20 + d10 + d5 + d2 + d1 + dKoin;
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

  const breakdown = { d100k: d100, d50k: d50, d20k: d20, d10k: d10, d5k: d5, d2k: d2, d1k: d1, dKoin };
  return { total, breakdown, diff, expected };
}

// -----------------------------------------------------------------------------
// PRINT LAPORAN X (CEK SALDO BERJALAN)
// -----------------------------------------------------------------------------
async function handlePrintReportX() {
  if (!state.shift) {
    showToast('Tidak ada shift aktif yang bisa dicetak.', 'warning');
    return;
  }

  const { total, breakdown, diff, expected } = recalculateDenominations();
  const reportData = {
    ...state.shift,
    cashier_name: state.shift.cashier_name || (state.user ? state.user.name : 'Kasir'),
    actual_cash: total,
    breakdown,
    expected_system_cash: expected,
    cash_difference: diff,
    closing_notes: el.cashierNotes ? el.cashierNotes.value : ''
  };

  try {
    if (el.btnPrintReportX) {
      el.btnPrintReportX.disabled = true;
      el.btnPrintReportX.innerHTML = '<span>⏳</span> Mencetak Laporan X...';
    }

    renderThermalShiftReceipt(reportData, 'X');
    const settings = state.settings || {};
    await hardwareManager.printShiftReport(reportData, 'X', settings);
    showToast('🖨️ Struk Laporan X (Cek Kas Berjalan) berhasil dicetak ke printer kasir!', 'success');
  } catch (err) {
    showToast('Gagal mencetak Laporan X: ' + err.message, 'error');
  } finally {
    if (el.btnPrintReportX) {
      el.btnPrintReportX.disabled = false;
      el.btnPrintReportX.innerHTML = '<span>🖨️</span> Cetak Laporan X (Cek Kas Berjalan)';
    }
  }
}

// -----------------------------------------------------------------------------
// TUTUP SHIFT & PRINT LAPORAN Z
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
  confirmMsg += '\n\nSistem akan menutup shift, membuka laci kasir otomatis, dan mencetak Struk Laporan Z.';

  if (!confirm(confirmMsg)) return;

  try {
    if (el.btnCloseShiftZ) {
      el.btnCloseShiftZ.disabled = true;
      el.btnCloseShiftZ.innerHTML = '<span>⏳</span> Menutup Shift & Mencetak...';
    }

    const notes = el.cashierNotes ? el.cashierNotes.value : '';
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
    window.location.href = '/';
  } catch (err) {
    showToast('Gagal menutup shift: ' + err.message, 'error');
  } finally {
    if (el.btnCloseShiftZ) {
      el.btnCloseShiftZ.disabled = false;
      el.btnCloseShiftZ.innerHTML = '<span>🔒</span> Tutup Shift & Cetak Laporan Z';
    }
  }
}

// -----------------------------------------------------------------------------
// RENDER THERMAL SHIFT RECEIPT (FALLBACK SYSTEM PRINT)
// -----------------------------------------------------------------------------
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
    <div class="receipt-divider" style="margin-top:12px;"></div>
    <div style="display: flex; justify-content: space-between; text-align: center; font-size: 11px; margin-top: 14px; padding: 0 8px;">
      <div>
        Kasir Bertugas,<br><br><br><br>
        ( .................... )
      </div>
      <div>
        Supervisor / Penerima,<br><br><br><br>
        ( .................... )
      </div>
    </div>
    <div class="receipt-divider" style="margin-top: 16px;"></div>
    <div class="receipt-footer">
      <p>Kassa POS • Sistem Kasir Pintar & Anti-Kecolongan Toko Pasar</p>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// EVENT LISTENERS
// -----------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  initCashierPage();

  if (el.btnKickDrawerTop) {
    el.btnKickDrawerTop.addEventListener('click', async () => {
      try {
        await hardwareManager.kickCashDrawer();
        showToast('💰 Sinyal buka laci kasir (Kick RJ-11) terkirim!', 'success');
      } catch (err) {
        showToast('Gagal membuka laci: ' + err.message, 'warning');
      }
    });
  }

  if (el.btnRefreshPageData) {
    el.btnRefreshPageData.addEventListener('click', loadActiveShiftData);
  }

  if (el.btnResetDenom) {
    el.btnResetDenom.addEventListener('click', () => {
      ['d100k', 'd50k', 'd20k', 'd10k', 'd5k', 'd2k', 'd1k', 'dKoin'].forEach(id => {
        const inp = document.getElementById(id);
        if (inp) inp.value = '0';
      });
      recalculateDenominations();
    });
  }

  ['d100k', 'd50k', 'd20k', 'd10k', 'd5k', 'd2k', 'd1k', 'dKoin'].forEach(id => {
    const inp = document.getElementById(id);
    if (inp) {
      inp.addEventListener('input', recalculateDenominations);
    }
  });

  if (el.btnPrintReportX) {
    el.btnPrintReportX.addEventListener('click', handlePrintReportX);
  }

  if (el.btnCloseShiftZ) {
    el.btnCloseShiftZ.addEventListener('click', handleCloseShiftZ);
  }
});
