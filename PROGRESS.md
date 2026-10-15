# 📋 CATATAN PENGEMBANGAN SISTEM (DEVELOPMENT PROGRESS)
**Proyek:** Toko Umbi POS & Executive Anti-Fraud Dashboard  
**Lokasi Direktori:** `F:\POS`  
**Repository GitHub:** [https://github.com/yusufburhani20/pos-umbi.git](https://github.com/yusufburhani20/pos-umbi.git)  
**Branch Utama:** `main`  
**Status Terakhir:** v1.3.0 (Aktif & Siap Dikembangkan Lebih Lanjut)  
**Pembaruan Terakhir:** 15 Oktober 2026  

---

## 🚀 Ringkasan Cara Menjalankan Aplikasi

Jika Anda ingin melanjutkan pengembangan di kemudian hari, jalankan 2 terminal berikut:

### 1. Terminal Backend API (Port 4000)
```bash
cd F:\POS\backend
npm install    # (jika ada dependensi baru)
npm start      # atau 'npm run dev' untuk auto-restart saat kode diubah
```
- URL API: `http://localhost:4000/api`
- Database: SQLite `F:\POS\backend\pos_umbi.db` (Mode WAL aktif)

### 2. Terminal Frontend POS & Owner (Port 3000)
```bash
cd F:\POS\frontend-pos
npm install    # (jika ada dependensi baru)
npm run dev
```
- Layar Kasir POS: [http://localhost:3000/](http://localhost:3000/)
- Layar Owner Dashboard: [http://localhost:3000/owner.html](http://localhost:3000/owner.html)

### 3. Akun Akses Default untuk Pengujian
| Peran | Username | PIN Akses | Hak Akses Utama |
| :--- | :--- | :--- | :--- |
| **👑 Pemilik (Owner)** | `owner` | `123456` | Dashboard Finansial, Margin Laba, Otorisasi Batal/Void, Buku Piutang, Pengaturan Toko |
| **👤 Kasir Pagi** | `kasir1` | `112233` | Operasional Kasir, Transaksi Tunai/Non-Tunai/Kasbon, Cetak Struk, Tutup Kasir (Blind Drop) |
| **👤 Kasir Siang** | `kasir2` | `112233` | Akun Kasir Tambahan |

---

## ✅ FITUR YANG SUDAH SELESAI 100% (COMPLETED FEATURES)

### 1. 🖥️ Layar Kasir POS (`index.html`, `app.js`, `style.css`)
- [x] **Skema Harga Bertingkat Otomatis**: Mendeteksi otomatis harga Eceran vs Grosir/Reseller berdasarkan kuantiti minimal (contoh: $\ge 10$ kg) atau status pelanggan reseller.
- [x] **Pembelian Nominal Uang Pasti**: Fitur tombol cepat Rp 5rb, 10rb, 15rb, 20rb, 50rb dsb. Timbangan kilogram dihitung otomatis presisi, dan total belanja di struk terkunci pas sesuai nominal uang pelanggan.
- [x] **Pencegahan Stok Habis (Out-of-Stock Protection)**: Produk dengan stok 0 kg ditandai pudar (`🚨 Habis`), dicegah agar tidak bisa dimasukkan ke keranjang kasir.
- [x] **Pill Filter Stok Menipis**: Tombol filter `⚠️ Stok Menipis` di deretan kategori kasir dengan badge indikator merah jumlah barang kritis.
- [x] **Cetak Struk Thermal Real-Time**: Desain struk thermal 80mm/58mm rapi dengan kop identitas toko dinamis, rincian timbangan, dan catatan kaki kustom.
- [x] **Cetak Salinan Ulang Struk**: Kasir dapat mencetak ulang nota transaksi lama di menu riwayat dengan penanda `*** SALINAN / CETAK ULANG ***`.
- [x] **Pembatalan Transaksi (Batal / Void)**: Pembatalan nota salah input yang diwajibkan meminta otorisasi PIN Owner dan alasan pembatalan. Stok otomatis dikembalikan.
- [x] **Pencatatan Susut Timbangan**: Input susut (busuk, layu, rusak, opname) per shift kerja kasir untuk pertanggungjawaban barang.
- [x] **Tutup Kasir Anti-Kecolongan (Blind Cash Drop)**: Kasir menginput uang fisik pecahan (100rb, 50rb, 20rb, 10rb, koin) tanpa melihat saldo sistem, mencegah kasir mencocok-cocokkan uang laci.
- [x] **Header Hari & Tanggal Real-Time**: Tampilan kalender Indonesia lengkap dan jam digital berjalan (WIB).

### 2. 📒 Penjualan Tempo & Buku Piutang Pelanggan
- [x] **Metode Pembayaran "Tempo / Kasbon" di Kasir**:
  - Wajib memilih pembeli terdaftar (khusus langganan / reseller).
  - Pilihan tanggal jatuh tempo pembayaran.
  - Input Uang Muka (DP) opsional.
  - Struk thermal kasir otomatis berstatus `*** NOTA KASBON / TEMPO ***` & `STATUS: BELUM LUNAS`.
- [x] **Buku Piutang Kasir**: Tombol cepat kasir `📒 Kasbon / Piutang` untuk melihat daftar piutang belum lunas dan mencatat cicilan/pelunasan kilat di meja kasir.
- [x] **Tab Buku Piutang & Kasbon di Owner Dashboard**:
  - 4 Kartu KPI: Total Piutang Berjalan, Piutang Jatuh Tempo (Overdue), Jumlah Pelanggan Berhutang, dan Total Kasbon Terlunasi.
  - Tabel interaktif dengan filter status (*Semua, Belum Lunas, Lewat Jatuh Tempo, Lunas*) dan pencarian nama pelanggan.
  - Modal Pembayaran Kasbon (Tunai, Transfer, QRIS) dengan audit pencatat.
  - Modal Rincian Riwayat Cicilan per transaksi kasbon.

### 3. ⚠️ Peringatan Stok Menipis (*Low Stock Alert*) & Ambang Batas Minimum
- [x] **Kolom `min_stock_alert` di Database**: Pengaturan ambang batas stok per produk (default 15.0 kg).
- [x] **Radar Peringatan Stok Menipis di Panel Owner (Tab Ringkasan)**:
  - Kartu radar dengan lampu indikator merah berdenyut (*pulse animation*).
  - Daftar komoditas di bawah batas aman lengkap dengan status sisa stok dan tombol cepat `[📦 Kulakan]`.
- [x] **Tab Katalog & Margin Laba**: Chip filter cepat `⚠️ Perlu Kulakan`, label batas minimum pada kartu produk, dan form input batas minimum di modal edit komoditas.
- [x] **Endpoint Backend**: `GET /api/products/low-stock` dan parameter query `?low_stock=true`.

### 4. ⚙️ Pengaturan Identitas Toko & Kustomisasi Struk Thermal
- [x] **Tabel Database `store_settings`**: Penyimpanan dinamis identitas toko.
- [x] **Tab Pengaturan di Owner Dashboard (`⚙️ Identitas Toko & Struk`)**:
  - Formulir Nama Toko, Slogan Usaha, Alamat Kios Pasar, Nomor Kontak / WhatsApp, dan Catatan Kaki Struk (*Footer Receipt*).
  - **Pratinjau Interaktif Struk Thermal (*Live Preview*)**: Simulasi kertas struk thermal yang otomatis berubah secara *real-time* saat pemilik mengetik form.
  - **Formulir Ganti PIN Owner**: Fitur perbarui PIN keamanan akun pemilik (validasi PIN lama dan konfirmasi 4-6 digit angka).
- [x] **Integrasi Header Kasir & Struk**: Judul brand di kasir dan kop/kaki struk belanja thermal otomatis mengikuti pengaturan pemilik toko.

### 5. 📈 Laporan Penjualan & Ekspor Komprehensif
- [x] **Filter Periode Fleksibel**: Hari Ini, Kemarin, 7 Hari Terakhir, Bulan Ini, dan Rentang Tanggal Kustom.
- [x] **4 KPI Finansial**: Total Omzet, HPP (Modal Kulakan), Laba Kotor Bersih, dan Persentase Margin Keuntungan.
- [x] **Tabel Peringkat Produk Terlaris (*Top Products*)**: Mengetahui komoditas mana yang paling laku dan paling menguntungkan.
- [x] **Ekspor Excel (CSV UTF-8)**: File spreadsheet siap olah yang rapi dan tidak berantakan di Microsoft Excel.
- [x] **Cetak Laporan Resmi A4 (PDF / Print)**: Format cetak resmi berstandar dokumen pembukuan toko lengkap dengan kolom tanda tangan pemilik.

### 6. 🛡️ Keamanan & Anti-Fraud Intelligence
- [x] **Radar Deteksi Anomali Penjualan**: Menganalisis rasio transaksi eceran vs grosir untuk mencegah kasir menjual eceran mahal tetapi menginput grosir murah di komputer.
- [x] **Audit Trail Digital Lengkap**: Setiap aksi penting kasir tercatat forensik (jam, tanggal, pelaksana, IP, dan detail aksi).
- [x] **Manajemen Kasir & Hak Akses**: Tambah kasir, reset PIN kasir lupa kode, dan nonaktifkan kasir.

---

## 🛠️ RIWAYAT PERBAIKAN MASALAH (BUGFIXES LOG)

1. **Sinkronisasi Zona Waktu WIB (UTC+7)**:
   - *Masalah*: Transaksi jam 11 siang tercatat jam 6 atau 4 pagi karena perbedaan UTC server.
   - *Solusi*: Seluruh query SQLite kini menggunakan `datetime('now', 'localtime')` dan frontend dilengkapi parser tanggal aman `parseSafeDate()`.
2. **Data Riwayat Transaksi Hari Ini**:
   - *Masalah*: Data transaksi kasir hilang saat kasir berganti shift atau merefresh halaman.
   - *Solusi*: Endpoint riwayat kasir diperbarui untuk mengambil seluruh data transaksi tanggal hari ini di semua shift.
3. **Pemberian Bahasa Indonesia Baku & Natural**:
   - Mengganti istilah asing seperti *Void* menjadi *Batal*, *Low Stock* menjadi *Stok Menipis*, dan format nominal standar Rupiah Indonesia (Rp).
4. **Perbaikan Tampilan Layar Penuh & Z-Index Modal**:
   - Memperbaiki pop-up cetak salinan struk yang sebelumnya tertutup di belakang pop-up riwayat transaksi.
   - Mengoptimalkan dashboard owner agar *responsive*, tidak terpotong, dan dapat di-scroll lancar pada resolusi monitor apapun.

---

## 🗺️ ROADMAP FITUR SELANJUTNYA (YANG BELUM DIBUAT)

Berikut adalah daftar fitur yang siap dipilih untuk pengembangan selanjutnya:

### 1. 📲 Kirim Struk Digital via WhatsApp (*Struk WA*) - [Prioritas Rekomendasi]
- **Tujuan**: Menghemat kertas thermal kasir dan mempermudah pelanggan warung/reseller yang butuh rekap belanjaan di HP mereka.
- **Rencana Fitur**:
  - Tombol **"Kirim Struk WA"** di kasir saat checkout selesai dan di modal riwayat transaksi.
  - Otomatis mengambil nomor WA pelanggan (jika terdaftar) atau kasir memasukkan nomor WA walk-in.
  - Membuka WhatsApp Web / WhatsApp Mobile dengan format teks nota yang rapi, ada nama toko, rincian barang, total, dan status lunas.

### 2. 🚛 Manajemen Pemasok / Supplier & Riwayat Kulakan
- **Tujuan**: Mencatat asal komoditas umbi dan memantau hutang toko ke juragan petani.
- **Rencana Fitur**:
  - Database Supplier (contoh: *Juragan Bawang Brebes, Petani Kentang Dieng, Pengepul Singkong Sukabumi*).
  - Form Kulakan Barang Masuk yang menghubungkan komoditas dengan supplier.
  - Riwayat Kulakan dan status pembayaran ke supplier (Lunas atau Tempo Kulakan).

### 3. 👥 Manajemen Pelanggan Reseller (CRM Sederhana)
- **Tujuan**: Mengelola basis data pembeli grosir dan memantau loyalitas belanja langganan.
- **Rencana Fitur**:
  - Halaman kelola pelanggan di panel Owner (Tambah, Edit nama, nomor telepon, alamat, dan tier).
  - Riwayat akumulasi total belanja pelanggan.

### 4. 📊 Grafik Visual & Tren Komoditas
- **Tujuan**: Membantu pemilik toko melihat performa penjualan komoditas secara visual.
- **Rencana Fitur**:
  - Grafik tren penjualan mingguan/bulanan.
  - Grafik perbandingan komoditas terlaris (Kentang vs Bawang vs Ubi).

### 5. ☁️ Persiapan Cloud / Multi-Device Online (Production Deployment)
- **Tujuan**: Memungkinkan pemilik memantau toko dari HP di luar kota secara online.
- **Rencana Fitur**:
  - Migrasi database ke PostgreSQL / Cloud SQLite (Turso / Supabase).
  - Konfigurasi deploy ke hosting/VPS (seperti Railway, Render, atau VPS Ubuntu).

---

## 📁 Struktur Berkas Proyek Utama

```text
F:\POS
├── .agents/                      # Konfigurasi skill AI (anti-slop, UI/UX guidelines)
├── .gitignore                    # Berkas pengecualian Git (node_modules, .env, temp db)
├── README.md                     # Dokumentasi pengenalan proyek
├── PROGRESS.md                   # << Berkas ini: Rekaman progres pengembangan aplikasi
├── backend/                      # Backend Server API
│   ├── pos_umbi.db               # Database SQLite lokal
│   ├── package.json              # Dependensi backend (Express, SQLite3, Bcrypt, JWT)
│   ├── .env.example              # Contoh konfigurasi environment
│   ├── index.js                  # Entry point server backend
│   └── src/
│       ├── app.js                # Setup routing Express & middleware
│       ├── db/index.js           # Skema tabel, query helper, dan seeder data
│       ├── middleware/auth.js    # Otentikasi token JWT, validasi Owner, audit logger
│       └── routes/               # REST API Routes:
│           ├── auth.js           # Login kasir/owner, verifikasi PIN
│           ├── products.js       # Katalog komoditas, restock, susut, low-stock
│           ├── customers.js      # Data pelanggan reseller & retail
│           ├── orders.js         # Transaksi kasir, cetak ulang, batal/void
│           ├── debts.js          # Pembukuan kasbon/piutang dan pelunasan cicilan
│           ├── reports.js        # Laporan keuangan, ekspor CSV, PDF, audit trail
│           ├── settings.js       # Identitas toko, footer struk, ganti PIN owner
│           ├── shifts.js         # Manajemen shift & rekonsiliasi blind drop
│           └── users.js          # Kelola user kasir & reset PIN
└── frontend-pos/                 # Frontend Web Application (Vite + Vanilla JS/CSS)
    ├── package.json              # Dependensi frontend (Vite bundler)
    ├── index.html                # Antarmuka Kasir POS
    ├── owner.html                # Antarmuka Dashboard Eksekutif Owner
    └── src/
        ├── api.js                # API client HTTP untuk komunikasi ke backend
        ├── app.js                # Logika kasir POS, keranjang, kalkulasi kg, struk
        ├── style.css             # Desain sistem & styling layar kasir
        ├── owner.js              # Logika dashboard owner, laporan, piutang, settings
        └── owner.css             # Desain sistem modern executive dashboard
```

---
*Dokumen ini dibuat otomatis sebagai panduan kerja berkelanjutan. Setiap kali ada penambahan fitur baru, dokumen ini dapat diperbarui untuk menjaga kontinuitas pengembangan.*
