# 🛡️ Kassa POS - Sistem Kasir Pintar & Anti-Kecolongan Toko Pasar

Sistem Point of Sale (POS) dan Dashboard Manajemen Eksekutif modern yang dirancang khusus untuk operasional perdagangan komoditas pasar, agen sembako, umbi-umbian (kentang, ubi, singkong), bumbu dapur, buah, dan hasil bumi.

Aplikasi ini dibangun untuk mengatasi permasalahan nyata di toko pasar: perbedaan harga eceran vs grosir/reseller, kebocoran uang kasir, penjualan tempo (kasbon), penyusutan timbangan barang, serta pemantauan stok menipis.

---

## ✨ Fitur Utama Sistem

### 1. 🖥️ Kasir POS Pasar (Cashier Interface)
- **Skema Harga Bertingkat Otomatis**: Transisi cerdas antara harga Eceran dan Grosir berdasarkan batas minimum kilogram atau status pelanggan reseller.
- **Dukungan Pembelian Nominal Pasti**: Kasir dapat memilih nominal uang langsung (Rp 10.000, Rp 20.000, dst.) dan timbangan kilogram terhitung otomatis dengan presisi akurat.
- **📒 Penjualan Tempo / Kasbon**: Dukungan pembayaran tempo khusus pelanggan langganan terdaftar dengan tanggal jatuh tempo dan pencatatan DP/Uang Muka.
- **🖨️ Cetak Struk Thermal Real-Time**: Format cetak struk 80mm/58mm dengan kop identitas toko dinamis, rincian timbangan, dan catatan kaki kustom.
- **Fitur Cetak Salinan Ulang**: Riwayat nota transaksi dengan fitur cetak ulang langsung berlabel *SALINAN / CETAK ULANG*.
- **⚠️ Peringatan Stok Menipis**: Kartu produk dengan tag visual status stok (Aman, Menipis, Habis) dan filter cepat komoditas menipis.
- **🕒 Hari, Tanggal, & Jam Digital Real-Time**: Sinkronisasi waktu operasional kasir (WIB).

### 2. 👑 Dashboard Manajemen & Anti-Kecolongan (Owner Dashboard)
- **💵 Rekonsiliasi Tutup Kasir (Blind Cash Drop)**: Kasir menginput uang fisik tunai di laci tanpa melihat saldo hitungan sistem, mencegah manipulasi uang setoran.
- **🛡️ Radar Deteksi Anomali Penjualan**: Mendeteksi jika kasir curang menjual harga eceran tetapi mencatat harga grosir untuk mengantongi selisih uang.
- **📒 Buku Piutang & Kasbon Pelanggan**: Rekapitulasi piutang berjalan, peringatan jatuh tempo, pencatatan pembayaran cicilan/pelunasan, dan riwayat mutasi piutang.
- **⚠️ Radar Peringatan Stok Menipis & Kulakan**: Monitor komoditas yang berada di bawah ambang batas minimum toko dengan tombol cepat kulakan.
- **📈 Laporan Penjualan & Ekspor Komprehensif**: Filter rentang tanggal fleksibel, 4 KPI finansial (Omzet, HPP/Modal, Laba Kotor, Margin %), Peringkat Produk Terlaris, Ekspor Excel (CSV UTF-8), dan Cetak Lembar Laporan A4 Resmi.
- **👥 Manajemen Akun Kasir & Reset PIN**: Pengelolaan kasir bertugas, pembuatan akun baru, reset PIN akses kasir, dan penonaktifan akun.
- **⚙️ Pengaturan Identitas Toko & Kustomisasi Struk**: Ubah nama toko, slogan, alamat kios pasar, kontak telepon/WA, catatan kaki struk, dan ganti PIN Owner dengan *Live Thermal Receipt Preview*.
- **📋 Audit Trail Forensik**: Catatan digital setiap tindakan sensitif kasir (pembatalan nota, susut timbangan, restock, perubahan harga, dan pergantian shift).

---

## 🛠️ Arsitektur Teknologi

- **Backend**: Node.js, Express.js, SQLite (WAL Mode), JWT Authentication, Bcrypt.
- **Frontend**: Vanilla JavaScript (ES Modules), Vanilla CSS (High Performance & Zero Slop Design System), Vite Development Server.
- **Keamanan**: Role-Based Access Control (`owner` vs `cashier`), Pin Hashing, Audit Logging, Blind Reconciliation.

---

## 🚀 Panduan Instalasi & Menjalankan Aplikasi

### 1. Prasyarat
- [Node.js](https://nodejs.org/) versi 18 atau lebih baru.
- Git.

### 2. Menjalankan Backend API (Port 4000)
```bash
cd backend
npm install
npm start
```
*API akan aktif di `http://localhost:4000` dengan database SQLite otomatis terinisialisasi.*

### 3. Menjalankan Frontend Kasir POS & Owner (Port 3000)
```bash
cd frontend-pos
npm install
npm run dev
```
*Aplikasi web akan dapat diakses di browser:*
Buka di browser atau tablet:
- **Kasir POS (Online)**: [https://kassa.konfigin.my.id/](https://kassa.konfigin.my.id/)
- **Owner Dashboard (Online)**: [https://kassa.konfigin.my.id/owner.html](https://kassa.konfigin.my.id/owner.html)

---

## 🔐 Akun Bawaan Sistem (Data Pengguna)

| Peran | Username | PIN Akses | Keterangan |
| :--- | :--- | :--- | :--- |
| **👑 Pemilik (Owner)** | `owner` | `123456` | Akses penuh dashboard eksekutif, margin laba, pengaturan toko, dan void |
| **👤 Kasir Pagi** | `kasir` | `654321` | Akses operasional kasir, input timbangan, kasbon, dan tutup shift |


---

## 📄 Lisensi
Hak Cipta © 2026 Kassa POS. Seluruh hak cipta dilindungi.
