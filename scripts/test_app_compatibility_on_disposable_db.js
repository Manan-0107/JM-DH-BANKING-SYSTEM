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

    // A. Login Route Queries & Authentication
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

    // B. Credential Verification Scenarios
    // Scenario 1: Valid PIN
    const isPinMatch = custRows[0].card_pin_hash && bcrypt.compareSync('1234', custRows[0].card_pin_hash);
    assert(isPinMatch, 'Auth Login: Valid 4-digit card PIN authentication matched expected hash');

    // Scenario 2: Invalid PIN (must reject)
    const isInvalidPinMatch = custRows[0].card_pin_hash && bcrypt.compareSync('9999', custRows[0].card_pin_hash);
    assert(!isInvalidPinMatch, 'Auth Login: Invalid PIN (9999) correctly rejected');

    // Scenario 3: Account without card credentials (fails closed securely without crashing)
    const testNoCredAcc = `ACC-NOCRED-${Date.now()}`;
    await appConn.query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, ifsc_code, branch_name, status, card_pin_hash)
       VALUES (?, 'CUST-101', 'Savings Account', 25000.00, 'BTBI0001024', 'Mumbai Nariman Point Hub', 'Active', NULL)`,
      [testNoCredAcc]
    );

    const [noCredRow] = await appConn.query(
      'SELECT balance, card_pin_hash FROM v_accounts_legacy WHERE account_number = ?',
      [testNoCredAcc]
    );
    assert(noCredRow.length === 1 && noCredRow[0].card_pin_hash === null, 'Card Credential: Missing credential evaluates to NULL in v_accounts_legacy');
    assert(parseFloat(noCredRow[0].balance) === 25000.00, 'Card Credential: Account balance inquiry succeeds on account without PIN');

    const noCredPinAuth = noCredRow[0].card_pin_hash && bcrypt.compareSync('1234', noCredRow[0].card_pin_hash);
    assert(!noCredPinAuth, 'Card Credential: Authentication fails closed securely when credential hash is missing');

    // C. Customer Profile & Nominee Legacy View under strict ONLY_FULL_GROUP_BY
    await appConn.query("SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO,STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY'");
    
    // Customer with nominee (CUST-107)
    const [cust107View] = await appConn.query(
      'SELECT customer_id, full_name, nominee_name, nominee_relation, nominee_dob FROM v_customers_legacy WHERE customer_id = "CUST-107"'
    );
    assert(
      cust107View.length === 1 && cust107View[0].nominee_name === 'Kavita Chauhan' && cust107View[0].nominee_relation === 'Spouse',
      'v_customers_legacy: Successfully projected nominee under strict ONLY_FULL_GROUP_BY for CUST-107'
    );

    // Customer without nominee (CUST-101)
    const [cust101View] = await appConn.query(
      'SELECT customer_id, full_name, nominee_name, nominee_relation, nominee_dob FROM v_customers_legacy WHERE customer_id = "CUST-101"'
    );
    assert(
      cust101View.length === 1 && cust101View[0].nominee_name === null,
      'v_customers_legacy: Correctly returned NULL nominee attributes for customer without nominee (CUST-101)'
    );

    // D. Account Transfer Route Queries (Atomic Double-Entry)
    const transferAmount = 500.00;
    const fromAcc = 'ACC-772910';
    const toAcc = 'ACC-553102';

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

    // E. Cash Withdrawal with Non-Negative Balance Check
    const [withdrawRes] = await appConn.query(
      'UPDATE accounts SET balance = balance - 100.00 WHERE account_number = ? AND (balance - 100.00) >= 0',
      [fromAcc]
    );
    assert(withdrawRes.affectedRows === 1, 'Withdrawal: Cash debit query with non-negative check succeeded');

    // F. My Transactions Route Query
    const [myTxns] = await appConn.query(
      'SELECT * FROM transactions WHERE sender_account = ? OR receiver_account = ? ORDER BY date_time DESC',
      [fromAcc, fromAcc]
    );
    assert(myTxns.length > 0 && myTxns.some(t => t.transaction_id === txnId), 'My-Transactions: History retrieval with sender/receiver filter succeeded');

    // G. UPI Simulate Receive Route
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

    // H. Term Deposit Booking & Premature Break
    const depId = `FD-COMPAT-${Date.now()}`;
    await appConn.query(
      `INSERT INTO deposits (deposit_id, customer_id, linked_account, deposit_type, principal_amount, interest_rate, tenure_months, maturity_amount, maturity_date, status, created_at)
       VALUES (?, 'CUST-101', ?, 'Fixed Deposit', 10000.00, 7.50, 12, 10750.00, DATE_ADD(CURRENT_DATE, INTERVAL 12 MONTH), 'Active', CURRENT_TIMESTAMP)`,
      [depId, fromAcc]
    );
    assert(true, 'Deposits: Fixed deposit contract booking succeeded');

    // Break Deposit
    const [breakDepRes] = await appConn.query(
      'UPDATE deposits SET status = "Liquidated" WHERE deposit_id = ? AND customer_id = "CUST-101"',
      [depId]
    );
    assert(breakDepRes.affectedRows === 1, 'Deposits: Premature deposit break/liquidation query succeeded');

    // I. Beneficiaries Whitelist Query & Addition
    const [beneficiaries] = await appConn.query(
      'SELECT * FROM beneficiaries WHERE customer_id = "CUST-101" AND is_active = 1'
    );
    assert(beneficiaries.length > 0, 'Beneficiaries: Whitelist retrieval succeeded');

    // J. KYC Verification Status
    const [kycRows] = await appConn.query(
      'SELECT * FROM kyc_verifications WHERE customer_id = "CUST-101"'
    );
    assert(kycRows.length > 0, 'KYC: Regulatory verification documents retrieved');

    // K. OTP Challenge Session Verification
    const [otpSession] = await appConn.query(
      'SELECT * FROM otp_sessions WHERE expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1'
    );
    assert(otpSession !== undefined, 'OTP: Session lookup query executed cleanly');

    // L. Security Rate Limiting
    const [rateRow] = await appConn.query(
      'SELECT attempts, locked_until FROM security_rate_limits LIMIT 1'
    );
    assert(rateRow.length === 1, 'Security: Rate limit defensive table queried successfully');

    // M. Account Creation / Signup Queries
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

    // N. Portfolio View Net Worth Check
    const [portfolioView] = await appConn.query('SELECT * FROM v_customer_portfolio WHERE customer_id = ?', [newCustId]);
    assert(portfolioView.length === 1 && parseFloat(portfolioView[0].total_liquid_balance) === 10000.00, 'v_customer_portfolio: Portfolio total liquid balance matches');

    console.log(`\nCompatibility Test Summary: ${passed} passed, ${failed} failed.`);

    await appConn.end();

    // 4. Cleanup
    await adminConn.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_COMPAT_DB}\`;`);
    console.log('[4/4] Disposable test DB cleaned up.');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Compatibility test error:', err);
    try {
      await adminConn.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_COMPAT_DB}\`;`);
    } catch (e) {}
    process.exit(1);
  } finally {
    await adminConn.end();
  }
}

testAppCompatibility();
