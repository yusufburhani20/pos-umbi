#!/usr/bin/env bash
# ==============================================================================
#           PANEL KONTROL VENDOR & OPERASIONAL POS UMBI (INTERAKTIF)
# ==============================================================================
# Script ini menyediakan menu interaktif di terminal untuk:
# 1. Cek & Kelola Lisensi Langganan Klien (Extend, Lock, Unlock, Ganti Rekening)
# 2. Simulasi Status Jatuh Tempo & Blokir
# 3. Pengosongan Data Transaksi (Clean Reset untuk Klien Baru)
# 4. Backup & Pemulihan (Restore) Database
# ==============================================================================

# Lokasi direktori proyek absolut
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# Definisi Warna Terminal
BOLD='\033[1m'
DIM='\033[2m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
RESET='\033[0m'

# Helper: Tunggu tombol enter
pause() {
    echo ""
    echo -e "${DIM}Tekan [Enter] untuk kembali ke menu...${RESET}"
    read -r _
}

# Header Menu
print_header() {
    clear 2>/dev/null || true
    echo -e "${CYAN}${BOLD}================================================================================"
    echo -e "       💎 PANEL KONTROL VENDOR - KASSA POS (PD. HASIL BUMI RAYA 1)"
    echo -e "================================================================================${RESET}"
    echo -e "${DIM}Direktori Proyek: $SCRIPT_DIR${RESET}"
    echo ""
}

# 1. Cek Status
do_status() {
    print_header
    echo -e "${BOLD}${BLUE}▶ MENGECEK STATUS LISENSI & REKENING SAAT INI...${RESET}"
    node "$SCRIPT_DIR/backend/manage_license.js" --status
    pause
}

# 2. Perpanjang Masa Aktif
do_extend() {
    print_header
    echo -e "${BOLD}${GREEN}▶ PERPANJANG MASA AKTIF LANGGANAN${RESET}"
    echo "Pilih durasi perpanjangan:"
    echo -e "  ${BOLD}[1]${RESET} +30 Hari  (1 Bulan)"
    echo -e "  ${BOLD}[2]${RESET} +60 Hari  (2 Bulan)"
    echo -e "  ${BOLD}[3]${RESET} +90 Hari  (3 Bulan)"
    echo -e "  ${BOLD}[4]${RESET} +180 Hari (6 Bulan)"
    echo -e "  ${BOLD}[5]${RESET} +365 Hari (1 Tahun)"
    echo -e "  ${BOLD}[6]${RESET} Kustom (Input jumlah hari manual)"
    echo -e "  ${BOLD}[0]${RESET} Batal"
    echo ""
    read -r -p "Pilihan Anda [1-6 / 0]: " ext_choice

    local days=0
    case "$ext_choice" in
        1) days=30 ;;
        2) days=60 ;;
        3) days=90 ;;
        4) days=180 ;;
        5) days=365 ;;
        6)
            read -r -p "Masukkan jumlah hari tambahan (misal: 45): " custom_days
            if [[ "$custom_days" =~ ^[0-9]+$ ]] && [ "$custom_days" -gt 0 ]; then
                days=$custom_days
            else
                echo -e "${RED}Jumlah hari tidak valid.${RESET}"
                pause
                return
            fi
            ;;
        0) return ;;
        *) echo -e "${RED}Pilihan tidak valid.${RESET}"; pause; return ;;
    esac

    echo ""
    echo -e "${CYAN}Memproses perpanjangan +$days hari...${RESET}"
    node "$SCRIPT_DIR/backend/manage_license.js" --extend "$days"
    pause
}

