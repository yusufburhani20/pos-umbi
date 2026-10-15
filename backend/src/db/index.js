const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../pos_umbi.db');
const db = new sqlite3.Database(dbPath);

// Helper for promise-based queries
const dbQuery = {
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },

  exec: (sql) => {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

async function initDatabase() {
  await dbQuery.exec('PRAGMA foreign_keys = ON;');
  await dbQuery.exec('PRAGMA journal_mode = WAL;');

  // 1. Users table (Owner & Cashiers)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'cashier')),
      pin_code TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 2. Products table (Multi-tier pricing for umbi-umbian)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'umbi',
      unit TEXT DEFAULT 'kg',
      cost_price REAL NOT NULL,
      retail_price REAL NOT NULL,
      reseller_price REAL NOT NULL,
      wholesale_min_qty REAL DEFAULT 10.0,
      stock_qty REAL DEFAULT 0.0,
      min_stock_alert REAL DEFAULT 15.0,
      image_emoji TEXT DEFAULT '🥔',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 3. Customers table (Wholesale / Reseller registered profiles)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      tier TEXT DEFAULT 'retail' CHECK(tier IN ('retail', 'reseller')),
      address TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 4. Shifts table (Key Anti-Fraud: Blind Cash Drop)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_id INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      starting_cash REAL NOT NULL,
      system_cash REAL DEFAULT 0.0,
      actual_cash REAL,
      cash_difference REAL,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed')),
      closing_notes TEXT,
      FOREIGN KEY(cashier_id) REFERENCES users(id)
    );
  `);

  // 5. Orders table (Sales transactions)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      shift_id INTEGER NOT NULL,
      customer_id INTEGER,
      customer_name TEXT,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'transfer', 'qris', 'tempo')),
      cash_tendered REAL,
      change_due REAL,
      status TEXT DEFAULT 'completed' CHECK(status IN ('completed', 'void', 'tempo')),
      due_date DATE,
      void_reason TEXT,
      void_approved_by INTEGER,
      void_at DATETIME,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(shift_id) REFERENCES shifts(id),
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(void_approved_by) REFERENCES users(id)
    );
  `);

  // 5b. Customer Debts (Piutang / Kasbon)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS customer_debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0.0,
      remaining_amount REAL NOT NULL,
      due_date DATE NOT NULL,
      status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'partial', 'paid')),
      notes TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );
  `);

  // 5c. Debt Payments (Riwayat Cicilan / Pelunasan Piutang)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      shift_id INTEGER,
      amount_paid REAL NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'transfer', 'qris')),
      recorded_by INTEGER NOT NULL,
      notes TEXT,
      payment_date DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(debt_id) REFERENCES customer_debts(id) ON DELETE CASCADE,
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(shift_id) REFERENCES shifts(id),
      FOREIGN KEY(recorded_by) REFERENCES users(id)
    );
  `);

  // 6. Order items (Line items with tier audit)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      qty REAL NOT NULL,
      price_tier TEXT NOT NULL CHECK(price_tier IN ('retail', 'reseller')),
      cost_price REAL NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);

  // 7. Stock Adjustments (Susut, busuk, rusak with notes & photo)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      shift_id INTEGER,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('susut', 'busuk', 'rusak', 'opname')),
      qty_kg REAL NOT NULL,
      notes TEXT,
      photo_url TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(product_id) REFERENCES products(id),
      FOREIGN KEY(shift_id) REFERENCES shifts(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // 8. Audit Logs (Log every suspicious/important event)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // 9. Store Settings (Identitas Toko & Profil Struk)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Seed default data if empty
  await seedInitialData();
  await seedStoreSettings();
}

async function seedInitialData() {
  const userCount = await dbQuery.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    console.log('[DB] Seeding default users (Owner & Kasir)...');
    // Default Owner (PIN: 123456) and Kasir (PIN: 112233)
    const ownerPinHash = await bcrypt.hash('123456', 8);
    const cashierPinHash = await bcrypt.hash('112233', 8);

    await dbQuery.run(
      'INSERT INTO users (name, username, role, pin_code) VALUES (?, ?, ?, ?)',
      ['Pak Haji (Owner)', 'owner', 'owner', ownerPinHash]
    );
    await dbQuery.run(
      'INSERT INTO users (name, username, role, pin_code) VALUES (?, ?, ?, ?)',
      ['Kasir Pagi (Budi)', 'kasir1', 'cashier', cashierPinHash]
    );

    console.log('[DB] Seeding sample umbi-umbian products...');
    const sampleProducts = [
      ['Kentang Dieng Super', 'umbi', 'kg', 11000, 16000, 13500, 10.0, 300.0, '🥔'],
      ['Ubi Madu Cilembu Asli', 'umbi', 'kg', 9000, 14000, 11500, 10.0, 200.0, '🍠'],
      ['Ubi Ungu Grade A', 'umbi', 'kg', 7000, 11000, 9000, 10.0, 150.0, '🍠'],
      ['Singkong Gajah Mentega', 'umbi', 'kg', 3500, 6500, 5000, 15.0, 450.0, '🍠'],
      ['Bawang Merah Brebes Super', 'bumbu', 'kg', 28000, 38000, 32000, 5.0, 100.0, '🧅'],
      ['Bawang Putih Kating', 'bumbu', 'kg', 25000, 34000, 29000, 5.0, 120.0, '🧄'],
      ['Wortel Brastagi Curah', 'sayur', 'kg', 8000, 13000, 10500, 10.0, 180.0, '🥕'],
      ['Kacang Tanah Kupas', 'palawija', 'kg', 24000, 32000, 28000, 5.0, 80.0, '🥜']
    ];

    for (const p of sampleProducts) {
      await dbQuery.run(
        `INSERT INTO products 
         (name, category, unit, cost_price, retail_price, reseller_price, wholesale_min_qty, stock_qty, image_emoji)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p
      );
    }

    console.log('[DB] Seeding sample reseller customers...');
    await dbQuery.run(
      'INSERT INTO customers (name, phone, tier, address) VALUES (?, ?, ?, ?)',
      ['Warung Makan Barokah (Bu Siti)', '081234567890', 'reseller', 'Jl. Pasar Anyar No. 12']
    );
    await dbQuery.run(
      'INSERT INTO customers (name, phone, tier, address) VALUES (?, ?, ?, ?)',
      ['Katering Berkah Jaya', '089876543210', 'reseller', 'Komplek Griya Indah Blok B']
    );
    console.log('[DB] Initial seed completed!');
  }
}

async function seedStoreSettings() {
  const defaults = [
    { key: 'store_name', value: 'TOKO UMBI JAYA' },
    { key: 'store_tagline', value: 'Pusat Umbi, Bawang & Komoditas Pasar' },
    { key: 'store_address', value: 'Pasar Induk Kramat Jati, Blok B No. 12-14' },
    { key: 'store_phone', value: '0812-3456-7890' },
    { key: 'receipt_footer', value: 'Terima kasih atas kunjungan Anda!\nBarang yang sudah ditimbang & dibeli tidak dapat ditukar/dikembalikan.' }
  ];

  for (const item of defaults) {
    await dbQuery.run(
      'INSERT OR IGNORE INTO store_settings (key, value) VALUES (?, ?)',
      [item.key, item.value]
    );
  }
}

module.exports = {
  db,
  dbQuery,
  initDatabase
};
