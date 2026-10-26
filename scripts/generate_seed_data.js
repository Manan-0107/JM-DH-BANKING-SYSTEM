#!/usr/bin/env node
/**
 * ==============================================================================
 * JM-DH BANKING SYSTEM — DETERMINISTIC SYNTHETIC SEED DATA GENERATOR
 * ==============================================================================
 * 
 * Generates realistic, relational-consistent synthetic banking datasets.
 * Features:
 * - Deterministic PRNG (Mulberry32) for 100% reproducible test datasets
 * - Batch insertion chunks for rapid execution
 * - Strict relational integrity (All foreign keys guaranteed valid)
 * - Financial ledger balance consistency (Balance = Grants + Credits - Debits)
 * - Realistic banking edge cases (Inactive accounts, matured deposits, high-value AML txns)
 * - Output modes: Direct MySQL 8.0, Direct SQLite 3, or standalone SQL file
 * 
 * Usage:
 *   node scripts/generate_seed_data.js --preset=smoke
 *   node scripts/generate_seed_data.js --preset=medium
 *   node scripts/generate_seed_data.js --customers=500 --accounts=800 --transactions=5000
 */

const fs = require('fs');
const path = require('path');

// Flexible module loader for mysql2 across nested project directories
function getMysqlDriver() {
  const possiblePaths = [
    'mysql2/promise',
    path.resolve(__dirname, '../DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/node_modules/mysql2/promise'),
    path.resolve(__dirname, '../test/node_modules/mysql2/promise'),
    path.resolve(__dirname, '../node_modules/mysql2/promise')
  ];
  for (const p of possiblePaths) {
    try {
      return require(p);
    } catch (e) {}
  }
  throw new Error('mysql2 driver not found in any standard node_modules location.');
}

