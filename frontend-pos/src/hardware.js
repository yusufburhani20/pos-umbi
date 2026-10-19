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

function parseSafeDate(dateInput) {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  let s = String(dateInput).trim();
  if (s.includes(' ') && !s.includes('T')) {
    s = s.replace(' ', 'T');
  }
  return new Date(s);
}

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
    this.isReconnecting = false;
    this.manualDisconnect = false;
    this.reconnectTimer = null;
    this.stateListeners = new Set();

    // Setup lifecycle listeners for automatic reconnect
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        if (this.config.isLocked && !this.isConnected && !this.manualDisconnect) {
          this.startAutoReconnectWatcher();
        }
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.config.isLocked && !this.isConnected && !this.manualDisconnect) {
          this.startAutoReconnectWatcher();
        }
      });

      // Attempt background auto-connect on startup if previously locked
      setTimeout(() => {
        this.initAutoConnect();
      }, 1200);
    }
  }

  loadConfig() {
    return {
      mode: localStorage.getItem('pos_printer_mode') || 'bluetooth', // 'bluetooth', 'rawbt', 'system'
      paperSize: localStorage.getItem('pos_paper_size') || '58mm', // '58mm' (32 cols), '80mm' (48 cols)
      autoDrawer: localStorage.getItem('pos_auto_drawer') !== 'false', // default true
      lastDeviceName: localStorage.getItem('pos_last_bt_device') || null,
      lockedDeviceId: localStorage.getItem('pos_locked_printer_id') || null,
      lockedDeviceName: localStorage.getItem('pos_locked_printer_name') || null,
      isLocked: localStorage.getItem('pos_locked_printer_enabled') === 'true'
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
    if (this.config.lockedDeviceId) {
      localStorage.setItem('pos_locked_printer_id', this.config.lockedDeviceId);
    } else {
      localStorage.removeItem('pos_locked_printer_id');
    }
    if (this.config.lockedDeviceName) {
      localStorage.setItem('pos_locked_printer_name', this.config.lockedDeviceName);
    } else {
      localStorage.removeItem('pos_locked_printer_name');
    }
    localStorage.setItem('pos_locked_printer_enabled', this.config.isLocked ? 'true' : 'false');
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
      isReconnecting: this.isReconnecting,
      deviceName: this.bluetoothDevice ? this.bluetoothDevice.name || 'Printer Thermal' : (this.config.lockedDeviceName || this.config.lastDeviceName),
      lockedDeviceName: this.config.lockedDeviceName,
      isLocked: Boolean(this.config.isLocked),
      config: { ...this.config }
    };
  }

  // --- Bluetooth Connection & GATT Handling ---
  bindDeviceEvents(device) {
    if (!device) return;
    if (device._disconnectHandler) {
      device.removeEventListener('gattserverdisconnected', device._disconnectHandler);
    }
    device._disconnectHandler = () => {
      console.warn('[Hardware] Printer Bluetooth terputus');
      this.isConnected = false;
      this.characteristic = null;
      this.notifyState();

      // Trigger automatic reconnection if printer is locked
      if (this.config.isLocked && !this.manualDisconnect) {
        this.startAutoReconnectWatcher();
      }
    };
    device.addEventListener('gattserverdisconnected', device._disconnectHandler);
  }

  async connectToDeviceGatt(device) {
    if (!device) throw new Error('Perangkat printer tidak valid');

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
        // Continue searching
      }
    }

    // Fallback: auto-discover all services
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
          } catch {}
        }
      } catch (e) {
        console.warn('[Hardware] Gagal auto-discover services:', e);
      }
    }

    if (!targetChar) {
      throw new Error('Gagal menemukan jalur cetak (write characteristic) pada printer ini.');
    }

    this.characteristic = targetChar;
    this.bluetoothDevice = device;
    this.isConnected = true;
    this.isConnecting = false;
    this.isReconnecting = false;
    this.bindDeviceEvents(device);
    this.notifyState();
    return { success: true, deviceName: device.name || 'Printer Thermal' };
  }

  async connectBluetooth() {
    if (!('bluetooth' in navigator)) {
      throw new Error('Web Bluetooth tidak didukung di browser ini. Pastikan menggunakan Google Chrome di Android (Redmi Pad SE).');
    }

    this.manualDisconnect = false;
    this.isConnecting = true;
    this.notifyState();

    try {
      console.log('[Hardware] Membuka pemilih Bluetooth...');
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICES
      });

      this.bluetoothDevice = device;
      this.bindDeviceEvents(device);

      const res = await this.connectToDeviceGatt(device);

      // Kunci koneksi printer secara otomatis agar tersimpan & selalu auto-reconnect
      this.saveConfig({
        lastDeviceName: device.name || 'Printer Thermal',
        lockedDeviceId: device.id,
        lockedDeviceName: device.name || 'Printer Thermal',
        isLocked: true
      });

      return res;
    } catch (err) {
      this.isConnected = false;
      this.isConnecting = false;
      this.notifyState();
      throw err;
    }
  }

  // Auto-Reconnect Watcher: Otomatis mencari dan menyambung ulang ketika terputus
  startAutoReconnectWatcher() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!this.config.isLocked || this.isConnected || this.manualDisconnect) {
      this.isReconnecting = false;
      this.notifyState();
      return;
    }

    this.isReconnecting = true;
    this.notifyState();

    const doReconnect = async () => {
      if (this.isConnected || !this.config.isLocked || this.manualDisconnect) {
        this.isReconnecting = false;
        this.notifyState();
        return;
      }

      console.log(`[Hardware] Auto-reconnect: Mencoba menyambung ke ${this.config.lockedDeviceName || 'Printer'}...`);

      try {
        let device = this.bluetoothDevice;
        if (!device && typeof navigator !== 'undefined' && 'bluetooth' in navigator && navigator.bluetooth.getDevices) {
          const devices = await navigator.bluetooth.getDevices();
          if (devices && devices.length > 0) {
            device = devices.find(d => d.id === this.config.lockedDeviceId) ||
                     devices.find(d => d.name === this.config.lockedDeviceName) ||
                     devices[0];
            if (device) {
              this.bluetoothDevice = device;
              this.bindDeviceEvents(device);
            }
          }
        }

        if (device) {
          await this.connectToDeviceGatt(device);
          console.log('[Hardware] Berhasil auto-reconnect ke printer!');
          this.isReconnecting = false;
          this.notifyState();
          return;
        }
      } catch (e) {
        console.warn('[Hardware] Auto-reconnect mencoba kembali dalam 3.5 detik:', e.message);
      }

      if (this.config.isLocked && !this.isConnected && !this.manualDisconnect) {
        this.reconnectTimer = setTimeout(doReconnect, 3500);
      } else {
        this.isReconnecting = false;
        this.notifyState();
      }
    };

    this.reconnectTimer = setTimeout(doReconnect, 1000);
  }

  async initAutoConnect() {
    if (!this.config.isLocked || this.isConnected) return;
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) return;

    try {
      if (navigator.bluetooth.getDevices) {
        const devices = await navigator.bluetooth.getDevices();
        if (devices && devices.length > 0) {
          const target = devices.find(d => d.id === this.config.lockedDeviceId) ||
                         devices.find(d => d.name === this.config.lockedDeviceName) ||
                         devices[0];
          if (target) {
            console.log('[Hardware] Menemukan printer terdaftar untuk auto-connect:', target.name);
            this.bluetoothDevice = target;
            this.bindDeviceEvents(target);
            await this.connectToDeviceGatt(target);
            console.log('[Hardware] Berhasil auto-connect printer saat aplikasi dibuka!');
          }
        }
      }
    } catch (e) {
      console.warn('[Hardware] Auto-connect on startup skipped:', e.message);
      // Fallback to auto-reconnect watcher
      this.startAutoReconnectWatcher();
    }
  }

  // Putuskan manual tanpa menghapus kunci
  async disconnectBluetooth() {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.bluetoothDevice && this.bluetoothDevice.gatt && this.bluetoothDevice.gatt.connected) {
      try {
        this.bluetoothDevice.gatt.disconnect();
      } catch (e) {}
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.isReconnecting = false;
    this.characteristic = null;
    this.notifyState();
  }

  // Hapus kunci printer (agar kasir dapat mengganti ke printer lain)
  async unlockPrinter() {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.bluetoothDevice && this.bluetoothDevice.gatt && this.bluetoothDevice.gatt.connected) {
      try {
        this.bluetoothDevice.gatt.disconnect();
      } catch (e) {}
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.isReconnecting = false;
    this.characteristic = null;
    this.bluetoothDevice = null;
    this.saveConfig({
      lockedDeviceId: null,
      lockedDeviceName: null,
      isLocked: false
    });
    this.notifyState();
    return { success: true };
  }

  // Pastikan printer tersambung sebelum kirim data cetak / sinyal laci
  async ensureConnection() {
    if (this.config.mode !== 'bluetooth') return true;
    if (this.isConnected && this.characteristic) return true;

    if (this.bluetoothDevice || this.config.isLocked) {
      try {
        let device = this.bluetoothDevice;
        if (!device && typeof navigator !== 'undefined' && 'bluetooth' in navigator && navigator.bluetooth.getDevices) {
          const devices = await navigator.bluetooth.getDevices();
          device = devices.find(d => d.id === this.config.lockedDeviceId) || devices[0];
          if (device) this.bluetoothDevice = device;
        }
        if (device) {
          const connectPromise = this.connectToDeviceGatt(device);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout koneksi printer')), 2500));
          await Promise.race([connectPromise, timeoutPromise]);
          return this.isConnected;
        }
      } catch (e) {
        console.warn('[Hardware] Sambung cepat sebelum cetak gagal:', e.message);
      }
    }
    return this.isConnected;
  }

  // Send raw bytes to Bluetooth in safe BLE chunks (max 100 bytes chunk)
  async sendBluetoothBytes(bytes) {
    await this.ensureConnection();
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
      await this.ensureConnection();
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
    append(formatRow('Waktu   :', parseSafeDate(order.created_at || Date.now()).toLocaleString('id-ID')));
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
    append('Kassa POS System\n');
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
      await this.ensureConnection();
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
      await this.ensureConnection();
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

  // --- ESC/POS Expense Receipt Formatter ---
  buildExpenseReceiptBytes(expense, settings = {}, isReprint = false) {
    const is80mm = this.config.paperSize === '80mm';
    const maxCols = is80mm ? 48 : 32;
    const divider = '-'.repeat(maxCols);
    const doubleDivider = '='.repeat(maxCols);

    const encoder = new TextEncoder();
    const byteChunks = [];

    const append = (bytes) => {
      if (Array.isArray(bytes)) byteChunks.push(new Uint8Array(bytes));
      else if (bytes instanceof Uint8Array) byteChunks.push(bytes);
      else if (typeof bytes === 'string') byteChunks.push(encoder.encode(bytes));
    };

    const formatRow = (left, right) => {
      const leftStr = String(left || '');
      const rightStr = String(right || '');
      const space = maxCols - leftStr.length - rightStr.length;
      if (space >= 0) {
        return leftStr + ' '.repeat(space) + rightStr + '\n';
      } else {
        return leftStr + '\n' + ' '.repeat(Math.max(0, maxCols - rightStr.length)) + rightStr + '\n';
      }
    };

    const formatRp = (num) => 'Rp ' + Number(num || 0).toLocaleString('id-ID');

    const isIncome = expense.type === 'income';
    const sourceLabel = expense.source === 'cash' ? 'KAS LACI (TUNAI)' : 'TRANSFER BANK';

    // 1. Initialize
    append(COMMANDS.INIT);

    // 2. Header
    append(COMMANDS.ALIGN_CENTER);
    append(COMMANDS.DOUBLE_SIZE_ON);
    append(COMMANDS.BOLD_ON);
    append((settings.store_name || 'PD. HASIL BUMI RAYA 1') + '\n');
    append(COMMANDS.NORMAL_TEXT);
    append(COMMANDS.BOLD_OFF);

    append((settings.store_tagline || 'Pusat Umbi, Bawang & Komoditas') + '\n');
    if (settings.store_address) append(settings.store_address + '\n');
    if (settings.store_phone) append('Telp/WA: ' + settings.store_phone + '\n');

    append(doubleDivider + '\n');
    append(COMMANDS.BOLD_ON);
    if (isIncome) {
      append('*** BUKTI KAS MASUK TOKO ***\n');
      append('(TAMBAH MODAL / DANA LACI)\n');
    } else {
      append('*** BIAYA OPERASIONAL ***\n');
      append('(PENGELUARAN KAS KIOS)\n');
    }
    if (isReprint) {
      append('*** SALINAN / CETAK ULANG ***\n');
    }
    append(COMMANDS.BOLD_OFF);
    append(doubleDivider + '\n');

    // 3. Meta Data
    append(COMMANDS.ALIGN_LEFT);
    append(formatRow('No. Bukti :', expense.expense_no || '-'));
    append(formatRow('Waktu     :', parseSafeDate(expense.created_at || Date.now()).toLocaleString('id-ID')));
    append(formatRow('Petugas   :', expense.recorded_by_name || 'Kasir'));
    append(formatRow('Sumber Kas:', sourceLabel));
    append(formatRow('Kategori  :', expense.category_name || '-'));
    append(divider + '\n');

    // 4. Nominal Amount Highlight (Double size bold centered)
    append(COMMANDS.ALIGN_CENTER);
    append(COMMANDS.BOLD_ON);
    append('JUMLAH NOMINAL:\n');
    append(COMMANDS.DOUBLE_SIZE_ON);
    append((isIncome ? '+ ' : '- ') + formatRp(expense.amount) + '\n');
    append(COMMANDS.NORMAL_TEXT);
    append(COMMANDS.BOLD_OFF);
    append(COMMANDS.ALIGN_LEFT);
    append(divider + '\n');

    // 5. Notes / Keterangan
    if (expense.notes) {
      append('Keterangan:\n');
      append('  ' + expense.notes + '\n');
      append(divider + '\n');
    }

    // 6. Petugas & Penerima (Simpel 1 baris, tidak turun ke bawah)
    append(COMMANDS.ALIGN_CENTER);
    if (is80mm) {
      append('Petugas: ( .................. )   Penerima: ( .................. )\n');
    } else {
      append('Petugas: (....) Penerima: (....)\n');
    }

    // 7. Footer
    append(divider + '\n');
    append('Harap simpan struk ini sebagai\nbukti sah pembukuan keuangan kios.\n');
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

  // --- Main Print Expense Method ---
  async printExpense(expense, settings = {}, isReprint = false) {
    const bytes = this.buildExpenseReceiptBytes(expense, settings, isReprint);

    // Auto-open cash drawer if expense was paid with drawer cash
    if (this.config.autoDrawer && expense.source === 'cash') {
      try {
        await this.kickCashDrawer();
      } catch (err) {
        console.warn('[Hardware] Gagal membuka laci otomatis:', err);
      }
    }

    if (this.config.mode === 'bluetooth') {
      await this.ensureConnection();
      if (this.isConnected) {
        await this.sendBluetoothBytes(bytes);
        return { success: true, mode: 'bluetooth' };
      } else {
        console.warn('[Hardware] Bluetooth printer belum terhubung, mencoba RawBT...');
        this.sendRawBT(bytes);
        return { success: true, mode: 'rawbt_fallback' };
      }
    } else if (this.config.mode === 'rawbt') {
      this.sendRawBT(bytes);
      return { success: true, mode: 'rawbt' };
    } else {
      window.print();
      return { success: true, mode: 'system' };
    }
  }

  // --- Build Shift Balancing Report Bytes (Laporan Harian) ---
  buildShiftReportBytes(shiftData, type = 'X', settings = {}) {
    const is80mm = this.config.paperSize === '80mm';
    const maxCols = is80mm ? 48 : 32;
    const divider = '='.repeat(maxCols);
    const subDivider = '-'.repeat(maxCols);

    const encoder = new TextEncoder();
    const byteChunks = [];
    const append = (b) => {
      if (Array.isArray(b)) byteChunks.push(new Uint8Array(b));
      else if (b instanceof Uint8Array) byteChunks.push(b);
      else if (typeof b === 'string') byteChunks.push(encoder.encode(b));
    };

    const formatLine = (left, right) => {
      const leftStr = String(left || '');
      const rightStr = String(right || '');
      const spaces = maxCols - (leftStr.length + rightStr.length);
      if (spaces > 0) {
        return leftStr + ' '.repeat(spaces) + rightStr;
      }
      return leftStr + ' ' + rightStr;
    };

    const formatCurrency = (val) => {
      return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
    };

    append(COMMANDS.INIT);

    // 1. Store Header
    append(COMMANDS.ALIGN_CENTER);
    append(COMMANDS.DOUBLE_SIZE_ON);
    append(COMMANDS.BOLD_ON);
    const storeName = settings.store_name || 'PD. HASIL BUMI RAYA 1';
    append(storeName + '\n');
    append(COMMANDS.NORMAL_TEXT);
    append(COMMANDS.BOLD_OFF);

    const storeTagline = settings.store_tagline || 'Pusat Umbi, Bawang & Komoditas Pasar';
    append(storeTagline + '\n');
    if (settings.store_address) append(settings.store_address + '\n');
    if (settings.store_phone) append('Telp/WA: ' + settings.store_phone + '\n');
    append(divider + '\n');

    // 2. Report Title
    append(COMMANDS.BOLD_ON);
    if (type === 'Z') {
      append('*** LAPORAN HARIAN (TUTUP KASIR) ***\n');
      append(COMMANDS.NORMAL_TEXT);
      append('(REKONSILIASI KAS & PENUTUPAN HARIAN)\n');
    } else {
      append('*** LAPORAN HARIAN (CEK KAS BERJALAN) ***\n');
      append(COMMANDS.NORMAL_TEXT);
      append('(RINGKASAN SALDO KAS BERJALAN)\n');
    }
    append(COMMANDS.BOLD_OFF);
    append(subDivider + '\n');

    // 3. Shift Metadata
    append(COMMANDS.ALIGN_LEFT);
    append(formatLine('No. Shift   :', '#' + (shiftData.id || shiftData.shift_id || '-')) + '\n');
    append(formatLine('Kasir       :', shiftData.cashier_name || 'Kasir Bertugas') + '\n');
    if (shiftData.start_time) {
      append(formatLine('Waktu Buka  :', parseSafeDate(shiftData.start_time).toLocaleString('id-ID')) + '\n');
    }
    const printTime = type === 'Z' && shiftData.end_time 
      ? parseSafeDate(shiftData.end_time).toLocaleString('id-ID')
      : new Date().toLocaleString('id-ID');
    append(formatLine(type === 'Z' ? 'Waktu Tutup :' : 'Waktu Cetak :', printTime) + '\n');
    append(formatLine('Status Shift:', type === 'Z' ? 'TUTUP (CLOSED)' : 'AKTIF (OPEN)') + '\n');
    append(subDivider + '\n');

    // 4. Cash Drawer Reconciliation (Rincian Kas Laci)
    append(COMMANDS.BOLD_ON);
    append('RINCIAN POSISI KAS LACI:\n');
    append(COMMANDS.BOLD_OFF);

    const startingCash = Number(shiftData.starting_cash || 0);
    const cashSales = Number(shiftData.cash_sales || shiftData.total_cash_sales || 0);
    const cashDebt = Number(shiftData.cash_debt_collected || shiftData.total_cash_debt_collected || 0);
    const cashIncome = Number(shiftData.cash_income || shiftData.total_cash_income || 0);
    const cashExpenses = Number(shiftData.cash_expenses || shiftData.total_cash_expenses || 0);
    const cashSupplier = Number(shiftData.cash_supplier_payments || shiftData.total_cash_supplier_paid || 0);

    const expectedCash = startingCash + cashSales + cashDebt + cashIncome - cashExpenses - cashSupplier;

    append(formatLine('  Modal Awal (Float)     :', formatCurrency(startingCash)) + '\n');
    append(formatLine('  (+) Penjualan Tunai    :', formatCurrency(cashSales)) + '\n');
    if (cashDebt > 0) {
      append(formatLine('  (+) Pelunasan Bon Tunai:', formatCurrency(cashDebt)) + '\n');
    }
    if (cashIncome > 0) {
      append(formatLine('  (+) Kas Masuk Tambahan :', formatCurrency(cashIncome)) + '\n');
    }
    if (cashExpenses > 0) {
      append(formatLine('  (-) Pengeluaran Laci   :', '(' + formatCurrency(cashExpenses) + ')') + '\n');
    }
    if (cashSupplier > 0) {
      append(formatLine('  (-) Kulakan Kas Laci   :', '(' + formatCurrency(cashSupplier) + ')') + '\n');
    }
    append(subDivider + '\n');

    // Expected Drawer Cash
    append(COMMANDS.BOLD_ON);
    append(formatLine('SALDO LACI SEHARUSNYA:', formatCurrency(expectedCash)) + '\n');
    append(COMMANDS.BOLD_OFF);

    // 5. Cash Physically Counted & Variance
    const actualCash = Number(shiftData.actual_cash !== undefined ? shiftData.actual_cash : (shiftData.actual_cash_input !== undefined ? shiftData.actual_cash_input : expectedCash));
    const difference = actualCash - expectedCash;

    append(formatLine('FISIK UANG DIHITUNG  :', formatCurrency(actualCash)) + '\n');
    append(subDivider + '\n');

    append(COMMANDS.ALIGN_CENTER);
    append(COMMANDS.BOLD_ON);
    if (difference === 0) {
      append('STATUS : [ OK KAS BALANCE / SESUAI ]\n');
    } else if (difference < 0) {
      append(`STATUS : [ !! SELISIH KURANG ${formatCurrency(Math.abs(difference))} ]\n`);
    } else {
      append(`STATUS : [ + SELISIH LEBIH ${formatCurrency(difference)} ]\n`);
    }
    append(COMMANDS.BOLD_OFF);
    append(COMMANDS.ALIGN_LEFT);
    append(subDivider + '\n');

    // 6. Denominations Breakdown (if available)
    if (shiftData.breakdown && typeof shiftData.breakdown === 'object') {
      append(COMMANDS.BOLD_ON);
      append('RINCIAN PECAHAN UANG FISIK:\n');
      append(COMMANDS.BOLD_OFF);
      const b = shiftData.breakdown;
      if (b.d100k) append(formatLine('  100.000 x ' + Math.round(b.d100k / 100000), formatCurrency(b.d100k)) + '\n');
      if (b.d75k)  append(formatLine('   75.000 x ' + Math.round(b.d75k / 75000), formatCurrency(b.d75k)) + '\n');
      if (b.d50k)  append(formatLine('   50.000 x ' + Math.round(b.d50k / 50000), formatCurrency(b.d50k)) + '\n');
      if (b.d20k)  append(formatLine('   20.000 x ' + Math.round(b.d20k / 20000), formatCurrency(b.d20k)) + '\n');
      if (b.d10k)  append(formatLine('   10.000 x ' + Math.round(b.d10k / 10000), formatCurrency(b.d10k)) + '\n');
      if (b.d5k)   append(formatLine('    5.000 x ' + Math.round(b.d5k / 5000), formatCurrency(b.d5k)) + '\n');
      if (b.d2k)   append(formatLine('    2.000 x ' + Math.round(b.d2k / 2000), formatCurrency(b.d2k)) + '\n');
      if (b.d1k)   append(formatLine('    1.000 x ' + Math.round(b.d1k / 1000), formatCurrency(b.d1k)) + '\n');
      if (b.dKoin) append(formatLine('    Koin / Receh         :', formatCurrency(b.dKoin)) + '\n');
      append(subDivider + '\n');
    }

    // 7. Non-Cash Sales & Total Shift Turnover
    const qris = Number(shiftData.qris_sales || shiftData.total_qris || 0);
    const transfer = Number(shiftData.transfer_sales || shiftData.total_transfer || 0);
    const tempo = Number(shiftData.tempo_sales || shiftData.total_tempo || 0);
    const totalOmset = Number(shiftData.total_omset || (cashSales + qris + transfer + tempo));
    const totalOrders = shiftData.total_orders || '-';

    append(COMMANDS.BOLD_ON);
    append('RINGKASAN METODE NON-TUNAI:\n');
    append(COMMANDS.BOLD_OFF);
    append(formatLine('  QRIS                :', formatCurrency(qris)) + '\n');
    append(formatLine('  Transfer Bank       :', formatCurrency(transfer)) + '\n');
    append(formatLine('  Bon Hutang Baru     :', formatCurrency(tempo)) + '\n');
    append(formatLine('  Total Omset Shift   :', formatCurrency(totalOmset)) + '\n');
    append(formatLine('  Total Nota Transaksi:', String(totalOrders) + ' Nota') + '\n');
    append(subDivider + '\n');

    // 8. Notes (Cleaned without raw breakdown JSON)
    const cleanNotes = String(shiftData.closing_notes || shiftData.notes || '').replace(/^Breakdown\s*:\s*\{[\s\S]*?\}\s*(\.|\;)?\s*/i, '').trim();
    if (cleanNotes) {
      append('Catatan Kasir:\n');
      append('  ' + cleanNotes + '\n');
      append(subDivider + '\n');
    }

    // 9. Signatures - Compact Side-by-Side
    append(COMMANDS.ALIGN_CENTER);
    if (is80mm) {
      append('     Kasir Bertugas,             Supervisor / Penerima, \n\n');
      append('  ( .................. )        ( .................. )\n');
    } else {
      append('  Kasir,            Supervisor, \n\n');
      append(' ( ........ )     ( ........ )\n');
    }
    append(divider + '\n');
    append('Kassa POS • Sistem Kasir Pintar\n& Anti-Kecolongan Toko Pasar\n');
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

  // --- Main Print Shift Report Method ---
  async printShiftReport(shiftData, type = 'X', settings = {}) {
    const bytes = this.buildShiftReportBytes(shiftData, type, settings);

    // Auto-open cash drawer if closing shift
    if (this.config.autoDrawer && type === 'Z') {
      try {
        await this.kickCashDrawer();
      } catch (err) {
        console.warn('[Hardware] Gagal membuka laci otomatis:', err);
      }
    }

    if (this.config.mode === 'bluetooth') {
      await this.ensureConnection();
      if (this.isConnected) {
        await this.sendBluetoothBytes(bytes);
        return { success: true, mode: 'bluetooth' };
      } else {
        console.warn('[Hardware] Bluetooth printer belum terhubung, mencoba RawBT...');
        this.sendRawBT(bytes);
        return { success: true, mode: 'rawbt_fallback' };
      }
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
