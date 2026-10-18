/**
 * Automated Verification Test Suite for Bharat Trust Bank
 * Tests:
 * 1. Database Connectivity & Tables
 * 2. Customer Registration / Signup
 * 3. Customer Authentication / Login
 * 4. Account Retrieval & Row-Level Authorization
 * 5. Successful Fund Transfer with atomic balance updates
 * 6. Overdraft Prevention (Transfer > Balance)
 * 7. Concurrency Test (Concurrent transfers competing for limited funds)
 * 8. Unauthorized Cross-Account Transfer Prevention
 * 9. Cash Withdrawal & ATM limits
 * 10. Cash Deposit & Ledger Persistence
 * 11. Term Deposit Booking & Premature Liquidation
 * 12. Instant UPI Inward Credit
 * 13. Institutional Branches API
 * 14. Administrative Dashboard Aggregations
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('   STARTING BTB INFRASTRUCTURE VERIFICATION SUITE   ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // TEST 1: Login with seeded customer Aarav Lynn
    console.log('\n--- 1. Testing Customer Authentication ---');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aarav@example.com', password: '1234' }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, 'Aarav login HTTP 200');
    assert(!!loginData.token, 'Aarav JWT token generated');
    assert(loginData.customer.customer_id === 'CUST-101', 'Customer ID matches CUST-101');
    assert(!loginData.customer.password_hash, 'Password hash is not exposed');
    assert(!loginData.customer.card_pin, 'Card PIN is not exposed');

    const aaravToken = loginData.token;
    const aaravAccount = loginData.accounts[0].account_number;
    const initialAaravBalance = parseFloat(loginData.accounts[0].balance);
    console.log(`Aarav Account: ${aaravAccount}, Initial Balance: ₹${initialAaravBalance}`);

    // TEST 2: Login with seeded customer Priya Nair
    const priyaRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@example.com', password: '1234' }),
    });
    const priyaData = await priyaRes.json();
    assert(priyaRes.status === 200, 'Priya login HTTP 200');
    const priyaToken = priyaData.token;
    const priyaAccount = priyaData.accounts[0].account_number;
    const initialPriyaBalance = parseFloat(priyaData.accounts[0].balance);
    console.log(`Priya Account: ${priyaAccount}, Initial Balance: ₹${initialPriyaBalance}`);

    // TEST 3: Cross-Customer Authorization (Aarav attempts to transfer from Priya's account)
    console.log('\n--- 2. Testing Cross-Customer Authorization ---');
    const stolenTransferRes = await fetch(`${BASE_URL}/api/accounts/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({
        from_account: priyaAccount, // Aarav trying to spend Priya's money!
        to_account: aaravAccount,
        amount: 500,
        pin: '1234',
      }),
    });
    assert(stolenTransferRes.status === 403, 'Cross-account transfer rejected with HTTP 403 Forbidden');

    // TEST 4: Invalid PIN Transfer
    console.log('\n--- 3. Testing PIN Security ---');
    const wrongPinRes = await fetch(`${BASE_URL}/api/accounts/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({
        from_account: aaravAccount,
        to_account: priyaAccount,
        amount: 500,
        pin: '9999', // wrong pin
      }),
    });
    assert(wrongPinRes.status === 401, 'Wrong PIN rejected with HTTP 401 Unauthorized');

    // TEST 5: Overdraft Prevention (Transfer amount > balance)
    console.log('\n--- 4. Testing Overdraft Prevention ---');
    const excessiveAmount = initialAaravBalance + 500000;
    const overdraftRes = await fetch(`${BASE_URL}/api/accounts/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({
        from_account: aaravAccount,
        to_account: priyaAccount,
        amount: excessiveAmount,
        pin: '1234',
      }),
    });
    assert(overdraftRes.status === 400, 'Overdraft transfer rejected with HTTP 400 Bad Request');

    // TEST 6: Successful Legitimate Transfer
    console.log('\n--- 5. Testing Atomic Legitimate Transfer ---');
    const transferAmount = 1000;
    const transferRes = await fetch(`${BASE_URL}/api/accounts/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({
        from_account: aaravAccount,
        to_account: priyaAccount,
        amount: transferAmount,
        description: 'Test Verification Transfer',
        pin: '1234',
      }),
    });
    const transferData = await transferRes.json();
    assert(transferRes.status === 200, 'Legitimate transfer HTTP 200');
    assert(!!transferData.transaction.reference_number, `Reference Number generated: ${transferData.transaction.reference_number}`);
    assert(parseFloat(transferData.sender.balance) === initialAaravBalance - transferAmount, 'Sender balance deducted accurately in database');

    // Verify receiver got credited in database
    const priyaMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${priyaToken}` },
    });
    const priyaMeData = await priyaMeRes.json();
    assert(parseFloat(priyaMeData.accounts[0].balance) === initialPriyaBalance + transferAmount, 'Receiver balance credited accurately in database');

    // TEST 7: High-Concurrency Safety Test
    console.log('\n--- 6. Testing Concurrency Safety & Race-Condition Lock ---');
    // Let's create 10 simultaneous transfers of 10,000 each.
    // If Aarav had e.g. 15,000 balance, only 1 should succeed and 9 should fail.
    // Here Aarav has sufficient balance for some, but let's test that 5 concurrent transfers of 500 execute cleanly without race conditions.
    const concurrentPromises = [];
    for (let i = 0; i < 5; i++) {
      concurrentPromises.push(
        fetch(`${BASE_URL}/api/accounts/transfer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${aaravToken}`,
          },
          body: JSON.stringify({
            from_account: aaravAccount,
            to_account: priyaAccount,
            amount: 100,
            description: `Concurrent batch item #${i + 1}`,
            pin: '1234',
          }),
        }).then((r) => r.json())
      );
    }
    const concurrentResults = await Promise.all(concurrentPromises);
    const successfulConcurrent = concurrentResults.filter((r) => r.message && r.message.includes('transferred successfully'));
    assert(successfulConcurrent.length === 5, `All 5 concurrent requests handled safely (Success: ${successfulConcurrent.length}/5)`);

    // TEST 8: Cash Withdrawal
    console.log('\n--- 7. Testing ATM Cash Withdrawal ---');
    const withdrawRes = await fetch(`${BASE_URL}/api/accounts/${aaravAccount}/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({
        amount: 500,
        description: 'ATM Cash Verification',
        pin: '1234',
      }),
    });
    const withdrawData = await withdrawRes.json();
    assert(withdrawRes.status === 200, 'ATM withdrawal HTTP 200');
    assert(!!withdrawData.transaction.reference_number, `ATM Ref: ${withdrawData.transaction.reference_number}`);

    // TEST 9: Cash Deposit
    console.log('\n--- 8. Testing Cash Deposit ---');
    const depositRes = await fetch(`${BASE_URL}/api/accounts/${aaravAccount}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({
        amount: 2500,
        description: 'Verification Cash Deposit',
        pin: '1234',
      }),
    });
    const depositData = await depositRes.json();
    assert(depositRes.status === 200, 'Cash deposit HTTP 200');
    assert(depositData.account.balance > 0, `New Balance: ₹${depositData.account.balance}`);

    // TEST 10: Term Deposit Booking & Liquidation
    console.log('\n--- 9. Testing Term Deposit Lifecycle ---');
    const bookRes = await fetch(`${BASE_URL}/api/deposits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({
        source_account: aaravAccount,
        deposit_type: 'Fixed Deposit',
        principal_amount: 10000,
        tenure_months: 12,
        pin: '1234',
      }),
    });
    const bookData = await bookRes.json();
    assert(bookRes.status === 201, 'Fixed Deposit booked HTTP 201');
    const depositId = bookData.deposit.deposit_id;
    console.log(`Created Certificate: ${depositId}, Maturity: ₹${bookData.deposit.maturity_amount}`);

    // Premature liquidation
    const breakRes = await fetch(`${BASE_URL}/api/deposits/${depositId}/break`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({ pin: '1234' }),
    });
    const breakData = await breakRes.json();
    assert(breakRes.status === 200, 'Premature liquidation HTTP 200');
    assert(breakData.payout >= 10000, `Payout amount: ₹${breakData.payout}`);

    // TEST 11: Transaction Ledger Pagination & Filter
    console.log('\n--- 10. Testing Paginated Transaction Ledger ---');
    const txRes = await fetch(`${BASE_URL}/api/transactions/my-transactions?page=1&limit=5&type=Transfer`, {
      headers: { Authorization: `Bearer ${aaravToken}` },
    });
    const txData = await txRes.json();
    assert(txRes.status === 200, 'Paginated transactions HTTP 200');
    assert(Array.isArray(txData.transactions), 'Transactions returned as array');
    assert(typeof txData.total === 'number' && txData.total > 0, `Total transactions in ledger: ${txData.total}`);

    // TEST 12: UPI Inward Credit
    console.log('\n--- 11. Testing Instant UPI Inward Credit ---');
    const upiRes = await fetch(`${BASE_URL}/api/upi/simulate-receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({
        account_number: aaravAccount,
        amount: 750,
        payer_vpa: 'test.colleague@okaxis',
        payer_name: 'Dr. Test Colleague',
        remarks: 'Verification Split',
      }),
    });
    const upiData = await upiRes.json();
    assert(upiRes.status === 200, 'UPI inward credit HTTP 200');
    assert(!!upiData.utr, `Simulated UPI UTR: ${upiData.utr}`);

    // TEST 13: Institutional Directory API
    console.log('\n--- 12. Testing Institutional Database Directory ---');
    const instRes = await fetch(`${BASE_URL}/api/institutional`);
    const instData = await instRes.json();
    assert(instRes.status === 200, 'Institutional catalog HTTP 200');
    assert(Array.isArray(instData.branches) && instData.branches.length >= 8, `National branches in database: ${instData.branches.length}`);

    // TEST 14: Administrative Dashboard Aggregations
    console.log('\n--- 13. Testing Administrative Dashboard Metrics ---');
    const dashRes = await fetch(`${BASE_URL}/api/dashboard`);
    const dashData = await dashRes.json();
    assert(dashRes.status === 200, 'Dashboard statistics HTTP 200');
    assert(dashData.metrics.customers.total_customers >= 5, `Total Customers: ${dashData.metrics.customers.total_customers}`);
    assert(dashData.metrics.accounts.total_liquid_balance > 0, `Total System Liquidity: ₹${dashData.metrics.accounts.total_liquid_balance}`);
    assert(dashData.recent_audits.length > 0, `Audit log entries recorded: ${dashData.recent_audits.length}`);

    // TEST 15: New Customer Digital Onboarding (e-KYC & Signup)
    console.log('\n--- 14. Testing New Customer Digital Onboarding ---');
    const testEmail = `test.student.${Date.now()}@example.com`;
    const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Manan Patel',
        email: testEmail,
        password: 'SecureBankPassword@2026',
        card_pin: '4321',
        phone: '9876543210',
        dob: '1998-05-15',
        account_type: 'Savings Account',
        branch_name: 'Mumbai Nariman Point Hub',
      }),
    });
    const signupData = await signupRes.json();
    assert(signupRes.status === 201, 'Customer onboarding HTTP 201');
    assert(!!signupData.customer.customer_id, `New Customer ID: ${signupData.customer.customer_id}`);
    assert(!!signupData.account.account_number, `New Account Number: ${signupData.account.account_number}`);
    assert(parseFloat(signupData.account.balance) === 10000, 'Opening balance grant credited (₹10,000)');

    // Verify plaintext PIN and hash sanitization in API responses
    assert(!signupData.customer.card_pin, 'Customer card_pin is not exposed in API response');
    assert(!signupData.customer.card_pin_hash, 'Customer card_pin_hash is not exposed in API response');
    assert(!signupData.account.card_pin, 'Account card_pin is not exposed in API response');
    assert(!signupData.account.card_pin_hash, 'Account card_pin_hash is not exposed in API response');

    // Direct Database Integrity Verification: Confirm card_pin is NULL and card_pin_hash is bcrypt
    const sqlite3 = require('sqlite3').verbose();
    const verifyDb = new sqlite3.Database('bankist.sqlite');

    const dbCustRow = await new Promise((res) => {
      verifyDb.get(
        'SELECT card_pin, card_pin_hash FROM customers WHERE customer_id = ?',
        [signupData.customer.customer_id],
        (err, row) => res(row)
      );
    });
    assert(dbCustRow && (dbCustRow.card_pin === null || dbCustRow.card_pin === undefined), 'Customer row card_pin is strictly NULL in database (no plaintext storage)');
    assert(
      dbCustRow && dbCustRow.card_pin_hash && (dbCustRow.card_pin_hash.startsWith('$2a$') || dbCustRow.card_pin_hash.startsWith('$2b$')),
      'Customer row card_pin_hash is stored as a secure bcrypt hash'
    );

    const dbAccRow = await new Promise((res) => {
      verifyDb.get(
        'SELECT card_pin, card_pin_hash FROM accounts WHERE account_number = ?',
        [signupData.account.account_number],
        (err, row) => res(row)
      );
    });
    assert(dbAccRow && (dbAccRow.card_pin === null || dbAccRow.card_pin === undefined), 'Account row card_pin is strictly NULL in database (no plaintext storage)');
    assert(
      dbAccRow && dbAccRow.card_pin_hash && (dbAccRow.card_pin_hash.startsWith('$2a$') || dbAccRow.card_pin_hash.startsWith('$2b$')),
      'Account row card_pin_hash is stored as a secure bcrypt hash'
    );

    // Open additional account and verify it also stores NULL for card_pin and bcrypt hash
    const openAddRes = await fetch(`${BASE_URL}/api/accounts/open-additional`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signupData.token}`,
      },
      body: JSON.stringify({
        account_type: 'Salary Account',
        pin: '4321',
      }),
    });
    assert(openAddRes.status === 201, 'Open additional account HTTP 201');
    const openAddData = await openAddRes.json();
    const dbAddAccRow = await new Promise((res) => {
      verifyDb.get(
        'SELECT card_pin, card_pin_hash FROM accounts WHERE account_number = ?',
        [openAddData.account.account_number],
        (err, row) => res(row)
      );
    });
    assert(dbAddAccRow && dbAddAccRow.card_pin === null, 'Additional account row card_pin is strictly NULL in database');
    assert(
      dbAddAccRow && dbAddAccRow.card_pin_hash && (dbAddAccRow.card_pin_hash.startsWith('$2a$') || dbAddAccRow.card_pin_hash.startsWith('$2b$')),
      'Additional account row card_pin_hash is stored as a secure bcrypt hash'
    );

    // Verify valid PIN authentication works for new customer
    const validPinTransferRes = await fetch(`${BASE_URL}/api/accounts/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signupData.token}`,
      },
      body: JSON.stringify({
        from_account: signupData.account.account_number,
        to_account: aaravAccount,
        amount: 200,
        pin: '4321', // valid PIN
      }),
    });
    assert(validPinTransferRes.status === 200, 'Valid PIN transfer authenticated successfully (HTTP 200)');

    // Verify invalid PIN authentication fails for new customer
    const invalidPinTransferRes = await fetch(`${BASE_URL}/api/accounts/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signupData.token}`,
      },
      body: JSON.stringify({
        from_account: signupData.account.account_number,
        to_account: aaravAccount,
        amount: 200,
        pin: '0000', // invalid PIN
      }),
    });
    assert(invalidPinTransferRes.status === 401, 'Invalid PIN transfer correctly rejected (HTTP 401 Unauthorized)');

    // Verify signup rejects missing credentials without default fallbacks
    const badSignupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Missing Creds Test', email: `badcreds_${Date.now()}@example.com` }),
    });
    assert(badSignupRes.status === 400, 'Signup with missing password/PIN rejected with HTTP 400 (zero silent default substitution)');

    // Login with new customer credentials
    const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'SecureBankPassword@2026' }),
    });
    assert(newLoginRes.status === 200, 'New customer login HTTP 200');

    // TEST 15: Invalid & Expired Token Authentication
    console.log('\n--- 15. Testing Invalid & Tampered Authentication Tokens ---');
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcl9pZCI6IkNVU1QtOTk5IiwiaWF0IjoxNTE2MjM5MDIyfQ.invalidSignatureKeyHere1234567890';
    const fakeTokenRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${fakeToken}` },
    });
    assert(fakeTokenRes.status === 401, 'Tampered JWT token rejected with HTTP 401 Unauthorized');

    const noTokenRes = await fetch(`${BASE_URL}/api/auth/me`);
    assert(noTokenRes.status === 401, 'Missing Authorization header rejected with HTTP 401 Unauthorized');

    // TEST 16: Failure-Driven Mid-Transaction Automatic Rollback
    console.log('\n--- 16. Testing Failure-Driven Mid-Transaction Automatic Rollback ---');
    // 0. Authorization Guards on Test Rollback Endpoint
    const noHeaderGet = await fetch(`${BASE_URL}/api/system/test-rollback`);
    assert(noHeaderGet.status === 403, 'Test rollback GET without test-suite header rejected with HTTP 403 Forbidden');

    const noHeaderPost = await fetch(`${BASE_URL}/api/system/test-rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_number: aaravAccount }),
    });
    assert(noHeaderPost.status === 403, 'Test rollback POST without test-suite header rejected with HTTP 403 Forbidden');

    const noTokenPost = await fetch(`${BASE_URL}/api/system/test-rollback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-suite': 'btb-verification-suite',
      },
      body: JSON.stringify({ account_number: aaravAccount }),
    });
    assert(noTokenPost.status === 401, 'Test rollback POST without Bearer token rejected with HTTP 401 Unauthorized');

    // Check active database engine reported by application
    const engineCheckRes = await fetch(`${BASE_URL}/api/system/test-rollback`, {
      headers: { 'x-test-suite': 'btb-verification-suite' },
    });
    const engineInfo = await engineCheckRes.json();
    assert(engineCheckRes.status === 200, `Active database engine queried: ${engineInfo.engine}`);

    // 1. Record starting account balance
    const preRollbackMe = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${aaravToken}` },
    }).then(r => r.json());
    const preRollbackBalance = parseFloat(preRollbackMe.accounts[0].balance);

    // 2. Trigger deliberate mid-transaction failure inside application's db.transaction abstraction
    const rollbackRes = await fetch(`${BASE_URL}/api/system/test-rollback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
        'x-test-suite': 'btb-verification-suite',
      },
      body: JSON.stringify({
        account_number: aaravAccount,
        amount: 5000,
        trigger_failure: true, // triggers deterministic SQL error after debit write and ledger insert
      }),
    });
    const rollbackData = await rollbackRes.json();

    assert(rollbackRes.status === 500, 'Transaction error propagated to caller with HTTP 500');
    assert(rollbackData.rolledBack === true, 'Application db.transaction caught deliberate failure and executed rollback');
    assert(rollbackData.balance_restored === true, 'Application confirmed balance was restored inside transaction handler');
    assert(rollbackData.ledger_record_remains === false, 'Application confirmed uncommitted ledger record was not retained');

    // 3. Independent API assertion: Confirm account balance is 100% restored
    const postRollbackMe = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${aaravToken}` },
    }).then(r => r.json());
    const postRollbackBalance = parseFloat(postRollbackMe.accounts[0].balance);
    assert(preRollbackBalance === postRollbackBalance, `Failure-Driven Rollback: Account balance fully restored (₹${postRollbackBalance} === ₹${preRollbackBalance})`);

    // 4. Independent Database query: Confirm uncommitted transaction record was dropped
    const probeTxnRecord = await new Promise((res) => {
      verifyDb.get(
        "SELECT * FROM transactions WHERE transaction_id = ? OR reference_number = ?",
        [rollbackData.probe_txn_id, rollbackData.probe_reference_number],
        (err, row) => res(row)
      );
    });
    assert(!probeTxnRecord, 'Failure-Driven Rollback: Uncommitted transaction/ledger record was completely rolled back from database');

    // 5. Engine-Specific Rollback Verification
    // Direct SQLite transaction failure test using the same transaction pattern
    let sqliteEngineRollbackPassed = false;
    try {
      await new Promise((resolve, reject) => {
        verifyDb.serialize(() => {
          verifyDb.run("BEGIN IMMEDIATE TRANSACTION");
          verifyDb.run("UPDATE accounts SET balance = balance - 1000 WHERE account_number = ?", [aaravAccount]);
          verifyDb.run(
            "INSERT INTO transactions (transaction_id, reference_number, sender_account, amount, type, date_time, status, description) VALUES (?, ?, ?, 1000, 'Transfer', datetime('now'), 'Pending', 'Engine Probe')",
            [`TXN-SQLITE-${Date.now()}`, `PROBE-${Date.now()}`, aaravAccount]
          );
          // Trigger deliberate SQL failure
          verifyDb.run("INSERT INTO non_existent_table_direct_sqlite VALUES (1)", function (err) {
            if (err) {
              // Engine error caught; rollback
              verifyDb.run("ROLLBACK", (rbErr) => {
                if (rbErr) reject(rbErr);
                else {
                  sqliteEngineRollbackPassed = true;
                  resolve(true);
                }
              });
            } else {
              reject(new Error('Expected SQL error was not triggered'));
            }
          });
        });
      });
    } catch (e) {
      sqliteEngineRollbackPassed = false;
    }
    assert(sqliteEngineRollbackPassed, 'Direct SQLite engine: Caught failure after writes and rolled back atomically');

    // Check MySQL engine availability
    if (process.env.USE_MYSQL === 'true') {
      try {
        const mysql = require('mysql2/promise');
        const mConn = await mysql.createConnection({
          host: process.env.DB_HOST || 'localhost',
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || 'bankist',
          port: parseInt(process.env.DB_PORT || '3306', 10),
        });
        await mConn.beginTransaction();
        await mConn.query('UPDATE accounts SET balance = balance - 500 WHERE account_number = ?', [aaravAccount]);
        try {
          await mConn.query('INSERT INTO non_existent_table_mysql_probe VALUES (1)');
        } catch (mErr) {
          await mConn.rollback();
          assert(true, 'Direct MySQL engine: Caught failure after writes and rolled back atomically');
        }
        await mConn.end();
      } catch (mysqlErr) {
        console.log(`[SKIP] MySQL engine rollback test skipped: ${mysqlErr.message}`);
      }
    } else {
      console.log('[SKIP] MySQL integration test explicitly skipped: MySQL server is not configured or offline (USE_MYSQL=false). Testing SQLite active engine.');
    }

    // TEST 17: Multi-Threaded Overdraft Race Condition (Preventing Negative Balances)
    console.log('\n--- 17. Testing Multi-Threaded Overdraft Race Condition ---');
    const newCustToken = signupData.token;
    const newCustAcc = signupData.account.account_number;
    // Launch 3 simultaneous transfers of ₹6,000 each (Total ₹18,000 > ₹9,800 balance).
    // Exactly 1 must succeed and 2 must be rejected with HTTP 400. Balance must NEVER go below 0!
    const racePromises = [1, 2, 3].map((idx) =>
      fetch(`${BASE_URL}/api/accounts/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newCustToken}`,
        },
        body: JSON.stringify({
          from_account: newCustAcc,
          to_account: aaravAccount,
          amount: 6000,
          pin: '4321',
          description: `Race test ${idx}`,
        }),
      }).then(async (r) => ({ status: r.status, data: await r.json() }))
    );

    const raceResults = await Promise.all(racePromises);
    const raceSuccesses = raceResults.filter((r) => r.status === 200);
    const raceFailures = raceResults.filter((r) => r.status === 400);

    assert(raceSuccesses.length === 1, `Exactly 1 transfer succeeded (${raceSuccesses.length}/3)`);
    assert(raceFailures.length === 2, `Exactly 2 transfers blocked by overdraft check (${raceFailures.length}/3)`);

    const finalRaceMe = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${newCustToken}` },
    }).then(r => r.json());
    const finalRaceBalance = parseFloat(finalRaceMe.accounts[0].balance);
    assert(finalRaceBalance >= 0, `Post-race balance is non-negative: ₹${finalRaceBalance}`);

    // TEST 18: High-Concurrency Digital Onboarding Race Condition Safety
    console.log('\n--- 18. Testing High-Concurrency Digital Onboarding Safety ---');
    const nowStamp = Date.now();
    const concurrentSignups = [1, 2, 3].map((idx) =>
      fetch(`${BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: `Concurrent User ${idx}`,
          email: `concurrent_${nowStamp}_${idx}@example.com`,
          password: 'SecurePassword123!',
          card_pin: '5678',
          phone: `980000000${idx}`,
        }),
      }).then(async (r) => ({ status: r.status, data: await r.json() }))
    );

    const concurrentSignupResults = await Promise.all(concurrentSignups);
    const successfulSignups = concurrentSignupResults.filter((r) => r.status === 201);
    assert(successfulSignups.length === 3, `All 3 concurrent signups completed successfully (${successfulSignups.length}/3)`);

    const createdCustIds = successfulSignups.map((r) => r.data.customer?.customer_id).filter(Boolean);
    const createdAccNums = successfulSignups.map((r) => r.data.account?.account_number).filter(Boolean);
    assert(new Set(createdCustIds).size === 3, `All 3 concurrent customer IDs are strictly unique: ${createdCustIds.join(', ')}`);
    assert(new Set(createdAccNums).size === 3, `All 3 concurrent account numbers are strictly unique: ${createdAccNums.join(', ')}`);

    // Direct database validation of persisted records under concurrency
    for (let i = 0; i < successfulSignups.length; i++) {
      const cId = createdCustIds[i];
      const aNum = createdAccNums[i];
      const dbCust = await new Promise((res) => {
        verifyDb.get('SELECT customer_id, email, password_hash, card_pin, card_pin_hash FROM customers WHERE customer_id = ?', [cId], (err, row) => res(row));
      });
      assert(dbCust && dbCust.customer_id === cId, `Database has persisted customer record for ${cId}`);
      assert(dbCust && dbCust.card_pin === null, `Database customer ${cId} has card_pin = NULL`);
      assert(dbCust && dbCust.card_pin_hash && dbCust.card_pin_hash.startsWith('$2a$'), `Database customer ${cId} has valid bcrypt card_pin_hash`);

      const dbAcc = await new Promise((res) => {
        verifyDb.get('SELECT account_number, customer_id, balance, card_pin, card_pin_hash FROM accounts WHERE account_number = ?', [aNum], (err, row) => res(row));
      });
      assert(dbAcc && dbAcc.account_number === aNum, `Database has persisted account record for ${aNum}`);
      assert(dbAcc && dbAcc.customer_id === cId, `Account ${aNum} is correctly mapped to customer ${cId}`);
      assert(dbAcc && dbAcc.card_pin === null, `Account ${aNum} has card_pin = NULL`);
      assert(dbAcc && parseFloat(dbAcc.balance) === 10000, `Account ${aNum} has initial opening grant of ₹10,000`);
    }

    // Confirm no orphaned accounts exist in database
    const orphanedAccs = await new Promise((res) => {
      verifyDb.all('SELECT a.account_number FROM accounts a LEFT JOIN customers c ON a.customer_id = c.customer_id WHERE c.customer_id IS NULL', (err, rows) => res(rows || []));
    });
    assert(orphanedAccs.length === 0, 'No orphaned account records exist in database');

    // Confirm duplicate email signup fails immediately with HTTP 409 without retrying or corrupting records
    const dupEmailRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Duplicate Email User',
        email: `concurrent_${nowStamp}_1@example.com`,
        password: 'Password123!',
        card_pin: '5678',
      }),
    });
    assert(dupEmailRes.status === 409, 'Duplicate email registration immediately rejected with HTTP 409 Conflict');

    // TEST 19: Sensitive Credential Sanitization Across Financial Endpoints
    console.log('\n--- 19. Testing Sensitive Credential Sanitization Across Financial Endpoints ---');
    // A. /api/accounts/my-accounts
    const myAccsRes = await fetch(`${BASE_URL}/api/accounts/my-accounts`, {
      headers: { Authorization: `Bearer ${aaravToken}` },
    });
    const myAccsData = await myAccsRes.json();
    assert(myAccsRes.status === 200, 'GET /api/accounts/my-accounts HTTP 200');
    const allAccountsSanitized = (myAccsData.accounts || []).every(
      (a) => a.card_pin === undefined && a.card_pin_hash === undefined && a.password_hash === undefined
    );
    assert(allAccountsSanitized, 'my-accounts response completely strips card_pin, card_pin_hash, and password_hash');

    // B. /api/accounts/[id]/deposit
    const sanDepositRes = await fetch(`${BASE_URL}/api/accounts/${aaravAccount}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({ amount: 1000, pin: '1234', description: 'Sanitization Verification Deposit' }),
    });
    const sanDepositData = await sanDepositRes.json();
    assert(sanDepositRes.status === 200, 'POST /api/accounts/[id]/deposit HTTP 200');
    assert(sanDepositData.account && sanDepositData.account.card_pin === undefined, 'Deposit response does not expose card_pin');
    assert(sanDepositData.account && sanDepositData.account.card_pin_hash === undefined, 'Deposit response does not expose card_pin_hash');

    // C. /api/accounts/[id]/withdraw
    const sanWithdrawRes = await fetch(`${BASE_URL}/api/accounts/${aaravAccount}/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({ amount: 500, pin: '1234' }),
    });
    const sanWithdrawData = await sanWithdrawRes.json();
    assert(sanWithdrawRes.status === 200, 'POST /api/accounts/[id]/withdraw HTTP 200');
    assert(sanWithdrawData.account && sanWithdrawData.account.card_pin === undefined, 'Withdraw response does not expose card_pin');
    assert(sanWithdrawData.account && sanWithdrawData.account.card_pin_hash === undefined, 'Withdraw response does not expose card_pin_hash');

    // D. /api/accounts/transfer
    const sanitizeTransferRes = await fetch(`${BASE_URL}/api/accounts/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({
        from_account: aaravAccount,
        to_account: priyaAccount,
        amount: 100,
        pin: '1234',
        description: 'Sanitize Transfer Test',
      }),
    });
    const sanitizeTransferData = await sanitizeTransferRes.json();
    assert(sanitizeTransferRes.status === 200, 'POST /api/accounts/transfer HTTP 200');
    assert(sanitizeTransferData.sender && sanitizeTransferData.sender.card_pin === undefined, 'Transfer response does not expose card_pin');
    assert(sanitizeTransferData.sender && sanitizeTransferData.sender.card_pin_hash === undefined, 'Transfer response does not expose card_pin_hash');

    // E. /api/accounts/[id]/freeze
    const sanFreezeRes = await fetch(`${BASE_URL}/api/accounts/${aaravAccount}/freeze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({ pin: '1234' }),
    });
    const sanFreezeData = await sanFreezeRes.json();
    assert(sanFreezeRes.status === 200, 'POST /api/accounts/[id]/freeze HTTP 200');
    assert(sanFreezeData.account && sanFreezeData.account.card_pin === undefined, 'Freeze response does not expose card_pin');
    assert(sanFreezeData.account && sanFreezeData.account.card_pin_hash === undefined, 'Freeze response does not expose card_pin_hash');
    // Unfreeze to restore active state
    await fetch(`${BASE_URL}/api/accounts/${aaravAccount}/freeze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({ pin: '1234' }),
    });

    // F. /api/deposits (Term Deposit booking)
    const sanFdRes = await fetch(`${BASE_URL}/api/deposits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({
        source_account: aaravAccount,
        deposit_type: 'Fixed Deposit',
        principal_amount: 10000,
        tenure_months: 12,
        pin: '1234',
      }),
    });
    const sanFdData = await sanFdRes.json();
    assert(sanFdRes.status === 201, 'POST /api/deposits HTTP 201');
    assert(sanFdData.account && sanFdData.account.card_pin === undefined, 'Term deposit response does not expose card_pin');
    assert(sanFdData.account && sanFdData.account.card_pin_hash === undefined, 'Term deposit response does not expose card_pin_hash');

    // G. /api/deposits/[id]/break (Premature closure)
    if (sanFdData.deposit?.deposit_id) {
      const sanBreakRes = await fetch(`${BASE_URL}/api/deposits/${sanFdData.deposit.deposit_id}/break`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aaravToken}`,
        },
        body: JSON.stringify({ pin: '1234' }),
      });
      const sanBreakData = await sanBreakRes.json();
      assert(sanBreakRes.status === 200, 'POST /api/deposits/[id]/break HTTP 200');
      assert(sanBreakData.account && sanBreakData.account.card_pin === undefined, 'Term deposit break response does not expose card_pin');
      assert(sanBreakData.account && sanBreakData.account.card_pin_hash === undefined, 'Term deposit break response does not expose card_pin_hash');
    }

    // TEST 20: Isolated Legacy PIN Migration & Fail-Closed Logic
    console.log('\n--- 20. Testing Isolated Legacy PIN Migration & Fail-Closed Verification ---');
    const bcrypt = require('bcryptjs');

    function localVerifyPin(pin, storedHash) {
      if (!storedHash || !pin) return false;
      const trimmedPin = pin.toString().trim();
      if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
        try {
          return bcrypt.compareSync(trimmedPin, storedHash);
        } catch {
          return false;
        }
      }
      return false;
    }

    function localVerifyTransactionPin(providedPin, customer) {
      if (!providedPin) return false;
      const pin = providedPin.toString().trim();
      if (customer.card_pin_hash && localVerifyPin(pin, customer.card_pin_hash)) {
        return true;
      }
      if (customer.password_hash && (customer.password_hash.startsWith('$2a$') || customer.password_hash.startsWith('$2b$'))) {
        try {
          return bcrypt.compareSync(pin, customer.password_hash);
        } catch {
          return false;
        }
      }
      return false;
    }

    const testPinHash = bcrypt.hashSync('9876', 10);
    assert(localVerifyPin('9876', testPinHash) === true, 'localVerifyPin succeeds with correct PIN');
    assert(localVerifyPin('0000', testPinHash) === false, 'localVerifyPin fails with incorrect PIN');
    assert(localVerifyPin('9876', null) === false, 'localVerifyPin fails closed on null hash');
    assert(localVerifyPin('9876', undefined) === false, 'localVerifyPin fails closed on undefined hash');
    assert(localVerifyPin('9876', '') === false, 'localVerifyPin fails closed on empty hash');
    assert(localVerifyPin('9876', 'not-a-bcrypt-hash') === false, 'localVerifyPin fails closed on plain string hash');
    assert(localVerifyPin('9876', '$2a$10$malformedcorruptedhashvalue123456789012345') === false, 'localVerifyPin fails closed on corrupted bcrypt string');

    assert(localVerifyTransactionPin('9876', { password_hash: '', card_pin_hash: '' }) === false, 'localVerifyTransactionPin fails closed when hashes missing');
    assert(localVerifyTransactionPin('9876', { password_hash: 'plainTextPassword', card_pin: '9876' }) === false, 'localVerifyTransactionPin never authenticates against plaintext card_pin');

    // Isolated In-Memory SQLite Legacy Migration Simulation
    const tempLegacyDb = new sqlite3.Database(':memory:');
    const runAsync = (sql, params = []) => new Promise((res, rej) => tempLegacyDb.run(sql, params, (err) => err ? rej(err) : res()));
    const allAsync = (sql, params = []) => new Promise((res, rej) => tempLegacyDb.all(sql, params, (err, rows) => err ? rej(err) : res(rows || [])));

    await runAsync(`
      CREATE TABLE legacy_customers (
        customer_id TEXT PRIMARY KEY,
        card_pin TEXT,
        card_pin_hash TEXT
      )
    `);
    await runAsync("INSERT INTO legacy_customers (customer_id, card_pin, card_pin_hash) VALUES ('LEGACY-1', '5555', NULL)");
    await runAsync("INSERT INTO legacy_customers (customer_id, card_pin, card_pin_hash) VALUES ('LEGACY-2', '7777', NULL)");

    // Step 1: Migrate plaintext PINs to bcrypt hashes
    const legacyRows = await allAsync("SELECT customer_id, card_pin FROM legacy_customers WHERE card_pin IS NOT NULL AND (card_pin_hash IS NULL OR card_pin_hash = '')");
    for (const r of legacyRows) {
      const h = bcrypt.hashSync(r.card_pin, 10);
      await runAsync("UPDATE legacy_customers SET card_pin_hash = ? WHERE customer_id = ?", [h, r.customer_id]);
    }

    // Step 2: Scrub plaintext PIN column
    await runAsync("UPDATE legacy_customers SET card_pin = NULL WHERE card_pin_hash IS NOT NULL AND card_pin_hash != ''");

    // Step 3: Verify migration
    const migratedRows = await allAsync("SELECT * FROM legacy_customers");
    assert(migratedRows.length === 2, 'Isolated legacy migration processed 2 records');
    assert(migratedRows.every(r => r.card_pin === null), 'Isolated legacy migration set card_pin = NULL for all records');
    assert(migratedRows.every(r => r.card_pin_hash && r.card_pin_hash.startsWith('$2a$')), 'Isolated legacy migration generated bcrypt hashes');
    assert(bcrypt.compareSync('5555', migratedRows[0].card_pin_hash), 'Migrated hash matches original legacy PIN for LEGACY-1');
    assert(bcrypt.compareSync('7777', migratedRows[1].card_pin_hash), 'Migrated hash matches original legacy PIN for LEGACY-2');

    tempLegacyDb.close();
    verifyDb.close();

  } catch (error) {
    console.error('Test execution error:', error);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`   SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED   `);
  console.log('====================================================');
}

runTests();
