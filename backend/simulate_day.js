require('dotenv').config({ path: __dirname + '/.env' });

const API_BASE = 'http://localhost:4000/api';

async function apiRequest(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSimulation() {
  console.log('================================================================');
  console.log('🌽 SIMULASI 1 HARI KERJA PENUH: PD. HASIL BUMI RAYA 1');
  console.log('📍 Alamat: Pasar induk modern, Cikopo, Kec. Campaka, Kabupaten Purwakarta, Jawa Barat 41183');
  console.log('📅 Tanggal Simulasi: ' + new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
  console.log('================================================================\n');

  // 1. Login Kasir
  console.log('▶️ LANGKAH 1: Login Kasir (Budi)');
  const cashierLogin = await apiRequest('POST', '/auth/login', { pin: '112233' });
  if (!cashierLogin.ok) {
    console.error('❌ Gagal login kasir:', cashierLogin.data.message);
    process.exit(1);
  }
  const cashierToken = cashierLogin.data.token;
  console.log(`   ✅ Berhasil login: ${cashierLogin.data.user.name} (${cashierLogin.data.user.role})`);

  // 2. Login Owner (Pak Haji)
  console.log('\n▶️ LANGKAH 2: Login Owner (Pak Haji)');
  const ownerLogin = await apiRequest('POST', '/auth/login', { pin: '123456' });
  if (!ownerLogin.ok) {
    console.error('❌ Gagal login owner:', ownerLogin.data.message);
    process.exit(1);
  }
  const ownerToken = ownerLogin.data.token;
  console.log(`   ✅ Berhasil login: ${ownerLogin.data.user.name} (${ownerLogin.data.user.role})`);

  // 3. Periksa Shift Aktif
  console.log('\n▶️ LANGKAH 3: Pemeriksaan & Buka Shift Kasir Pagi (Modal Awal: Rp 200.000)');
  const currentShift = await apiRequest('GET', '/shifts/current', null, cashierToken);
  let activeShiftId = null;

  if (currentShift.data && currentShift.data.has_active_shift) {
    activeShiftId = currentShift.data.shift.id;
    console.log(`   ℹ️ Shift aktif sudah berjalan (Shift #${activeShiftId}) oleh ${currentShift.data.shift.cashier_name}`);
    console.log(`   💵 Saldo kas laci saat ini: ${formatRupiah(currentShift.data.shift.current_drawer_cash)}`);
  } else {
    const openRes = await apiRequest('POST', '/shifts/open', { starting_cash: 200000 }, cashierToken);
    if (!openRes.ok) {
      console.error('❌ Gagal buka shift:', openRes.data.message);
      process.exit(1);
    }
    activeShiftId = openRes.data.shift.id;
    console.log(`   ✅ Shift #${activeShiftId} berhasil dibuka dengan modal awal ${formatRupiah(200000)}`);
  }

  // Ambil daftar produk
  const prodRes = await apiRequest('GET', '/products', null, cashierToken);
  const products = prodRes.data.products || [];
  const ubiCilembu = products.find(p => p.name.includes('Cilembu')) || products[0];
  const jagungManis = products.find(p => p.name.includes('Jagung')) || products[1];
  const singkong = products.find(p => p.name.includes('Singkong')) || products[2];
  const kacangKupas = products.find(p => p.name.includes('Kacang Tanah Kupas')) || products[3];
  const ubiMerah = products.find(p => p.name.includes('Ubi Merah')) || products[4];

  // 4. Transaksi 1: Penjualan Eceran Pagi (Tunai)
  console.log('\n▶️ LANGKAH 4: Transaksi Penjualan Eceran Pagi (Tunai / Uang Pas)');
  console.log(`   🛒 Item 1: ${ubiCilembu.name} (3 kg @ ${formatRupiah(ubiCilembu.retail_price)})`);
  console.log(`   🛒 Item 2: ${jagungManis.name} (2.5 kg @ ${formatRupiah(jagungManis.retail_price)})`);

  const order1Total = (3 * ubiCilembu.retail_price) + Math.round((2.5 * jagungManis.retail_price) / 100) * 100;
  const order1Res = await apiRequest('POST', '/orders', {
    shift_id: activeShiftId,
    items: [
      { product_id: ubiCilembu.id, qty: 3, price_tier: 'retail' },
      { product_id: jagungManis.id, qty: 2.5, price_tier: 'retail' }
    ],
    payment_method: 'cash',
    cash_tendered: order1Total,
    customer_name: 'Pembeli Umum Pagi'
  }, cashierToken);

  if (order1Res.ok) {
    console.log(`   ✅ Nota Penjualan ${order1Res.data.order.order_no} berhasil!`);
    console.log(`      Total Belanja: ${formatRupiah(order1Res.data.order.total_amount)} | Uang Diterima: ${formatRupiah(order1Res.data.order.cash_tendered)} | Kembalian: ${formatRupiah(order1Res.data.order.change_due)}`);
  } else {
    console.log('   ⚠️ Gagal transaksi 1:', order1Res.data.message);
  }

  // 5. Transaksi 2: Penjualan Partai / Karungan (Non-Tunai / QRIS)
  console.log('\n▶️ LANGKAH 5: Transaksi Partai / Karungan Reseller Warung (QRIS)');
  console.log(`   🛒 Item: ${ubiCilembu.name} (25 kg @ Harga Karung ${formatRupiah(ubiCilembu.reseller_price)})`);
  const order2Total = 25 * ubiCilembu.reseller_price;

  const order2Res = await apiRequest('POST', '/orders', {
    shift_id: activeShiftId,
    items: [
      { product_id: ubiCilembu.id, qty: 25, price_tier: 'karungan' }
    ],
    payment_method: 'qris',
    cash_tendered: order2Total,
    customer_name: 'Warung Bu Siti'
  }, cashierToken);

  if (order2Res.ok) {
    console.log(`   ✅ Nota Penjualan ${order2Res.data.order.order_no} berhasil via QRIS!`);
    console.log(`      Total Belanja: ${formatRupiah(order2Res.data.order.total_amount)} (Dana masuk rekening bank toko, tidak menambah laci fisik)`);
  } else {
    console.log('   ⚠️ Gagal transaksi 2:', order2Res.data.message);
  }

  // 6. Transaksi 3: Pembelian Kasbon / Tempo Pelanggan dengan DP Tunai
  console.log('\n▶️ LANGKAH 6: Transaksi Kasbon / Tempo Pelanggan Tetap dengan DP Tunai');
  console.log(`   🛒 Item: ${kacangKupas.name} (10 kg @ ${formatRupiah(kacangKupas.retail_price)})`);
  const order3Total = 10 * kacangKupas.retail_price;
  const dpAmount = 100000;

  const order3Res = await apiRequest('POST', '/orders', {
    shift_id: activeShiftId,
    items: [
      { product_id: kacangKupas.id, qty: 10, price_tier: 'retail' }
    ],
    payment_method: 'tempo',
    cash_tendered: dpAmount,
    customer_name: 'Pak Bambang (Catering Berkah)',
    customer_phone: '0813-8899-7711',
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  }, cashierToken);

  let newDebtId = null;
  if (order3Res.ok) {
    console.log(`   ✅ Nota Kasbon ${order3Res.data.order.order_no} tercatat!`);
    console.log(`      Total: ${formatRupiah(order3Total)} | DP Kasir (Tunai Laci): ${formatRupiah(dpAmount)} | Sisa Hutang: ${formatRupiah(order3Total - dpAmount)}`);
    console.log(`      Jatuh Tempo: 7 Hari ke depan`);
  } else {
    console.log('   ⚠️ Gagal transaksi 3:', order3Res.data.message);
  }

  // 7. Pengeluaran Toko 1: Biaya Makan & Minum Kuli (Tunai Laci)
  console.log('\n▶️ LANGKAH 7: Pencatatan Biaya Operasional Pagi (Makan & Kopi Kuli Panggul)');
  const exp1Res = await apiRequest('POST', '/expenses', {
    category: 'makan_rokok',
    amount: 35000,
    source: 'cash',
    type: 'expense',
    notes: 'Kopi dan sarapan 2 orang kuli panggul bongkar muat'
  }, cashierToken);

  if (exp1Res.ok) {
    console.log(`   ✅ Biaya operasional tercatat: ${exp1Res.data.expense.expense_no}`);
    console.log(`      Nominal: ${formatRupiah(35000)} dipotong langsung dari kas laci.`);
  } else {
    console.log('   ⚠️ Gagal catat biaya:', exp1Res.data.message);
  }

  // 8. Pengujian Sistem: Uji Coba Pencegahan Saldo Kas Laci Minus (Negative Drawer Guard)
  console.log('\n▶️ LANGKAH 8: Uji Coba Proteksi Anti Saldo Minus (Mencoba Pengeluaran Rp 5.000.000)');
  const overExpRes = await apiRequest('POST', '/expenses', {
    category: 'perbaikan_alat',
    amount: 5000000,
    source: 'cash',
    type: 'expense',
    notes: 'Uji coba pengeluaran melebihi uang kas laci'
  }, cashierToken);

  if (!overExpRes.ok && overExpRes.data.code === 'INSUFFICIENT_DRAWER_CASH') {
    console.log('   🛡️ PROTEKSI SISTEM BERFUNGSI SEMPURNA! Pengeluaran ditolak otomatis.');
    console.log(`      Pesan Sistem: "${overExpRes.data.message.substring(0, 110)}..."`);
  } else {
    console.log('   ⚠️ Hasil uji coba kas minus:', overExpRes.data);
  }

  // 9. Kulakan Masuk dari Pemasok: Penambahan Stok Fisik & Update HPP
  console.log('\n▶️ LANGKAH 9: Penerimaan Kulakan dari Petani / Bandar (Restock Komoditas)');
  console.log(`   🚛 Masuk: 150 kg ${ubiMerah.name} @ Rp 6.200 dari Pemasok`);
  const supList = await apiRequest('GET', '/suppliers', null, cashierToken);
  const suppliers = supList.data.suppliers || [];
  const defaultSupplier = suppliers[0] || { id: null, name: 'Pemasok Petani Lokal' };

  const purchaseRes = await apiRequest('POST', '/suppliers/purchases', {
    supplier_id: defaultSupplier.id,
    product_id: ubiMerah.id,
    qty_kg: 150,
    cost_price: 6200,
    payment_status: 'tempo',
    dp_amount: 300000,
    payment_method: 'transfer',
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    notes: 'Kiriman mobil pickup pagi, ubi merah super mulus'
  }, cashierToken);

  if (purchaseRes.ok) {
    console.log(`   ✅ Nota Kulakan ${purchaseRes.data.purchase.purchase_no} berhasil disimpan!`);
    console.log(`      Total Kulakan: ${formatRupiah(150 * 6200)} | DP Transfer: ${formatRupiah(300000)} | Sisa Hutang Toko: ${formatRupiah((150 * 6200) - 300000)}`);
    console.log(`      Stok ${ubiMerah.name} otomatis bertambah +150 kg di katalog.`);
  } else {
    console.log('   ⚠️ Gagal catat kulakan:', purchaseRes.data.message);
  }

  // 10. Pencatatan Susut / Busuk Komoditas (Shrinkage Loss)
  console.log('\n▶️ LANGKAH 10: Pencatatan Susut / Busuk Harian (Sortasi Pagi)');
  console.log(`   🗑️ Ditemukan: 1.5 kg ${ubiCilembu.name} lembek/busuk saat pemindahan karung`);
  const wasteRes = await apiRequest('POST', '/products/adjust-stock', {
    product_id: ubiCilembu.id,
    qty_kg: 1.5,
    type: 'susut',
    notes: 'Sortiran pagi, 1.5 kg busuk lembek terkena air hujan'
  }, cashierToken);

  if (wasteRes.ok) {
    console.log(`   ✅ Pencatatan susut/busuk berhasil: ${wasteRes.data.message}`);
    console.log(`      Stok berkurang 1.5 kg, nilai kerugian modal langsung terekam ke laporan rugi-laba.`);
  } else {
    console.log('   ⚠️ Gagal catat susut:', wasteRes.data.message);
  }

  // 11. Pelunasan / Cicilan Kasbon oleh Pelanggan
  console.log('\n▶️ LANGKAH 11: Pelanggan Bayar Cicilan Kasbon Tunai di Kasir');
  const debtsRes = await apiRequest('GET', '/debts', null, cashierToken);
  const activeDebts = debtsRes.data.debts || [];
  const targetDebt = activeDebts.find(d => d.customer_name.includes('Bambang')) || activeDebts[0];

  if (targetDebt && targetDebt.remaining_amount > 0) {
    const payAmount = Math.min(150000, targetDebt.remaining_amount);
    const payRes = await apiRequest('POST', `/debts/${targetDebt.id}/pay`, {
      amount_paid: payAmount,
      payment_method: 'cash',
      notes: 'Cicilan tunai kasbon di kasir siang'
    }, cashierToken);

    if (payRes.ok) {
      console.log(`   ✅ Setoran cicilan ${targetDebt.customer_name} sebesar ${formatRupiah(payAmount)} diterima kasir!`);
      console.log(`      Uang fisik ${formatRupiah(payAmount)} otomatis menambah saldo laci kasir aktif.`);
    } else {
      console.log('   ⚠️ Gagal catat cicilan:', payRes.data.message);
    }
  } else {
    console.log('   ℹ️ Tidak ada piutang aktif yang perlu dicicil.');
  }

  // 12. Dashboard Eksekutif Owner Live Snapshot
  console.log('\n▶️ LANGKAH 12: Pemantauan Dashboard Eksekutif Owner (HP / Laptop Pemilik)');
  const dashRes = await apiRequest('GET', '/reports/dashboard', null, ownerToken);
  if (dashRes.ok) {
    const s = dashRes.data.summary;
    const l = dashRes.data.liquidity_snapshot;
    console.log('   📊 RINGKASAN FINANSIAL TOKO HARI INI:');
    console.log(`      • Total Omset Penjualan  : ${formatRupiah(s.total_revenue)}`);
    console.log(`      • Estimasi Uang Kas Laci : ${formatRupiah(s.cash_in_drawer)} (Uang tunai wajib ada di laci saat ini)`);
    console.log(`      • Penjualan Non-Tunai    : ${formatRupiah(s.total_qris + s.total_transfer)}`);
    console.log(`      • Biaya Operasional Toko : ${formatRupiah(s.total_expenses_today)}`);
    console.log(`      • Estimasi Laba Bersih   : ${formatRupiah(s.net_profit_today)}`);
    console.log(`      • Piutang Kasbon Pembeli : ${formatRupiah(l.total_customer_debts)} (dari ${l.total_debtors} pelanggan)`);
    console.log(`      • Hutang Kulakan Toko    : ${formatRupiah(l.total_supplier_debt)} (ke ${l.total_suppliers_debt} pemasok)`);
  }

  console.log('\n================================================================');
  console.log('🎉 SELURUH SIMULASI 1 HARI KERJA PD. HASIL BUMI RAYA 1 SELESAI DENGAN SUKSES!');
  console.log('💡 Anda sekarang dapat membuka http://localhost:3000/owner.html');
  console.log('   untuk melihat seluruh visual grafik, kartu kas, dan histori terbaru.');
  console.log('================================================================\n');
}

runSimulation().catch(err => {
  console.error('Fatal Simulation Error:', err);
});
