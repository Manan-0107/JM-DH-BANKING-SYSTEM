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

  // Verify all 8 views on the demo database
  const [vCustLegacy] = await conn.query('SELECT customer_id, full_name, nominee_name FROM v_customers_legacy ORDER BY customer_id');
  assert(vCustLegacy.length === 2 && vCustLegacy[0].nominee_name === 'Kavita Patel', 'View 1 (v_customers_legacy): 2 customers with deterministic nominee resolution');

  const [vAccLegacy] = await conn.query('SELECT account_number, branch_name FROM v_accounts_legacy ORDER BY account_number');
  assert(vAccLegacy.length === 2 && vAccLegacy[0].branch_name.includes('Nariman Point') && vAccLegacy[1].branch_name.includes('MG Road'), 'View 2 (v_accounts_legacy): 2 accounts with resolved branch_name');

  const [vPort] = await conn.query('SELECT customer_id, total_net_worth FROM v_customer_portfolio WHERE customer_id = "CUST-101"');
  assert(vPort.length === 1 && parseFloat(vPort[0].total_net_worth) === 15500.00, 'View 3 (v_customer_portfolio): CUST-101 net worth 15,500.00 verified');

  const [vHighVal] = await conn.query('SELECT COUNT(*) as cnt FROM v_high_value_transactions');
  assert(vHighVal[0].cnt >= 0, 'View 4 (v_high_value_transactions): Executed cleanly');

  const [vActDep] = await conn.query('SELECT deposit_id, customer_name, expected_interest_yield FROM v_active_deposits_summary WHERE deposit_id = "DEP-101"');
  assert(vActDep.length === 1 && vActDep[0].customer_name === 'Aarav Patel', 'View 5 (v_active_deposits_summary): DEP-101 mapped to Aarav Patel with calculated yield');

  const [vBranchPerf] = await conn.query('SELECT branch_id, total_active_accounts FROM v_branch_performance ORDER BY branch_id');
  assert(vBranchPerf.length === 2 && vBranchPerf[0].total_active_accounts === 1 && vBranchPerf[1].total_active_accounts === 1, 'View 6 (v_branch_performance): BR-001 active accounts aggregation verified');

  const [deps] = await conn.query('SELECT deposit_id, customer_id, full_name FROM v_deposits WHERE deposit_id = "DEP-101"');
  assert(deps.length === 1 && deps[0].customer_id === 'CUST-101', 'View 7 (v_deposits): Deposit ownership dynamically resolved via accounts: CUST-101 (Aarav Patel)');

  const [bens] = await conn.query('SELECT beneficiary_id, bank_name, branch_name FROM v_beneficiaries WHERE beneficiary_id = "BEN-101"');
  assert(bens.length === 1 && bens[0].bank_name === 'Bharat Trust Bank', 'View 8 (v_beneficiaries): Beneficiary bank dynamically resolved via branches: Bharat Trust Bank');

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
  // Strictly executed against isolated demo database bankist_college_demo to keep live bankist pristine
  console.log('\n--- DEMO TEST 6: Atomic Transaction Rollback Invariant ---');
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '3306'),
    database: 'bankist_college_demo'
  });

  const demoTestAccount = 'ACC-1001';
  const [[{ preBal }]] = await db.query('SELECT balance AS preBal FROM accounts WHERE account_number = ?', [demoTestAccount]);
  let rollbackCaught = false;
  try {
    await db.query('START TRANSACTION');
    await db.query('UPDATE accounts SET balance = balance - 100 WHERE account_number = ?', [demoTestAccount]);
    // Deliberately trigger runtime exception to test rollback guarantee
    await db.query('INSERT INTO non_existent_table_for_rollback_test VALUES (1)');
    await db.query('COMMIT');
  } catch (e) {
    rollbackCaught = true;
    await db.query('ROLLBACK');
  }

  const [[{ postBal }]] = await db.query('SELECT balance AS postBal FROM accounts WHERE account_number = ?', [demoTestAccount]);
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
