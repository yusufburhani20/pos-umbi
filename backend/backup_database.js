#!/usr/bin/env node
/**
 * POS Umbi - Database Backup & Restore Utility
 * 
 * Fitur:
 * - Backup atomic aman saat server menyala (VACUUM INTO & WAL checkpoint)
 * - File cadangan tersimpan di folder backups/ dengan timestamp rapi
 * - Ringkasan isi data (Produk, Transaksi, Omzet, Pelanggan, Pemasok)
 * - Perintah daftar backup (list) & pemulihan data (restore) dengan pengecekan integritas
 */

const fs = require('fs');
const path = require('path');
const { dbQuery } = require('./src/db');

const PROJECT_ROOT = path.join(__dirname, '..');
const BACKUP_DIR = path.join(PROJECT_ROOT, 'backups');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'pos_umbi.db');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + ' KB';
  return (kb / 1024).toFixed(2) + ' MB';
}

function formatDateIndo(date) {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + ' WIB';
}

async function createBackup(customName = null) {
  ensureBackupDir();

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  
  const filename = customName 
    ? `${customName}.db`
    : `pos_umbi_backup_${dateStr}.db`;
  const targetPath = path.join(BACKUP_DIR, filename);

  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }

  console.log('\n================================================================');
  console.log('            PROSES BACKUP DATABASE POS UMBI                    ');
  console.log('================================================================');
  console.log('⏳ Menyinkronkan catatan transaksi (WAL Checkpoint)...');

  try {
    // 1. Checkpoint WAL ke database utama
    await dbQuery.run('PRAGMA wal_checkpoint(TRUNCATE);');

    // 2. Gunakan VACUUM INTO untuk membuat atomic copy yang terdefragmentasi rapi
    console.log('⏳ Membuat salinan database terpadat (Atomic VACUUM INTO)...');
    await dbQuery.run('VACUUM INTO ?', [targetPath]);

    const stats = fs.statSync(targetPath);

    // 3. Ambil ringkasan statistik database
    const storeNameRow = await dbQuery.get("SELECT value FROM store_settings WHERE key = 'store_name'").catch(() => null);
    const storeName = storeNameRow ? storeNameRow.value : 'PD. HASIL BUMI RAYA 1';
    const prodCount = (await dbQuery.get("SELECT COUNT(*) as c FROM products").catch(() => ({ c: 0 }))).c;
    const orderCount = (await dbQuery.get("SELECT COUNT(*) as c FROM orders").catch(() => ({ c: 0 }))).c;
    const orderRevenue = (await dbQuery.get("SELECT COALESCE(SUM(total_amount), 0) as s FROM orders WHERE status = 'completed'").catch(() => ({ s: 0 }))).s;
    const debtCount = (await dbQuery.get("SELECT COUNT(*) as c FROM customer_debts WHERE status != 'paid'").catch(() => ({ c: 0 }))).c;
    const customerCount = (await dbQuery.get("SELECT COUNT(*) as c FROM customers").catch(() => ({ c: 0 }))).c;
    const supplierCount = (await dbQuery.get("SELECT COUNT(*) as c FROM suppliers").catch(() => ({ c: 0 }))).c;

    console.log('\n✅ BACKUP BERHASIL DIBUAT DENGAN SEMPURNA!');
    console.log('----------------------------------------------------------------');
    console.log(`Nama Toko            : ${storeName}`);
    console.log(`Waktu Backup         : ${formatDateIndo(now)}`);
    console.log(`Lokasi File          : ${targetPath}`);
    console.log(`Nama File            : ${filename}`);
    console.log(`Ukuran File          : ${formatBytes(stats.size)}`);
    console.log('----------------------------------------------------------------');
    console.log('RINGKASAN DATA YANG DICADANGKAN:');
    console.log(`- Master Komoditas   : ${prodCount} varian`);
    console.log(`- Transaksi Nota     : ${orderCount} transaksi (Total Rp ${Number(orderRevenue).toLocaleString('id-ID')})`);
    console.log(`- Piutang Berjalan   : ${debtCount} kasbon belum lunas`);
    console.log(`- Data Pelanggan     : ${customerCount} profil`);
    console.log(`- Data Pemasok       : ${supplierCount} juragan`);
    console.log('================================================================\n');

    return { success: true, filepath: targetPath, filename, size: stats.size };
  } catch (err) {
    console.error('❌ Gagal membuat backup database:', err);
    throw err;
  }
}

