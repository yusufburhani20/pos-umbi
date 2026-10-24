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
      breakdown TEXT,
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
      subtotal_amount REAL DEFAULT 0.0,
      manual_total_override REAL,
      discount_amount REAL DEFAULT 0.0,
      discount_notes TEXT,
      rotten_refund_amount REAL DEFAULT 0.0,
      rotten_refund_notes TEXT,
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
      order_id INTEGER UNIQUE,
      customer_id INTEGER NOT NULL,
      manual_ref_no TEXT,
      recorded_by INTEGER,
      total_amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0.0,
      remaining_amount REAL NOT NULL,
      due_date DATE NOT NULL,
      status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'partial', 'paid')),
      notes TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(recorded_by) REFERENCES users(id)
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

  // 10. Suppliers table (Manajemen Pemasok / Juragan Petani)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      supplied_commodities TEXT,
      bank_info TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 11. Purchases table (Riwayat Kulakan / Barang Masuk dari Supplier)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_no TEXT UNIQUE NOT NULL,
      supplier_id INTEGER,
      product_id INTEGER NOT NULL,
      qty_kg REAL NOT NULL,
      cost_price REAL NOT NULL,
      total_cost REAL NOT NULL,
      payment_status TEXT DEFAULT 'lunas' CHECK(payment_status IN ('lunas', 'tempo', 'partial')),
      paid_amount REAL DEFAULT 0.0,
      remaining_amount REAL NOT NULL DEFAULT 0.0,
      due_date DATE,
      notes TEXT,
      recorded_by INTEGER,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY(product_id) REFERENCES products(id),
      FOREIGN KEY(recorded_by) REFERENCES users(id)
    );
  `);

  // 12. Supplier Payments table (Cicilan / Pelunasan Hutang Kulakan)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      supplier_id INTEGER NOT NULL,
      shift_id INTEGER,
      amount_paid REAL NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'transfer', 'safe')),
      payment_date DATETIME DEFAULT (datetime('now', 'localtime')),
      notes TEXT,
      recorded_by INTEGER,
      FOREIGN KEY(purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY(shift_id) REFERENCES shifts(id),
      FOREIGN KEY(recorded_by) REFERENCES users(id)
    );
  `);

  // 13. Store Expenses & Cash Flow (Biaya Operasional Toko & Kas Kecil)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS store_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_no TEXT UNIQUE NOT NULL,
      shift_id INTEGER,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      category_name TEXT NOT NULL,
      type TEXT DEFAULT 'expense' CHECK(type IN ('expense', 'income')),
      amount REAL NOT NULL,
      source TEXT DEFAULT 'cash' CHECK(source IN ('cash', 'transfer', 'safe')),
      notes TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(shift_id) REFERENCES shifts(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // 14. Safe Cash Transactions (Buku Kas Brankas Toko / Master Brankas Owner)
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS safe_cash_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trx_no TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      shift_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('initial', 'deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'expense', 'supplier_pay', 'income', 'prive')),
      amount REAL NOT NULL,
      balance_before REAL DEFAULT 0,
      balance_after REAL DEFAULT 0,
      source TEXT DEFAULT 'cash',
      reference_no TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(shift_id) REFERENCES shifts(id)
    );
  `);

  // Migration: Add shift_id to safe_cash_transactions if not present
  try {
    const safeCols = await dbQuery.all("PRAGMA table_info(safe_cash_transactions)");
    if (!safeCols.some(c => c.name === 'shift_id')) {
      await dbQuery.exec("ALTER TABLE safe_cash_transactions ADD COLUMN shift_id INTEGER;");
      console.log('[DB] Migrated: Added shift_id column to safe_cash_transactions table');
    }
  } catch (sErr) {
    console.warn('[DB] Migration error on safe_cash_transactions shift_id:', sErr.message);
  }

  // Migration: Add breakdown column to shifts if not present
  try {
    const shiftCols = await dbQuery.all("PRAGMA table_info(shifts)");
    if (!shiftCols.some(c => c.name === 'breakdown')) {
      await dbQuery.exec("ALTER TABLE shifts ADD COLUMN breakdown TEXT;");
      console.log('[DB] Migrated: Added breakdown column to shifts table');
    }
  } catch (mErr) {
    console.warn('[DB] Migration error on shifts breakdown:', mErr.message);
  }

  // Migration: Add shift_id column to supplier_payments if not present
  try {
    const spCols = await dbQuery.all("PRAGMA table_info(supplier_payments)");
    if (!spCols.some(c => c.name === 'shift_id')) {
      await dbQuery.exec("ALTER TABLE supplier_payments ADD COLUMN shift_id INTEGER;");
      console.log('[DB] Migrated: Added shift_id column to supplier_payments table');
    }
  } catch (spErr) {
    console.warn('[DB] Migration error on supplier_payments shift_id:', spErr.message);
  }

  // Migration: Add manual_ref_no and recorded_by to customer_debts if not present
  try {
    const debtCols = await dbQuery.all("PRAGMA table_info(customer_debts)");
    if (!debtCols.some(c => c.name === 'manual_ref_no')) {
      await dbQuery.exec("ALTER TABLE customer_debts ADD COLUMN manual_ref_no TEXT;");
      console.log('[DB] Migrated: Added manual_ref_no column to customer_debts table');
    }
    if (!debtCols.some(c => c.name === 'recorded_by')) {
      await dbQuery.exec("ALTER TABLE customer_debts ADD COLUMN recorded_by INTEGER;");
      console.log('[DB] Migrated: Added recorded_by column to customer_debts table');
    }
  } catch (dErr) {
    console.warn('[DB] Migration error on customer_debts:', dErr.message);
  }

  // Migration: Add adjustment columns to orders if not present
  try {
    const orderCols = await dbQuery.all("PRAGMA table_info(orders)");
    const colNames = new Set(orderCols.map(c => c.name));
    if (!colNames.has('subtotal_amount')) {
      await dbQuery.exec("ALTER TABLE orders ADD COLUMN subtotal_amount REAL DEFAULT 0.0;");
      console.log('[DB] Migrated: Added subtotal_amount column to orders table');
    }
    if (!colNames.has('manual_total_override')) {
      await dbQuery.exec("ALTER TABLE orders ADD COLUMN manual_total_override REAL;");
      console.log('[DB] Migrated: Added manual_total_override column to orders table');
    }
    if (!colNames.has('discount_amount')) {
      await dbQuery.exec("ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0.0;");
      console.log('[DB] Migrated: Added discount_amount column to orders table');
    }
    if (!colNames.has('discount_notes')) {
      await dbQuery.exec("ALTER TABLE orders ADD COLUMN discount_notes TEXT;");
      console.log('[DB] Migrated: Added discount_notes column to orders table');
    }
    if (!colNames.has('rotten_refund_amount')) {
      await dbQuery.exec("ALTER TABLE orders ADD COLUMN rotten_refund_amount REAL DEFAULT 0.0;");
      console.log('[DB] Migrated: Added rotten_refund_amount column to orders table');
    }
    if (!colNames.has('rotten_refund_notes')) {
      await dbQuery.exec("ALTER TABLE orders ADD COLUMN rotten_refund_notes TEXT;");
      console.log('[DB] Migrated: Added rotten_refund_notes column to orders table');
    }
  } catch (ordErr) {
    console.warn('[DB] Migration error on orders adjustments:', ordErr.message);
  }

  // Migration: Allow 'safe' in store_expenses source
  try {
    const tableExp = await dbQuery.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='store_expenses'");
    if (tableExp && tableExp.sql && !tableExp.sql.includes("'safe'")) {
      await dbQuery.exec(`
        PRAGMA foreign_keys=OFF;
        CREATE TABLE store_expenses_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expense_no TEXT UNIQUE NOT NULL,
          shift_id INTEGER,
          user_id INTEGER NOT NULL,
          category TEXT NOT NULL,
          category_name TEXT NOT NULL,
          type TEXT DEFAULT 'expense' CHECK(type IN ('expense', 'income')),
          amount REAL NOT NULL,
          source TEXT DEFAULT 'cash' CHECK(source IN ('cash', 'transfer', 'safe')),
          notes TEXT,
          created_at DATETIME DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY(shift_id) REFERENCES shifts(id),
          FOREIGN KEY(user_id) REFERENCES users(id)
        );
        INSERT INTO store_expenses_new SELECT * FROM store_expenses;
        DROP TABLE store_expenses;
        ALTER TABLE store_expenses_new RENAME TO store_expenses;
        PRAGMA foreign_keys=ON;
      `);
      console.log("[DB] Migrated store_expenses to support 'safe' source");
    }
  } catch (err) {
    console.warn("[DB] Migration error on store_expenses safe source:", err.message);
  }

  // Migration: Allow 'safe' in supplier_payments payment_method
  try {
    const tableSp = await dbQuery.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='supplier_payments'");
    if (tableSp && tableSp.sql && !tableSp.sql.includes("'safe'")) {
      await dbQuery.exec(`
        PRAGMA foreign_keys=OFF;
        CREATE TABLE supplier_payments_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          purchase_id INTEGER NOT NULL,
          supplier_id INTEGER NOT NULL,
          shift_id INTEGER,
          amount_paid REAL NOT NULL,
          payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'transfer', 'safe')),
          payment_date DATETIME DEFAULT (datetime('now', 'localtime')),
          notes TEXT,
          recorded_by INTEGER,
          FOREIGN KEY(purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
          FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
          FOREIGN KEY(shift_id) REFERENCES shifts(id),
          FOREIGN KEY(recorded_by) REFERENCES users(id)
        );
        INSERT INTO supplier_payments_new SELECT * FROM supplier_payments;
        DROP TABLE supplier_payments;
        ALTER TABLE supplier_payments_new RENAME TO supplier_payments;
        PRAGMA foreign_keys=ON;
      `);
      console.log("[DB] Migrated supplier_payments to support 'safe' payment_method");
    }
  } catch (err) {
    console.warn("[DB] Migration error on supplier_payments safe method:", err.message);
  }

  // Seed default data if empty
  await seedInitialData();
  await seedStoreSettings();
  await seedInitialSuppliers();
  await seedInitialExpenses();
}

async function seedInitialData() {
  const userCount = await dbQuery.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    console.log('[DB] Seeding default users (Owner & Kasir)...');
    // Default Owner (PIN: 123456) and Kasir (PIN: 654321)
    const ownerPinHash = await bcrypt.hash('123456', 8);
    const cashierPinHash = await bcrypt.hash('654321', 8);

    await dbQuery.run(
      'INSERT INTO users (name, username, role, pin_code) VALUES (?, ?, ?, ?)',
      ['Owner', 'owner', 'owner', ownerPinHash]
    );

    await dbQuery.run(
      'INSERT INTO users (name, username, role, pin_code) VALUES (?, ?, ?, ?)',
      ['Budi (Kasir)', 'kasir', 'cashier', cashierPinHash]
    );

    console.log('[DB] Seeding real market commodities products...');
    const sampleProducts = [
      ['Ubi Putih Super (Besar)', 'umbi', 'kg', 5100, 7000, 5500, 15.0, 300.0, 30.0, '🍠'],
      ['Ubi Putih (Kecil)', 'umbi', 'kg', 5100, 6500, 5500, 15.0, 200.0, 20.0, '🍠'],
      ['Ubi Merah', 'umbi', 'kg', 6000, 7500, 6500, 15.0, 250.0, 25.0, '🍠'],
      ['Ubi Ungu', 'umbi', 'kg', 5900, 8000, 6500, 15.0, 250.0, 25.0, '🍠'],
      ['Ubi Cilembu Madu Asli', 'umbi', 'kg', 9000, 14000, 11500, 10.0, 200.0, 20.0, '🍠'],
      ['Ubi Jepang', 'umbi', 'kg', 4500, 7500, 5000, 15.0, 250.0, 25.0, '🍠'],
      ['Ubi To (Sortiran Kecil)', 'umbi', 'kg', 2500, 4500, 3200, 15.0, 200.0, 20.0, '🍠'],
      ['Talas Bogor / Ketan', 'umbi', 'kg', 7000, 12000, 9000, 10.0, 150.0, 15.0, '🥔'],
      ['Suuk (Kacang Tanah Basah)', 'palawija', 'kg', 14000, 18000, 14800, 10.0, 200.0, 25.0, '🥜'],
      ['Singkong Mentega', 'umbi', 'kg', 3500, 6000, 4500, 15.0, 350.0, 30.0, '🍠'],
      ['Kacang Kedelai / Bulu', 'palawija', 'kg', 6000, 7500, 6500, 10.0, 200.0, 20.0, '🫛'],
      ['Kacang Tanah Kupas', 'palawija', 'kg', 24000, 32000, 28000, 5.0, 120.0, 15.0, '🥜'],
      ['Bangkuang Super', 'sayur', 'kg', 5000, 7500, 5500, 15.0, 300.0, 30.0, '🥔'],
      ['To Bangkuang (Kecil)', 'sayur', 'kg', 2500, 5000, 3500, 15.0, 200.0, 20.0, '🥔'],
      ['Labu Parang / Kuning', 'sayur', 'kg', 7000, 9500, 7800, 10.0, 250.0, 25.0, '🎃'],
      ['Kulang Kaleng (Kolang-Kaling)', 'olahan', 'kg', 7500, 15000, 11500, 10.0, 180.0, 20.0, '🥥'],
      ['Gula Aren Plastik (10 kg)', 'bumbu', 'bal', 195000, 238000, 215000, 1.0, 50.0, 5.0, '🍯'],
      ['Gula Aren Daun', 'bumbu', 'kg', 19500, 24500, 22000, 5.0, 100.0, 10.0, '🍯'],
      ['Jagung Manis', 'sayur', 'kg', 6000, 9500, 7500, 10.0, 200.0, 20.0, '🌽'],
      ['Edamame Pretelan Super', 'sayur', 'kg', 6000, 24000, 20000, 5.0, 120.0, 15.0, '🫛'],
      ['Buah Kaweni (Kweni)', 'buah', 'kg', 12000, 18000, 15000, 10.0, 120.0, 15.0, '🥭']
    ];

    for (const p of sampleProducts) {
      await dbQuery.run(
        `INSERT INTO products 
         (name, category, unit, cost_price, retail_price, reseller_price, wholesale_min_qty, stock_qty, min_stock_alert, image_emoji)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    { key: 'store_name', value: 'PD. HASIL BUMI RAYA 1' },
    { key: 'store_tagline', value: 'Pusat Umbi, Bawang & Komoditas Pasar' },
    { key: 'store_address', value: 'Pasar induk modern, Cikopo, Kec. Campaka, Kabupaten Purwakarta, Jawa Barat 41183' },
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

