#!/usr/bin/env node
/**
 * POS Umbi - Vendor License & Subscription Management CLI
 * Digunakan oleh penyedia aplikasi/vendor untuk:
 * - Mengecek status masa aktif langganan toko/klien
 * - Memperpanjang masa aktif langganan (+30 hari, +90 hari, dst.)
 * - Mengatur rekening bank tujuan transfer pembayaran
 * - Mengunci (lock) / Membuka kunci (unlock) sistem secara manual
 * - Mensimulasikan kondisi telat bayar (overdue) untuk pengujian
 */

const path = require('path');
const { dbQuery } = require('./src/db');

async function getSettings() {
  const rows = await dbQuery.all("SELECT key, value FROM store_settings WHERE key LIKE 'sub_%'");
  const conf = {};
  rows.forEach(r => { conf[r.key] = r.value; });
  return conf;
}

async function setSetting(key, value) {
  await dbQuery.run(
    `INSERT INTO store_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now', 'localtime'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, String(value)]
  );
}

function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

async function showStatus() {
  const conf = await getSettings();
  const storeRow = await dbQuery.get("SELECT value FROM store_settings WHERE key = 'store_name'");
  const storeName = storeRow ? storeRow.value : 'PD. HASIL BUMI RAYA 1';

  let dueDateStr = conf.sub_due_date;
  if (!dueDateStr) {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    dueDateStr = d.toISOString().split('T')[0];
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const todayMs = new Date(todayStr).getTime();
  const dueMs = new Date(dueDateStr).getTime();
  const diffDays = Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));
  const graceDays = Number(conf.sub_grace_days !== undefined ? conf.sub_grace_days : 3);
  const manualStatus = conf.sub_status;
  let statusDisplay = '✅ AKTIF';
  if (manualStatus === 'locked' || diffDays < -graceDays) {
    statusDisplay = '⛔ TERKUNCI (MENGUNCI TOTAL)';
  } else if (manualStatus === 'warning') {
    statusDisplay = '⚠️ PERINGATAN (TIDAK MENGUNCI - Ada Tombol Nanti Saja)';
  } else if (diffDays <= 3) {
    statusDisplay = '⚠️ PERINGATAN JATUH TEMPO (TIDAK MENGUNCI)';
  }

  console.log('\n======================================================');
  console.log('       STATUS LISENSI & LANGGANAN POS UMBI           ');
  console.log('======================================================');
  console.log(`Nama Toko / Client   : ${storeName}`);
  console.log(`Status Saat Ini      : ${statusDisplay}`);
  console.log(`Tanggal Jatuh Tempo  : ${dueDateStr} (${formatDateIndo(dueDateStr)})`);
  console.log(`Sisa Waktu           : ${diffDays >= 0 ? `${diffDays} hari lagi` : `TELAT ${Math.abs(diffDays)} hari`}`);
  console.log(`Toleransi Tenggang   : ${graceDays} hari`);
  console.log(`Mode Kontrol Vendor  : ${manualStatus === 'locked' ? '⛔ TERKUNCI (Hard Lock)' : (manualStatus === 'warning' ? '⚠️ PERINGATAN (Soft Warning)' : '✅ NORMAL (Auto)')}`);
  console.log('------------------------------------------------------');
  console.log('REKENING PEMBAYARAN TUJUAN:');
  console.log(`- Bank               : ${conf.sub_bank_name || 'BCA (Bank Central Asia)'}`);
  console.log(`- No. Rekening       : ${conf.sub_bank_account || '883-123-4567'}`);
  console.log(`- Atas Nama          : ${conf.sub_bank_holder || 'YUSUF BURHANI / VENDOR POS'}`);
  console.log(`- Nominal Langganan  : Rp ${(Number(conf.sub_amount) || 150000).toLocaleString('id-ID')} / bulan`);
  console.log(`- WhatsApp Vendor    : ${conf.sub_contact_wa || '0812-3456-7890'}`);
  console.log('======================================================\n');
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(`
PANDUAN PERINTAH KONTROL LISENSI VENDOR:
  node backend/manage_license.js --status
      Melihat status aktif langganan dan info rekening saat ini.

  node backend/manage_license.js --extend <hari>
      Memperpanjang masa aktif (contoh: --extend 30 untuk 30 hari kedepan).

  node backend/manage_license.js --set-due <YYYY-MM-DD>
      Menyetel tanggal jatuh tempo spesifik (contoh: --set-due 2026-11-30).

  node backend/manage_license.js --warn
      Setel mode pop-up peringatan:
      -> Sifat: TIDAK MENGUNCI (muncul pop-up tagihan tetapi ada tombol "Nanti Saja").

  node backend/manage_license.js --lock
      Setel mode pop-up terkunci:
      -> Sifat: MENGUNCI TOTAL (memblokir penuh layar kasir & owner sampai dibayar).

  node backend/manage_license.js --unlock
      Kembalikan ke status normal / buka kunci (menghilangkan pop-up).

  node backend/manage_license.js --set-bank <Bank> <NoRek> <AtasNama> <Nominal> <NoWA>
      Mengubah detail rekening pembayaran tujuan dan nominal.
      Contoh:
      node backend/manage_license.js --set-bank "BCA" "883-123-4567" "YUSUF BURHANI" 150000 "0812-3456-7890"

  node backend/manage_license.js --simulate-overdue
      Simulasi langsung kondisi telat bayar (melewati batas toleransi).

  node backend/manage_license.js --simulate-warning
      Simulasi kondisi pengingat mendekati jatuh tempo (2 hari lagi).

  node backend/manage_license.js --reset-transactions [--confirm]
      Mengosongkan SELURUH data transaksi toko (penjualan, shift, kasbon, biaya).
      Data produk/barang, harga, identitas toko & user kasir/owner TETAP AMAN.

  node backend/manage_license.js --backup
      Membuat salinan cadangan (backup) database toko secara instan ke folder backups/.

  node backend/manage_license.js --list-backups
      Melihat daftar file cadangan database yang tersedia di folder backups/.
`);
    process.exit(0);
  }

  try {
    if (cmd === '--status') {
      await showStatus();
    } else if (cmd === '--extend') {
      const days = parseInt(args[1], 10) || 30;
      const conf = await getSettings();
      let baseDate = new Date();
      if (conf.sub_due_date && new Date(conf.sub_due_date) > new Date()) {
        baseDate = new Date(conf.sub_due_date);
      }
      baseDate.setDate(baseDate.getDate() + days);
      const newDue = baseDate.toISOString().split('T')[0];

      await setSetting('sub_due_date', newDue);
      await setSetting('sub_status', 'active');
      console.log(`\n✅ Berhasil memperpanjang lisensi +${days} hari!`);
      console.log(`Jatuh tempo baru: ${newDue} (${formatDateIndo(newDue)})\n`);
      await showStatus();
    } else if (cmd === '--set-due') {
      const targetDate = args[1];
      if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        console.error('Format tanggal harus YYYY-MM-DD, contoh: 2026-11-30');
        process.exit(1);
      }
      await setSetting('sub_due_date', targetDate);
      await setSetting('sub_status', 'active');
      console.log(`\n✅ Tanggal jatuh tempo disetel ke: ${targetDate}\n`);
      await showStatus();
    } else if (cmd === '--warn' || cmd === '--warning') {
      await setSetting('sub_status', 'warning');
      console.log('\n⚠️ Mode Pop-up Peringatan DIAKTIFKAN!');
      console.log('-> Tipe: TIDAK MENGUNCI.');
      console.log('-> Kasir & Owner akan melihat pop-up pengingat pembayaran, tetapi masih bisa menutupnya (ada tombol "Nanti Saja") dan lanjut bertransaksi.\n');
      await showStatus();
    } else if (cmd === '--lock') {
      await setSetting('sub_status', 'locked');
      console.log('\n⛔ Mode Pop-up Terkunci DIAKTIFKAN!');
      console.log('-> Tipe: MENGUNCI TOTAL.');
      console.log('-> Kasir & Owner DIBLOKIR PENUH (pop-up tidak bisa ditutup, transaksi kasir dinonaktifkan sampai pembayaran diselesaikan).\n');
      await showStatus();
    } else if (cmd === '--unlock') {
      await setSetting('sub_status', 'active');
      const conf = await getSettings();
      const today = new Date().toISOString().split('T')[0];
      if (!conf.sub_due_date || conf.sub_due_date < today) {
        // Automatically extend 30 days if overdue
        const d = new Date();
        d.setDate(d.getDate() + 30);
        await setSetting('sub_due_date', d.toISOString().split('T')[0]);
      }
      console.log('\n✅ Kunci aplikasi DIBUKA. Aplikasi kembali aktif normal.\n');
      await showStatus();
    } else if (cmd === '--set-bank') {
      const bank = args[1];
      const acc = args[2];
      const holder = args[3];
      const amount = args[4];
      const wa = args[5];

      if (!bank || !acc || !holder) {
        console.error('Gunakan: --set-bank <Bank> <NoRek> <AtasNama> [Nominal] [NoWA]');
        process.exit(1);
      }
      await setSetting('sub_bank_name', bank);
      await setSetting('sub_bank_account', acc);
      await setSetting('sub_bank_holder', holder);
      if (amount) await setSetting('sub_amount', amount);
      if (wa) await setSetting('sub_contact_wa', wa);

      console.log('\n✅ Detail rekening vendor berhasil diperbarui!\n');
      await showStatus();
    } else if (cmd === '--simulate-overdue') {
      // Set due date to 5 days ago (past the 3-day grace period)
      const d = new Date();
      d.setDate(d.getDate() - 5);
      const overdueDate = d.toISOString().split('T')[0];
      await setSetting('sub_due_date', overdueDate);
      await setSetting('sub_status', 'active');
      console.log(`\n⚡ Mode simulasi telat bayar aktif (Jatuh tempo: ${overdueDate}, telat 5 hari).\n`);
      await showStatus();
    } else if (cmd === '--simulate-warning') {
      // Set due date to 2 days ahead
      const d = new Date();
      d.setDate(d.getDate() + 2);
      const warnDate = d.toISOString().split('T')[0];
      await setSetting('sub_due_date', warnDate);
      await setSetting('sub_status', 'active');
      console.log(`\n⚡ Mode simulasi pengingat aktif (Jatuh tempo: ${warnDate}, sisa 2 hari).\n`);
      await showStatus();
    } else if (cmd === '--reset-transactions') {
      const isConfirm = args.includes('--confirm') || args.includes('-y');
      const { runResetLogic } = require('./reset_transactions');
      await runResetLogic(isConfirm);
      return;
    } else if (cmd === '--backup') {
      const { createBackup } = require('./backup_database');
      await createBackup(args[1]);
      return;
    } else if (cmd === '--list-backups') {
      const { listBackups } = require('./backup_database');
      await listBackups();
      return;
    } else {
      console.log(`Perintah tidak dikenal: ${cmd}. Gunakan --help untuk melihat panduan.`);
    }
  } catch (err) {
    console.error('Terjadi kesalahan:', err);
  } finally {
    process.exit(0);
  }
}

main();
