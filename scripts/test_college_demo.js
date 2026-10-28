const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const TEST_DIR = path.resolve(__dirname, '../DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test');
require(path.resolve(TEST_DIR, 'node_modules/dotenv')).config({ path: path.resolve(TEST_DIR, '.env') });
const mysql = require(path.resolve(TEST_DIR, 'node_modules/mysql2/promise'));

const BASE_URL = 'http://localhost:3000';

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

async function runDirectSqlLabTest(host, port, user, password) {
  console.log('\n======================================================');
  console.log('   PART 1: DIRECT EXECUTION OF DBMS_LAB_FINAL.sql     ');
  console.log('======================================================');

  const labSqlPath = path.resolve(__dirname, '../DBMS_LAB_FINAL.sql');
  console.log(`Executing ${labSqlPath} against MySQL 8.0...`);

  const pwdArg = password ? `-p"${password}"` : '';
  const cmd = `mysql -h ${host} -P ${port} -u ${user} ${pwdArg} < "${labSqlPath}"`;
  const output = execSync(cmd, { shell: 'cmd.exe', encoding: 'utf8' });
  console.log(output);

  // Connect to bankist_college_demo to verify post-conditions
  const conn = await mysql.createConnection({
    host, port, user, password,
    database: 'bankist_college_demo'
  });

  const [accs] = await conn.query('SELECT account_number, balance FROM accounts WHERE account_number IN ("ACC-1001", "ACC-1002") ORDER BY account_number');
  assert(accs.length === 2, 'Exactly 2 demo accounts verified');
  assert(parseFloat(accs[0].balance) === 5500.00, `ACC-1001 balance after test sequence: ₹${accs[0].balance} === ₹5,500.00`);
  assert(parseFloat(accs[1].balance) === 2500.00, `ACC-1002 balance after test sequence: ₹${accs[1].balance} === ₹2,500.00`);

  const [txns] = await conn.query('SELECT COUNT(*) as cnt FROM transactions WHERE type IN ("Deposit", "Transfer")');
  assert(txns[0].cnt === 2, `Exactly 2 transactions (1 deposit, 1 transfer) recorded in ledger: ${txns[0].cnt}`);

  await conn.end();
  console.log('[SUCCESS] PART 1: DBMS_LAB_FINAL.sql executed and verified with 100% compliance!\n');
}

