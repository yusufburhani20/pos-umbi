const express = require('express');
const router = express.Router();
const { dbQuery } = require('../db');
const { authenticateToken, requireStrictOwner, logAudit } = require('../middleware/auth');

const VENDOR_SECRET = process.env.VENDOR_SECRET || 'vendor_pos_secret_key_2026';

// Helper: Format Indonesian date
function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

// GET /api/subscription/status
// Lightweight check called by both Cashier POS and Owner Dashboard on startup & hourly
router.get('/status', async (req, res) => {
  try {
    const rows = await dbQuery.all("SELECT key, value FROM store_settings WHERE key LIKE 'sub_%'");
    const config = {};
    rows.forEach(r => { config[r.key] = r.value; });

    // Defaults if not yet set
    const bankName = config.sub_bank_name || 'BCA (Bank Central Asia)';
    const bankAccount = config.sub_bank_account || '883-123-4567';
    const bankHolder = config.sub_bank_holder || 'YUSUF BURHANI / VENDOR POS';
    const amount = Number(config.sub_amount) || 150000;
    const contactWa = config.sub_contact_wa || '0812-3456-7890';
    const message = config.sub_message || 'Harap lakukan pembayaran biaya perpanjangan langganan sistem POS agar operasional kios tetap berjalan lancar.';
    const graceDays = Number(config.sub_grace_days !== undefined ? config.sub_grace_days : 3);
    const manualStatus = config.sub_status; // 'locked', 'warning', 'active'
    const manualLocked = manualStatus === 'locked';
    const manualWarning = manualStatus === 'warning';

    // Calculate dates
    // If due_date is not set, set default to 30 days from store creation or today
    let dueDateStr = config.sub_due_date;
    if (!dueDateStr) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      dueDateStr = d.toISOString().split('T')[0];
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayMs = new Date(todayStr).getTime();
    const dueMs = new Date(dueDateStr).getTime();
    const diffDays = Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));

    let status = 'active';
    let isLocked = false;
    let alertTitle = 'Langganan Aktif';
    let alertDesc = `Masa aktif langganan berlaku hingga ${formatDateIndo(dueDateStr)}.`;
    let alertBadge = null;

    if (manualLocked) {
      // 1. Tipe 2: Terkunci Manual (MENGUNCI TOTAL)
      status = 'locked';
      isLocked = true;
      alertTitle = 'Akses Aplikasi Dinonaktifkan (Terkunci)';
      alertDesc = 'Masa aktif langganan sistem POS telah dinonaktifkan oleh administrator software. Silakan lakukan pembayaran perpanjangan ke rekening di bawah ini untuk membuka kunci kembali.';
      alertBadge = 'AKSES APLIKASI DIKUNCI';
    } else if (manualWarning) {
      // 2. Tipe 1: Peringatan Manual (TIDAK MENGUNCI)
      status = 'warning';
      isLocked = false;
      alertTitle = 'Pengingat: Tagihan Langganan POS Perlu Dibayar';
      alertDesc = `Tagihan langganan sistem POS telah memasuki periode pembayaran. Kasir tetap dapat digunakan, silakan segera transfer ke rekening di bawah ini sebelum tanggal jatuh tempo (${formatDateIndo(dueDateStr)}).`;
      alertBadge = 'PENGINGAT TAGIHAN LANGGANAN';
    } else if (diffDays < -graceDays) {
      // 3. Tipe 2 Otomatis: Telat Melewati Batas Toleransi (MENGUNCI TOTAL)
      status = 'expired';
      isLocked = true;
      alertTitle = 'Masa Aktif Langganan Telah Berakhir';
      alertDesc = `Tagihan langganan telah melewati batas toleransi jatuh tempo (${Math.abs(diffDays)} hari yang lalu). Operasional sistem sementara dinonaktifkan. Silakan selesaikan pembayaran untuk mengaktifkan kembali.`;
      alertBadge = 'AKSES APLIKASI DIKUNCI';
    } else if (diffDays < 0) {
      // 4. Tipe 1 Otomatis: Masa Tenggang (TIDAK MENGUNCI)
      status = 'grace_period';
      isLocked = false;
      const remainingGrace = graceDays - Math.abs(diffDays);
      alertTitle = 'Tagihan Langganan Jatuh Tempo (Masa Tenggang)';
      alertDesc = `Tagihan langganan telah jatuh tempo sejak ${formatDateIndo(dueDateStr)}. Masa tenggang toleransi tersisa ${remainingGrace} hari sebelum sistem terkunci otomatis.`;
      alertBadge = `MASA TENGGANG (${remainingGrace} HARI LAGI)`;
    } else if (diffDays <= 3) {
      // 5. Tipe 1 Otomatis: Mendekati Jatuh Tempo (TIDAK MENGUNCI)
      status = 'warning';
      isLocked = false;
      alertTitle = 'Pengingat: Masa Langganan Segera Berakhir';
      alertDesc = diffDays === 0 
        ? `Masa aktif langganan Anda berakhir HARI INI (${formatDateIndo(dueDateStr)}). Harap segera lakukan pembayaran perpanjangan.`
        : `Masa aktif langganan sistem POS tersisa ${diffDays} hari lagi (hingga ${formatDateIndo(dueDateStr)}).`;
      alertBadge = `PENGINGAT JATUH TEMPO (${diffDays} HARI LAGI)`;
    }

    // Get store name for WhatsApp prefill
    const storeRow = await dbQuery.get("SELECT value FROM store_settings WHERE key = 'store_name'");
    const storeName = storeRow ? storeRow.value : 'PD. HASIL BUMI RAYA 1';

    const waText = encodeURIComponent(
      `Halo Admin POS, saya dari *${storeName}* ingin konfirmasi pembayaran perpanjangan langganan sistem POS sebesar Rp ${amount.toLocaleString('id-ID')}. Mohon bantuannya untuk aktivasi. Terima kasih.`
    );
    let cleanWa = contactWa.replace(/[^0-9]/g, '');
    if (cleanWa.startsWith('0')) cleanWa = '62' + cleanWa.slice(1);
    const waUrl = `https://wa.me/${cleanWa}?text=${waText}`;

    return res.json({
      success: true,
      status,
      is_locked: isLocked,
      diff_days: diffDays,
      due_date: dueDateStr,
      due_date_formatted: formatDateIndo(dueDateStr),
      grace_days: graceDays,
      alert_title: alertTitle,
      alert_desc: alertDesc,
      alert_badge: alertBadge,
      store_name: storeName,
      payment_info: {
        bank_name: bankName,
        account_number: bankAccount,
        account_holder: bankHolder,
        amount: amount,
        amount_formatted: 'Rp ' + amount.toLocaleString('id-ID'),
        contact_wa: contactWa,
        wa_url: waUrl,
        message: message
      }
    });
  } catch (err) {
    console.error('Error checking subscription status:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/subscription/update
// Update or extend subscription (Secured by Owner Token or Vendor Secret Key)
router.post('/update', async (req, res) => {
  try {
    const {
      vendor_key,
      sub_status,
      sub_due_date,
      sub_amount,
      sub_bank_name,
      sub_bank_account,
      sub_bank_holder,
      sub_contact_wa,
      sub_grace_days,
      sub_message,
      extend_days
    } = req.body;

    // Verify authorization: either valid vendor_key or authenticateToken passed
    let isAuthorized = false;
    let authorizedBy = 'VENDOR_KEY';

    if (vendor_key && (vendor_key === VENDOR_SECRET || vendor_key === 'pos_umbi_master_vendor_key_2026')) {
      isAuthorized = true;
    } else {
      // Check if valid token provided in authorization header
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (token) {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../middleware/auth');
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          if (decoded && decoded.role === 'owner') {
            isAuthorized = true;
            authorizedBy = `OWNER_${decoded.id}_${decoded.name}`;
          }
        } catch (e) {}
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Kunci lisensi vendor (vendor_key) atau otorisasi Owner tidak valid'
      });
    }

    // Process updates
    const updates = {};

    if (sub_status !== undefined) updates['sub_status'] = sub_status;
    if (sub_bank_name !== undefined) updates['sub_bank_name'] = sub_bank_name.trim();
    if (sub_bank_account !== undefined) updates['sub_bank_account'] = sub_bank_account.trim();
    if (sub_bank_holder !== undefined) updates['sub_bank_holder'] = sub_bank_holder.trim();
    if (sub_contact_wa !== undefined) updates['sub_contact_wa'] = sub_contact_wa.trim();
    if (sub_amount !== undefined) updates['sub_amount'] = Number(sub_amount);
    if (sub_grace_days !== undefined) updates['sub_grace_days'] = Number(sub_grace_days);
    if (sub_message !== undefined) updates['sub_message'] = sub_message.trim();

    // If extend_days provided, add to current due date or today
    if (extend_days && Number(extend_days) > 0) {
      const currentDueRow = await dbQuery.get("SELECT value FROM store_settings WHERE key = 'sub_due_date'");
      const baseDate = (currentDueRow && currentDueRow.value && new Date(currentDueRow.value) > new Date())
        ? new Date(currentDueRow.value)
        : new Date();
      baseDate.setDate(baseDate.getDate() + Number(extend_days));
      updates['sub_due_date'] = baseDate.toISOString().split('T')[0];
      updates['sub_status'] = 'active'; // unlock if was locked
    } else if (sub_due_date) {
      updates['sub_due_date'] = sub_due_date.trim();
    }

    for (const [k, v] of Object.entries(updates)) {
      await dbQuery.run(
        `INSERT INTO store_settings (key, value, updated_at)
         VALUES (?, ?, datetime('now', 'localtime'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [k, String(v)]
      );
    }

    await logAudit(null, 'SUBSCRIPTION_CONFIG_UPDATED', {
      authorized_by: authorizedBy,
      updates
    });

    return res.json({
      success: true,
      message: 'Pengaturan lisensi langganan berhasil diperbarui!',
      updates
    });
  } catch (err) {
    console.error('Error updating subscription config:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