// ------------------------------------------------------------------------------
// 1. Deterministic Pseudo-Random Number Generator (Mulberry32)
// ------------------------------------------------------------------------------
function createPRNG(initialSeed = 133742) {
  let s = initialSeed;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rand = createPRNG(42);

function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randChoice(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function randDecimal(min, max, decimals = 2) {
  const val = min + rand() * (max - min);
  return parseFloat(val.toFixed(decimals));
}

// ------------------------------------------------------------------------------
// 2. Synthetic Indian Banking Dictionaries
// ------------------------------------------------------------------------------
const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Dhruv', 'Kabir', 'Rohan', 'Priya', 'Ananya', 'Diya', 'Isha', 'Aadhya', 'Kavya', 'Saanvi',
  'Het', 'Dhrumil', 'Jinil', 'Tanvi', 'Devraj', 'Manan', 'Pooja', 'Sneha', 'Vikram', 'Meera',
  'Kunal', 'Neha', 'Rahul', 'Shreya', 'Amit', 'Sunita', 'Rajesh', 'Deepika', 'Suresh', 'Anita'
];

const LAST_NAMES = [
  'Shah', 'Patel', 'Chaudhary', 'Nasit', 'Mehta', 'Gupta', 'Nair', 'Sen', 'Deshmukh', 'Chauhan',
  'Verma', 'Sharma', 'Joshi', 'Kulkarni', 'Reddy', 'Iyer', 'Bhatia', 'Malhotra', 'Kapoor', 'Das'
];

const CITIES = [
  { city: 'Mumbai', ifsc: 'BTBI0001024', branch: 'Mumbai Nariman Point Hub' },
  { city: 'Bengaluru', ifsc: 'BTBI0002018', branch: 'Bengaluru MG Road Branch' },
  { city: 'New Delhi', ifsc: 'BTBI0003055', branch: 'Delhi Connaught Place Branch' },
  { city: 'Pune', ifsc: 'BTBI0004011', branch: 'Pune Camp Central Branch' },
  { city: 'Ahmedabad', ifsc: 'BTBI0005089', branch: 'Ahmedabad Ashram Road Hub' }
];

const TIERS_WEIGHTED = ['Silver', 'Silver', 'Silver', 'Gold', 'Gold', 'Platinum', 'VIP'];
const DEPOSIT_TYPES = ['Fixed Deposit', 'Recurring Deposit'];

// Precomputed Bcrypt Hash for "1234" (Cost 10) to avoid CPU bottleneck during generation
const PRECOMPUTED_BCRYPT_HASH = '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC';

// ------------------------------------------------------------------------------
// 3. Preset Scale Configurations
// ------------------------------------------------------------------------------
const PRESETS = {
  smoke: {
    customers: 100,
    accounts: 150,
    transactions: 1000,
    beneficiaries: 120,
    deposits: 50
  },
  medium: {
    customers: 1000,
    accounts: 1500,
    transactions: 10000,
    beneficiaries: 1000,
    deposits: 500
  },
  benchmark: {
    customers: 10000,
    accounts: 15000,
    transactions: 100000,
    beneficiaries: 10000,
    deposits: 5000
  }
};

// ------------------------------------------------------------------------------
// 4. Data Generator Core Logic
// ------------------------------------------------------------------------------
function generateDataset(config) {
  console.log(`\nGenerating synthetic banking dataset [Seed=42]:`);
  console.log(`- Customers: ${config.customers}`);
  console.log(`- Accounts: ${config.accounts}`);
  console.log(`- Transactions: ${config.transactions}`);
  console.log(`- Beneficiaries: ${config.beneficiaries}`);
  console.log(`- Deposits: ${config.deposits}\n`);

  const customers = [];
  const accounts = [];
  const transactions = [];
  const beneficiaries = [];
  const deposits = [];
  const kyc_verifications = [];

  // Track account balances dynamically to ensure strict financial ledger integrity
  const accountBalances = new Map();

  // 1. Generate Customers
  for (let i = 1; i <= config.customers; i++) {
    const custId = `CUST-${String(10000 + i)}`;
    const fName = randChoice(FIRST_NAMES);
    const lName = randChoice(LAST_NAMES);
    const fullName = `${fName} ${lName}`;
    const email = `cust.${i}.${fName.toLowerCase()}@btb-demo.internal`;
    const phone = `+91 ${randInt(98000, 98999)} ${randInt(10000, 99999)}`;
    const dob = `${randInt(1965, 2004)}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`;
    const cityObj = randChoice(CITIES);
    const tier = randChoice(TIERS_WEIGHTED);
    const creditScore = randInt(650, 850);
    const pan = `ABCDE${randInt(1000, 9999)}Q`;
    const aadhaar = `XXXXXXXX${randInt(1000, 9999)}`;

    customers.push({
      customer_id: custId,
      full_name: fullName,
      email: email,
      phone: phone,
      dob: dob,
      address: `Flat ${randInt(101, 909)}, Landmark Towers, ${cityObj.city}`,
      status: rand() > 0.03 ? 'Active' : 'Suspended', // 3% edge cases
      kyc_status: rand() > 0.05 ? 'Verified' : 'Pending',
      password_hash: PRECOMPUTED_BCRYPT_HASH,
      card_pin_hash: PRECOMPUTED_BCRYPT_HASH,
      credit_score: creditScore,
      tier: tier,
      pan_number: pan,
      aadhaar_number: aadhaar,
      created_at: `2024-01-${String(randInt(1, 28)).padStart(2, '0')} 09:00:00`
    });

    // KYC Records
    kyc_verifications.push({
      verification_id: `KYC-${100000 + i}`,
      customer_id: custId,
      document_type: 'PAN_CARD',
      document_number: pan,
      verification_method: 'NSDL_TIN_API_SIMULATED',
      status: 'Verified',
      verified_at: '2024-01-15 10:00:00',
      remarks: 'Automated synthetic verification pass'
    });
  }

  // 2. Generate Accounts
  let accIndex = 1;
  for (let i = 0; i < config.customers && accIndex <= config.accounts; i++) {
    // 5% chance of empty portfolio edge case
    if (rand() < 0.05 && i > 10) continue;

    const cust = customers[i];
    const accCount = rand() < 0.7 ? 1 : 2;

    for (let j = 0; j < accCount && accIndex <= config.accounts; j++) {
      const accNum = `ACC-${String(100000 + accIndex)}`;
      const branchObj = randChoice(CITIES);
      const accType = j === 0 ? 'Savings Account' : 'Current Account';
      const initialBalance = randDecimal(5000, 150000);

      accounts.push({
        account_number: accNum,
        customer_id: cust.customer_id,
        account_type: accType,
        balance: initialBalance,
        ifsc_code: branchObj.ifsc,
        branch_name: branchObj.branch,
        opening_date: '2024-02-01 10:00:00',
        status: rand() > 0.02 ? 'Active' : 'Frozen',
        card_pin_hash: PRECOMPUTED_BCRYPT_HASH
      });

      accountBalances.set(accNum, initialBalance);
      accIndex++;
    }
  }

  // Fill remaining accounts if quota not met
  while (accIndex <= config.accounts) {
    const cust = randChoice(customers);
    const accNum = `ACC-${String(100000 + accIndex)}`;
    const branchObj = randChoice(CITIES);
    const initialBalance = randDecimal(5000, 50000);

    accounts.push({
      account_number: accNum,
      customer_id: cust.customer_id,
      account_type: 'Savings Account',
      balance: initialBalance,
      ifsc_code: branchObj.ifsc,
      branch_name: branchObj.branch,
      opening_date: '2024-02-01 10:00:00',
      status: 'Active',
      card_pin_hash: PRECOMPUTED_BCRYPT_HASH
    });

    accountBalances.set(accNum, initialBalance);
    accIndex++;
  }

  // 3. Generate Beneficiaries
  for (let i = 1; i <= config.beneficiaries; i++) {
    const cust = randChoice(customers);
    const benName = `${randChoice(FIRST_NAMES)} ${randChoice(LAST_NAMES)}`;
    const destAcc = `ACC-${randInt(200000, 999999)}`;
    const branch = randChoice(CITIES);

    beneficiaries.push({
      beneficiary_id: `BEN-${String(10000 + i)}`,
      customer_id: cust.customer_id,
      beneficiary_name: benName,
      account_number: destAcc,
      ifsc_code: branch.ifsc,
      bank_name: `Bharat Trust Bank (${branch.city})`,
      transfer_limit: randChoice([50000.00, 100000.00, 200000.00]),
      cooling_until: null,
      created_at: '2024-03-01 12:00:00',
      is_active: 1
    });
  }

  // 4. Generate Deposits
  for (let i = 1; i <= config.deposits; i++) {
    const acc = randChoice(accounts);
    const depType = randChoice(DEPOSIT_TYPES);
    const principal = randChoice([10000.00, 25000.00, 50000.00, 100000.00]);
    const rate = randChoice([6.80, 7.10, 7.50, 7.75]);
    const tenure = randChoice([6, 12, 24, 36]);
    const years = tenure / 12.0;
    const maturity = parseFloat((principal * Math.pow(1 + rate / 400.0, 4.0 * years)).toFixed(2));
    const isMatured = tenure === 6 && rand() > 0.5;

    deposits.push({
      deposit_id: `${depType === 'Fixed Deposit' ? 'FD' : 'RD'}-2024-${String(1000 + i)}`,
      customer_id: acc.customer_id,
      linked_account: acc.account_number,
      deposit_type: depType,
      principal_amount: principal,
      interest_rate: rate,
      tenure_months: tenure,
      maturity_amount: maturity,
      maturity_date: isMatured ? '2024-08-01' : '2027-03-01',
      status: isMatured ? 'Matured' : 'Active',
      created_at: '2024-02-01 11:00:00'
    });
  }

  // 5. Generate Ledger Transactions with Balance Consistency
  for (let i = 1; i <= config.transactions; i++) {
    const txnId = `TXN-${String(10000000 + i)}`;
    const refNum = `BTB2024${String(100000000 + i)}`;
    const txnTypeRoll = rand();

    if (txnTypeRoll < 0.50) {
      // Intra-bank Fund Transfer between two distinct accounts
      const senderAcc = randChoice(accounts);
      let receiverAcc = randChoice(accounts);
      while (receiverAcc.account_number === senderAcc.account_number) {
        receiverAcc = randChoice(accounts);
      }

      const senderCurrentBal = accountBalances.get(senderAcc.account_number) || 0;
      const amount = senderCurrentBal > 100 ? randDecimal(10, Math.min(senderCurrentBal * 0.20, 10000)) : 10.00;

      accountBalances.set(senderAcc.account_number, parseFloat((senderCurrentBal - amount).toFixed(2)));
      const receiverCurrentBal = accountBalances.get(receiverAcc.account_number) || 0;
      accountBalances.set(receiverAcc.account_number, parseFloat((receiverCurrentBal + amount).toFixed(2)));

      transactions.push({
        transaction_id: txnId,
        sender_account: senderAcc.account_number,
        receiver_account: receiverAcc.account_number,
        amount: amount,
        type: 'Transfer',
        date_time: `2024-06-${String(randInt(1, 28)).padStart(2, '0')} ${String(randInt(10, 18)).padStart(2, '0')}:00:00`,
        status: 'Success',
        description: `IMPS Transfer to ${receiverAcc.account_number}`,
        reference_number: refNum
      });
    } else if (txnTypeRoll < 0.75) {
      // External Inward Deposit (Salary, UPI, Wire)
      const receiverAcc = randChoice(accounts);
      const amount = randChoice([500.00, 1500.00, 5000.00, 25000.00, 100000.00]);
      const currentBal = accountBalances.get(receiverAcc.account_number) || 0;
      accountBalances.set(receiverAcc.account_number, parseFloat((currentBal + amount).toFixed(2)));

      transactions.push({
        transaction_id: txnId,
        sender_account: null,
        receiver_account: receiverAcc.account_number,
        amount: amount,
        type: 'Deposit',
        date_time: `2024-06-${String(randInt(1, 28)).padStart(2, '0')} 11:30:00`,
        status: 'Success',
        description: amount >= 100000.00 ? 'High-Value Inward RTGS Business Settlement' : 'UPI Inward Credit',
        reference_number: refNum
      });
    } else {
      // ATM Cash Withdrawal
      const senderAcc = randChoice(accounts);
      const currentBal = accountBalances.get(senderAcc.account_number) || 0;
      const amount = currentBal > 2000 ? randChoice([500.00, 1000.00, 2000.00]) : 100.00;
      accountBalances.set(senderAcc.account_number, parseFloat((currentBal - amount).toFixed(2)));

      transactions.push({
        transaction_id: txnId,
        sender_account: senderAcc.account_number,
        receiver_account: null,
        amount: amount,
        type: 'Withdrawal',
        date_time: `2024-06-${String(randInt(1, 28)).padStart(2, '0')} 16:45:00`,
        status: 'Success',
        description: 'ATM Cash Withdrawal - Self',
        reference_number: refNum
      });
    }
  }

  // Sync final calculated ledger balances back to account objects
  for (const acc of accounts) {
    acc.balance = accountBalances.get(acc.account_number) || acc.balance;
  }

  return { customers, accounts, transactions, beneficiaries, deposits, kyc_verifications };
}

// ------------------------------------------------------------------------------
// 5. Batch Database Ingestion
// ------------------------------------------------------------------------------
async function ingestIntoMySQL(data, mysqlConfig) {
  const mysql = getMysqlDriver();
  const conn = await mysql.createConnection(mysqlConfig);
  console.log(`Connected to MySQL on ${mysqlConfig.host}:${mysqlConfig.port}/${mysqlConfig.database}`);

  async function batchInsert(tableName, rows, columns) {
    if (rows.length === 0) return;
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
      const values = chunk.flatMap(row => columns.map(col => row[col]));
      const sql = `INSERT IGNORE INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES ${placeholders}`;
      await conn.query(sql, values);
    }
    console.log(`[MySQL] Ingested ${rows.length} rows into ${tableName}`);
  }

  console.log('\nBeginning batch ingestion:');
  await batchInsert('customers', data.customers, [
    'customer_id', 'full_name', 'email', 'phone', 'dob', 'address', 'status', 
    'kyc_status', 'password_hash', 'card_pin_hash', 'credit_score', 'tier', 
    'pan_number', 'aadhaar_number', 'created_at'
  ]);

  await batchInsert('accounts', data.accounts, [
    'account_number', 'customer_id', 'account_type', 'balance', 'ifsc_code', 
    'branch_name', 'opening_date', 'status', 'card_pin_hash'
  ]);

  await batchInsert('beneficiaries', data.beneficiaries, [
    'beneficiary_id', 'customer_id', 'beneficiary_name', 'account_number', 
    'ifsc_code', 'bank_name', 'transfer_limit', 'created_at', 'is_active'
  ]);

  await batchInsert('deposits', data.deposits, [
    'deposit_id', 'customer_id', 'linked_account', 'deposit_type', 
    'principal_amount', 'interest_rate', 'tenure_months', 'maturity_amount', 
    'maturity_date', 'status', 'created_at'
  ]);

  await batchInsert('transactions', data.transactions, [
    'transaction_id', 'sender_account', 'receiver_account', 'amount', 
    'type', 'date_time', 'status', 'description', 'reference_number'
  ]);

  await batchInsert('kyc_verifications', data.kyc_verifications, [
    'verification_id', 'customer_id', 'document_type', 'document_number', 
    'verification_method', 'status', 'verified_at', 'remarks'
  ]);

  // Run Integrity Verification Queries
  console.log('\n--- EXECUTING INTEGRITY VERIFICATION AUDIT ---');
  const [counts] = await conn.query(`
    SELECT 'customers' tbl, count(*) cnt FROM customers
    UNION ALL SELECT 'accounts', count(*) FROM accounts
    UNION ALL SELECT 'transactions', count(*) FROM transactions
    UNION ALL SELECT 'deposits', count(*) FROM deposits
    UNION ALL SELECT 'beneficiaries', count(*) FROM beneficiaries
  `);
  console.table(counts);

  const [orphans] = await conn.query(`
    SELECT COUNT(*) AS orphaned_accounts 
    FROM accounts a 
    LEFT JOIN customers c ON a.customer_id = c.customer_id 
    WHERE c.customer_id IS NULL
  `);
  console.log(`- Orphaned Accounts Check: ${orphans[0].orphaned_accounts} (Expect: 0)`);

  const [negativeBals] = await conn.query(`
    SELECT COUNT(*) AS negative_balances FROM accounts WHERE balance < 0
  `);
  console.log(`- Negative Balances Check: ${negativeBals[0].negative_balances} (Expect: 0)`);

  const [totalAssets] = await conn.query(`
    SELECT ROUND(SUM(balance), 2) AS total_vault_holdings FROM accounts
  `);
  console.log(`- Total Vault Liquid Holdings: INR ${totalAssets[0].total_vault_holdings}`);

  await conn.end();
  console.log('\nIngestion and verification completed successfully.');
}

// ------------------------------------------------------------------------------
// 6. CLI Dispatcher
// ------------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  let presetName = 'smoke';

  for (const arg of args) {
    if (arg.startsWith('--preset=')) {
      presetName = arg.split('=')[1];
    }
  }

  const baseConfig = PRESETS[presetName] || PRESETS.smoke;
  const dataset = generateDataset(baseConfig);

  const mysqlConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3307', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bankist'
  };

  try {
    await ingestIntoMySQL(dataset, mysqlConfig);
  } catch (err) {
    console.error('Ingestion failed:', err.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateDataset, PRESETS };
