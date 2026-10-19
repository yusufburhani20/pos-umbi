#!/usr/bin/env node
/**
 * POS Umbi - Skrip Pengosongan Data Transaksi (Clean Reset)
 * 
 * FUNGSI:
 * Mengosongkan SEMUA riwayat transaksi operasional toko:
 * - Transaksi Penjualan Kasir (orders, order_items)
 * - Buku Piutang & Kasbon Pelanggan (customer_debts, debt_payments)
 * - Riwayat Shift Kasir (shifts)
 * - Buku Kas Keluar / Biaya Operasional (store_expenses)
 * - Riwayat Kulakan & Hutang Pemasok (purchases, supplier_payments)
 * - Catatan Barang Susut / Busuk (stock_adjustments)
 * - Catatan Log Audit Transaksi (audit_logs)
 * 
 * DATA YANG 100% TETAP UTUH & AMAN (TIDAK DIHAPUS):
 * - Data Komoditas & Master Produk (products) beserta harga modal, eceran, reseller & stok
 * - Identitas Toko & Konfigurasi Struk (store_settings)
 * - Lisensi Langganan Vendor (sub_*)
 * - Akun Pengguna & PIN Kasir / Owner (users)
 * - Master Data Pelanggan Langganan (customers)
 * - Master Data Juragan & Pemasok (suppliers)
 */

const fs = require('fs');
const path = require('path');
const { dbQuery } = require('./src/db');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'pos_umbi.db');

async function getCounts() {
  const txTables = [
    { name: 'orders', label: 'Nota Penjualan Kasir' },
    { name: 'order_items', label: 'Item Belanjaan Nota' },
    { name: 'customer_debts', label: 'Buku Piutang / Kasbon Pelanggan' },
    { name: 'debt_payments', label: 'Cicilan / Pelunasan Piutang' },
    { name: 'shifts', label: 'Sesi Shift Kasir (Buka/Tutup)' },
    { name: 'store_expenses', label: 'Biaya Operasional & Kas Toko' },
    { name: 'purchases', label: 'Riwayat Nota Kulakan Pemasok' },
    { name: 'supplier_payments', label: 'Pelunasan Hutang Pemasok' },
    { name: 'stock_adjustments', label: 'Catatan Susut / Busuk / Opname' },
    { name: 'audit_logs', label: 'Log Aktivitas / Audit Trail' }
  ];

  const masterTables = [
    { name: 'products', label: 'Master Komoditas & Harga Produk' },
    { name: 'store_settings', label: 'Identitas Toko & Lisensi Vendor' },
    { name: 'users', label: 'Akun Login Kasir & Owner' },
    { name: 'customers', label: 'Data Pelanggan / Reseller' },
    { name: 'suppliers', label: 'Data Juragan / Pemasok' }
  ];

  const txData = [];
  for (const t of txTables) {
    try {
      const row = await dbQuery.get(`SELECT COUNT(*) as c FROM ${t.name}`);
      txData.push({ ...t, count: row.c });
    } catch (e) {
      txData.push({ ...t, count: 0 });
    }
  }

  const masterData = [];
  for (const m of masterTables) {
    try {
      const row = await dbQuery.get(`SELECT COUNT(*) as c FROM ${m.name}`);
      masterData.push({ ...m, count: row.c });
    } catch (e) {
      masterData.push({ ...m, count: 0 });
    }
  }

  return { txData, masterData };
}