# 3. Setel Tanggal Jatuh Tempo Spesifik
do_set_due() {
    print_header
    echo -e "${BOLD}${YELLOW}▶ SETEL TANGGAL JATUH TEMPO SPESIFIK${RESET}"
    echo "Contoh format: 2026-12-31 (Tahun-Bulan-Tanggal)"
    echo ""
    read -r -p "Masukkan tanggal jatuh tempo baru: " due_input

    if [[ ! "$due_input" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        echo -e "${RED}Format tanggal salah! Gunakan format YYYY-MM-DD.${RESET}"
        pause
        return
    fi

    echo ""
    node "$SCRIPT_DIR/backend/manage_license.js" --set-due "$due_input"
    pause
}

# 4. Mode Peringatan (TIDAK Mengunci)
do_warn() {
    print_header
    echo -e "${BOLD}${YELLOW}================================================================================"
    echo -e "       ⚠️  SETEL MODE POP-UP PERINGATAN (TIDAK MENGUNCI)"
    echo -e "================================================================================${RESET}"
    echo -e "Karakteristik Mode Ini:"
    echo -e "  ✔ Pop-up tagihan pembayaran AKAN MUNCUL di layar Kasir dan Owner."
    echo -e "  ✔ ${GREEN}${BOLD}TIDAK MENGUNCI:${RESET} Klien masih dapat mengklik tombol ${BOLD}'Nanti Saja'${RESET} atau ${BOLD}'✕'${RESET}."
    echo -e "  ✔ Kasir tetap bisa melayani pelanggan dan mencetak nota seperti biasa."
    echo -e "  ✔ Sangat cocok sebagai pengingat tagihan awal sebelum tanggal jatuh tempo."
    echo ""
    read -r -p "Aktifkan Mode Peringatan (Tidak Mengunci) sekarang? (y/N): " confirm_warn

    if [[ "$confirm_warn" == "y" || "$confirm_warn" == "Y" ]]; then
        echo ""
        node "$SCRIPT_DIR/backend/manage_license.js" --warn
    else
        echo -e "${DIM}Aksi dibatalkan.${RESET}"
    fi
    pause
}

# 5. Mode Terkunci (MENGUNCI TOTAL)
do_lock() {
    print_header
    echo -e "${BOLD}${RED}================================================================================"
    echo -e "       🔒 SETEL MODE POP-UP TERKUNCI (MENGUNCI TOTAL)"
    echo -e "================================================================================${RESET}"
    echo -e "Karakteristik Mode Ini:"
    echo -e "  ⛔ ${RED}${BOLD}MENGUNCI TOTAL (HARD LOCKDOWN):${RESET} Layar Kasir dan Owner diblokir penuh."
    echo -e "  ⛔ Pop-up TIDAK BISA ditutup (tombol close '✕' dan 'Nanti Saja' disembunyikan)."
    echo -e "  ⛔ Tombol transaksi belanja kasir dinonaktifkan sampai pembayaran diselesaikan."
    echo -e "  ✔ Sangat cocok jika klien menunggak lewat batas waktu toleransi."
    echo ""
    read -r -p "Aktifkan Mode Terkunci (Mengunci Total) sekarang? (y/N): " confirm_lock

    if [[ "$confirm_lock" == "y" || "$confirm_lock" == "Y" ]]; then
        echo ""
        node "$SCRIPT_DIR/backend/manage_license.js" --lock
    else
        echo -e "${DIM}Aksi dibatalkan.${RESET}"
    fi
    pause
}

# 6. Mode Normal / Buka Kunci (BEBAS POP-UP)
do_unlock() {
    print_header
    echo -e "${BOLD}${GREEN}================================================================================"
    echo -e "       🔓 SETEL MODE NORMAL / BUKA KUNCI (BEBAS POP-UP)"
    echo -e "================================================================================${RESET}"
    echo -e "Karakteristik Mode Ini:"
    echo -e "  ✔ Menghilangkan semua pop-up peringatan maupun pemblokiran."
    echo -e "  ✔ Mengembalikan status aplikasi ke Aktif Normal."
    echo -e "  ✔ Jika tanggal jatuh tempo sudah lewat, otomatis ditambahkan masa aktif 30 hari."
    echo ""
    node "$SCRIPT_DIR/backend/manage_license.js" --unlock
    pause
}

# 6. Ganti Rekening Vendor
do_set_bank() {
    print_header
    echo -e "${BOLD}${CYAN}▶ UBAH DETAIL REKENING TUJUAN & BIAYA LANGGANAN${RESET}"
    echo "Masukkan informasi rekening vendor tempat klien mentransfer biaya:"
    echo ""

    read -r -p "Nama Bank [contoh: BCA / Mandiri / BRI / BNI]: " v_bank
    if [ -z "$v_bank" ]; then echo -e "${RED}Nama Bank tidak boleh kosong.${RESET}"; pause; return; fi

    read -r -p "Nomor Rekening [contoh: 883-123-4567]: " v_acc
    if [ -z "$v_acc" ]; then echo -e "${RED}Nomor Rekening tidak boleh kosong.${RESET}"; pause; return; fi

    read -r -p "Nama Pemilik Rekening (Atas Nama) [contoh: YUSUF BURHANI]: " v_holder
    if [ -z "$v_holder" ]; then echo -e "${RED}Nama Pemilik tidak boleh kosong.${RESET}"; pause; return; fi

    read -r -p "Nominal Biaya per Bulan (Rp) [default: 150000]: " v_amount
    v_amount="${v_amount:-150000}"

    read -r -p "Nomor WhatsApp Vendor [contoh: 0812-3456-7890]: " v_wa
    v_wa="${v_wa:-0812-3456-7890}"

    echo ""
    echo -e "${CYAN}Menyimpan detail rekening baru...${RESET}"
    node "$SCRIPT_DIR/backend/manage_license.js" --set-bank "$v_bank" "$v_acc" "$v_holder" "$v_amount" "$v_wa"
    pause
}

# 7. Menu Simulasi
do_simulate() {
    while true; do
        print_header
        echo -e "${BOLD}${MAGENTA}▶ MENU SIMULASI PENGUJIAN SISTEM LISENSI${RESET}"
        echo -e "Gunakan opsi ini untuk mendemokan atau menguji pop-up di layar kasir & owner:"
        echo ""
        echo -e "  ${BOLD}[1]${RESET} Simulasi Telat Bayar (Jatuh tempo -5 hari lalu -> Terkunci Total / Pop-up Merah)"
        echo -e "  ${BOLD}[2]${RESET} Simulasi Peringatan Mendekati Jatuh Tempo (Sisa 2 hari -> Pop-up Kuning/Amber)"
        echo -e "  ${BOLD}[3]${RESET} Kembalikan ke Normal (+30 Hari Aktif)"
        echo -e "  ${BOLD}[0]${RESET} Kembali ke Menu Utama"
        echo ""
        read -r -p "Pilihan Anda [1-3 / 0]: " sim_choice

        case "$sim_choice" in
            1)
                echo ""
                node "$SCRIPT_DIR/backend/manage_license.js" --simulate-overdue
                pause
                ;;
            2)
                echo ""
                node "$SCRIPT_DIR/backend/manage_license.js" --simulate-warning
                pause
                ;;
            3)
                echo ""
                node "$SCRIPT_DIR/backend/manage_license.js" --unlock
                pause
                ;;
            0) break ;;
            *) echo -e "${RED}Pilihan tidak valid.${RESET}"; pause ;;
        esac
    done
}