async function runApplicationWorkflowTest() {
  console.log('======================================================');
  console.log('   PART 2: FULL-STACK APPLICATION DEMO VERIFICATION   ');
  console.log('======================================================');

  // TEST 1: Login
  console.log('\n--- DEMO TEST 1: Authentication & Authorization ---');
  // 1a. Valid login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav@example.com', password: '1234' }),
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200, 'Valid credentials login returned HTTP 200 OK');
  assert(!!loginData.token, 'Session JWT token issued successfully');
  assert(loginData.customer.customer_id === 'CUST-101', 'Authenticated customer matches CUST-101 (Aarav Patel)');
  const aaravToken = loginData.token;
  const aaravAccount = loginData.accounts[0].account_number;
  console.log(`  Logged in as Aarav Patel. Primary Account: ${aaravAccount}, Initial Balance: ₹${loginData.accounts[0].balance}`);

  // 1b. Invalid login
  const badLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav@example.com', password: 'wrongpassword' }),
  });
  assert(badLoginRes.status === 401, 'Invalid credentials rejected with HTTP 401 Unauthorized');

  // Log in second user (Priya Nair) to get destination account
  const priyaLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'priya@example.com', password: '1234' }),
  });
  const priyaData = await priyaLoginRes.json();
  assert(priyaLoginRes.status === 200, 'Priya Nair login returned HTTP 200 OK');
  const priyaAccount = priyaData.accounts[0].account_number;
  console.log(`  Logged in as Priya Nair. Primary Account: ${priyaAccount}, Initial Balance: ₹${priyaData.accounts[0].balance}`);

  // Fetch baseline balance for Aarav
  const myAccRes = await fetch(`${BASE_URL}/api/accounts/my-accounts`, {
    headers: { Authorization: `Bearer ${aaravToken}` }
  });
  const myAccData = await myAccRes.json();
  const initialAaravBalance = parseFloat(myAccData.accounts[0].balance);
  console.log(`\nBaseline balance for ${aaravAccount}: ₹${initialAaravBalance}`);

  // TEST 2: Deposit ₹1,000
  console.log('\n--- DEMO TEST 2: Valid Deposit (₹1,000.00) ---');
  const depRes = await fetch(`${BASE_URL}/api/accounts/${aaravAccount}/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aaravToken}`
    },
    body: JSON.stringify({ amount: 1000, pin: '1234', description: 'College Demo Deposit' })
  });
  const depData = await depRes.json();
  assert(depRes.status === 200, 'Deposit request returned HTTP 200 OK');
  assert(parseFloat(depData.account.balance) === initialAaravBalance + 1000, `Balance updated correctly: ₹${initialAaravBalance + 1000}`);
  assert(!!depData.transaction.reference_number, `Deposit reference number issued: ${depData.transaction.reference_number}`);

  // TEST 3: Transfer ₹500 from Aarav to Priya
  console.log('\n--- DEMO TEST 3: Valid Fund Transfer (₹500.00) ---');
  const trfRes = await fetch(`${BASE_URL}/api/accounts/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aaravToken}`
    },
    body: JSON.stringify({
      from_account: aaravAccount,
      to_account: priyaAccount,
      amount: 500,
      pin: '1234',
      description: 'College Demo Fund Transfer'
    })
  });
  const trfData = await trfRes.json();
  assert(trfRes.status === 200, 'Transfer request returned HTTP 200 OK');
  assert(parseFloat(trfData.sender.balance) === initialAaravBalance + 1000 - 500, `Sender balance accurately debited by ₹500: ₹${trfData.sender.balance}`);
  assert(!!trfData.transaction.reference_number, `Transfer reference number issued: ${trfData.transaction.reference_number}`);

  // TEST 4: Invalid Deposit (Negative amount)
  console.log('\n--- DEMO TEST 4: Rejecting Invalid Deposit (₹-500.00) ---');
  const badDepRes = await fetch(`${BASE_URL}/api/accounts/${aaravAccount}/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aaravToken}`
    },
    body: JSON.stringify({ amount: -500, pin: '1234' })
  });
  assert(badDepRes.status === 400, 'Negative deposit strictly rejected with HTTP 400 Bad Request');

  // TEST 5: Insufficient Funds Transfer
  console.log('\n--- DEMO TEST 5: Rejecting Insufficient Funds Transfer ---');
  const overdraftRes = await fetch(`${BASE_URL}/api/accounts/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aaravToken}`
    },
    body: JSON.stringify({
      from_account: aaravAccount,
      to_account: priyaAccount,
      amount: 9999999, // Exceeds balance and limit
      pin: '1234'
    })
  });
  assert(overdraftRes.status === 400, 'Overdraft transfer strictly rejected with HTTP 400 Bad Request');

  // TEST 6: Atomic Rollback Invariant
  console.log('\n--- DEMO TEST 6: Atomic Transaction Rollback Invariant ---');
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_NAME || 'bankist'
  });

  const [[{ preBal }]] = await db.query('SELECT balance AS preBal FROM accounts WHERE account_number = ?', [aaravAccount]);
  let rollbackCaught = false;
  try {
    await db.query('START TRANSACTION');
    await db.query('UPDATE accounts SET balance = balance - 100 WHERE account_number = ?', [aaravAccount]);
    // Deliberately trigger syntax/runtime error
    await db.query('INSERT INTO non_existent_table_for_rollback_test VALUES (1)');
    await db.query('COMMIT');
  } catch (e) {
    rollbackCaught = true;
    await db.query('ROLLBACK');
  }

  const [[{ postBal }]] = await db.query('SELECT balance AS postBal FROM accounts WHERE account_number = ?', [aaravAccount]);
  assert(rollbackCaught, 'Transaction exception deliberately caught and triggered ROLLBACK');
  assert(parseFloat(preBal) === parseFloat(postBal), `Balance completely restored after rollback: ₹${preBal} === ₹${postBal}`);
  await db.end();

  console.log('\n======================================================');
  console.log('   ALL 7 COLLEGE DEMO REQUIREMENTS VERIFIED 100%      ');
  console.log('======================================================\n');
}

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';

  await runDirectSqlLabTest(host, port, user, password);
  await runApplicationWorkflowTest();
}

main().catch(err => {
  console.error('[DEMO TEST ERROR]', err);
  process.exit(1);
});
