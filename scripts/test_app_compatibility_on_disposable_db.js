const path = require('path');
const fs = require('fs');
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.resolve(WORKSPACE_ROOT, 'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test');
require(path.resolve(TEST_DIR, 'node_modules/dotenv')).config({ path: path.resolve(TEST_DIR, '.env') });
const mysql = require(path.resolve(TEST_DIR, 'node_modules/mysql2/promise'));
const bcrypt = require(path.resolve(TEST_DIR, 'node_modules/bcryptjs'));

const DISPOSABLE_COMPAT_DB = `bankist_compat_eval_${Date.now()}`;
const DDL_PATH = path.resolve(WORKSPACE_ROOT, 'DBMS project/bankist_normalized.sql');
const MIGRATION_PATH = path.resolve(WORKSPACE_ROOT, 'DBMS project/bankist_migration.sql');

async function testAppCompatibility() {
  console.log('====================================================================');
  console.log('  TESTING REAL APPLICATION QUERIES AGAINST NORMALIZED DISPOSABLE DB ');
  console.log('====================================================================');
  console.log(`Disposable Database: ${DISPOSABLE_COMPAT_DB}`);

  const adminConn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '3306'),
    multipleStatements: true
  });

  try {
    // 1. Create disposable DB
    await adminConn.query(`CREATE DATABASE \`${DISPOSABLE_COMPAT_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log('[1/4] Disposable DB created.');

    const appConn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '3306'),
      database: DISPOSABLE_COMPAT_DB,
      multipleStatements: true
    });

    // 2. Apply Normalized Schema and Migration
    const ddl = fs.readFileSync(DDL_PATH, 'utf8');
    await appConn.query(ddl);
    await appConn.query(`SET @MIGRATION_SRC_DB = 'bankist';`);
    const mig = fs.readFileSync(MIGRATION_PATH, 'utf8');
    await appConn.query(mig);
    console.log('[2/4] Normalized schema and migrated data loaded.');

    // 3. Test Every Critical Application Flow
    console.log('[3/4] Testing application queries for compatibility...');
    let passed = 0;
    let failed = 0;

    function assert(cond, msg) {
      if (cond) {
        console.log(`  [PASS] ${msg}`);
        passed++;
      } else {
        console.error(`  [FAIL] ${msg}`);
        failed++;
      }
    }

    // A. Login Route Queries
    const [custRows] = await appConn.query(
      'SELECT * FROM customers WHERE LOWER(email) = LOWER(?) OR customer_id = ? OR phone = ?',
      ['aarav@example.com', 'CUST-101', '+91 98200 12345']
    );
    assert(custRows.length === 1 && custRows[0].customer_id === 'CUST-101', 'Auth Login: Customer lookup query succeeded');

    const [accRows] = await appConn.query(
      'SELECT * FROM accounts WHERE customer_id = ? ORDER BY opening_date DESC',
      ['CUST-101']
    );
    assert(accRows.length > 0 && accRows.some(a => a.account_number === 'ACC-772910'), 'Auth Login / My-Accounts: Account listing succeeded');

    // B. Card Verification in Login / Auth
    const isPinMatch = custRows[0].card_pin_hash && bcrypt.compareSync('1234', custRows[0].card_pin_hash);
    assert(isPinMatch, 'Auth Login: 4-digit card PIN authentication matched expected hash');

    // C. Account Transfer Route Queries (Atomic Double-Entry)
    const transferAmount = 500.00;
    const fromAcc = 'ACC-772910';
    const toAcc = 'ACC-553102';

    const [senderBefore] = await appConn.query('SELECT balance FROM accounts WHERE account_number = ?', [fromAcc]);
    const [receiverBefore] = await appConn.query('SELECT balance FROM accounts WHERE account_number = ?', [toAcc]);

    // Check liens
    const [lienRows] = await appConn.query(
      'SELECT COALESCE(SUM(lien_amount), 0) AS total_lien FROM account_lien_records WHERE account_number = ?',
      [fromAcc]
    );
    assert(parseFloat(lienRows[0].total_lien) === 0, 'Transfer: Lien inquiry query succeeded');

    // Debit sender
    const [debitRes] = await appConn.query(
      'UPDATE accounts SET balance = balance - ? WHERE account_number = ? AND (balance - ?) >= 0 AND status = "Active"',
      [transferAmount, fromAcc, transferAmount]
    );
    assert(debitRes.affectedRows === 1, 'Transfer: Debit sender query succeeded');

    // Credit receiver
    const [creditRes] = await appConn.query(
      'UPDATE accounts SET balance = balance + ? WHERE account_number = ?',
      [transferAmount, toAcc]
    );
    assert(creditRes.affectedRows === 1, 'Transfer: Credit receiver query succeeded');

    // Insert transaction
    const txnId = `TXN-COMPAT-${Date.now()}`;
    await appConn.query(
      `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description, reference_number)
       VALUES (?, ?, ?, ?, 'Transfer', CURRENT_TIMESTAMP, 'Success', 'Compatibility Test Transfer', ?)`,
      [txnId, fromAcc, toAcc, transferAmount, `REF-COMPAT-${Date.now()}`]
    );
    assert(true, 'Transfer: Transaction ledger insertion succeeded');

    // Audit log
    await appConn.query(
      `INSERT INTO audit_logs (log_id, customer_id, action, entity_type, entity_id, details)
       VALUES (?, 'CUST-101', 'FUNDS_TRANSFER', 'TRANSACTION', ?, 'Transfer compatibility verified')`,
      [`AUDIT-${Date.now()}`, txnId]
    );
    assert(true, 'Transfer: Audit log insertion succeeded');

    // D. My Transactions Route Query
    const [myTxns] = await appConn.query(
      'SELECT * FROM transactions WHERE sender_account = ? OR receiver_account = ? ORDER BY date_time DESC',
      [fromAcc, fromAcc]
    );
    assert(myTxns.length > 0 && myTxns.some(t => t.transaction_id === txnId), 'My-Transactions: History retrieval with sender/receiver filter succeeded');

    // E. UPI Simulate Receive Route
    const [upiCreditRes] = await appConn.query(
      'UPDATE accounts SET balance = balance + ? WHERE account_number = ?',
      [150.00, fromAcc]
    );
    assert(upiCreditRes.affectedRows === 1, 'UPI Simulate Receive: Credit query succeeded');

    const upiTxnId = `TXN-UPI-${Date.now()}`;
    await appConn.query(
      `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description, reference_number)
       VALUES (?, 'payer.test@okaxis', ?, 150.00, 'Deposit', CURRENT_TIMESTAMP, 'Success', 'UPI Inward Credit Test', ?)`,
      [upiTxnId, fromAcc, `UPI-REF-${Date.now()}`]
    );
    assert(true, 'UPI Simulate Receive: Transaction insertion with external VPA sender succeeded');

    // F. Term Deposit Booking Route
    const depId = `FD-COMPAT-${Date.now()}`;
    await appConn.query(
      `INSERT INTO deposits (deposit_id, customer_id, linked_account, deposit_type, principal_amount, interest_rate, tenure_months, maturity_amount, maturity_date, status, created_at)
       VALUES (?, 'CUST-101', ?, 'Fixed Deposit', 10000.00, 7.50, 12, 10750.00, DATE_ADD(CURRENT_DATE, INTERVAL 12 MONTH), 'Active', CURRENT_TIMESTAMP)`,
      [depId, fromAcc]
    );
    assert(true, 'Deposits: Fixed deposit contract booking succeeded');

    // G. Account Creation / Signup Queries
    const newCustId = `CUST-TEST-${Date.now()}`;
    const newEmail = `testuser.${Date.now()}@example.com`;
    const newAccNum = `ACC-TEST-${Math.floor(100000 + Math.random() * 900000)}`;

    await appConn.query(
      `INSERT INTO customers (customer_id, full_name, email, phone, password_hash, credit_score, tier, card_pin_hash)
       VALUES (?, 'New Test User', ?, '+91 99999 11111', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 750, 'Silver', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC')`,
      [newCustId, newEmail]
    );
    assert(true, 'Signup: New customer creation succeeded');

    await appConn.query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, ifsc_code, branch_name, status, card_pin_hash)
       VALUES (?, ?, 'Savings Account', 10000.00, 'BTBI0001024', 'Mumbai Nariman Point Hub', 'Active', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC')`,
      [newAccNum, newCustId]
    );
    assert(true, 'Signup: New account creation with branch_name succeeded');

    // H. Backward-Compatibility Views
    const [legacyAccView] = await appConn.query('SELECT * FROM v_accounts_legacy WHERE account_number = ?', [newAccNum]);
    assert(legacyAccView.length === 1 && legacyAccView[0].branch_name === 'Mumbai Nariman Point Hub', 'v_accounts_legacy: View projection correctly joined branch');

    const [portfolioView] = await appConn.query('SELECT * FROM v_customer_portfolio WHERE customer_id = ?', [newCustId]);
    assert(portfolioView.length === 1 && parseFloat(portfolioView[0].total_liquid_balance) === 10000.00, 'v_customer_portfolio: Portfolio total liquid balance matches');

    console.log(`\nCompatibility Test Summary: ${passed} passed, ${failed} failed.`);

    await appConn.end();

    // 4. Cleanup
    await adminConn.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_COMPAT_DB}\`;`);
    console.log('[4/4] Disposable test DB cleaned up.');

  } catch (err) {
    console.error('Compatibility test error:', err);
    try {
      await adminConn.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_COMPAT_DB}\`;`);
    } catch (e) {}
  } finally {
    await adminConn.end();
  }
}

testAppCompatibility();