# 8. Reset Data Transaksi
do_reset_transactions() {
    print_header
    echo -e "${BOLD}${RED}================================================================================"
    echo -e "             PENGOSONGAN DATA TRANSAKSI TOKO (CLEAN RESET)"
    echo -e "================================================================================${RESET}"
    echo -e "${YELLOW}Perhatian Penting:"
    echo -e "- Tindakan ini MENGOSONGKAN seluruh riwayat nota kasir, hutang/piutang, kas, & kulakan."
    echo -e "- DATA YANG AMAN (TIDAK AKAN HILANG): Master Barang, Harga, Akun Login, & Toko."
    echo -e "- File backup SQLite otomatis dibuat sebelum penghapusan dilakukan.${RESET}"
    echo ""
    echo -e "  ${BOLD}[1]${RESET} Mode Aman: Lihat Preview Jumlah Data yang Akan Dihapus (Tanpa Hapus)"
    echo -e "  ${BOLD}[2]${RESET} ${RED}${BOLD}EKSEKUSI PENGOSONGAN DATA TRANSAKSI SEKARANG${RESET}"
    echo -e "  ${BOLD}[0]${RESET} Batal / Kembali"
    echo ""
    read -r -p "Pilihan Anda [1-2 / 0]: " reset_choice

    case "$reset_choice" in
        1)
            echo ""
            node "$SCRIPT_DIR/backend/reset_transactions.js"
            pause
            ;;
        2)
            echo ""
            echo -e "${RED}${BOLD}KONFIRMASI TERAKHIR:${RESET}"
            echo -e "Ketik kata ${BOLD}'HAPUS'${RESET} dengan huruf kapital jika Anda benar-benar yakin:"
            read -r -p "Konfirmasi: " conf_word
            if [ "$conf_word" == "HAPUS" ]; then
                echo ""
                node "$SCRIPT_DIR/backend/reset_transactions.js" --confirm
            else
                echo -e "${YELLOW}Kata kunci salah. Penghapusan dibatalkan demi keamanan.${RESET}"
            fi
            pause
            ;;
        0) return ;;
        *) echo -e "${RED}Pilihan tidak valid.${RESET}"; pause; return ;;
    esac
}