async function seedInitialSuppliers() {
  const count = await dbQuery.get('SELECT COUNT(*) as count FROM suppliers');
  if (count.count === 0) {
    console.log('[DB] Seeding default suppliers (Juragan Petani & Pengepul)...');
    const defaultSuppliers = [
      [
        'Juragan Mahmud (Brebes)',
        '0812-3456-7890',
        'Kersana, Brebes, Jawa Tengah',
        'Bawang Merah Super, Bawang Putih Kating',
        'BCA 1234567890 a.n. Mahmud',
        'Juragan bawang merah langganan utama, kiriman rutin setiap Selasa & Jumat pagi.'
      ],
      [
        'Petani Pak Subur (Dieng)',
        '0852-9876-5432',
        'Kejajar, Wonosobo, Jawa Tengah',
        'Kentang Granola Super, Kentang Dieng AB/AL',
        'BRI 9876543210123 a.n. Subur Wibowo',
        'Kelompok tani Dieng langsung, umbi kentang padat kadar air rendah.'
      ],
      [
        'Kang Asep Pengepul (Sukabumi)',
        '0878-1122-3344',
        'Cikembar, Sukabumi, Jawa Barat',
        'Ubi Cilembu Madu, Singkong Mentega, Ubi Ungu',
        'Mandiri 1320011223344 a.n. Asep Saepudin',
        'Pengepul ubi-ubian terpercaya, pasokan karungan 50 kg.'
      ],
      [
        'Haji Anwar (Garut)',
        '0813-5566-7788',
        'Samarang, Garut, Jawa Barat',
        'Talas Bogor Super, Jahe Merah, Kunyit Rimpang',
        'BNI 0441122334 a.n. Anwar Sanusi',
        'Spesialis talas pulen dan rempah hasil bumi pegunungan Garut.'
      ]
    ];

    for (const sup of defaultSuppliers) {
      await dbQuery.run(
        `INSERT INTO suppliers (name, phone, address, supplied_commodities, bank_info, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        sup
      );
    }
  }
}

async function seedInitialExpenses() {
  try {
    const count = await dbQuery.get('SELECT COUNT(*) as count FROM store_expenses');
    if (count && count.count === 0) {
      // Check if shift 1 exists before seeding with shift_id: 1
      const shift1 = await dbQuery.get('SELECT id FROM shifts WHERE id = 1');
      if (!shift1) {
        // No shifts exist, skip sample expenses seeding to avoid foreign key violation
        return;
      }
      console.log('[DB] Seeding sample store operational expenses...');
      const defaultExpenses = [
        ['EXP-20261018-0001', 1, 2, 'makan_rokok', 'Makan, Minum & Rokok', 'expense', 35000, 'cash', 'Nasi bungkus siang 2 porsi + es teh kru kasir'],
        ['EXP-20261018-0002', 1, 2, 'parkir_retribusi', 'Parkir & Retribusi Pasar', 'expense', 15000, 'cash', 'Salar kebersihan & keamanan pasar harian'],
        ['EXP-20261018-0003', 1, 2, 'kuli_bongkar', 'Kuli Panggul & Bongkar Muat', 'expense', 50000, 'cash', 'Upah panggul turun 25 karung ubi cilembu'],
        ['EXP-20261018-0004', 1, 1, 'listrik_token', 'Listrik & Token PLN', 'expense', 100000, 'transfer', 'Isi token listrik kios 1300VA'],
        ['EXP-20261018-0005', 1, 1, 'wifi_pulsa', 'WiFi, Internet & Pulsa', 'expense', 150000, 'transfer', 'Tagihan bulanan WiFi router kios']
      ];

      for (const exp of defaultExpenses) {
        await dbQuery.run(
          `INSERT INTO store_expenses (expense_no, shift_id, user_id, category, category_name, type, amount, source, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          exp
        );
      }
    }
  } catch (err) {
    console.warn('[DB] seedInitialExpenses skipped:', err.message);
  }
}

