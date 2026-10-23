#!/usr/bin/env node
/**
 * ==============================================================================
 * SEED SIMULASI DATA LENGKAP 1 BULAN (PD. HASIL BUMI RAYA 1)
 * Khusus untuk Domain 1: kassa.konfigin.my.id
 * ==============================================================================
 * Menghasilkan data transaksi realistis selama 1 bulan penuh (23 Sep 2026 - 23 Okt 2026):
 * - Shift Kasir Pagi & Sore (buka/tutup, modal laci, rekonsiliasi kas, breakdown fisik)
 * - Transaksi Penjualan Eceran & Grosir Reseller (Cash, QRIS, Transfer, Tempo)
 * - Buku Piutang & Kasbon Pelanggan (Unpaid, Partial, Paid + Riwayat Cicilan)
 * - Biaya Operasional Toko (Makan tim, Retribusi pasar, Kuli panggul, Perlengkapan, Listrik)
 * - Riwayat Kulakan & Hutang Supplier (Pemasok Brebes, Dieng, Sukabumi, Garut)
 * - Penyesuaian Stok (Susut, Busuk, Rusak, Opname Timbangan)
 * - Log Audit Transaksi & Anti-Fraud (Deteksi Selisih Kas, Void Order)
 * - Shift Aktif Hari Ini (23 Okt 2026) dengan beberapa transaksi siap live!
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Parse argument or default to kassa database
const args = process.argv.slice(2);
let dbPath = '/www/wwwroot/kassa.konfigin.my.id/backend/pos_umbi.db';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--db-path' && args[i + 1]) {
    dbPath = args[i + 1];
    i++;
  }
}

// STRICT GUARD: JANGAN PERNAH JALANKAN DI SERVER HASILBUMIRAYA (PRODUCTION)!
if (dbPath.toLowerCase().includes('hasilbumiraya')) {
  console.error('\n❌ FATAL SECURITY ERROR: Skrip ini DILARANG dijalankan pada database hasilbumiraya.konfigin.my.id!');
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`\n❌ Database file not found at: ${dbPath}`);
  process.exit(1);
}

console.log(`\n================================================================`);
console.log(`🌽 SEEDING SIMULASI 1 BULAN: PD. HASIL BUMI RAYA 1`);
console.log(`📍 Database Target: ${dbPath}`);
console.log(`📅 Periode Data: 23 September 2026 - 23 Oktober 2026 (31 Hari)`);
console.log(`================================================================\n`);

// Backup database before starting
const backupFile = `${dbPath}.bak_simulation_${Date.now()}`;
try {
  fs.copyFileSync(dbPath, backupFile);
  console.log(`🛡️ Backup otomatis aman dibuat di: ${backupFile}`);
} catch (e) {
  console.warn(`⚠️ Warning: Gagal membuat backup otomatis: ${e.message}`);
}

const db = new sqlite3.Database(dbPath);

const dbQuery = {
  get: (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  }),
  all: (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  }),
  run: (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes });
    });
  }),
  exec: (sql) => new Promise((resolve, reject) => {
    db.exec(sql, (err) => err ? reject(err) : resolve());
  })
};

function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function padZero(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDatetime(d) {
  const year = d.getFullYear();
  const month = padZero(d.getMonth() + 1);
  const day = padZero(d.getDate());
  const hours = padZero(d.getHours());
  const minutes = padZero(d.getMinutes());
  const seconds = padZero(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatDateOnly(d) {
  const year = d.getFullYear();
  const month = padZero(d.getMonth() + 1);
  const day = padZero(d.getDate());
  return `${year}-${month}-${day}`;
}

function generateCashBreakdown(totalAmount) {
  let rem = Math.max(0, Math.round(totalAmount));
  const denoms = [100000, 50000, 20000, 10000, 5000, 2000, 1000];
  const breakdown = {};
  
  for (const d of denoms) {
    if (rem >= d) {
      const count = Math.floor(rem / d);
      breakdown[String(d)] = count;
      rem -= count * d;
    } else {
      breakdown[String(d)] = 0;
    }
  }
  return breakdown;
}

async function runSeed() {
  try {
    await dbQuery.exec('PRAGMA foreign_keys = OFF;');
    await dbQuery.exec('BEGIN TRANSACTION;');

    console.log('🧹 1. Mengosongkan data transaksi lama di kassa...');
    const tablesToClear = [
      'debt_payments',
      'customer_debts',
      'order_items',
      'orders',
      'store_expenses',
      'supplier_payments',
      'purchases',
      'stock_adjustments',
      'audit_logs',
      'shifts'
    ];

    for (const tbl of tablesToClear) {
      await dbQuery.exec(`DELETE FROM ${tbl};`);
      await dbQuery.exec(`DELETE FROM sqlite_sequence WHERE name='${tbl}';`);
    }

    console.log('👥 2. Memeriksa & melengkapi akun pengguna (Kasir & Owner)...');
    let cashiers = await dbQuery.all(`SELECT id, name, username FROM users WHERE role = 'cashier' AND is_active = 1`);
    if (cashiers.length === 0) {
      const pinHash = await bcrypt.hash('654321', 8);
      const res = await dbQuery.run(
        `INSERT INTO users (name, username, role, pin_code, is_active) VALUES (?, ?, ?, ?, 1)`,
        ['Hanif Abdul Rohman', 'hanif', 'cashier', pinHash]
      );
      cashiers = [{ id: res.lastID, name: 'Hanif Abdul Rohman', username: 'hanif' }];
    }

    // Pastikan ada kasir kedua untuk rotasi shift realistis
    let sitiCashier = await dbQuery.get(`SELECT id, name FROM users WHERE username = 'siti'`);
    if (!sitiCashier) {
      const pinSiti = await bcrypt.hash('123456', 8);
      const resSiti = await dbQuery.run(
        `INSERT INTO users (name, username, role, pin_code, is_active) VALUES (?, ?, ?, ?, 1)`,
        ['Siti Rahma', 'siti', 'cashier', pinSiti]
      );
      sitiCashier = { id: resSiti.lastID, name: 'Siti Rahma' };
    }
    const allCashiers = [cashiers[0], sitiCashier];

    console.log('🏪 3. Memeriksa & melengkapi data pelanggan (Retail & Reseller)...');
    const existingCust = await dbQuery.all(`SELECT id, name, tier FROM customers`);
    const defaultCusts = [
      { name: 'Warung Makan Barokah (Bu Siti)', phone: '0812-3456-7890', tier: 'reseller', address: 'Kios Blok A No. 12' },
      { name: 'Katering Berkah Jaya', phone: '0898-7654-3210', tier: 'reseller', address: 'Komplek Griya Indah Blok B' },
      { name: 'Gorengan Renyah Mas Budi', phone: '0857-1122-3344', tier: 'reseller', address: 'Jl. Pemuda No. 45' },
      { name: 'Keripik Singkong & Ubi Barokah', phone: '0813-9988-7766', tier: 'reseller', address: 'Sentra Oleh-Oleh Cikopo' },
      { name: 'Dapur Bu Dewi Catering', phone: '0821-5566-7788', tier: 'reseller', address: 'Perum Permata Indah 3' },
      { name: 'Pak Bambang Warung Jaya', phone: '0812-9988-7766', tier: 'retail', address: 'Gang Warung No. 5' },
      { name: 'Ibu Haryati (Pelanggan Setia)', phone: '0856-4433-2211', tier: 'retail', address: 'Jl. Melati No. 8' },
      { name: 'Pelanggan Umum Pagi', phone: null, tier: 'retail', address: null },
      { name: 'Pembeli Eceran Sore', phone: null, tier: 'retail', address: null }
    ];

    for (const dc of defaultCusts) {
      const found = existingCust.find(c => c.name.toLowerCase() === dc.name.toLowerCase());
      if (!found) {
        await dbQuery.run(
          `INSERT INTO customers (name, phone, tier, address) VALUES (?, ?, ?, ?)`,
          [dc.name, dc.phone, dc.tier, dc.address]
        );
      }
    }
    const customerList = await dbQuery.all(`SELECT id, name, tier, phone FROM customers`);
    const resellerCustomers = customerList.filter(c => c.tier === 'reseller');
    const retailCustomers = customerList.filter(c => c.tier === 'retail');

    console.log('🚛 4. Memeriksa data pemasok (Suppliers)...');
    let supplierList = await dbQuery.all(`SELECT id, name FROM suppliers WHERE is_active = 1`);
    if (supplierList.length === 0) {
      await dbQuery.run(`INSERT INTO suppliers (name, phone, address, supplied_commodities) VALUES (?, ?, ?, ?)`,
        ['Juragan Mahmud (Brebes)', '0812-7788-9900', 'Brebes, Jawa Tengah', 'Ubi Merah, Ubi Putih']);
      await dbQuery.run(`INSERT INTO suppliers (name, phone, address, supplied_commodities) VALUES (?, ?, ?, ?)`,
        ['Petani Pak Subur (Dieng)', '0813-2233-4455', 'Dataran Tinggi Dieng, Wonosobo', 'Kentang, Talas Bogor']);
      await dbQuery.run(`INSERT INTO suppliers (name, phone, address, supplied_commodities) VALUES (?, ?, ?, ?)`,
        ['Kang Asep Pengepul (Sukabumi)', '0858-6677-8899', 'Cisaat, Sukabumi', 'Singkong Mentega, Suuk']);
      await dbQuery.run(`INSERT INTO suppliers (name, phone, address, supplied_commodities) VALUES (?, ?, ?, ?)`,
        ['Haji Anwar (Garut)', '0821-3344-5566', 'Tarogong, Garut', 'Ubi Cilembu Madu, Jagung Manis']);
      supplierList = await dbQuery.all(`SELECT id, name FROM suppliers WHERE is_active = 1`);
    }

    console.log('🍠 5. Memeriksa & menyetel stok produk komoditas...');
    const products = await dbQuery.all(`SELECT id, name, cost_price, retail_price, reseller_price FROM products WHERE is_active = 1 AND retail_price > 0`);
    if (products.length === 0) {
      throw new Error('Tidak ada produk aktif di database!');
    }

    // Setel stok awal yang sehat & realistis
    for (const p of products) {
      let healthyStock = 250 + Math.floor(Math.random() * 300);
      // Buat 1 produk sengaja stok menipis agar alert dashboard menyala
      if (p.name.includes('Madu Sumedang')) {
        healthyStock = 12.5;
      }
      await dbQuery.run(`UPDATE products SET stock_qty = ? WHERE id = ?`, [healthyStock, p.id]);
    }

    console.log(`📦 Terdeteksi ${products.length} komoditas aktif.`);

    // -------------------------------------------------------------------------
    // GENERASI TRANSAKSI 31 HARI PENUH (23 Sep 2026 s/d 23 Okt 2026)
    // -------------------------------------------------------------------------
    console.log('\n📊 6. Membuat data 31 hari operasional...');

    const startDate = new Date(2026, 8, 23); // 23 September 2026
    let orderSeq = 1;
    let expenseSeq = 1;
    let purchaseSeq = 1;

    let totalOrdersCreated = 0;
    let totalRevenueCreated = 0;
    let totalDebtsCreated = 0;
    let totalExpensesCreated = 0;

    for (let dayOffset = 0; dayOffset <= 30; dayOffset++) {
      const curDate = new Date(startDate.getTime() + dayOffset * 86400000);
      const dateStr = formatDateOnly(curDate);
      const isToday = (dayOffset === 30); // 23 Oktober 2026
      const isWeekend = (curDate.getDay() === 0 || curDate.getDay() === 6);

      // Tentukan jumlah shift hari ini (weekend 2 shift, weekday selang-seling 1 atau 2 shift)
      const numShifts = isToday ? 1 : (isWeekend || dayOffset % 3 === 0 ? 2 : 1);

      for (let sIdx = 0; sIdx < numShifts; sIdx++) {
        const cashier = allCashiers[sIdx % allCashiers.length];
        const isShiftPagi = (sIdx === 0);

        // Waktu Shift
        const shiftStart = new Date(curDate);
        if (isShiftPagi) {
          shiftStart.setHours(5, 30 + Math.floor(Math.random() * 20), 0, 0);
        } else {
          shiftStart.setHours(13, 30 + Math.floor(Math.random() * 15), 0, 0);
        }

        const startingCash = 200000; // Modal awal laci Rp 200.000

        // Buat record Shift
        const shiftRes = await dbQuery.run(
          `INSERT INTO shifts (cashier_id, start_time, starting_cash, status) VALUES (?, ?, ?, 'open')`,
          [cashier.id, formatDatetime(shiftStart), startingCash]
        );
        const shiftId = shiftRes.lastID;

        let shiftCashSales = 0;
        let shiftCashIncome = 0;
        let shiftCashDebtCollected = 0;
        let shiftCashExpenses = 0;
        let shiftCashSupplierPaid = 0;

        // Tentukan jumlah transaksi dalam shift ini
        let orderCount = isToday ? 5 : (isWeekend ? 6 + Math.floor(Math.random() * 4) : 4 + Math.floor(Math.random() * 3));

        for (let oIdx = 0; oIdx < orderCount; oIdx++) {
          const orderDate = new Date(shiftStart.getTime() + (oIdx + 1) * (isToday ? 28 * 60000 : 45 * 60000) + Math.floor(Math.random() * 10 * 60000));
          if (isToday && orderDate.getHours() > 8) {
            orderDate.setHours(8, 10 + oIdx * 3, 0);
          }

          const orderDateStr = dateStr.replace(/-/g, '');
          const orderNo = `TR-${orderDateStr}-${String(orderSeq++).padStart(4, '0')}`;

          // Tentukan apakah transaksi Retail atau Reseller
          const isResellerTx = Math.random() < 0.28; // 28% reseller grosir
          let customer = null;

          if (isResellerTx && resellerCustomers.length > 0) {
            customer = resellerCustomers[Math.floor(Math.random() * resellerCustomers.length)];
          } else {
            customer = retailCustomers[Math.floor(Math.random() * retailCustomers.length)];
          }

          // Tentukan item yang dibeli (1 s/d 3 produk)
          const numItems = isResellerTx ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);
          const chosenProds = [];
          const shuffledProds = [...products].sort(() => 0.5 - Math.random());

          let calculatedTotal = 0;
          const orderItems = [];

          for (let it = 0; it < numItems; it++) {
            const prod = shuffledProds[it];
            let qty = 0;
            let unitPrice = 0;

            if (isResellerTx) {
              // Reseller beli partai besar: 15 - 50 kg
              qty = [15, 20, 25, 30, 40, 50][Math.floor(Math.random() * 6)];
              unitPrice = prod.reseller_price;
            } else {
              // Eceran pembeli pasar: 1.5 - 5 kg
              qty = [1.5, 2.0, 2.5, 3.0, 4.0, 5.0][Math.floor(Math.random() * 6)];
              unitPrice = prod.retail_price;
            }

            const subtotal = Math.round(qty * unitPrice);
            calculatedTotal += subtotal;

            orderItems.push({
              product_id: prod.id,
              product_name: prod.name,
              qty,
              price_tier: isResellerTx ? 'reseller' : 'retail',
              cost_price: prod.cost_price,
              unit_price: unitPrice,
              subtotal
            });
          }

          // Tentukan Metode Pembayaran
          let payMethod = 'cash';
          const rPay = Math.random();
          if (isResellerTx && rPay < 0.25 && !isToday) {
            payMethod = 'tempo'; // Reseller kasbon tempo
          } else if (rPay < 0.68) {
            payMethod = 'cash';
          } else if (rPay < 0.85) {
            payMethod = 'qris';
          } else {
            payMethod = 'transfer';
          }

          let cashTendered = calculatedTotal;
          let changeDue = 0;

          if (payMethod === 'cash') {
            // Pembulatan uang tunai pasar (50k, 100k, dsb)
            if (calculatedTotal < 50000) {
              cashTendered = Math.ceil(calculatedTotal / 10000) * 10000;
              if (cashTendered === calculatedTotal && Math.random() > 0.5) cashTendered += 10000;
            } else if (calculatedTotal < 200000) {
              cashTendered = Math.ceil(calculatedTotal / 50000) * 50000;
              if (cashTendered === calculatedTotal && Math.random() > 0.5) cashTendered += 50000;
            } else {
              cashTendered = Math.ceil(calculatedTotal / 100000) * 100000;
            }
            changeDue = Math.max(0, cashTendered - calculatedTotal);
            shiftCashSales += calculatedTotal;
          } else if (payMethod === 'tempo') {
            cashTendered = 0;
            changeDue = 0;
          }

          // Sesekali buat transaksi void di masa lalu untuk uji Anti-Fraud
          const isVoid = (!isToday && dayOffset === 12 && oIdx === 1) || (!isToday && dayOffset === 22 && oIdx === 2);
          const orderStatus = isVoid ? 'void' : 'completed';

          let dueDateStr = null;
          if (payMethod === 'tempo') {
            const dueD = new Date(orderDate.getTime() + 14 * 86400000); // tempo 14 hari
            dueDateStr = formatDateOnly(dueD);
          }

          const orderRes = await dbQuery.run(
            `INSERT INTO orders 
             (order_no, shift_id, customer_id, customer_name, total_amount, payment_method, cash_tendered, change_due, status, due_date, void_reason, void_approved_by, void_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              orderNo,
              shiftId,
              customer ? customer.id : null,
              customer ? customer.name : 'Pelanggan Umum',
              calculatedTotal,
              payMethod,
              cashTendered,
              changeDue,
              orderStatus,
              dueDateStr,
              isVoid ? 'Pembeli batal beli (salah timbangan)' : null,
              isVoid ? 1 : null,
              isVoid ? formatDatetime(orderDate) : null,
              formatDatetime(orderDate)
            ]
          );
          const orderId = orderRes.lastID;

          // Simpan order items
          for (const item of orderItems) {
            await dbQuery.run(
              `INSERT INTO order_items 
               (order_id, product_id, product_name, qty, price_tier, cost_price, unit_price, subtotal)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                orderId,
                item.product_id,
                item.product_name,
                item.qty,
                item.price_tier,
                item.cost_price,
                item.unit_price,
                item.subtotal
              ]
            );
          }

          // Jika tempo dan bukan void, buat customer_debts
          if (payMethod === 'tempo' && !isVoid) {
            totalDebtsCreated++;
            // Tentukan status piutang: apakah sudah lunas, cicil, atau belum lunas
            let debtStatus = 'unpaid';
            let paidAmt = 0;
            let remAmt = calculatedTotal;

            if (dayOffset < 15) {
              // Transaksi tempo 2 minggu lalu -> SUDAH LUNAS
              debtStatus = 'paid';
              paidAmt = calculatedTotal;
              remAmt = 0;
            } else if (dayOffset < 24) {
              // Transaksi tempo 1 minggu lalu -> CICIL SEPARUH (PARTIAL)
              debtStatus = 'partial';
              paidAmt = Math.round(calculatedTotal * 0.5 / 10000) * 10000;
              remAmt = calculatedTotal - paidAmt;
            } else {
              // Transaksi tempo baru -> BELUM LUNAS (UNPAID)
              debtStatus = 'unpaid';
              paidAmt = 0;
              remAmt = calculatedTotal;
            }

            const debtRes = await dbQuery.run(
              `INSERT INTO customer_debts 
               (order_id, customer_id, total_amount, paid_amount, remaining_amount, due_date, status, notes, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                orderId,
                customer.id,
                calculatedTotal,
                paidAmt,
                remAmt,
                dueDateStr,
                debtStatus,
                `Kasbon belanja grosir ${customer.name} (Tempo 14 Hari)`,
                formatDatetime(orderDate),
                formatDatetime(orderDate)
              ]
            );
            const debtId = debtRes.lastID;

            // Catat riwayat pelunasan jika ada pembayaran
            if (paidAmt > 0) {
              const payD = new Date(orderDate.getTime() + 4 * 86400000);
              await dbQuery.run(
                `INSERT INTO debt_payments 
                 (debt_id, customer_id, shift_id, amount_paid, payment_method, recorded_by, notes, payment_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  debtId,
                  customer.id,
                  shiftId,
                  paidAmt,
                  'transfer',
                  cashier.id,
                  debtStatus === 'paid' ? 'Pelunasan penuh transfer bank' : 'Cicilan tahap 1 kasbon',
                  formatDatetime(payD)
                ]
              );
            }
          }

          if (!isVoid) {
            totalOrdersCreated++;
            totalRevenueCreated += calculatedTotal;
          }
        } // End loop orders

        // ---------------------------------------------------------------------
        // BIAYA OPERASIONAL PADA SHIFT INI
        // ---------------------------------------------------------------------
        // Makan & Kopi tim kasir/kru
        const expTime1 = new Date(shiftStart.getTime() + 2 * 3600000);
        const expNo1 = `EXP-${dateStr.replace(/-/g, '')}-${String(expenseSeq++).padStart(4, '0')}`;
        await dbQuery.run(
          `INSERT INTO store_expenses 
           (expense_no, shift_id, user_id, category, category_name, type, amount, source, notes, created_at)
           VALUES (?, ?, ?, ?, ?, 'expense', ?, 'cash', ?, ?)`,
          [
            expNo1,
            shiftId,
            cashier.id,
            'makan_rokok',
            'Makan, Minum & Rokok',
            35000,
            'Makan siang & kopi tim kios pasar',
            formatDatetime(expTime1)
          ]
        );
        shiftCashExpenses += 35000;
        totalExpensesCreated += 35000;

        // Retribusi & Parkir Pasar
        const expTime2 = new Date(shiftStart.getTime() + 3.5 * 3600000);
        const expNo2 = `EXP-${dateStr.replace(/-/g, '')}-${String(expenseSeq++).padStart(4, '0')}`;
        await dbQuery.run(
          `INSERT INTO store_expenses 
           (expense_no, shift_id, user_id, category, category_name, type, amount, source, notes, created_at)
           VALUES (?, ?, ?, ?, ?, 'expense', ?, 'cash', ?, ?)`,
          [
            expNo2,
            shiftId,
            cashier.id,
            'parkir_retribusi',
            'Parkir & Retribusi Pasar',
            15000,
            'Karcis retribusi kebersihan & keamanan pasar harian',
            formatDatetime(expTime2)
          ]
        );
        shiftCashExpenses += 15000;
        totalExpensesCreated += 15000;

        // Kuli Bongkar / Perlengkapan pada hari tertentu
        if (dayOffset % 4 === 0) {
          const expTime3 = new Date(shiftStart.getTime() + 4.5 * 3600000);
          const expNo3 = `EXP-${dateStr.replace(/-/g, '')}-${String(expenseSeq++).padStart(4, '0')}`;
          await dbQuery.run(
            `INSERT INTO store_expenses 
             (expense_no, shift_id, user_id, category, category_name, type, amount, source, notes, created_at)
             VALUES (?, ?, ?, ?, ?, 'expense', ?, 'cash', ?, ?)`,
            [
              expNo3,
              shiftId,
              cashier.id,
              'kuli_bongkar',
              'Kuli Panggul & Bongkar Muat',
              60000,
              'Ongkos kuli angkut pick-up ubi & singkong',
              formatDatetime(expTime3)
            ]
          );
          shiftCashExpenses += 60000;
          totalExpensesCreated += 60000;
        }

        // Token Listrik PLN mingguan
        if (dayOffset % 7 === 1 && isShiftPagi) {
          const expTime4 = new Date(shiftStart.getTime() + 5 * 3600000);
          const expNo4 = `EXP-${dateStr.replace(/-/g, '')}-${String(expenseSeq++).padStart(4, '0')}`;
          await dbQuery.run(
            `INSERT INTO store_expenses 
             (expense_no, shift_id, user_id, category, category_name, type, amount, source, notes, created_at)
             VALUES (?, ?, ?, ?, ?, 'expense', ?, 'transfer', ?, ?)`,
            [
              expNo4,
              shiftId,
              1, // Owner
              'listrik_token',
              'Listrik & Token PLN',
              150000,
              'Token listrik PLN kios 2200W',
              formatDatetime(expTime4)
            ]
          );
          totalExpensesCreated += 150000;
        }

        // Tambah Kas Modal Laci (Kas Masuk)
        if (dayOffset % 8 === 2 && isShiftPagi) {
          const incTime = new Date(shiftStart.getTime() + 1 * 3600000);
          const incNo = `EXP-${dateStr.replace(/-/g, '')}-${String(expenseSeq++).padStart(4, '0')}`;
          await dbQuery.run(
            `INSERT INTO store_expenses 
             (expense_no, shift_id, user_id, category, category_name, type, amount, source, notes, created_at)
             VALUES (?, ?, ?, ?, ?, 'income', ?, 'cash', ?, ?)`,
            [
              incNo,
              shiftId,
              1, // Owner
              'kas_masuk_modal',
              'Kas Masuk / Tambah Modal Laci',
              300000,
              'Tambah modal uang pecahan kembalian dari brankas',
              formatDatetime(incTime)
            ]
          );
          shiftCashIncome += 300000;
        }

        // ---------------------------------------------------------------------
        // REKONSILIASI PENUTUPAN SHIFT (Kecuali shift hari ini yang dibiarkan OPEN)
        // ---------------------------------------------------------------------
        if (!isToday) {
          const shiftEnd = new Date(shiftStart.getTime() + 7.5 * 3600000);
          const expectedSystemCash = startingCash 
            + shiftCashSales 
            + shiftCashIncome 
            + shiftCashDebtCollected 
            - shiftCashExpenses 
            - shiftCashSupplierPaid;

          // Selisih kas realistis (90% uang pas, sesekali selisih kecil uang koin)
          let cashDiff = 0;
          if (dayOffset % 7 === 3) cashDiff = -2000; // Kurang 2rb kembalian
          if (dayOffset % 9 === 4) cashDiff = 1000; // Lebih 1rb

          const actualCash = Math.max(0, expectedSystemCash + cashDiff);
          const breakdown = generateCashBreakdown(actualCash);
          const closingNote = cashDiff === 0 
            ? 'Shift selesai, uang fisik di laci pas.' 
            : (cashDiff < 0 ? `Selisih minus Rp ${Math.abs(cashDiff).toLocaleString('id-ID')} (pembulatan koin receh).` : 'Lebih kembalian receh.');

          await dbQuery.run(
            `UPDATE shifts 
             SET end_time = ?,
                 system_cash = ?,
                 actual_cash = ?,
                 cash_difference = ?,
                 status = 'closed',
                 closing_notes = ?,
                 breakdown = ?
             WHERE id = ?`,
            [
              formatDatetime(shiftEnd),
              expectedSystemCash,
              actualCash,
              cashDiff,
              closingNote,
              JSON.stringify(breakdown),
              shiftId
            ]
          );

          // Log audit penutupan shift
          await dbQuery.run(
            `INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, ?, ?, ?)`,
            [
              cashier.id,
              'SHIFT_CLOSED',
              `Shift #${shiftId} ditutup oleh ${cashier.name}. Sistem: ${formatRupiah(expectedSystemCash)}, Fisik: ${formatRupiah(actualCash)}, Selisih: ${formatRupiah(cashDiff)}`,
              formatDatetime(shiftEnd)
            ]
          );
        } else {
          // Log audit buka shift hari ini
          await dbQuery.run(
            `INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, ?, ?, ?)`,
            [
              cashier.id,
              'SHIFT_OPENED',
              `Shift #${shiftId} dibuka oleh ${cashier.name} dengan modal awal ${formatRupiah(startingCash)}.`,
              formatDatetime(shiftStart)
            ]
          );
        }
      } // End loop shifts

      // -----------------------------------------------------------------------
      // TRANSAKSI KULAKAN PEMASOK (PURCHASES & SUPPLIER PAYMENTS)
      // Terjadi berkala setiap 2-3 hari sekali
      // -----------------------------------------------------------------------
      if (dayOffset % 3 === 0 && dayOffset > 0 && !isToday) {
        const sup = supplierList[dayOffset % supplierList.length];
        const kulProd = products[dayOffset % products.length];
        const kulQty = [200, 250, 300, 400][dayOffset % 4];
        const kulCost = kulProd.cost_price;
        const totalCost = Math.round(kulQty * kulCost);

        const isLunas = (dayOffset % 2 === 0);
        const paidAmt = isLunas ? totalCost : Math.round(totalCost * 0.4 / 100000) * 100000;
        const remAmt = totalCost - paidAmt;
        const payStatus = isLunas ? 'lunas' : (paidAmt > 0 ? 'partial' : 'tempo');

        const kulDate = new Date(curDate);
        kulDate.setHours(4, 30, 0); // Kulakan tiba subuh
        const dueD = new Date(kulDate.getTime() + 10 * 86400000);
        const purchaseNo = `KUL-${dateStr.replace(/-/g, '')}-${String(purchaseSeq++).padStart(4, '0')}`;

        const purRes = await dbQuery.run(
          `INSERT INTO purchases 
           (purchase_no, supplier_id, product_id, qty_kg, cost_price, total_cost, payment_status, paid_amount, remaining_amount, due_date, notes, recorded_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [
            purchaseNo,
            sup.id,
            kulProd.id,
            kulQty,
            kulCost,
            totalCost,
            payStatus,
            paidAmt,
            remAmt,
            formatDateOnly(dueD),
            `Kulakan ${kulProd.name} dari ${sup.name}`,
            formatDatetime(kulDate)
          ]
        );
        const purchaseId = purRes.lastID;

        // Catat pembayaran supplier
        if (paidAmt > 0) {
          await dbQuery.run(
            `INSERT INTO supplier_payments 
             (purchase_id, supplier_id, shift_id, amount_paid, payment_method, payment_date, notes, recorded_by)
             VALUES (?, ?, NULL, ?, 'transfer', ?, ?, 1)`,
            [
              purchaseId,
              sup.id,
              paidAmt,
              formatDatetime(kulDate),
              isLunas ? 'Pembayaran lunas transfer bank' : 'DP transfer bank 40%'
            ]
          );
        }
      }

      // -----------------------------------------------------------------------
      // CATATAN SUSUT / BUSUK / OPNAME (STOCK ADJUSTMENTS)
      // -----------------------------------------------------------------------
      if (dayOffset === 5 || dayOffset === 11 || dayOffset === 18 || dayOffset === 25) {
        const adjProd = products[(dayOffset * 2) % products.length];
        const adjType = (dayOffset === 18) ? 'busuk' : 'susut';
        const adjQty = (dayOffset === 18) ? 2.5 : 1.8;
        const adjDate = new Date(curDate);
        adjDate.setHours(12, 15, 0);

        await dbQuery.run(
          `INSERT INTO stock_adjustments 
           (product_id, shift_id, user_id, type, qty_kg, notes, created_at)
           VALUES (?, NULL, 1, ?, ?, ?, ?)`,
          [
            adjProd.id,
            adjType,
            adjQty,
            `Penyortiran harian ${adjProd.name} (${adjType})`,
            formatDatetime(adjDate)
          ]
        );
      }
    } // End loop 31 days

    await dbQuery.exec('COMMIT;');
    await dbQuery.exec('PRAGMA foreign_keys = ON;');

    console.log('\n================================================================');
    console.log('✅ SEEDING SIMULASI BERHASIL 100%!');
    console.log(`📦 Total Transaksi Nota Dibuat : ${totalOrdersCreated} Nota`);
    console.log(`💰 Total Omset Transaksi 30 Hari : ${formatRupiah(totalRevenueCreated)}`);
    console.log(`📝 Total Piutang Tempo Dibuat   : ${totalDebtsCreated} Rekening Piutang`);
    console.log(`💸 Total Biaya Pengeluaran Toko : ${formatRupiah(totalExpensesCreated)}`);
    console.log(`🟢 Status Shift Hari Ini        : AKTIF (OPEN) Siap Kasir`);
    console.log('================================================================\n');

  } catch (err) {
    try {
      await dbQuery.exec('ROLLBACK;');
    } catch (rbErr) {}
    console.error('❌ Gagal melakukan seeding:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

runSeed();