async function performReset() {
  console.log('\n================================================================');
  console.log('       PENGOSONGAN DATA TRANSAKSI POS UMBI (CLEAN RESET)       ');
  console.log('================================================================');

  // 1. Buat Salinan Cadangan (Backup Otomatis)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(__dirname, `pos_umbi_backup_before_reset_${timestamp}.db`);

  try {
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, backupPath);
      console.log(`\n🛡️ [BACKUP OTOMATIS BERHASIL]`);
      console.log(`   File cadangan tersimpan di:`);
      console.log(`   ${backupPath}`);
    }
  } catch (err) {
    console.warn('⚠️ Gagal membuat file backup lokal:', err.message);
  }

  // 2. Eksekusi Penghapusan Data Transaksi
  console.log('\n🔄 Memproses pengosongan data transaksi...');

  await dbQuery.exec('PRAGMA foreign_keys = OFF;');

  const tablesToClear = [
    'debt_payments',
    'customer_debts',
    'order_items',
    'orders',
    'supplier_payments',
    'purchases',
    'store_expenses',
    'stock_adjustments',
    'shifts',
    'audit_logs'
  ];

  for (const tbl of tablesToClear) {
    await dbQuery.run(`DELETE FROM ${tbl};`);
  }

  // 3. Reset auto-increment counter agar ID transaksi mulai dari #1
  try {
    const placeholders = tablesToClear.map(() => '?').join(',');
    await dbQuery.run(`DELETE FROM sqlite_sequence WHERE name IN (${placeholders});`, tablesToClear);
  } catch (e) {}

  await dbQuery.exec('PRAGMA foreign_keys = ON;');

  // 4. Catat Log Audit Baru
  try {
    await dbQuery.run(
      `INSERT INTO audit_logs (user_id, action, details, created_at)
       VALUES (NULL, 'TRANSACTION_DATA_PURGED', ?, datetime('now', 'localtime'))`,
      [JSON.stringify({ note: 'Seluruh riwayat transaksi dikosongkan untuk persiapan operasional toko baru' })]
    );
  } catch (e) {}

  // 5. Padatkan Ukuran Database
  try {
    await dbQuery.exec('VACUUM;');
  } catch (e) {}

  console.log('\n✅ BERHASIL! Seluruh data transaksi telah dikosongkan.');
  console.log('================================================================');
  console.log('STATUS TABEL PASCA PENGOSONGAN:');

  const { txData, masterData } = await getCounts();

  console.log('\n[DATA TRANSAKSI (TELAH DIKOSONGKAN)]:');
  txData.forEach(t => {
    console.log(`  - ${t.label.padEnd(35)}: ${t.count} data`);
  });

  console.log('\n[DATA MASTER (TETAP AMAN & UTUH)]:');
  masterData.forEach(m => {
    console.log(`  - ${m.label.padEnd(35)}: ${m.count} data`);
  });

  console.log('\n💡 TIPS OPERASIONAL:');
  console.log('1. Kasir sekarang dapat membuka shift baru dengan saldo kas awal.');
  console.log('2. Nomor nota penjualan berikutnya akan dimulai kembali dari awal (#1).');
  console.log('3. Data produk komoditas dan identitas toko tetap utuh tidak terpengaruh.\n');
}

async function showPreview() {
  const { txData, masterData } = await getCounts();

  console.log('\n================================================================');
  console.log('       PREVIEW PENGOSONGAN DATA TRANSAKSI POS UMBI              ');
  console.log('================================================================');
  console.log('PERINGATAN: Perintah ini HANYA akan menghapus data transaksi.');
  console.log('Data komoditas, harga, identitas toko, kasir & owner TETAP AMAN.');
  console.log('----------------------------------------------------------------');

  console.log('\n1. DATA TRANSAKSI YANG AKAN DIHAPUS:');
  let totalTx = 0;
  txData.forEach(t => {
    totalTx += t.count;
    console.log(`   ❌ ${t.label.padEnd(35)}: ${t.count} baris`);
  });
  console.log(`   TOTAL: ${totalTx} data transaksi akan dikosongkan.`);

  console.log('\n2. DATA MASTER YANG TETAP AMAN (TIDAK AKAN DIHAPUS):');
  masterData.forEach(m => {
    console.log(`   ✅ ${m.label.padEnd(35)}: ${m.count} baris (TETAP UTUH)`);
  });

  console.log('\n================================================================');
  console.log('UNTUK MENGEKSEKUSI PENGOSONGAN DATA, JALANKAN DENGAN --confirm :');
  console.log('   node backend/reset_transactions.js --confirm');
  console.log('================================================================\n');
}

async function runResetLogic(isConfirm = false) {
  if (!isConfirm) {
    await showPreview();
  } else {
    await performReset();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isConfirm = args.includes('--confirm') || args.includes('-y');

  try {
    await runResetLogic(isConfirm);
  } catch (err) {
    console.error('Terjadi kesalahan:', err);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runResetLogic,
  performReset,
  showPreview
};
