/**
 * POS Umbi - Subscription & License Enforcement Module
 * Menangani pengecekan masa aktif langganan pada Kasir POS dan Owner Dashboard.
 * Menampilkan pop-up peringatan jatuh tempo / pemblokiran akses jika telat bayar,
 * serta mengarahkan pembayaran ke rekening vendor & konfirmasi via WhatsApp.
 */

import { api } from './api.js';

let currentSubState = null;
let recheckInterval = null;

export async function checkSubscription(options = {}) {
  const { isOwner = false, silent = false } = options;

  try {
    const res = await api.getSubscriptionStatus();
    if (!res || !res.success) return null;

    currentSubState = res;

    // Check status:
    // 'active' -> no modal needed, but if modal was open, close it!
    // 'warning' -> show reminder (can be dismissed)
    // 'grace_period' -> show overdue reminder (can be dismissed)
    // 'expired' / 'locked' -> hard lock! Modal cannot be dismissed
    if (res.status === 'active') {
      closeSubscriptionModal();
      removeLockdownOverlay();
      return res;
    }

    if (!silent || res.is_locked) {
      showSubscriptionModal(res, isOwner);
    }

    if (res.is_locked) {
      applyLockdown(isOwner);
    } else {
      removeLockdownOverlay();
    }

    return res;
  } catch (err) {
    console.warn('[Subscription] Gagal memeriksa status lisensi langganan:', err);
    return null;
  }
}

export function initSubscriptionGuard(options = {}) {
  const { isOwner = false } = options;

  // Run immediately on page load
  checkSubscription({ isOwner });

  // Periodically check every 10 minutes
  if (recheckInterval) clearInterval(recheckInterval);
  recheckInterval = setInterval(() => {
    checkSubscription({ isOwner, silent: true });
  }, 10 * 60 * 1000);

  // Bind modal DOM buttons
  bindSubscriptionModalEvents(isOwner);
}

function bindSubscriptionModalEvents(isOwner) {
  const modal = document.getElementById('subscriptionModal');
  const btnClose = document.getElementById('btnCloseSubModal');
  const btnDismiss = document.getElementById('btnSubDismiss');
  const btnCopy = document.getElementById('btnCopySubAccount');
  const btnRecheck = document.getElementById('btnSubRecheck');

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      if (currentSubState && currentSubState.is_locked) return;
      closeSubscriptionModal();
    });
  }

  if (btnDismiss) {
    btnDismiss.addEventListener('click', () => {
      if (currentSubState && currentSubState.is_locked) return;
      closeSubscriptionModal();
    });
  }

  // Prevent closing on backdrop click if locked
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (currentSubState && currentSubState.is_locked) {
          // Shake modal to emphasize it cannot be closed
          const dialog = modal.querySelector('.sub-modal-dialog');
          if (dialog) {
            dialog.classList.remove('sub-dialog-shake');
            void dialog.offsetWidth; // trigger reflow
            dialog.classList.add('sub-dialog-shake');
          }
        } else {
          closeSubscriptionModal();
        }
      }
    });
  }

  // Intercept Escape key if locked
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
      if (currentSubState && currentSubState.is_locked) {
        e.preventDefault();
        e.stopPropagation();
        const dialog = modal.querySelector('.sub-modal-dialog');
        if (dialog) {
          dialog.classList.remove('sub-dialog-shake');
          void dialog.offsetWidth;
          dialog.classList.add('sub-dialog-shake');
        }
      }
    }
  });

  // Copy bank account number
  if (btnCopy) {
    btnCopy.addEventListener('click', async () => {
      const accEl = document.getElementById('subBankAccount');
      if (!accEl) return;
      const textToCopy = accEl.textContent.trim().replace(/[^0-9]/g, '');

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(textToCopy);
        } else {
          const temp = document.createElement('textarea');
          temp.value = textToCopy;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          document.body.removeChild(temp);
        }

        const originalHtml = btnCopy.innerHTML;
        btnCopy.innerHTML = '✅ Tersalin!';
        btnCopy.classList.add('copied');
        setTimeout(() => {
          btnCopy.innerHTML = originalHtml;
          btnCopy.classList.remove('copied');
        }, 2500);
      } catch (err) {
        console.error('Gagal menyalin no rekening:', err);
      }
    });
  }

  // Recheck status button
  if (btnRecheck) {
    btnRecheck.addEventListener('click', async () => {
      const origText = btnRecheck.innerHTML;
      btnRecheck.innerHTML = '<span>⏳ Memeriksa...</span>';
      btnRecheck.disabled = true;

      try {
        const res = await checkSubscription({ isOwner, silent: false });
        if (res && res.status === 'active') {
          alert('✅ Selamat! Status langganan toko Anda telah aktif kembali hingga ' + res.due_date_formatted + '. Terima kasih atas pembayarannya.');
          closeSubscriptionModal();
        } else if (res && !res.is_locked) {
          alert('ℹ️ Status saat ini: ' + res.alert_title + '\n' + res.alert_desc);
        } else {
          alert('⚠️ Pembayaran belum terverifikasi oleh administrator. Jika sudah transfer, silakan klik tombol WhatsApp untuk konfirmasi.');
        }
      } finally {
        btnRecheck.innerHTML = origText;
        btnRecheck.disabled = false;
      }
    });
  }
}

