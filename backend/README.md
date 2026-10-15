# Toko Umbi POS & Anti-Fraud Backend API

Backend API khusus untuk bisnis komoditas pertanian / toko umbi-umbian dengan fitur **Anti-Kecolongan (Anti-Fraud)** dan **Multi-Tier Pricing (Eceran vs Reseller/Grosir)**.

---

## 🚀 Fitur Unggulan Sistem

1. **Anti-Fraud Pricing Engine:**
   - Pembeli umum (< kuantiti grosir) otomatis dikenakan **Harga Eceran**.
   - Pembelian $\ge$ batas kuantiti (misal $\ge$ 10 kg) otomatis beralih ke **Harga Reseller**.
   - Pelanggan berstatus reseller terdaftar otomatis mendapat **Harga Reseller** berapapun jumlahnya.
   - Kasir **tidak bisa memanipulasi tier harga** untuk pembeli eceran tanpa identitas reseller atau kuantiti yang memenuhi syarat.

2. **Blind Close Shift (Tutup Kasir Buta):**
   - Saat tutup shift, kasir **tidak melihat** total kas di sistem.
   - Kasir wajib menginput uang fisik riil di laci.
   - Sistem mencocokkan otomatis dengan `Modal Awal + Penjualan Tunai` dan langsung mencatat selisih (*shortage / surplus*) ke log owner.

3. **Strict Void with Owner PIN:**
   - Pembatalan transaksi (*void*) wajib memasukkan PIN Owner dan alasan pembatalan.
   - Stok barang otomatis dikembalikan (*restored*).

4. **Pencatatan Susut / Barang Busuk:**
   - Pencatatan barang rusak/busuk (*shrinkage*) dengan dokumentasi alasan dan link foto bukti.

5. **Owner Mobile Dashboard Endpoint:**
   - Memantau uang fisik di laci kasir saat ini (*Cash In Drawer*).
   - Memantau omset tunai vs QRIS vs transfer.
   - Deteksi anomali: Rasio volume eceran vs reseller (mencegah kasir menjual eceran tapi dicatat grosir).
   - Laporan selisih kas kasir (*recent cash shortages*).

---

## 🛠️ Cara Menjalankan

### 1. Jalankan Server
```bash
npm start
# atau mode development:
npm run dev
```
Server berjalan di `http://localhost:4000`.

### 2. Jalankan Pengujian Otomatis
```bash
node test_api.js
```

---

## 🔑 Akun Default (Seeded)

* **Owner:** Username: `owner`, PIN: `123456`
* **Kasir:** Username: `kasir1`, PIN: `112233`

---

## 📡 Daftar Endpoint API

### 1. Autentikasi (`/api/auth`)
* `POST /api/auth/login` - Login dengan PIN (cepat untuk tablet) atau Username + PIN.
* `GET /api/auth/me` - Cek profil sesi saat ini.
* `POST /api/auth/verify-owner-pin` - Verifikasi PIN Owner untuk otorisasi tindakan khusus.

### 2. Shift Kasir (`/api/shifts`)
* `GET /api/shifts/current` - Cek status shift kasir aktif.
* `POST /api/shifts/open` - Buka shift baru dengan modal awal (*starting cash*).
* `POST /api/shifts/close` - **Blind Close Shift** (kirim uang fisik riil di laci).
* `GET /api/shifts/history` - Riwayat shift dan audit selisih kas.

### 3. Produk & Timbangan (`/api/products`)
* `GET /api/products` - Daftar produk aktif dengan harga eceran & reseller.
* `POST /api/products` - Tambah produk baru (Owner only).
* `PUT /api/products/:id` - Edit produk & harga (Owner only).
* `POST /api/products/adjust-stock` - Catat barang susut/busuk beserta foto.

### 4. Pelanggan & Reseller (`/api/customers`)
* `GET /api/customers` - Cari data pelanggan / reseller.
* `POST /api/customers` - Daftarkan reseller baru.

### 5. Transaksi Kasir (`/api/orders`)
* `POST /api/orders` - Buat transaksi penjualan baru dengan validasi tier harga otomatis.
* `GET /api/orders` - Riwayat transaksi penjualan.
* `GET /api/orders/:id` - Detail transaksi dan rincian item.
* `POST /api/orders/:id/void` - Batalkan transaksi (wajib PIN Owner).

### 6. Laporan Dashboard Owner (`/api/reports`)
* `GET /api/reports/dashboard` - Data real-time untuk layar smartphone Owner.
* `GET /api/reports/audit-logs` - Log rekaman gerak-gerik kasir dan insiden sistem.