# 9. Backup Database
do_backup() {
    print_header
    echo -e "${BOLD}${GREEN}▶ MEMBUAT CADANGAN (BACKUP) DATABASE LENGKAP${RESET}"
    echo "Memproses atomic backup dengan WAL Checkpoint & VACUUM INTO..."
    echo ""
    node "$SCRIPT_DIR/backend/backup_database.js"
    pause
}

# 10. List File Backup
do_list_backups() {
    print_header
    echo -e "${BOLD}${BLUE}▶ DAFTAR FILE CADANGAN DATABASE (FOLDER: backups/)${RESET}"
    node "$SCRIPT_DIR/backend/backup_database.js" --list
    pause
}

# 11. Restore Database
do_restore() {
    print_header
    echo -e "${BOLD}${RED}▶ PEMULIHAN (RESTORE) DATABASE DARI CADANGAN${RESET}"
    echo -e "${YELLOW}Perhatian: Database yang sedang berjalan akan digantikan dengan berkas backup."
    echo -e "Sistem akan otomatis membuat file penyelamat (rescue backup) sebelum menimpa.${RESET}"
    echo ""
    
    # Ambil daftar file backup
    local backup_files=()
    if [ -d "$SCRIPT_DIR/backups" ]; then
        while IFS= read -r f; do
            [ -n "$f" ] && backup_files+=("$f")
        done < <(ls -1t "$SCRIPT_DIR/backups"/*.db 2>/dev/null | xargs -n1 basename 2>/dev/null)
    fi

    if [ ${#backup_files[@]} -eq 0 ]; then
        echo -e "${YELLOW}Belum ada file backup di folder backups/. Buat backup terlebih dahulu.${RESET}"
        pause
        return
    fi

    echo "Pilih berkas backup yang ingin dipulihkan:"
    for i in "${!backup_files[@]}"; do
        local num=$((i + 1))
        echo -e "  ${BOLD}[$num]${RESET} ${backup_files[$i]}"
    done
    echo -e "  ${BOLD}[0]${RESET} Batal"
    echo ""

    read -r -p "Masukkan nomor file [1-${#backup_files[@]} / 0]: " sel_num

    if [ "$sel_num" == "0" ] || [ -z "$sel_num" ]; then
        return
    fi

    if [[ "$sel_num" =~ ^[0-9]+$ ]] && [ "$sel_num" -ge 1 ] && [ "$sel_num" -le "${#backup_files[@]}" ]; then
        local target_file="${backup_files[$((sel_num - 1))]}"
        echo ""
        echo -e "Anda memilih: ${BOLD}$target_file${RESET}"
        read -r -p "Yakin ingin memulihkan database ke versi ini? (y/N): " conf_rest
        if [[ "$conf_rest" == "y" || "$conf_rest" == "Y" ]]; then
            echo ""
            node "$SCRIPT_DIR/backend/backup_database.js" --restore "$target_file"
        else
            echo -e "${DIM}Pemulihan dibatalkan.${RESET}"
        fi
    else
        echo -e "${RED}Nomor pilihan tidak valid.${RESET}"
    fi
    pause
}

# 13. Cek Integritas Database SQLite
do_db_check() {
    print_header
    echo -e "${BOLD}${CYAN}▶ CEK KESEHATAN & INTEGRITAS DATABASE SQLITE${RESET}"
    echo ""
    node -e "
    const sqlite3 = require('$SCRIPT_DIR/backend/node_modules/sqlite3').verbose();
    const db = new sqlite3.Database('$SCRIPT_DIR/backend/pos_umbi.db');
    db.get('PRAGMA integrity_check;', (err, row) => {
      console.log('1. Integritas File DB    :', row ? row.integrity_check : err?.message);
      db.all('PRAGMA foreign_key_check;', (e, fks) => {
        console.log('2. Foreign Key Check     :', fks ? (fks.length === 0 ? '0 Pelanggaran (Bersih 100%)' : fks.length + ' Isu ditemukan') : e?.message);
        db.get('SELECT COUNT(*) as neg FROM products WHERE stock_qty < 0', (e, r) => {
          console.log('3. Produk Stok Negatif   :', r ? r.neg : 'N/A');
          db.get('SELECT COUNT(*) as ord FROM orders', (e, r2) => {
            console.log('4. Total Transaksi       :', r2 ? r2.ord + ' nota' : 'N/A');
            db.get('SELECT COUNT(*) as sh FROM shifts WHERE status = \"open\"', (e, r3) => {
              console.log('5. Shift Kasir Terbuka   :', r3 ? r3.sh : 'N/A');
              db.close();
            });
          });
        });
      });
    });
    "
    pause
}

# 14. Status PM2 & Log
do_pm2_status() {
    print_header
    echo -e "${BOLD}${BLUE}▶ STATUS PROSES PM2 & LOG KASSA POS${RESET}"
    echo ""
    if command -v pm2 >/dev/null 2>&1; then
        pm2 status kassa-pos || pm2 status
        echo ""
        echo -e "${CYAN}20 Baris Log Terakhir:${RESET}"
        pm2 logs kassa-pos --lines 20 --nostream 2>/dev/null || true
    else
        echo -e "${YELLOW}PM2 tidak terdeteksi di lingkungan lokal ini (atau belum masuk PATH).${RESET}"
    fi
    pause
}

# 15. Build Frontend & Reload
do_build_frontend() {
    print_header
    echo -e "${BOLD}${GREEN}▶ BUILD ULANG & DEPLOY FRONTEND PWA${RESET}"
    echo "Memproses Vite build di frontend-pos..."
    echo ""
    if [ -d "$SCRIPT_DIR/frontend-pos" ]; then
        cd "$SCRIPT_DIR/frontend-pos" || return
        npm run build
        cd "$SCRIPT_DIR" || return
        if [ -d "/www/wwwroot/kassa.konfigin.my.id" ]; then
            echo -e "${CYAN}Menyalin dist ke webroot produksi...${RESET}"
            cp -rf "$SCRIPT_DIR/frontend-pos/dist/"* /www/wwwroot/kassa.konfigin.my.id/
            cp -f "$SCRIPT_DIR/frontend-pos/public/sw.js" /www/wwwroot/kassa.konfigin.my.id/
            chown -R www:www /www/wwwroot/kassa.konfigin.my.id/ 2>/dev/null || true
            echo -e "${GREEN}Deploy webroot selesai.${RESET}"
            if command -v nginx >/dev/null 2>&1; then
                nginx -s reload 2>/dev/null && echo "Nginx reloaded."
            fi
            if command -v pm2 >/dev/null 2>&1; then
                pm2 restart kassa-pos 2>/dev/null && echo "PM2 restarted."
            fi
        fi
    else
        echo -e "${RED}Folder frontend-pos tidak ditemukan.${RESET}"
    fi
    pause
}

# ==============================================================================
#                               LOOP MENU UTAMA
# ==============================================================================
while true; do
    print_header
    echo -e "${BOLD}PILIH MENU OPERASIONAL:${RESET}"
    echo ""
    echo -e "  ${CYAN}${BOLD}[ 1]${RESET} 📊 Cek Status Masa Aktif & Rekening Saat Ini"
    echo -e "  ${GREEN}${BOLD}[ 2]${RESET} ➕ Perpanjang Masa Aktif (+30, +90, +365 Hari, dst.)"
    echo -e "  ${YELLOW}${BOLD}[ 3]${RESET} 📅 Setel Tanggal Jatuh Tempo Tertentu (YYYY-MM-DD)"
    echo ""
    echo -e "  ${YELLOW}${BOLD}[ 4]${RESET} ⚠️  Setel Mode Peringatan  ${DIM}➔${RESET} ${GREEN}${BOLD}TIDAK MENGUNCI${RESET} ${DIM}(Ada tombol 'Nanti Saja')${RESET}"
    echo -e "  ${RED}${BOLD}[ 5]${RESET} 🔒 Setel Mode Terkunci    ${DIM}➔${RESET} ${RED}${BOLD}MENGUNCI TOTAL${RESET} ${DIM}(Layar kasir & owner diblokir)${RESET}"
    echo -e "  ${GREEN}${BOLD}[ 6]${RESET} 🔓 Setel Mode Normal/Aktif ${DIM}➔${RESET} ${CYAN}${BOLD}BEBAS POP-UP${RESET}   ${DIM}(Buka kunci / normal kembali)${RESET}"
    echo ""
    echo -e "  ${BLUE}${BOLD}[ 7]${RESET} 🏦 Ubah Rekening Bank Vendor, Nominal, & No. WhatsApp"
    echo -e "  ${MAGENTA}${BOLD}[ 8]${RESET} ⚡ Simulasi Pengujian (Demo Overdue / Warning)"
    echo -e "  ${RED}${BOLD}[ 9]${RESET} 🧹 Kosongkan Data Transaksi Toko (Clean Reset Klien Baru)"
    echo ""
    echo -e "  ${CYAN}${BOLD}[10]${RESET} 💾 Buat Cadangan (Backup) Database Sekarang"
    echo -e "  ${BLUE}${BOLD}[11]${RESET} 📋 Lihat Daftar File Cadangan (Folder backups/)"
    echo -e "  ${RED}${BOLD}[12]${RESET} 🔄 Pulihkan (Restore) Database dari Berkas Cadangan"
    echo ""
    echo -e "  ${CYAN}${BOLD}[13]${RESET} 🩺 Cek Kesehatan & Integritas Database SQLite"
    echo -e "  ${BLUE}${BOLD}[14]${RESET} 🛠️  Cek Status Service PM2 & Error Log"
    echo -e "  ${GREEN}${BOLD}[15]${RESET} 🚀 Kompilasi (Build) & Deploy Frontend PWA"
    echo ""
    echo -e "  ${DIM}[ 0] ❌ Keluar / Tutup Menu${RESET}"
    echo ""
    read -r -p "Masukkan Nomor Pilihan [0-15]: " main_choice

    case "$main_choice" in
        1) do_status ;;
        2) do_extend ;;
        3) do_set_due ;;
        4) do_warn ;;
        5) do_lock ;;
        6) do_unlock ;;
        7) do_set_bank ;;
        8) do_simulate ;;
        9) do_reset_transactions ;;
        10) do_backup ;;
        11) do_list_backups ;;
        12) do_restore ;;
        13) do_db_check ;;
        14) do_pm2_status ;;
        15) do_build_frontend ;;
        0|q|exit)
            clear 2>/dev/null || true
            echo -e "${GREEN}Terima kasih. Program menu vendor ditutup.${RESET}\n"
            exit 0
            ;;
        *)
            echo -e "${RED}Pilihan tidak dikenali. Silakan masukkan angka 0 s/d 15.${RESET}"
            pause
            ;;
    esac
done
