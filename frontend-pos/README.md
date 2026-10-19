# Toko Umbi POS - Frontend Kasir (Tablet / Desktop Touchscreen)

Frontend aplikasi kasir khusus untuk toko hasil bumi dan umbi-umbian yang dirancang menggunakan standar **`premium-mobile-uiux`** dan filosofi **`anti-slop`**.

---

## 🎨 Prinsip Desain UI/UX yang Diterapkan

1. **Zero AI-Slop (Fokus Fungsi & Keterbacaan):**
   - Tidak ada gradien warna-warni yang mengalihkan fokus kasir.
   - Menggunakan palet warna netral yang tegas (*Slate 900, Slate 50, Emerald 600 untuk transaksi*).
   - Tipografi yang sangat mudah dibaca (*Inter* untuk label dan *JetBrains Mono* untuk timbangan & nominal uang).

2. **Thumb-Friendly Touch Targets ($\ge 44$px):**
   - Kartu produk besar dengan indikator stok visual (`🟢 Cukup` atau `🟡 Menipis`).
   - Tombol kuantiti timbangan `[-]` dan `[+]` serta input desimal kg yang presisi (misal: `2.75 kg`).
   - Tombol utama **"BAYAR SEKARANG"** setinggi 52px di pojok kanan bawah agar mudah dijangkau satu tangan.

3. **Status Semantik yang Tegas:**
   - Badge harga langsung menampilkan perbedaan **`ECERAN`** (abu-abu netral) vs **`GROSIR / RESELLER`** (hijau emerald).
   - Indikator Shift aktif dengan status dot pulsing hijau.

---

## ⚡ Fitur Utama

1. **Auto-Tiering Pricing Engine:**
   - Memilih produk otomatis menghitung harga eceran.
   - Jika kuantiti diubah menjadi $\ge 10$ kg (ambang grosir), sistem otomatis menurunkan harga ke harga reseller.
   - Jika dropdown pembeli diganti ke Reseller terdaftar (misal: *Warung Bu Siti*), seluruh item otomatis mendapat harga reseller tanpa syarat minimum.
2. **Kalkulator Pembayaran & Kembalian Cepat:**
   - Preset uang pas dan pecahan cepat (Rp 50rb, 100rb, 200rb).
   - Menghitung kembalian (*change due*) secara instan.
3. **Simulasi Cetak Struk Thermal 58mm/80mm:**
   - Desain struk kasir profesional dengan nomor nota, kasir yang bertugas, nama pembeli, rincian timbangan, dan total.
4. **Tutup Shift Kasir Buta (Blind Cash Drop):**
   - Kasir menginput lembaran uang fisik (Rp 100rb, 50rb, 20rb, 10rb, dan koin).
   - Kasir tidak diperlihatkan saldo sistem di layar form hitung fisik.
   - Selisih langsung dilaporkan dan dicatat ke log owner.
5. **Pencatatan Barang Susut / Busuk:**
   - Formulir cepat untuk mencatat umbi yang busuk/rusak dari karung baru agar stok tetap akurat.
6. **Otorisasi Void Transaksi:**
   - Pembatalan transaksi membutuhkan PIN Owner (123456) dan alasan pembatalan.

---

## 🚀 Cara Menjalankan

```bash
# Pastikan backend berjalan di port 4000:
cd F:\POS\backend
npm start

# Jalankan frontend POS di terminal terpisah:
cd F:\POS\frontend-pos
npm run dev
```

Buka di browser atau tablet:
- **Kasir POS (Online)**: **`https://kassa.konfigin.my.id/`**
- **Owner Dashboard (Online)**: **`https://kassa.konfigin.my.id/owner.html`**

### Kredensial Pengguna:
- **Kasir:** PIN `654321` (Kasir Pagi - Budi)
- **Owner:** PIN `123456` (Pak Haji - Owner)

