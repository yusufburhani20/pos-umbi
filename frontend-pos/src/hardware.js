// Hardware Integration Module for Toko Umbi POS
// Supports:
// 1. Android Tablet (Xiaomi Redmi Pad SE / Chrome Android PWA)
// 2. Bluetooth Thermal Printer (Panda PRJ-58D / PRJ-80D / ESC-POS BLE & SPP)
// 3. Cash Drawer (Panda RJ-11 Drawer Kick via ESC/POS pulse)

// Standard ESC/POS bytes
const ESC = 0x1b;
const GS = 0x1d;

const COMMANDS = {
  INIT: [ESC, 0x40], // ESC @ - Reset / initialize
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT_ON: [ESC, 0x21, 0x10],
  DOUBLE_WIDTH_ON: [ESC, 0x21, 0x20],
  DOUBLE_SIZE_ON: [ESC, 0x21, 0x30], // Double width & height for Store Title
  NORMAL_TEXT: [ESC, 0x21, 0x00],
  LINE_FEED: [0x0a],
  // Panda Cash Drawer Kick (Sends 24V pulse to RJ-11 pin 2 and pin 5)
  // ESC p 0 25 250 (Pin 2) + ESC p 1 25 250 (Pin 5)
  DRAWER_KICK: [ESC, 0x70, 0x00, 0x19, 0xfa, ESC, 0x70, 0x01, 0x19, 0xfa],
  // Paper Feed & Partial Cut
  FEED_AND_CUT: [0x0a, 0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00]
};

// Known BLE Primary Services & Characteristics for Thermal Printers (Panda, RPP, MPT, Feasycom, etc.)
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Print Service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART (common in Panda PRJ-58)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000ff00-0000-1000-8000-00805f9b34fb', // Feasycom module
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 BLE UART
  '0000fee7-0000-1000-8000-00805f9b34fb'
];

class HardwareManager {
  constructor() {
    this.config = this.loadConfig();
    this.bluetoothDevice = null;
    this.gattServer = null;
    this.characteristic = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.stateListeners = new Set();
  }

  loadConfig() {
    return {
      mode: localStorage.getItem('pos_printer_mode') || 'bluetooth', // 'bluetooth', 'rawbt', 'system'
      paperSize: localStorage.getItem('pos_paper_size') || '58mm', // '58mm' (32 cols), '80mm' (48 cols)
      autoDrawer: localStorage.getItem('pos_auto_drawer') !== 'false', // default true
      lastDeviceName: localStorage.getItem('pos_last_bt_device') || null
    };
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem('pos_printer_mode', this.config.mode);
    localStorage.setItem('pos_paper_size', this.config.paperSize);
    localStorage.setItem('pos_auto_drawer', this.config.autoDrawer);
    if (this.config.lastDeviceName) {
      localStorage.setItem('pos_last_bt_device', this.config.lastDeviceName);
    }
    this.notifyState();
  }

  subscribeState(listener) {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => this.stateListeners.delete(listener);
  }

  notifyState() {
    const s = this.getState();
    this.stateListeners.forEach(fn => {
      try {
        fn(s);
      } catch (e) {
        console.error('[Hardware] Listener error:', e);
      }
    });
  }

  getState() {
    return {
      isSupported: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      deviceName: this.bluetoothDevice ? this.bluetoothDevice.name || 'Printer Thermal' : this.config.lastDeviceName,
      config: { ...this.config }
    };
  }

  // --- Bluetooth Connection ---
  async connectBluetooth() {
    if (!('bluetooth' in navigator)) {
      throw new Error('Web Bluetooth tidak didukung di browser ini. Pastikan menggunakan Google Chrome di Android (Redmi Pad SE).');
    }

    this.isConnecting = true;
    this.notifyState();

    try {
      console.log('[Hardware] Requesting Bluetooth device...');
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICES
      });

      this.bluetoothDevice = device;
      this.bluetoothDevice.addEventListener('gattserverdisconnected', () => {
        console.warn('[Hardware] Printer Bluetooth terputus');
        this.isConnected = false;
        this.characteristic = null;
        this.notifyState();
      });

      console.log(`[Hardware] Menghubungkan ke ${device.name || 'Printer Thermal'}...`);
      const server = await device.gatt.connect();
      this.gattServer = server;