/**
 * Calculates real-time physical cash expected in the cashier drawer
 * for the currently active shift (or a specified shift).
 */
async function getCurrentDrawerCash(targetShiftId = null) {
  let shift;
  if (targetShiftId) {
    shift = await dbQuery.get('SELECT * FROM shifts WHERE id = ?', [targetShiftId]);
  } else {
    shift = await dbQuery.get("SELECT * FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1");
  }

  if (!shift) {
    return {
      has_active_shift: false,
      shift: null,
      starting_cash: 0,
      cash_sales: 0,
      cash_expenses: 0,
      cash_income: 0,
      cash_supplier_payments: 0,
      current_drawer_cash: 0
    };
  }

  const cashSalesRow = await dbQuery.get(
    `SELECT COALESCE(SUM(total_amount), 0) as cash_sales
     FROM orders
     WHERE shift_id = ? AND payment_method = 'cash' AND status = 'completed'`,
    [shift.id]
  );

  const expensesRow = await dbQuery.get(
    `SELECT 
       COALESCE(SUM(CASE WHEN type = 'expense' AND source = 'cash' THEN amount ELSE 0 END), 0) as cash_expenses,
       COALESCE(SUM(CASE WHEN type = 'income' AND source = 'cash' THEN amount ELSE 0 END), 0) as cash_income
     FROM store_expenses
     WHERE shift_id = ?`,
    [shift.id]
  );

  const supplierCashRow = await dbQuery.get(
    `SELECT COALESCE(SUM(amount_paid), 0) as cash_supplier_payments
     FROM supplier_payments
     WHERE payment_method = 'cash' AND (shift_id = ? OR (shift_id IS NULL AND payment_date >= ?))`,
    [shift.id, shift.start_time]
  );

  const debtCashRow = await dbQuery.get(
    `SELECT COALESCE(SUM(amount_paid), 0) as cash_debt_collected
     FROM debt_payments
     WHERE (shift_id = ? OR (payment_date >= ? AND shift_id IS NULL)) AND payment_method = 'cash'`,
    [shift.id, shift.start_time]
  );

  const safeTransferRow = await dbQuery.get(
    `SELECT 
       COALESCE(SUM(CASE WHEN type = 'deposit' AND source = 'drawer' THEN amount ELSE 0 END), 0) as cash_deposited_to_safe,
       COALESCE(SUM(CASE WHEN type = 'withdrawal' AND source = 'drawer' THEN amount ELSE 0 END), 0) as cash_withdrawn_from_safe
     FROM safe_cash_transactions
     WHERE shift_id = ? OR (shift_id IS NULL AND created_at >= ?)`,
    [shift.id, shift.start_time]
  );

  const starting_cash = Number(shift.starting_cash) || 0;
  const cash_sales = Number(cashSalesRow ? cashSalesRow.cash_sales : 0) || 0;
  const cash_expenses = Number(expensesRow ? expensesRow.cash_expenses : 0) || 0;
  const cash_income = Number(expensesRow ? expensesRow.cash_income : 0) || 0;
  const cash_supplier_payments = Number(supplierCashRow ? supplierCashRow.cash_supplier_payments : 0) || 0;
  const cash_debt_collected = Number(debtCashRow ? debtCashRow.cash_debt_collected : 0) || 0;
  const cash_deposited_to_safe = Number(safeTransferRow ? safeTransferRow.cash_deposited_to_safe : 0) || 0;
  const cash_withdrawn_from_safe = Number(safeTransferRow ? safeTransferRow.cash_withdrawn_from_safe : 0) || 0;

  const current_drawer_cash = starting_cash + cash_sales + cash_income + cash_debt_collected + cash_withdrawn_from_safe - cash_expenses - cash_supplier_payments - cash_deposited_to_safe;

  return {
    has_active_shift: true,
    shift,
    starting_cash,
    cash_sales,
    cash_expenses,
    cash_income,
    cash_debt_collected,
    cash_supplier_payments,
    cash_deposited_to_safe,
    cash_withdrawn_from_safe,
    current_drawer_cash
  };
}

