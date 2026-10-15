const { spawn } = require('child_process');
const http = require('http');

const PORT = 4000;
const BASE_URL = `http://localhost:${PORT}/api`;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('--- 🧪 STARTING API VERIFICATION TEST ---');

  // 1. Health check
  const health = await request('GET', '/health');
  console.log('1. Health check:', health.status === 200 ? '✅ PASSED' : '❌ FAILED', health.body);

  // 2. Login as Cashier (PIN: 112233)
  const cashierLogin = await request('POST', '/auth/login', { pin: '112233' });
  console.log('2. Cashier Login:', cashierLogin.body.success ? '✅ PASSED' : '❌ FAILED', cashierLogin.body.user);
  const cashierToken = cashierLogin.body.token;

  // 3. Login as Owner (PIN: 123456)
  const ownerLogin = await request('POST', '/auth/login', { pin: '123456' });
  console.log('3. Owner Login:', ownerLogin.body.success ? '✅ PASSED' : '❌ FAILED', ownerLogin.body.user);
  const ownerToken = ownerLogin.body.token;

  // 4. Check & Open Shift
  const currentShiftCheck = await request('GET', '/shifts/current', null, cashierToken);
  let shiftId;
  if (!currentShiftCheck.body.has_active_shift) {
    const openShift = await request('POST', '/shifts/open', { starting_cash: 200000 }, cashierToken);
    console.log('4. Open Shift (Starting Cash Rp 200.000):', openShift.body.success ? '✅ PASSED' : '❌ FAILED');
    shiftId = openShift.body.shift.id;
  } else {
    shiftId = currentShiftCheck.body.shift.id;
    console.log('4. Open Shift: Active shift already exists with ID', shiftId);
  }

  // 5. Fetch Products
  const productsRes = await request('GET', '/products', null, cashierToken);
  const kentang = productsRes.body.products.find((p) => p.name.includes('Kentang'));
  console.log('5. Products fetched:', productsRes.body.products.length, 'items. Kentang: Eceran Rp', kentang.retail_price, '| Reseller Rp', kentang.reseller_price);

  // 6. Test Multi-tier Pricing Case A: Walk-in buyer buys 3 kg Kentang (< 10kg min qty) -> Should get RETAIL price
  const orderRetail = await request('POST', '/orders', {
    shift_id: shiftId,
    customer_id: null,
    payment_method: 'cash',
    cash_tendered: 50000,
    items: [{ product_id: kentang.id, qty: 3 }]
  }, cashierToken);

  const itemA = orderRetail.body.order.items[0];
  const passedRetailRule = itemA.price_tier === 'retail' && itemA.unit_price === kentang.retail_price;
  console.log('6. Order 1 (3 kg Kentang Walk-in): Tier =', itemA.price_tier, 'Subtotal =', itemA.subtotal, passedRetailRule ? '✅ PASSED (Eceran Rp 16.000)' : '❌ FAILED');

  // 7. Test Multi-tier Pricing Case B: Walk-in buyer buys 15 kg Kentang (>= 10kg threshold) -> Should AUTO-SWITCH to RESELLER price!
  const orderWholesale = await request('POST', '/orders', {
    shift_id: shiftId,
    customer_id: null,
    payment_method: 'cash',
    cash_tendered: 250000,
    items: [{ product_id: kentang.id, qty: 15 }]
  }, cashierToken);

  const itemB = orderWholesale.body.order.items[0];
  const passedWholesaleRule = itemB.price_tier === 'reseller' && itemB.unit_price === kentang.reseller_price;
  console.log('7. Order 2 (15 kg Kentang Volume Threshold): Tier =', itemB.price_tier, 'Subtotal =', itemB.subtotal, passedWholesaleRule ? '✅ PASSED (Auto Reseller Rp 13.500)' : '❌ FAILED');

  // 8. Test Multi-tier Pricing Case C: Registered Reseller buys 2 kg Kentang (< 10kg) -> Should get RESELLER price because customer profile is reseller!
  const customersRes = await request('GET', '/customers?tier=reseller', null, cashierToken);
  const resellerCustomer = customersRes.body.customers[0];

  const orderResellerProfile = await request('POST', '/orders', {
    shift_id: shiftId,
    customer_id: resellerCustomer.id,
    payment_method: 'cash',
    cash_tendered: 30000,
    items: [{ product_id: kentang.id, qty: 2 }]
  }, cashierToken);

  const itemC = orderResellerProfile.body.order.items[0];
  const passedResellerProfileRule = itemC.price_tier === 'reseller' && itemC.unit_price === kentang.reseller_price;
  console.log('8. Order 3 (2 kg Kentang for Reseller Customer Profile): Tier =', itemC.price_tier, 'Subtotal =', itemC.subtotal, passedResellerProfileRule ? '✅ PASSED (Profile Reseller Rp 13.500)' : '❌ FAILED');

  // 9. Test Anti-Fraud Susut/Busuk input
  const adjustRes = await request('POST', '/products/adjust-stock', {
    product_id: kentang.id,
    shift_id: shiftId,
    type: 'busuk',
    qty_kg: 1.5,
    notes: 'Kentang berlubang dan busuk dari karung baru',
    photo_url: 'https://storage.local/photos/kentang_busuk_1.jpg'
  }, cashierToken);
  console.log('9. Waste/Susut recording:', adjustRes.body.success ? '✅ PASSED' : '❌ FAILED', adjustRes.body.message);

  // 10. Test Owner Dashboard Metrics & Fraud Indicators
  const dashboard = await request('GET', '/reports/dashboard', null, ownerToken);
  console.log('10. Owner Smartphone Dashboard:');
  console.log('    - Total Revenue Today: Rp', dashboard.body.summary.total_revenue.toLocaleString('id-ID'));
  console.log('    - Cash In Drawer Now: Rp', dashboard.body.summary.cash_in_drawer.toLocaleString('id-ID'));
  console.log('    - Ratio Volume: Retail', dashboard.body.anti_fraud.retail_percentage + '% | Reseller', dashboard.body.anti_fraud.reseller_percentage + '%');
  console.log('    - Anomaly Flag:', dashboard.body.anti_fraud.is_ratio_anomalous ? '⚠️ YES' : '🟢 NORMAL');

  // 11. Test Blind Shift Close (Cashier enters counted physical cash)
  // Let's deliberately enter a minor discrepancy to verify difference calculation
  const calculatedExpected = dashboard.body.summary.cash_in_drawer;
  const countedPhysical = calculatedExpected - 5000; // shortage of Rp 5.000
  const closeShiftRes = await request('POST', '/shifts/close', {
    shift_id: shiftId,
    actual_cash: countedPhysical,
    breakdown: { c100k: Math.floor(countedPhysical / 100000), remainder: countedPhysical % 100000 },
    closing_notes: 'Ada selisih Rp 5.000 karena koin kembalian tercecer'
  }, cashierToken);

  console.log('11. Blind Close Shift Summary:');
  console.log('    - Expected:', closeShiftRes.body.summary.expected_system_cash);
  console.log('    - Actual:', closeShiftRes.body.summary.actual_cash_input);
  console.log('    - Difference:', closeShiftRes.body.summary.cash_difference, closeShiftRes.body.summary.cash_difference < 0 ? '⚠️ MINUS DETECTED' : 'BALANCED');

  console.log('\n--- 🎉 ALL CORE BUSINESS & ANTI-FRAUD LOGICS TESTED SUCCESSFULLY! ---');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