      // Find writable characteristic in known services
      let targetChar = null;
      for (const serviceUuid of PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              targetChar = c;
              console.log(`[Hardware] Characteristic printer ditemukan pada service ${serviceUuid}`);
              break;
            }
          }
          if (targetChar) break;
        } catch {
          // Continue searching other services
        }
      }

      // If not in known services, inspect all services available
      if (!targetChar) {
        try {
          const services = await server.getPrimaryServices();
          for (const service of services) {
            try {
              const chars = await service.getCharacteristics();
              for (const c of chars) {
                if (c.properties.write || c.properties.writeWithoutResponse) {
                  targetChar = c;
                  console.log(`[Hardware] Characteristic alternatif ditemukan pada ${service.uuid}`);
                  break;
                }
              }
              if (targetChar) break;
            } catch {
              // Ignore service access error
            }
          }
        } catch (e) {
          console.warn('[Hardware] Gagal auto-discover services:', e);
        }
      }

      if (!targetChar) {
        throw new Error('Gagal menemukan jalur cetak (write characteristic) pada perangkat ini. Pastikan printer dalam mode Bluetooth aktif.');
      }

      this.characteristic = targetChar;
      this.isConnected = true;
      this.isConnecting = false;
      this.saveConfig({ lastDeviceName: device.name || 'Printer Thermal' });
      this.notifyState();
      return { success: true, deviceName: device.name || 'Printer Thermal' };
    } catch (err) {
      this.isConnected = false;
      this.isConnecting = false;
      this.notifyState();
      throw err;
    }
  }

  async disconnectBluetooth() {
    if (this.bluetoothDevice && this.bluetoothDevice.gatt.connected) {
      this.bluetoothDevice.gatt.disconnect();
    }
    this.isConnected = false;
    this.characteristic = null;
    this.bluetoothDevice = null;
    this.notifyState();
  }

  // Send raw bytes to Bluetooth in safe BLE chunks (max 100 bytes chunk)
  async sendBluetoothBytes(bytes) {
    if (!this.isConnected || !this.characteristic) {
      throw new Error('Printer Bluetooth belum terhubung. Silakan hubungkan printer terlebih dahulu.');
    }

    const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const chunkSize = 100; // Safe for BLE MTU

    for (let i = 0; i < uint8.length; i += chunkSize) {
      const chunk = uint8.slice(i, i + chunkSize);
      if (this.characteristic.properties.writeWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
      // Brief pause between BLE packets to prevent printer buffer overflow
      await new Promise(r => setTimeout(r, 15));
    }
  }

  // --- Cash Drawer RJ-11 Kick ---
  async kickCashDrawer() {
    console.log('[Hardware] Triggering Panda Cash Drawer RJ-11 Kick...');
    const drawerBytes = new Uint8Array(COMMANDS.DRAWER_KICK);

    if (this.config.mode === 'bluetooth') {
      if (this.isConnected) {
        await this.sendBluetoothBytes(drawerBytes);
        return { success: true, method: 'bluetooth' };
      } else {
        // Fallback to RawBT if bluetooth not actively connected
        this.sendRawBT(drawerBytes);
        return { success: true, method: 'rawbt_fallback' };
      }
    } else if (this.config.mode === 'rawbt') {
      this.sendRawBT(drawerBytes);
      return { success: true, method: 'rawbt' };
    } else {
      // System print cannot directly kick drawer, warn user
      console.warn('[Hardware] Mode System Print tidak mendukung sinyal laci fisik. Gunakan mode Bluetooth atau RawBT.');
      return { success: false, message: 'Gunakan mode Bluetooth / RawBT untuk membuka laci otomatis.' };
    }
  }

  // Send data via RawBT Android App (Intent)
  sendRawBT(bytes) {
    const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let binary = '';
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64Data = btoa(binary);

    // Intent URL scheme for RawBT Android Print Service
    const intentUrl = `intent:base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
    window.location.href = intentUrl;
  }

  // --- ESC/POS Receipt Formatter ---
  buildReceiptBytes(order, settings, isReprint = false) {
    const is80mm = this.config.paperSize === '80mm';
    const maxCols = is80mm ? 48 : 32;
    const divider = '-'.repeat(maxCols);

    const encoder = new TextEncoder();
    const byteChunks = [];

    const append = (bytes) => {
      if (Array.isArray(bytes)) byteChunks.push(new Uint8Array(bytes));
      else if (bytes instanceof Uint8Array) byteChunks.push(bytes);
      else if (typeof bytes === 'string') byteChunks.push(encoder.encode(bytes));
    };

    // Helper: format two-column row (left text, right text)
    const formatRow = (left, right) => {
      const leftStr = String(left || '');
      const rightStr = String(right || '');
      const space = maxCols - leftStr.length - rightStr.length;
      if (space >= 0) {
        return leftStr + ' '.repeat(space) + rightStr + '\n';
      } else {
        // If left is too long, wrap it
        return leftStr + '\n' + ' '.repeat(Math.max(0, maxCols - rightStr.length)) + rightStr + '\n';
      }
    };

    // Helper: format Rupiah
    const formatRp = (num) => 'Rp ' + Number(num || 0).toLocaleString('id-ID');

    // 1. Initialize
    append(COMMANDS.INIT);

    // 2. Header (Store Title Double Size, Centered)
    append(COMMANDS.ALIGN_CENTER);
    append(COMMANDS.DOUBLE_SIZE_ON);
    append(COMMANDS.BOLD_ON);
    append((settings.store_name || 'PD. HASIL BUMI RAYA 1') + '\n');
    append(COMMANDS.NORMAL_TEXT);
    append(COMMANDS.BOLD_OFF);

    append((settings.store_tagline || 'Pusat Umbi, Bawang & Komoditas') + '\n');
    if (settings.store_address) append(settings.store_address + '\n');
    if (settings.store_phone) append('Telp/WA: ' + settings.store_phone + '\n');

    if (isReprint) {
      append(COMMANDS.BOLD_ON);
      append('*** SALINAN / CETAK ULANG ***\n');
      append(COMMANDS.BOLD_OFF);
    }

    if (order.payment_method === 'tempo') {
      append(COMMANDS.BOLD_ON);
      append('*** NOTA KASBON / TEMPO ***\n');
      append('STATUS: BELUM LUNAS\n');
      append(COMMANDS.BOLD_OFF);
    }

    // 3. Meta Data
    append(COMMANDS.ALIGN_LEFT);
    append(divider + '\n');
    append(formatRow('No. Nota:', order.order_no));
    append(formatRow('Waktu   :', new Date(order.created_at || Date.now()).toLocaleString('id-ID')));
    append(formatRow('Kasir   :', order.cashier_name || 'Kasir'));
    append(formatRow('Pembeli :', (order.customer_name || 'Pelanggan Umum') + (order.customer_phone ? ` (${order.customer_phone})` : '')));
    if (order.due_date) {
      append(formatRow('Jatuh Tempo:', order.due_date));
    }
    append(divider + '\n');

    // 4. Line Items
    (order.items || []).forEach(item => {
      const formattedQty = Number(item.qty).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
      const formattedPrice = Number(item.unit_price).toLocaleString('id-ID');
      const subtotalStr = formatRp(item.subtotal);

      // Line 1: Item name
      append(item.product_name + '\n');
      // Line 2: Qty x Unit Price -> Subtotal
      const qtyPrice = `  ${formattedQty} kg @${formattedPrice}`;
      append(formatRow(qtyPrice, subtotalStr));
    });

    // 5. Total & Payments
    append(divider + '\n');
    append(COMMANDS.BOLD_ON);
    append(formatRow('TOTAL TAGIHAN', formatRp(order.total_amount)));
    append(COMMANDS.BOLD_OFF);

    if (order.payment_method === 'tempo') {
      append(formatRow('Uang Muka (DP)', formatRp(order.cash_tendered || 0)));
      append(COMMANDS.BOLD_ON);
      const remaining = Math.max(0, Number(order.total_amount) - Number(order.cash_tendered || 0));
      append(formatRow('SISA KASBON', formatRp(remaining)));
      append(COMMANDS.BOLD_OFF);
    } else {
      append(formatRow(`Bayar (${(order.payment_method || 'CASH').toUpperCase()})`, formatRp(order.cash_tendered)));
      append(formatRow('Kembali', formatRp(order.change_due)));
    }

    // 6. Footer Notes
    append(divider + '\n');
    append(COMMANDS.ALIGN_CENTER);
    const footerText = settings.receipt_footer || 'Terima kasih atas kunjungan Anda!\nBarang yang sudah ditimbang tidak dapat ditukar.';
    footerText.split('\n').forEach(line => {
      append(line + '\n');
    });

    // 7. Paper Feed & Cut
    append(COMMANDS.FEED_AND_CUT);

    // Merge all chunks into single Uint8Array
    let totalLen = 0;
    byteChunks.forEach(c => (totalLen += c.length));
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    byteChunks.forEach(c => {
      merged.set(c, offset);
      offset += c.length;
    });

    return merged;
  }

  // --- Print Test Receipt ---
  buildTestReceiptBytes() {
    const is80mm = this.config.paperSize === '80mm';
    const maxCols = is80mm ? 48 : 32;
    const divider = '='.repeat(maxCols);

    const encoder = new TextEncoder();
    const byteChunks = [];
    const append = (b) => {
      if (Array.isArray(b)) byteChunks.push(new Uint8Array(b));
      else if (b instanceof Uint8Array) byteChunks.push(b);
      else if (typeof b === 'string') byteChunks.push(encoder.encode(b));
    };

    append(COMMANDS.INIT);
    append(COMMANDS.ALIGN_CENTER);
    append(COMMANDS.DOUBLE_SIZE_ON);
    append(COMMANDS.BOLD_ON);
    append('THERMAL PRINTER TEST\n');
    append(COMMANDS.NORMAL_TEXT);
    append(COMMANDS.BOLD_OFF);
    append('Toko Umbi POS System\n');
    append('Hardware Ready: Tablet & Cash Drawer\n');
    append(divider + '\n');
    append(COMMANDS.ALIGN_LEFT);
    append(`Mode   : ${this.config.mode.toUpperCase()}\n`);
    append(`Kertas : ${this.config.paperSize}\n`);
    append(`Laci   : ${this.config.autoDrawer ? 'Otomatis Buka' : 'Manual'}\n`);
    append(`Waktu  : ${new Date().toLocaleString('id-ID')}\n`);
    append(divider + '\n');
    append(COMMANDS.ALIGN_CENTER);
    append('*** PRINTER & LACI SIAP DIGUNAKAN ***\n');
    append(COMMANDS.FEED_AND_CUT);

    let totalLen = 0;
    byteChunks.forEach(c => (totalLen += c.length));
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    byteChunks.forEach(c => {
      merged.set(c, offset);
      offset += c.length;
    });
    return merged;
  }

  // --- Main Print Method ---
  async printOrder(order, settings, isReprint = false) {
    const bytes = this.buildReceiptBytes(order, settings, isReprint);

    // Auto-open cash drawer if payment method is cash
    if (this.config.autoDrawer && (order.payment_method === 'cash' || order.payment_method === 'tempo')) {
      try {
        await this.kickCashDrawer();
      } catch (err) {
        console.warn('[Hardware] Gagal membuka laci otomatis:', err);
      }
    }

    if (this.config.mode === 'bluetooth') {
      if (this.isConnected) {
        await this.sendBluetoothBytes(bytes);
        return { success: true, mode: 'bluetooth' };
      } else {
        // If not connected, fallback to RawBT or System Print
        console.warn('[Hardware] Bluetooth printer belum terhubung, mencoba RawBT...');
        this.sendRawBT(bytes);
        return { success: true, mode: 'rawbt_fallback' };
      }
    } else if (this.config.mode === 'rawbt') {
      this.sendRawBT(bytes);
      return { success: true, mode: 'rawbt' };
    } else {
      // System Print Fallback
      window.print();
      return { success: true, mode: 'system' };
    }
  }

  async printTest() {
    const bytes = this.buildTestReceiptBytes();

    if (this.config.mode === 'bluetooth') {
      if (!this.isConnected) {
        throw new Error('Printer Bluetooth belum terhubung. Klik "Hubungkan Printer" terlebih dahulu.');
      }
      await this.sendBluetoothBytes(bytes);
      return { success: true, mode: 'bluetooth' };
    } else if (this.config.mode === 'rawbt') {
      this.sendRawBT(bytes);
      return { success: true, mode: 'rawbt' };
    } else {
      window.print();
      return { success: true, mode: 'system' };
    }
  }
}

export const hardwareManager = new HardwareManager();