function showSubscriptionModal(data, isOwner) {
  const modal = document.getElementById('subscriptionModal');
  if (!modal) return;

  const banner = document.getElementById('subModalBanner');
  const icon = document.getElementById('subBannerIcon');
  const badge = document.getElementById('subStatusBadge');
  const title = document.getElementById('subModalTitle');
  const message = document.getElementById('subAlertMessage');
  const btnClose = document.getElementById('btnCloseSubModal');
  const btnDismiss = document.getElementById('btnSubDismiss');

  const bankName = document.getElementById('subBankName');
  const bankAccount = document.getElementById('subBankAccount');
  const bankHolder = document.getElementById('subBankHolder');
  const amountText = document.getElementById('subAmountText');
  const amountBadge = document.getElementById('subAmountBadge');
  const dueDateText = document.getElementById('subDueDateText');
  const btnWa = document.getElementById('btnSubWhatsApp');

  // Populate data
  if (title) title.textContent = data.alert_title || 'Tagihan Langganan Perlu Dibayar';
  if (message) message.textContent = data.alert_desc || data.payment_info.message;

  if (data.payment_info) {
    if (bankName) bankName.textContent = data.payment_info.bank_name;
    if (bankAccount) bankAccount.textContent = data.payment_info.account_number;
    if (bankHolder) bankHolder.textContent = data.payment_info.account_holder;
    if (amountText) amountText.textContent = data.payment_info.amount_formatted + ' / bulan';
    if (amountBadge) amountBadge.textContent = data.payment_info.amount_formatted;
    if (dueDateText) dueDateText.textContent = `${data.due_date_formatted} (${data.diff_days < 0 ? `Telat ${Math.abs(data.diff_days)} hari` : `${data.diff_days} hari lagi`})`;
    if (btnWa) btnWa.href = data.payment_info.wa_url;
  }

  // Adjust theme according to severity
  if (data.is_locked) {
    // HARD LOCK
    modal.classList.add('sub-locked');
    if (banner) {
      banner.className = 'sub-modal-banner banner-locked';
    }
    if (icon) icon.textContent = '⛔';
    if (badge) {
      badge.textContent = 'AKSES APLIKASI DIKUNCI';
      badge.className = 'sub-badge badge-locked';
    }
    if (btnClose) btnClose.style.display = 'none';
    if (btnDismiss) btnDismiss.style.display = 'none';
  } else if (data.status === 'grace_period') {
    // GRACE PERIOD WARNING
    modal.classList.remove('sub-locked');
    if (banner) {
      banner.className = 'sub-modal-banner banner-grace';
    }
    if (icon) icon.textContent = '⏳';
    const remainingGrace = data.grace_days - Math.abs(data.diff_days);
    if (badge) {
      badge.textContent = `MASA TENGGANG (SISA ${remainingGrace} HARI)`;
      badge.className = 'sub-badge badge-grace';
    }
    if (btnClose) btnClose.style.display = 'block';
    if (btnDismiss) {
      btnDismiss.style.display = 'inline-flex';
      btnDismiss.innerHTML = `<span>Lanjut ke Aplikasi (Tersisa ${remainingGrace} Hari Toleransi) ➔</span>`;
    }
  } else {
    // APPROACHING DUE DATE WARNING
    modal.classList.remove('sub-locked');
    if (banner) {
      banner.className = 'sub-modal-banner banner-warning';
    }
    if (icon) icon.textContent = '⚠️';
    if (badge) {
      badge.textContent = data.alert_badge || `PENGINGAT JATUH TEMPO (${data.diff_days} HARI LAGI)`;
      badge.className = 'sub-badge badge-warning';
    }
    if (btnClose) btnClose.style.display = 'block';
    if (btnDismiss) {
      btnDismiss.style.display = 'inline-flex';
      btnDismiss.innerHTML = '<span>Nanti Saja (Lanjut ke Kasir / Dashboard) ➔</span>';
    }
  }

  modal.style.display = 'flex';
}

function closeSubscriptionModal() {
  const modal = document.getElementById('subscriptionModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function applyLockdown(isOwner) {
  document.body.classList.add('system-license-locked');

  // Disable cashier buttons
  const checkoutBtn = document.getElementById('btnCheckout');
  if (checkoutBtn) {
    checkoutBtn.disabled = true;
    checkoutBtn.title = 'Aplikasi terkunci: Biaya langganan belum dibayar';
  }

  const floatingCheckout = document.getElementById('btnFloatingCheckout');
  if (floatingCheckout) {
    floatingCheckout.disabled = true;
  }
}

function removeLockdownOverlay() {
  document.body.classList.remove('system-license-locked');

  const checkoutBtn = document.getElementById('btnCheckout');
  if (checkoutBtn) {
    // Re-evaluate based on cart length
    const raw = localStorage.getItem('pos_cart');
    const cart = raw ? JSON.parse(raw) : [];
    checkoutBtn.disabled = cart.length === 0;
    checkoutBtn.removeAttribute('title');
  }

  const floatingCheckout = document.getElementById('btnFloatingCheckout');
  if (floatingCheckout) {
    floatingCheckout.disabled = false;
  }
}
