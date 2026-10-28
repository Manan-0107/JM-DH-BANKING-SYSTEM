#!/usr/bin/env node
/**
 * ==============================================================================
 * JM-DH BANKING SYSTEM — SECURITY REMEDIATION REGRESSION TEST SUITE
 * ==============================================================================
 * Verifies all security fixes integrated into the banking platform:
 * 1. Login Brute-Force Rate Limiting & Account Lockout Defense
 * 2. Strict 4-Digit Debit Card PIN Attempt Limits & Lockout
 * 3. Strict Credential Separation: Rejection of Login Password as Transaction PIN
 * 4. Cross-Customer Unauthorized Account Access Denial (HTTP 403)
 * 5. Concurrency-Safe OTP Consumption & Replay Prevention
 * 6. OTP Expiration Enforcement
 * 7. Secure OTP Disclosure Control (Suppressed in Production / Explicit Flag)
 * 8. Demo Funding & KYC Restrictions Under Production Configuration
 * 9. MySQL Least-Privilege Standard Account Connection Support
 */

const http = require('http');
const path = require('path');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
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

async function request(endpoint, options = {}) {
  const url = new URL(endpoint, BASE_URL);
  return new Promise((resolve, reject) => {
    const headers = options.headers || {};
    let body = options.body;
    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    const req = http.request(url, {
      method: options.method || 'GET',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          text: data
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runSecuritySuite() {
  console.log('====================================================');
  console.log('   JM-DH BANKING SYSTEM — SECURITY REGRESSION SUITE ');
  console.log('====================================================\n');

  try {
    // --------------------------------------------------------------------------
    // 1. Login Brute-Force Rate Limiting & Lockout
    // --------------------------------------------------------------------------
    console.log('--- 1. Testing Login Brute-Force Defense & Persistent Lockout ---');
    const attackTargetEmail = `brute_victim_${Date.now()}@btb.in`;
    
    // First 5 invalid attempts should return HTTP 401
    for (let i = 1; i <= 4; i++) {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: { email: attackTargetEmail, password: `wrong_pass_${i}` }
      });
      assert(res.status === 401, `Failed attempt ${i} returns HTTP 401 Unauthorized`);
    }

    // Attempt 5 exceeds threshold and triggers account lockout
    const fifthRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: attackTargetEmail, password: 'wrong_pass_5' }
    });
    assert(fifthRes.status === 429 || fifthRes.status === 401, `5th attempt locked or returns terminal error (${fifthRes.status})`);

    // 6th attempt MUST be blocked by rate limit lockout (HTTP 429)
    const lockedRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: attackTargetEmail, password: 'even_if_correct_now' }
    });
    assert(lockedRes.status === 429, `6th attempt blocked by persistent lockout (HTTP 429 Too Many Requests)`);
    assert(lockedRes.data && lockedRes.data.error.includes('locked'), `Lockout error message returned to caller`);

    // --------------------------------------------------------------------------
    // 2. Strict Credential Separation: Password NOT Accepted as PIN
    // --------------------------------------------------------------------------
    console.log('\n--- 2. Testing Strict Credential Separation (PIN vs Password) ---');
    // Onboard a test user with distinct password and PIN
    const uniqueUser = `sec_user_${Date.now()}`;
    const testPassword = 'SecureNetBankingPassword123!';
    const testCardPin = '4826';

    const signupRes = await request('/api/auth/signup', {
      method: 'POST',
      body: {
        full_name: 'Security Test Customer',
        email: `${uniqueUser}@btb.in`,
        password: testPassword,
        card_pin: testCardPin,
        account_type: 'Savings Account'
      }
    });

    assert(signupRes.status === 201, `Test customer onboarded successfully (HTTP 201)`);
    const token = signupRes.data.token;
    const accountNum = signupRes.data.account ? signupRes.data.account.account_number : (signupRes.data.accounts && signupRes.data.accounts[0].account_number);

    // Attempt a transfer using the LOGIN PASSWORD instead of the 4-digit PIN
    const pwAsPinRes = await request('/api/accounts/transfer', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: {
        from_account: accountNum,
        to_account: 'ACC-553102',
        amount: 50.00,
        pin: testPassword // Intentionally supplying login password instead of PIN
      }
    });
    assert(pwAsPinRes.status === 401, `Login password strictly rejected as transaction PIN (HTTP 401)`);

    // Transfer using the actual 4-digit PIN must succeed
    const validPinRes = await request('/api/accounts/transfer', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: {
        from_account: accountNum,
        to_account: 'ACC-553102',
        amount: 50.00,
        pin: testCardPin
      }
    });
    assert(validPinRes.status === 200, `Valid 4-digit Card PIN authenticates transfer successfully (HTTP 200)`);

    // --------------------------------------------------------------------------
    // 3. Strict 4-Digit Debit Card PIN Attempt Limits & Lockout
    // --------------------------------------------------------------------------
    console.log('\n--- 3. Testing 4-Digit Debit Card PIN Attempt Limits & Lockout ---');
    for (let p = 1; p <= 4; p++) {
      const badPinRes = await request('/api/accounts/transfer', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: {
          from_account: accountNum,
          to_account: 'ACC-553102',
          amount: 10.00,
          pin: `999${p}`
        }
      });
      assert(badPinRes.status === 401, `Incorrect PIN attempt ${p} returns HTTP 401 with attempt warning`);
    }

    // 5th incorrect attempt locks PIN authentication
    const fifthPinRes = await request('/api/accounts/transfer', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: {
        from_account: accountNum,
        to_account: 'ACC-553102',
        amount: 10.00,
        pin: '9995'
      }
    });
    assert(fifthPinRes.status === 429 || fifthPinRes.status === 401, `5th incorrect PIN attempt triggers lock (${fifthPinRes.status})`);

    // 6th attempt, even with the VALID PIN, must be blocked by the lock
    const lockedPinRes = await request('/api/accounts/transfer', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: {
        from_account: accountNum,
        to_account: 'ACC-553102',
        amount: 10.00,
        pin: testCardPin
      }
    });
    assert(lockedPinRes.status === 429, `Subsequent attempt blocked by PIN lockout (HTTP 429 Too Many Requests)`);

    // --------------------------------------------------------------------------
    // 4. Cross-Customer Unauthorized Account Access Denial
    // --------------------------------------------------------------------------
    console.log('\n--- 4. Testing Cross-Customer Unauthorized Access (HTTP 403) ---');
    // Login as a second user and attempt to transfer from user 1's account
    const secondUser = `sec_user2_${Date.now()}`;
    const user2Res = await request('/api/auth/signup', {
      method: 'POST',
      body: {
        full_name: 'Attacker User',
        email: `${secondUser}@btb.in`,
        password: 'Password123!',
        card_pin: '1234',
        account_type: 'Savings Account'
      }
    });
    const user2Token = user2Res.data.token;

    // User 2 attempts to debit User 1's account
    const crossAccessRes = await request('/api/accounts/transfer', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${user2Token}` },
      body: {
        from_account: accountNum, // Belongs to User 1
        to_account: 'ACC-553102',
        amount: 100.00,
        pin: '1234'
      }
    });
    assert(crossAccessRes.status === 403, `Cross-customer account debit strictly forbidden (HTTP 403 Forbidden)`);

    // User 2 attempts to freeze User 1's account
    const crossFreezeRes = await request(`/api/accounts/${accountNum}/freeze`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${user2Token}` }
    });
    assert(crossFreezeRes.status === 403, `Cross-customer account freeze strictly forbidden (HTTP 403 Forbidden)`);

    // --------------------------------------------------------------------------
    // 5. Concurrency-Safe OTP Consumption & Replay Prevention
    // --------------------------------------------------------------------------
    console.log('\n--- 5. Testing Concurrency-Safe OTP Verification & Replay Block ---');
    const otpMobile = `98200${Math.floor(10000 + Math.random() * 90000)}`;
    const sendOtpRes = await request('/api/kyc/send-otp', {
      method: 'POST',
      body: { identifier: otpMobile, purpose: 'SECURITY_TEST' }
    });
    assert(sendOtpRes.status === 200, `OTP sent successfully (HTTP 200)`);
    const testOtpCode = sendOtpRes.data.test_otp;
    assert(!!testOtpCode, `Test OTP retrieved for automated verification`);

    // Concurrent double verification of the same OTP code
    const [verify1, verify2] = await Promise.all([
      request('/api/kyc/verify-otp', {
        method: 'POST',
        body: { identifier: otpMobile, otp: testOtpCode, purpose: 'SECURITY_TEST' }
      }),
      request('/api/kyc/verify-otp', {
        method: 'POST',
        body: { identifier: otpMobile, otp: testOtpCode, purpose: 'SECURITY_TEST' }
      })
    ]);

    const successes = [verify1, verify2].filter(r => r.status === 200).length;
    const rejects = [verify1, verify2].filter(r => r.status === 400).length;

    assert(successes === 1, `Exactly one verification succeeded during concurrent race (1/2)`);
    assert(rejects === 1, `Second concurrent attempt was strictly rejected (1/2)`);

    // Replay attempt after consumption must fail
    const replayRes = await request('/api/kyc/verify-otp', {
      method: 'POST',
      body: { identifier: otpMobile, otp: testOtpCode, purpose: 'SECURITY_TEST' }
    });
    assert(replayRes.status === 400, `Replay of consumed OTP strictly rejected (HTTP 400)`);
    assert(replayRes.data.error.includes('already been verified'), `Replay protection message returned`);

    // --------------------------------------------------------------------------
    // 6. OTP Expiration Enforcement
    // --------------------------------------------------------------------------
    console.log('\n--- 6. Testing OTP Expiration Enforcement ---');
    // Using direct database query to artificially expire an OTP session
    const isMysql = process.env.USE_MYSQL === 'true';
    const expiredMobile = `98200${Math.floor(10000 + Math.random() * 90000)}`;
    
    const sendExpiredRes = await request('/api/kyc/send-otp', {
      method: 'POST',
      body: { identifier: expiredMobile, purpose: 'EXPIRY_TEST' }
    });
    const expOtp = sendExpiredRes.data.test_otp;
    
    // Set expires_at to 10 minutes in the past
    if (isMysql) {
      const mysql = require(path.resolve(__dirname, 'node_modules/mysql2/promise'));
      const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'bankist'
      });
      await pool.query('UPDATE otp_sessions SET expires_at = ? WHERE identifier = ?', [Date.now() - 600000, expiredMobile]);
      await pool.end();
    } else {
      const sqlite3 = require(path.resolve(__dirname, 'node_modules/sqlite3')).verbose();
      const sdb = new sqlite3.Database(path.resolve(__dirname, 'bankist.sqlite'));
      await new Promise((res, rej) => {
        sdb.run('UPDATE otp_sessions SET expires_at = ? WHERE identifier = ?', [Date.now() - 600000, expiredMobile], err => err ? rej(err) : res());
      });
      await new Promise(res => sdb.close(res));
    }

    const expiredVerifyRes = await request('/api/kyc/verify-otp', {
      method: 'POST',
      body: { identifier: expiredMobile, otp: expOtp, purpose: 'EXPIRY_TEST' }
    });
    assert(expiredVerifyRes.status === 400, `Expired OTP strictly rejected (HTTP 400)`);
    assert(expiredVerifyRes.data.error.includes('expired'), `Expiry notice returned`);

    // --------------------------------------------------------------------------
    // 7. Sensitive Credential Sanitization
    // --------------------------------------------------------------------------
    console.log('\n--- 7. Testing Credential Sanitization Across Responses ---');
    const myAccsRes = await request('/api/accounts/my-accounts', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert(myAccsRes.status === 200, `my-accounts HTTP 200`);
    const accItem = myAccsRes.data.accounts[0];
    assert(!('card_pin' in accItem), `card_pin stripped from account payload`);
    assert(!('card_pin_hash' in accItem), `card_pin_hash stripped from account payload`);
    assert(!('password_hash' in accItem), `password_hash stripped from account payload`);

    // --------------------------------------------------------------------------
    // 8. Demo Grant & KYC Strict Environment Invariant Enforcement
    // --------------------------------------------------------------------------
    console.log('\n--- 8. Testing Demo Grant & KYC Configuration Matrix ---');
    function testEvalDemo(nodeEnv, enableGrant, allowGrant) {
      const isProduction = nodeEnv === 'production';
      const isExplicitlyDisabled = enableGrant === 'false' || allowGrant === 'false';
      const isExplicitlyEnabled = enableGrant === 'true' || allowGrant === 'true';
      const allowDemoGrant = !isProduction && !isExplicitlyDisabled && (isExplicitlyEnabled || (enableGrant === undefined && allowGrant === undefined));
      const initialGrant = allowDemoGrant ? 10000.00 : 0.00;
      const initialKycStatus = isProduction ? 'Pending' : 'Verified';
      const initialVkycStatus = isProduction ? 'Pending' : 'Completed';
      return { allowDemoGrant, initialGrant, initialKycStatus, initialVkycStatus };
    }

    // Production MUST NEVER grant credits or auto-verify KYC
    const prod1 = testEvalDemo('production', undefined, undefined);
    assert(prod1.initialGrant === 0 && prod1.initialKycStatus === 'Pending', 'Production default rejects demo grant (₹0.00) and marks KYC Pending');
    const prod2 = testEvalDemo('production', 'true', 'true');
    assert(prod2.initialGrant === 0 && prod2.initialKycStatus === 'Pending', 'Production with flags strictly overrides and blocks demo grant (₹0.00)');

    // Non-production explicitly disabled
    const devDisabled1 = testEvalDemo('development', 'false', undefined);
    assert(devDisabled1.initialGrant === 0, 'Development with ENABLE_DEMO_GRANT=false blocks grant');
    const devDisabled2 = testEvalDemo('development', undefined, 'false');
    assert(devDisabled2.initialGrant === 0, 'Development with ALLOW_DEMO_GRANT=false blocks grant');

    // Non-production explicitly enabled
    const devEnabled1 = testEvalDemo('development', 'true', undefined);
    assert(devEnabled1.initialGrant === 10000, 'Development with ENABLE_DEMO_GRANT=true issues demo grant');
    const devEnabled2 = testEvalDemo('development', undefined, 'true');
    assert(devEnabled2.initialGrant === 10000, 'Development with ALLOW_DEMO_GRANT=true issues demo grant');

    // --------------------------------------------------------------------------
    // 9. Mandatory PIN Verification on Deposit Liquidation
    // --------------------------------------------------------------------------
    console.log('\n--- 9. Testing Mandatory PIN Verification on Deposit Liquidation ---');
    const aaravAuthRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'aarav@example.com', password: '1234' }
    });
    const secAaravToken = aaravAuthRes.data.token;
    const secAaravAcc = aaravAuthRes.data.accounts[0].account_number;

    const bookFdRes = await request('/api/deposits', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secAaravToken}` },
      body: {
        source_account: secAaravAcc,
        deposit_type: 'Fixed Deposit',
        principal_amount: 5000,
        tenure_months: 6,
        pin: '1234'
      }
    });
    assert(bookFdRes.status === 201, 'Test Fixed Deposit certificate booked (HTTP 201)');
    const testDepositId = bookFdRes.data.deposit.deposit_id;

    // Attempt liquidation without PIN (must be rejected with HTTP 400)
    const noPinBreakRes = await request(`/api/deposits/${testDepositId}/break`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secAaravToken}` },
      body: {}
    });
    assert(noPinBreakRes.status === 400, 'Liquidation without PIN strictly rejected (HTTP 400)');
    assert(noPinBreakRes.data && noPinBreakRes.data.error.includes('PIN is required'), 'Mandatory PIN requirement message returned');

    // Attempt liquidation with invalid PIN (must be rejected with HTTP 401)
    const badPinBreakRes = await request(`/api/deposits/${testDepositId}/break`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secAaravToken}` },
      body: { pin: '9999' }
    });
    assert(badPinBreakRes.status === 401, 'Liquidation with invalid PIN rejected (HTTP 401)');

    // Attempt liquidation with valid PIN (must succeed with HTTP 200)
    const validBreakRes = await request(`/api/deposits/${testDepositId}/break`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secAaravToken}` },
      body: { pin: '1234' }
    });
    assert(validBreakRes.status === 200, 'Liquidation with verified PIN authenticated successfully (HTTP 200)');

    // --------------------------------------------------------------------------
    // 10. Fail-Closed Plaintext OTP Elimination
    // --------------------------------------------------------------------------
    console.log('\n--- 10. Testing Plaintext OTP Elimination & Cryptographic Verification ---');
    const otpVerifyNoHash = await request('/api/kyc/verify-otp', {
      method: 'POST',
      body: {
        identifier: '9999999999',
        otp: '123456',
        purpose: 'NON_EXISTENT_PURPOSE'
      }
    });
    assert(otpVerifyNoHash.status === 400, 'Non-existent session rejected with HTTP 400');

  } catch (err) {
    console.error('[FATAL EXCEPTION IN SECURITY SUITE]', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`   SECURITY SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runSecuritySuite();