// Helper for Safe Cash Balance (Uang Kas di Brankas Toko)
async function getSafeCashBalance() {
  const row = await dbQuery.get(`
    SELECT 
      COALESCE(SUM(
        CASE 
          WHEN type IN ('initial', 'deposit', 'transfer_in', 'income') THEN amount
          WHEN type IN ('withdrawal', 'transfer_out', 'expense', 'supplier_pay', 'prive') THEN -amount
          ELSE 0
        END
      ), 0) as balance,
      COUNT(id) as total_trx,
      COALESCE(SUM(CASE WHEN type IN ('initial', 'deposit', 'transfer_in', 'income') THEN amount ELSE 0 END), 0) as total_in,
      COALESCE(SUM(CASE WHEN type IN ('withdrawal', 'transfer_out', 'expense', 'supplier_pay', 'prive') THEN amount ELSE 0 END), 0) as total_out
    FROM safe_cash_transactions
  `);
  return {
    balance: Number(row ? row.balance : 0) || 0,
    total_trx: Number(row ? row.total_trx : 0) || 0,
    total_in: Number(row ? row.total_in : 0) || 0,
    total_out: Number(row ? row.total_out : 0) || 0
  };
}

async function recordSafeCashTransaction({ user_id, type, amount, source = 'cash', reference_no = null, notes = '', shift_id = null }) {
  const numAmount = Math.max(0, Math.round(Number(amount) || 0));
  if (numAmount <= 0) {
    throw new Error('Nominal transaksi brankas harus lebih dari Rp 0');
  }

  const current = await getSafeCashBalance();
  const balanceBefore = current.balance;

  const isDeduction = ['withdrawal', 'transfer_out', 'expense', 'supplier_pay', 'prive'].includes(type);
  if (isDeduction && balanceBefore < numAmount) {
    throw new Error(`Saldo uang di brankas tidak mencukupi! Saldo saat ini: Rp ${balanceBefore.toLocaleString('id-ID')}, penarikan: Rp ${numAmount.toLocaleString('id-ID')}`);
  }

  const balanceAfter = isDeduction ? (balanceBefore - numAmount) : (balanceBefore + numAmount);

  // Generate transaction number: TRX-BRK-YYYYMMDD-XXXX
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `TRX-BRK-${dateStr}-`;
  const last = await dbQuery.get('SELECT trx_no FROM safe_cash_transactions WHERE trx_no LIKE ? ORDER BY id DESC LIMIT 1', [`${prefix}%`]);
  let seq = 1;
  if (last && last.trx_no) {
    const parts = last.trx_no.split('-');
    if (parts.length >= 4) {
      seq = parseInt(parts[3], 10) + 1;
    }
  }
  const trx_no = `${prefix}${String(seq).padStart(4, '0')}`;

  const res = await dbQuery.run(`
    INSERT INTO safe_cash_transactions 
    (trx_no, user_id, shift_id, type, amount, balance_before, balance_after, source, reference_no, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `, [trx_no, user_id, shift_id, type, numAmount, balanceBefore, balanceAfter, source, reference_no, notes]);

  return {
    id: res.lastID,
    trx_no,
    user_id,
    shift_id,
    type,
    amount: numAmount,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    source,
    reference_no,
    notes
  };
}

module.exports = {
  db,
  dbQuery,
  initDatabase,
  getCurrentDrawerCash,
  getSafeCashBalance,
  recordSafeCashTransaction
};