async function listBackups() {
  ensureBackupDir();

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db'))
    .map(f => {
      const p = path.join(BACKUP_DIR, f);
      const s = fs.statSync(p);
      return {
        filename: f,
        filepath: p,
        size: s.size,
        sizeFormatted: formatBytes(s.size),
        mtime: s.mtime
      };
    })
    .sort((a, b) => b.mtime - a.mtime);

  console.log('\n================================================================');
  console.log('             DAFTAR FILE CADANGAN DATABASE POS UMBI            ');
  console.log('================================================================');
  console.log(`Folder Penyimpanan: ${BACKUP_DIR}\n`);

  if (files.length === 0) {
    console.log('ℹ️ Belum ada file backup. Buat backup baru dengan:');
    console.log('   node backend/backup_database.js\n');
    return [];
  }

  console.log('No.  Nama File Backup                     Ukuran     Tanggal Dibuat');
  console.log('-------------------------------------------------------------------------------');
  files.forEach((f, idx) => {
    const num = String(idx + 1).padEnd(4);
    const name = f.filename.padEnd(36);
    const size = f.sizeFormatted.padEnd(10);
    const dateStr = f.mtime.toLocaleDateString('id-ID') + ' ' + f.mtime.toLocaleTimeString('id-ID');
    console.log(`${num} ${name} ${size} ${dateStr}`);
  });
  console.log('-------------------------------------------------------------------------------');
  console.log(`Total: ${files.length} file cadangan ditemukan.\n`);

  return files;
}

async function restoreBackup(filename) {
  ensureBackupDir();

  if (!filename) {
    console.error('❌ Harap tentukan nama file backup yang ingin dipulihkan.');
    console.log('   Gunakan --list untuk melihat daftar file.');
    console.log('   Contoh: node backend/backup_database.js --restore pos_umbi_backup_YYYY-MM-DD.db');
    return;
  }

  let sourcePath = filename;
  if (!fs.existsSync(sourcePath)) {
    sourcePath = path.join(BACKUP_DIR, filename);
  }
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ File backup tidak ditemukan: ${filename}`);
    return;
  }

  console.log('\n================================================================');
  console.log('            PEMULIHAN (RESTORE) DATABASE POS UMBI              ');
  console.log('================================================================');
  console.log(`File Sumber Restore: ${sourcePath}`);

  // 1. Buat cadangan penyelamat dari database saat ini sebelum ditimpa
  const rescueTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const rescuePath = path.join(BACKUP_DIR, `pos_umbi_rescue_before_restore_${rescueTimestamp}.db`);
  try {
    if (fs.existsSync(DB_PATH)) {
      console.log('🛡️ Mengamankan database saat ini ke file penyelamat...');
      fs.copyFileSync(DB_PATH, rescuePath);
      console.log(`   File penyelamat: ${rescuePath}`);
    }
  } catch (e) {
    console.warn('⚠️ Gagal membuat file penyelamat:', e.message);
  }

  // 2. Timpa file database utama
  console.log('🔄 Memulihkan data dari file cadangan...');
  try {
    fs.copyFileSync(sourcePath, DB_PATH);

    // Hapus file -wal dan -shm lama agar sinkron dengan database baru
    const walPath = DB_PATH + '-wal';
    const shmPath = DB_PATH + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    // 3. Verifikasi integritas SQLite
    const check = await dbQuery.get('PRAGMA integrity_check;');
    if (check && check.integrity_check === 'ok') {
      console.log('✅ Verifikasi Integritas SQLite: OK (Database Sehat & Utuh)');
    } else {
      console.warn('⚠️ Peringatan Integritas:', check);
    }

    console.log('\n🎉 RESTORE BERHASIL! Database telah dipulihkan ke versi cadangan.');
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Gagal melakukan restore:', err);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  try {
    if (!cmd || cmd === '--create') {
      await createBackup(args[1]);
    } else if (cmd === '--list' || cmd === '-l') {
      await listBackups();
    } else if (cmd === '--restore') {
      await restoreBackup(args[1]);
    } else if (cmd === '--help' || cmd === '-h') {
      console.log(`
PANDUAN PERINTAH BACKUP & RESTORE DATABASE:
  node backend/backup_database.js
      Membuat salinan cadangan database lengkap dengan nama otomatis (timestamp).

  node backend/backup_database.js --list
      Melihat semua daftar file backup yang tersedia di folder backups/.

  node backend/backup_database.js --restore <nama_file.db>
      Memulihkan database dari salah satu file backup yang ada.
      Sistem otomatis membuat backup penyelamat sebelum pemulihan dilakukan.
`);
    } else {
      console.log(`Perintah tidak dikenal: ${cmd}. Gunakan --help untuk melihat panduan.`);
    }
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
  createBackup,
  listBackups,
  restoreBackup
};
