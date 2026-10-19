# 📋 CATATAN PENGEMBANGAN SISTEM (DEVELOPMENT PROGRESS)
**Proyek:** Kassa POS - Sistem Kasir Pintar & Anti-Kecolongan Toko Pasar  
**Lokasi Direktori:** `F:\POS`  
**Repository GitHub:** [https://github.com/yusufburhani20/pos-umbi.git](https://github.com/yusufburhani20/pos-umbi.git)  
**Branch Utama:** `main`  
**Status Terakhir:** v1.7.0 (Sistem Biaya & Kas Operasional Toko: Laci Kasir & Rekening Transfer Terintegrasi)  
**Pembaruan Terakhir:** 18 Oktober 2026  

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
- [x] **Penyederhanaan Harga (Penghapusan Opsi Reseller)**: Opsi reseller / dropdown tipe pembeli dihapus dari keranjang kasir karena kasir kini dapat langsung menyesuaikan harga satuan (harga eceran/kustom/nego) saat menimbang atau di keranjang.
- [x] **Kasbon Terbuka untuk Pembeli Siapa Saja**:
  - Transaksi kasbon/tempo tidak lagi dibatasi hanya untuk pelanggan reseller terdaftar.
  - Ditambahkan form input wajib: **Nama Pembeli** dan **Nomor HP / WhatsApp** pada modal checkout kasbon agar identitas pemilik hutang tercatat jelas.
  - Tersedia fitur autocomplete nama pelanggan terdahulu dan auto-fill nomor HP.
  - Terintegrasi otomatis ke buku kasbon kasir, buku piutang owner, dan struk thermal.
- [x] **Peran Ganda Kasir Sebagai Admin (Dual Role Operator/Admin)**:
  - Tombol `👑 Panel Admin` selalu dapat diakses kasir untuk melihat dashboard eksekutif, laporan profit, dan audit trail.
  - **📦 Stok Opname Fisik Komoditas**: Modal audit stok fisik interaktif langsung di kasir (koreksi stok riil, perhitungan selisih otomatis surplus/susut, dan update database instan lewat endpoint `/api/products/opname`).
  - **⚙️ Edit Identitas Toko & Kasir**: Modal pengeditan identitas toko (nama usaha, slogan, alamat kios pasar, telepon/WA, footer struk dengan *live thermal receipt preview*) dan profil kasir (nama tampilan, ganti PIN keamanan akun via `/api/settings/profile`).
  - Penyesuaian izin middleware backend (`requireOwner`) agar kasir memiliki wewenang administratif penuh di kios pasar.

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

### 7. 📱 Offline-First PWA & 1-Minute Auto-Sync Engine (v1.4.0)
- [x] **Operasional Kasir Full Offline (IndexedDB Engine)**:
  - Transaksi kasir, timbangan desimal, nominal uang pas, dan perhitungan nota tetap berjalan 100% normal tanpa koneksi internet sama sekali.
  - Cetak struk thermal 58mm/80mm instan via Bluetooth/USB tanpa perlu menunggu respon server cloud.
  - Keranjang belanja, katalog komoditas, dan antrean nota tersimpan aman di database internal tablet (`TokoUmbi_OfflineDB`).
- [x] **Mesin Sinkronisasi Otomatis 1 Menit (*Background Sync Engine*)**:
  - `POST /api/sync/push`: Mengirim paket nota penjualan, catatan susut, dan cicilan kasbon yang tertunda ke server cloud setiap 60 detik (atau begitu sinyal terdeteksi kembali) dengan proteksi anti-duplikat (*idempotent*).
  - `GET /api/sync/pull`: Menarik update harga komoditas dan master pelanggan terbaru dari Cloud ke Tablet.
  - `GET /api/sync/status`: Pemeriksaan detak jantung (*heartbeat*) konektivitas antara kios dan server.
- [x] **Indikator Status Sinkronisasi di Header Kasir**:
  - Badge visual pintar: 🟢 *Online (Tersinkron)*, 🟡 *Offline (X Nota Tersimpan Aman di Tablet)*, dan 🔄 *Menyinkron...*.
  - Modal Rincian Sinkronisasi: Memeriksa ID Tablet Kios, status jaringan, waktu sync terakhir, jumlah antrean nota, dan tombol manual *[🔄 Sinkronkan Sekarang]*.
- [x] **Dukungan PWA (*Progressive Web App*) & Service Worker**:
  - File manifest (`manifest.webmanifest`), ikon aplikasi (`icon.svg`), dan Service Worker (`sw.js`).
  - Tablet kasir dapat diinstal ke layar utama (*Add to Home Screen*) dan dibuka instan meskipun tablet dinyalakan ulang dalam kondisi tanpa internet.
- [x] **Monitoring Real-time di HP Pemilik (Owner Dashboard Heartbeat)**:
  - Badge Heartbeat Kios di bar atas Owner Dashboard: menampilkan nama tablet kios (`📱 TAB-KIOS-XX`), status lampu berdenyut hijau (*Active/Online*), kuning (*Warning*), atau merah (*Offline*), serta waktu sinkronisasi terakhir.
  - Polling otomatis setiap 30 detik agar omzet, uang laci kasir, dan komoditas laku di HP pemilik selalu ter-update secara *real-time*.

### 8. 🍠 Katalog Komoditas Asli Pasar & Skema Harga 3-Lapis (v1.4.1)
- [x] **Integrasi 21 Komoditas Asli**:
  - Mengganti seluruh data sampel dengan komoditas nyata kios: Ubi Putih Super, Ubi Putih Kecil, Ubi Merah, Ubi Ungu, Ubi Cilembu Madu, Ubi Jepang, Ubi To (Sortiran), Talas Bogor, Suuk (Kacang Tanah Basah), Singkong Mentega, Kacang Kedelai/Bulu, Kacang Tanah Kupas, Bangkuang Super, To Bangkuang, Labu Parang, Kulang Kaleng, Gula Aren Plastik 10kg, Gula Aren Daun, Jagung Manis, Edamame Pretelan, dan Buah Kaweni.
- [x] **Penyelarasan Terminologi Pasar Tradisional**:
  - `Harga Nota`: Biaya modal kulakan/HPP dari petani.
  - `Harga Karungan`: Harga grosir untuk pembelian partai karungan ($\ge 10$–15 kg) atau pelanggan warung.
  - `Harga Eceran`: Harga kiloan untuk pembeli umum/walk-in.
  - Label kategori di antarmuka kasir disesuaikan: `🍠 Umbi-umbian`, `🥜 Suuk & Kacang`, `🥕 Sayur & Labu`, `🥥 Kulang Kaleng`, `🍯 Gula Aren`, dan `🥭 Buah Kaweni`.

### 9. 📱 Responsif Mobile Penuh untuk Dashboard Owner (v1.5.0)
- [x] **Optimasi Tampilan Smartphone (360px - 430px)**:
  - Header adaptif ringkas: Subteks panjang otomatis disembunyikan di layar kecil, tombol aksi diringkas menjadi ikon sentuh ergonomis (`🔄`, `🖥️ Kasir`, `🚪`), dan telemetri kios tertata dalam bar mini tanpa merusak layout.
  - Sub-navbar navigasi tab berbasis kapsul segmented dengan dukungan *smooth horizontal swipe* (`overflow-x: auto`), indikator tab aktif presisi, serta status dot shift aktif.
  - 4 Kartu KPI finansial otomatis beradaptasi ke format grid 2×2 di ponsel pintar sehingga pemilik dapat langsung memantau Uang Laci, Omzet, Non-Tunai, dan Nota Batal secara instan (*above the fold*) tanpa perlu menggulir ke bawah berkali-kali.
  - Radar anti-manipulasi harga, rekonsiliasi tutup kasir blind drop, dan log susut komoditas tertata 1 kolom terstruktur.
  - Tabel rincian transaksi dan buku piutang tempo dilengkapi pembungkus *smooth horizontal scroll* (`.table-responsive`) dengan batas minimal lebar kolom sehingga data angka dan tanggal tidak terpotong atau saling tumpang tindih.
  - Modal dan dialog beralih ke format *bottom-sheet* modern di mobile, dengan pencegahan *auto-zoom* iOS Safari (font-size form $\ge 16$px) dan tombol aksi yang nyaman ditekan ibu jari.

### 10. 🖨️ Dukungan Perangkat Keras: Tablet Android, Printer Bluetooth & Cash Drawer RJ-11 (v1.6.0)
- [x] **Optimasi Tablet Android (Redmi Pad SE / Universal Tablet)**:
  - Layar 11 inci (landscape & portrait) responsif dengan layout 2-kolom di kasir (katalog komoditas & keranjang belanja terpisah rapi).
  - PWA standalone full-screen tanpa address bar Chrome (`manifest.webmanifest` & `sw.js`).
  - Sentuhan jari ergonomis: tombol aksi $\ge 48$px, penghapusan delay 300ms dengan `touch-action: manipulation`, dan pencegahan text-selection yang tidak disengaja.
  - Host server terikat ke `0.0.0.0` (`vite --host`) sehingga tablet bisa langsung mengakses kasir via WiFi/Hotspot lokal.
- [x] **Universal Thermal Bluetooth Printer (ESC/POS Generator)**:
  - Berkas modul modular [hardware.js](file:///home/yusufb/posumbi/pos-umbi/frontend-pos/src/hardware.js) dengan generator binary ESC/POS native (teks tajam, tebal judul toko, alignment rapi, dan potong kertas). Kompatibel dengan berbagai merek (Epson, Panda, Iware, Eppos, VSC, Blueprint, POS-58/80, RPP, MPT, Kassen, dll.).
  - Mendukung 3 mode cetak: **Web Bluetooth API** (koneksi langsung Chrome Android), **RawBT Intent** (untuk Bluetooth Classic SPP), dan **System Print** (dialog cetak Android).
  - Pilihan ukuran kertas: **58 mm** (Thermal Standar / 32 kolom) dan **80 mm** (Thermal Standar / 48 kolom).
  - Pill indikator status Bluetooth di bar atas kasir: 🟢 *Terhubung* vs 🔴 *Putus*.
  - Isolasi CSS `@media print` khusus struk thermal sehingga saat dialog cetak terbuka, hanya nota kasir berlatar putih yang tercetak (bebas margin & tanpa elemen web).
- [x] **Universal Cash Drawer (Pemicu Pulsa RJ-11 / Drawer Kick)**:
  - Perintah sinyal ESC/POS pulsa ganda pin 2 & pin 5 (`ESC p 0 25 250` dan `ESC p 1 25 250`) terkirim ke port RJ-11 printer kasir.
  - **Auto-Kick**: Laci otomatis terbuka sendiri saat transaksi tunai (`cash`) atau uang muka tempo diselesaikan kasir.
  - **Tombol Cepat "Buka Laci"**: Kasir dapat membuka laci kasir manual kapan saja dari header kasir atau modal struk (misal untuk tukar uang kembalian atau hitung uang fisik laci).
  - Fitur uji coba (*Test Cash Drawer Kick*) di modal pengaturan hardware kasir dan dashboard owner.

### 11. 🚛 Manajemen Pemasok & Buku Kulakan Terintegrasi (v1.7.0)
- [x] **Database & Skema Data Lengkap**:
  - Tabel `suppliers`: Menyimpan profil juragan / kelompok tani (nama, nomor WhatsApp, kota/daerah asal, komoditas utama yang dipasok, info rekening bank, dan catatan kemitraan).
  - Tabel `purchases`: Pembukuan nota kulakan masuk dengan format nomor otomatis `KUL-YYYYMMDD-XXXX`, kuantiti riil (kg), harga modal kulakan (Rp/kg), total nilai, status bayar (`lunas`, `tempo`, `partial`), uang muka (DP), sisa hutang, tanggal jatuh tempo, dan ID petugas pencatat.
  - Tabel `supplier_payments`: Rekaman jejak pembayaran hutang kulakan toko ke juragan petani (cicilan maupun pelunasan penuh, metode pembayaran via transfer atau uang fisik laci kasir, dan referensi mutasi).
  - Data bawaan (*Seeder*): Dilengkapi data contoh pemasok riil sentra umbi & bumbu (Juragan Mahmud - Brebes, Haji Sobari - Sukabumi, Kelompok Tani Dieng - Wonosobo, Pak Asep - Garut).
- [x] **Panel Kasir (POS) Terintegrasi**:
  - Menu **"🚛 Kontak & Data Pemasok"** di dropdown header kasir: Kasir dapat langsung melihat daftar juragan langganan toko, nomor rekening bank, serta tombol klik langsung chat WhatsApp (`wa.me`).
  - Modal **"+ Tambah Pemasok Cepat"** (`#modalNewSupplierQuick`): Kasir dapat mendaftarkan juragan/pengepul baru seketika saat truk komoditas tiba di kios pasar.
  - Integrasi Kulakan Masuk (`#restockModal`): Form kulakan masuk kasir kini dapat memilih pemasok juragan dan memilih skema pembayaran **Lunas Langsung** atau **Tempo / Hutang Toko ke Supplier** (dengan input tanggal jatuh tempo dan uang muka DP).
- [x] **Panel Owner (Dashboard Eksekutif)**:
  - Tab navigasi khusus **"🚛 Pemasok & Kulakan"** pada subnav desktop dan menu lembar bawah (*mobile bottom sheet*).
  - **4 Kartu KPI Eksekutif**:
    1. *Pemasok Aktif*: Jumlah total juragan/petani terdaftar.
    2. *Kulakan Bulan Ini*: Total belanja modal komoditas masuk bulan berjalan (Rp).
    3. *Hutang Tempo Toko*: Total kewajiban hutang toko yang masih berjalan ke seluruh juragan (Rp).
    4. *Tempo Lewat Jatuh Tempo*: Nilai kewajiban hutang yang sudah melampaui tanggal janji bayar.
  - **Dual View Switcher**: Beralih instan antara **"👥 Daftar Juragan / Pemasok"** dan **"📋 Riwayat Nota Kulakan Masuk"**.
  - **Filter Cepat & Pencarian**: Pencarian nama juragan, kontak, daerah asal, serta filter status hutang (*Semua Status*, *Ada Hutang Tempo*, *Lunas*).
  - Modal **"✨ Tambah / Edit Pemasok"** (`#modalEditSupplier`): Manajemen profil lengkap pemasok.
  - Modal **"📋 Detail & Riwayat Pemasok"** (`#modalSupplierDetail`): Menampilkan kartu profil juragan, tombol chat WhatsApp, rekap total belanja, tab riwayat nota kulakan masuk, dan tab riwayat pembayaran cicilan/pelunasan.
  - Modal **"📦 Catat Kulakan Masuk"** (`#modalOwnerRecordPurchase`): Tambah stok komoditas dan perbarui harga modal dengan kalkulasi nilai total otomatis dan pilihan skema bayar (Lunas/Tempo).
  - Modal **"💵 Bayar Hutang Kulakan"** (`#modalSupplierPay`): Form pelunasan hutang ke juragan dengan tombol chip cepat *⚡ Bayar Lunas Penuh*, pilihan metode pembayaran (*Transfer Bank* atau *Tunai dari Laci Kasir*), dan catatan referensi.

### 12. 💸 Buku Biaya & Kas Operasional Toko Terintegrasi (v1.7.0)
- [x] **Pemisahan Transaksi Beban vs Penjualan Komoditas**:
  - Biaya operasional kios (makan kasir, rokok, parkir/salar retribusi pasar, kuli panggul/bongkar, karung/plastik/rafia, listrik PLN, WiFi/pulsa, uang saku/gaji harian) dicatat di buku tersendiri (`store_expenses`).
  - Omzet bruto (penjualan) dan HPP modal komoditas tidak tercampur atau terdistorsi oleh pengeluaran operasional.
- [x] **Integrasi Saldo Fisik Laci Kasir Real-Time & Tutup Shift**:
  - Pengeluaran operasional yang diambil dari fisik laci kasir (`source: 'cash'`) otomatis memotong saldo kas sistem yang wajib ada di laci saat tutup shift:
    Target Kas Laci = Kas Awal + Penjualan Tunai + Kas Masuk Non-Penjualan - Biaya Tunai Laci - Bayar Kulakan Tunai
  - Mencegah tuduhan uang tekor / selisih kas salah saat kasir melakukan *blind drop* penutupan shift.
- [x] **Pemisahan Sumber Pengambilan Uang**:
  - `💵 Kas Laci Kasir`: Memotong fisik uang laci shift aktif dan tercatat pada rekonsiliasi kasir.
  - `🏦 Transfer Bank / Non-Tunai`: Digunakan untuk tagihan toko yang dibayar via m-banking (seperti WiFi Indihome/Biznet, token listrik PLN, sewa kios). Masuk ke pembukuan laba bersih toko tanpa mengurangi saldo laci fisik kasir.
- [x] **Pencatatan Kas Masuk / Modal Tambahan**:
  - Tersedia modal *Kas Masuk* (`type: 'income'`) untuk mencatat suntikan modal uang kembalian dari Owner atau penjualan karung bekas tanpa merusak pembukuan penjualan komoditas.
- [x] **Antarmuka Kasir POS Ergonomis & Cepat**:
  - Tombol cepat **"💸 Biaya & Kas"** di header navigasi kasir dan menu dropdown kelola toko.
  - 4 Kartu KPI laci real-time: *Biaya Hari Ini*, *Keluar Dari Laci Kasir*, *Via Transfer*, dan *Estimasi Kas Laci Shift*.
  - 10 Preset kategori biaya khas kios pasar dengan ikon emoji dan kode warna.
  - Tombol nominal cepat: `+10 Rb`, `+20 Rb`, `+35 Rb`, `+50 Rb`, `+100 Rb`, `+200 Rb`, dan tombol `Reset C`.
  - Tab riwayat kas keluar & kas masuk dengan filter kategori, sumber dana, pencarian nomor bukti (`EXP-YYYYMMDD-XXXX`), dan tombol void/hapus.
- [x] **Dashboard Eksekutif Owner (Pengawasan Finansial & Laba Bersih Riil)**:
  - Tab navigasi khusus **"💸 Biaya & Kas Toko"** dengan counter total transaksi.
  - 4 Kartu KPI: *Total Beban Bulan Ini*, *Keluar Dari Laci Kasir*, *Via Transfer Bank Toko*, dan *Total Kas Masuk/Modal*.
  - Bilah persentase pengeluaran per pos kategori (*Top Spending Distribution*).
  - Integrasi perhitungan Laba Bersih Riil (*Net Operating Profit*) pada Laporan Penjualan:
- [x] **Proteksi Ketat Anti-Saldo Minus (Strict Anti-Overdraft Protection)**:
  - Setiap kali transaksi pengeluaran tunai (`POST /api/expenses`), pembayaran hutang kulakan tunai (`POST /api/suppliers/purchases/:id/pay`), atau DP kulakan tunai (`POST /api/suppliers/purchases`) hendak dilakukan:
    - Sistem menghitung saldo riil kas laci detik itu juga via `getCurrentDrawerCash()`.
    - **Jika saldo kas laci tidak mencukupi:** Transaksi otomatis **DIBATALKAN / DITOLAK KERAS** (`code: 'INSUFFICIENT_DRAWER_CASH'`) dengan pesan rincian saldo laci saat ini dan jumlah nominal kekurangannya.
    - Kasir atau Owner wajib melakukan suntik dana modal terlebih dahulu via modal **`+ Kas Masuk / Modal`** atau mengganti metode pembayaran ke *Transfer Bank*.
  - Di antarmuka Kasir POS dan Owner Dashboard:
    - Muncul banner peringatan merah interaktif *⛔ Saldo Kas Laci Tidak Mencukupi* secara *real-time* saat kasir mengetik nominal atau memilih chip uang.
    - Tombol simpan dikunci (*disabled*) dan disediakan tombol pintas langsung: **`[💵 Tambah Kas Masuk / Modal Sekarang]`** yang otomatis mengisi form kas masuk dengan nilai kekurangan dana.

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
5. **Perbaikan Layering Pop-Up Tambah Komoditas & Kulakan Masuk di Jendela Katalog (v1.6.1)**:
   - *Masalah*: Saat kasir membuka jendela "Katalog Komoditas & Margin Laba" (`#modalCatalogMargin`, `z-index: 10003`) lalu mengklik "+ Tambah Komoditas" atau "+ Kulakan Masuk", pop-up dialog formulir muncul di belakang jendela katalog karena z-index bawaan 1000, sehingga tertimpa dan tidak bisa diinput.
   - *Solusi*: Mengatur hierarki stacking context modal anak (`#newProductModal`, `#restockModal`, `#editProductModal`, dan `#hardwareModal`) ke `z-index: 10030 !important`, memperbaiki fungsi pemicu form `openNewProductModal()` agar input tereset dan terfokus otomatis, menaikkan z-index notifikasi toast ke `99999`, serta memverifikasi interaksi buka-tutup dan simpan data langsung ter-render di atas jendela katalog tanpa kendala.

### 14. 🛡️ Audit Kesiapan Produksi & Penguatan Keamanan Sistem (v1.9.0 - 18 Oktober 2026)
- [x] **Pencegahan Saldo Laci Kas Minus (`getCurrentDrawerCash`)**:
  - Saldo riil kas laci dihitung secara live: $\text{Modal Awal} + \text{Penjualan Kas} + \text{Cicilan/DP Piutang Kas} + \text{Kas Masuk} - \text{Biaya Kas} - \text{Kulakan Kas}$.
  - Pengeluaran biaya operasional (`POST /api/expenses`) dan pembayaran kulakan tunai (`POST /api/suppliers/purchases` & `POST /api/suppliers/purchases/:id/pay`) otomatis dibatalkan jika saldo laci tidak mencukupi, mencegah tekor kas fisik.
- [x] **Separasi Otoritas Ketat (`requireStrictOwner`)**:
  - Endpoint pengguna (`/api/users`), reset PIN owner & ubah identitas toko (`/api/settings`), hapus biaya (`DELETE /api/expenses/:id`), dan audit log (`/api/reports/audit-logs`) diisolasi khusus untuk akun ber-role `owner`. Kasir tidak dapat mengekskalasi hak akses.
- [x] **Rate Limiter Anti-Brute Force PIN Login**:
  - In-memory rate limiting pada `POST /api/auth/login`. Jika gagal 5 kali dalam 5 menit, IP dikunci sementara selama 5 menit dengan respon status 429.
- [x] **Sanitasi Error Produksi**:
  - Global error handler pada `app.js` disanitasi: jika `NODE_ENV === 'production'`, rincian `err.message` teknis tidak dibocorkan ke client.
- [x] **Redesain Bar Aksi & Format Waktu Feed Dashboard Owner**:
  - Tombol navigasi 3 feed histori didesain ulang menjadi bar aksi modern dengan aksen warna tematik (Biru, Rose, Zamrud).
  - Ketiga tabel histori terbaru (Penjualan, Biaya, dan Kulakan) dilengkapi chip tanggal & jam Indonesia lengkap (`formatDateTimeDetailed()`).
- [x] **Penyelarasan Identitas Toko Resmi (PD. HASIL BUMI RAYA 1)**:
  - Nama toko resmi disetel menjadi **PD. HASIL BUMI RAYA 1**.
  - Alamat disetel menjadi **Pasar induk modern, Cikopo, Kec. Campaka, Kabupaten Purwakarta, Jawa Barat 41183**.
  - Diterapkan menyeluruh pada database SQLite (`store_settings`), layar kasir POS, kop struk thermal printer, dashboard executive owner, skrip simulasi harian (`simulate_day.js`), serta berkas Buku Panduan Operasional PDF.

### 15. 💎 Sistem Lisensi & Penegakan Langganan SaaS (Subscription Enforcement - v2.0.0)
- [x] **Logika Siklus Hidup Langganan & Toleransi Jatuh Tempo**:
  - `active` ($> 3$ hari sebelum jatuh tempo): Aplikasi berjalan normal, modal tidak muncul.
  - `warning` ($0 \le \text{diffDays} \le 3$ hari): Pop-up pengingat jatuh tempo muncul dengan tombol toleransi ("Nanti Saja") agar operasional kasir tidak terganggu seketika.
  - `grace_period` ($-3 \le \text{diffDays} < 0$): Telat bayar namun dalam masa tenggang toleransi (3 hari). Kasir dan owner diingatkan dengan hitungan mundur sisa masa tenggang.
  - `expired` / `locked` ($\text{diffDays} < -3$ hari atau kunci manual vendor): **Akses terkunci total (*Hard Lockdown*)**. Pop-up modal memblokir layar, tombol kasir dan checkout dinonaktifkan, tombol batal/tutup modal disembunyikan, dan penekanan tombol `Esc` diblokir sampai pembayaran diselesaikan.
- [x] **Pop-Up Otomatis di Kasir POS & Owner Dashboard**:
  - Otomatis memeriksa status langganan saat aplikasi pertama kali dibuka dan setiap 10 menit secara berkala via endpoint `/api/subscription/status`.
  - Kartu rekening resmi vendor: Nama Bank (BCA), Nomor Rekening dengan tombol salin 1-klik (*copy to clipboard* + feedback tersalin), Atas Nama, dan nominal langganan bulanan.
  - Tombol WhatsApp otomatis (`wa.me`) dengan pesan konfirmasi yang sudah terisi nama toko dan nominal transfer.
  - Tombol **"🔄 Periksa Status Sekarang"**: Memeriksa status langganan ke server secara instan dan membuka kembali sistem saat admin vendor sudah mengkonfirmasi pembayaran.
- [x] **Card Status Lisensi di Tab Pengaturan Owner Dashboard**:
  - Di tab *Identitas Toko & Struk*, ditambahkan kartu eksekutif **"💎 Status Lisensi & Biaya Langganan Aplikasi POS"** sehingga pemilik toko selalu dapat memantau tanggal jatuh tempo berikutnya dan informasi rekening pembayaran.
- [x] **CLI Kontrol Lisensi Vendor (`backend/manage_license.js`)**:
  - Utilitas terminal praktis bagi penyedia software untuk mengelola langganan klien:
    - `node backend/manage_license.js --status`: Cek status masa aktif dan rekening saat ini.
    - `node backend/manage_license.js --extend 30`: Memperpanjang masa aktif langganan +30 hari (atau nominal hari bebas).
    - `node backend/manage_license.js --set-due 2026-12-01`: Menyetel tanggal jatuh tempo spesifik.
    - `node backend/manage_license.js --lock`: Mengunci aplikasi toko seketika.
    - `node backend/manage_license.js --unlock`: Membuka kunci aplikasi toko.
    - `node backend/manage_license.js --set-bank`: Mengubah info rekening tujuan dan tarif bulanan.
    - `node backend/manage_license.js --simulate-overdue`: Simulasi kondisi telat bayar untuk pengujian.
    - `node backend/reset_transactions.js` (atau `--reset-transactions`): Pengosongan aman seluruh riwayat transaksi (orders, shifts, debts, expenses, purchases) dengan auto-backup SQLite, tanpa menyentuh master data produk, identitas toko, kasir, dan pemasok.
    - `node backend/backup_database.js` (atau `--backup`): Membuat salinan cadangan (backup) database toko secara instan dan atomic (WAL checkpoint + VACUUM INTO) ke folder `backups/`.
    - `node backend/backup_database.js --list` (atau `--list-backups`): Menampilkan daftar file backup yang tersedia beserta ukuran dan tanggal dibuat.
    - `node backend/backup_database.js --restore <nama_file.db>`: Memulihkan database dari file cadangan dengan proteksi file penyelamat (rescue backup) otomatis dan verifikasi integritas SQLite (`PRAGMA integrity_check`).

### 16. 🚀 Deployment Production Cloudflare Tunnel & Pengamanan Online (v2.1.0)
- [x] **Online di Domain Publik**:
  - URL Kasir: [https://kassa.konfigin.my.id/](https://kassa.konfigin.my.id/)
  - URL Owner: [https://kassa.konfigin.my.id/owner.html](https://kassa.konfigin.my.id/owner.html)
  - Reverse proxy Nginx aaPanel meneruskan `/api/` ke `http://127.0.0.1:4000/api/` via Cloudflare Zero Trust Tunnel.
  - Backend berjalan permanen di latar belakang via PM2 (`kassa-pos`).
- [x] **Pengamanan Login Produksi (Security Hardening)**:
  - Tombol **"Login Cepat Pengujian"** (Budi 112233, Siti 223344, Owner 123456) dihapus total dari modal login kasir `index.html`.
  - Hanya keypad PIN murni 6 digit yang tersisa demi keamanan dan privasi kredensial toko di lingkungan online publik.

---

## 🗺️ ROADMAP FITUR SELANJUTNYA (YANG BELUM DIBUAT)

Berikut adalah daftar fitur yang siap dipilih untuk pengembangan selanjutnya:

### 1. 📲 Kirim Struk Digital via WhatsApp (*Struk WA*) - [Prioritas Rekomendasi]
- **Tujuan**: Menghemat kertas thermal kasir dan mempermudah pelanggan warung/reseller yang butuh rekap belanjaan di HP mereka.
- **Rencana Fitur**:
  - Tombol **"Kirim Struk WA"** di kasir saat checkout selesai dan di modal riwayat transaksi.
  - Otomatis mengambil nomor WA pelanggan (jika terdaftar) atau kasir memasukkan nomor WA walk-in.
  - Membuka WhatsApp Web / WhatsApp Mobile dengan format teks nota yang rapi, ada nama toko, rincian barang, total, dan status lunas.

### 2. 👥 Manajemen Pelanggan Reseller (CRM Sederhana)
- **Tujuan**: Mengelola basis data pembeli grosir dan memantau loyalitas belanja langganan.
- **Rencana Fitur**:
  - Halaman kelola pelanggan di panel Owner (Tambah, Edit nama, nomor telepon, alamat, dan tier).
  - Riwayat akumulasi total belanja pelanggan.

### 3. 📊 Grafik Visual & Tren Komoditas
- **Tujuan**: Membantu pemilik toko melihat performa penjualan komoditas secara visual.
- **Rencana Fitur**:
  - Grafik tren penjualan mingguan/bulanan.
  - Grafik perbandingan komoditas terlaris (Kentang vs Bawang vs Ubi).

### 4. ☁️ Persiapan Cloud / Multi-Device Online (Production Deployment)
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
├── PERINTAH_KONTROL_LISENSI.txt  # Panduan & daftar perintah terminal kontrol lisensi, reset & backup
├── kontrol.sh                    # << APLIKASI BASH INTERAKTIF: Menu vendor (lisensi, reset, backup)
├── menu.sh                       # Alias cepat menjalankan kontrol.sh
├── backups/                      # Folder penyimpanan berkas cadangan database SQLite (.db)
├── backend/                      # Backend Server API
│   ├── pos_umbi.db               # Database SQLite lokal
│   ├── package.json              # Dependensi backend (Express, SQLite3, Bcrypt, JWT)
│   ├── manage_license.js         # CLI Kontrol lisensi vendor, perpanjang hari & lock/unlock
│   ├── backup_database.js        # Utilitas backup & restore database atomic
│   ├── reset_transactions.js     # Utilitas reset aman khusus data transaksi
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
│           ├── suppliers.js      # Manajemen data pemasok, nota kulakan masuk & hutang toko
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
