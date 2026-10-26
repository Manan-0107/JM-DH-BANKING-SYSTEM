import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateToken, hashPin, generateTransactionReference, generateAuditId } from '@/lib/auth';
import { sanitizeCustomer, sanitizeAccount } from '@/lib/api-helpers';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      full_name,
      email,
      password,
      pin,
      card_pin,
      phone,
      dob,
      address,
      pan_number,
      aadhaar_number,
      gender,
      father_name,
      marital_status,
      occupation,
      annual_income,
      nominee_name,
      nominee_relation,
      nominee_dob,
      account_type,
      branch_name,
      ifsc_code,
      signature_data,
      avatar_data,
      vkyc_status,
    } = body;

    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      return NextResponse.json(
        { error: 'Full legal name is required to initiate account creation' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !email.trim() || !email.includes('@')) {
      return NextResponse.json(
        { error: 'A valid email address is required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = full_name.trim();

    // Strict credential validation (Rejects missing credentials without default fallbacks)
    const rawPassword = password ? password.toString().trim() : '';
    const rawPin = (card_pin || pin) ? (card_pin || pin).toString().trim() : '';

    if (!rawPassword || rawPassword.length < 6) {
      return NextResponse.json(
        { error: 'A secure password of at least 6 characters is required for NetBanking registration' },
        { status: 400 }
      );
    }

    if (!rawPin || !/^\d{4}$/.test(rawPin)) {
      return NextResponse.json(
        { error: 'A valid 4-digit numeric ATM Card PIN is required' },
        { status: 400 }
      );
    }

    const effectivePassword = rawPassword;
    const effectivePin = rawPin;

    const db = await getDb();

    // Check if customer email already exists
    const [existing] = await db.query('SELECT customer_id FROM customers WHERE LOWER(email) = ?', [cleanEmail]);
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'This email is already registered with Bharat Trust Bank. Please login instead.' },
        { status: 409 }
      );
    }

    // Generate Next Sequential Customer ID safely
    const [allCusts] = await db.query('SELECT customer_id FROM customers');
    let nextNum = 106;
    if (allCusts && allCusts.length > 0) {
      const nums = allCusts
        .map((c: any) => {
          const parts = (c.customer_id || '').split('-');
          return parts.length > 1 ? parseInt(parts[1], 10) : 0;
        })
        .filter((n: number) => !isNaN(n));
      if (nums.length > 0) {
        nextNum = Math.max(...nums) + 1;
      }
    }
    const customer_id = `CUST-${nextNum}`;

    const password_hash = bcrypt.hashSync(effectivePassword, 10);
    const card_pin_hash = hashPin(effectivePin);
    const created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

    let maskedAadhaar = aadhaar_number ? aadhaar_number.toString().trim() : null;
    if (maskedAadhaar && maskedAadhaar.length === 12) {
      maskedAadhaar = `XXXXXXXX${maskedAadhaar.slice(-4)}`;
    }

    const cleanPan = pan_number ? pan_number.toString().trim().toUpperCase() : null;
    const finalBranch = branch_name || 'Mumbai Nariman Point Hub';
    const finalIfsc = ifsc_code || 'BTBI0001024';
    const finalType = account_type || 'Savings Account';
    const isProduction = process.env.NODE_ENV === 'production';
    // Demonstration grant of ₹10,000 is enabled in development/evaluation mode, but strictly prohibited in production
    const allowDemoGrant = !isProduction && (process.env.ENABLE_DEMO_GRANT === 'true' || process.env.ENABLE_DEMO_GRANT === undefined);
    const initialGrant = allowDemoGrant ? 10000.00 : 0.00;
    const initialKycStatus = isProduction ? 'Pending' : 'Verified';
    const initialVkycStatus = isProduction ? 'Pending' : (vkyc_status || 'Completed');

    // Concurrency-safe bounded retry loop for unique customer ID and account number generation
    let createdCustomerId = '';
    let createdAccNum = '';
    const maxRetries = 5;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
      attempt++;

      // 1. Determine next sequential Customer ID
      const [allCusts] = await db.query('SELECT customer_id FROM customers');
      let nextNum = 106;
      if (allCusts && allCusts.length > 0) {
        const nums = allCusts
          .map((c: any) => {
            const parts = (c.customer_id || '').split('-');
            return parts.length > 1 ? parseInt(parts[1], 10) : 0;
          })
          .filter((n: number) => !isNaN(n));
        if (nums.length > 0) {
          nextNum = Math.max(...nums) + 1;
        }
      }
      const candidateCustomerId = `CUST-${nextNum + (attempt - 1)}`;

      // 2. Generate unique account number and ensure absence of collision
      const randomAccSuffix = crypto.randomInt(100000, 999999);
      const candidateAccNum = `ACC-${randomAccSuffix}`;
      const [existingAcc] = await db.query('SELECT account_number FROM accounts WHERE account_number = ?', [candidateAccNum]);
      if (existingAcc && existingAcc.length > 0) {
        continue;
      }

      const { txnId, referenceNumber } = generateTransactionReference('TXN-GRANT');

      try {
        await db.transaction(async (conn) => {
          // 1. Insert Customer Record (card_pin set to NULL to prevent plaintext storage)
          await conn.query(
            `INSERT INTO customers (
              customer_id, full_name, email, phone, dob, address, created_at,
              status, kyc_status, password_hash, credit_score, tier,
              pan_number, aadhaar_number, gender, father_name, marital_status,
              occupation, annual_income, nominee_name, nominee_relation, nominee_dob,
              vkyc_status, signature_data, avatar_data, card_pin, card_pin_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, 770, 'Silver', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
            [
              candidateCustomerId,
              cleanName,
              cleanEmail,
              phone || null,
              dob || null,
              address || null,
              created_at,
              initialKycStatus,
              password_hash,
              cleanPan,
              maskedAadhaar,
              gender || 'Not Specified',
              father_name || null,
              marital_status || 'Single',
              occupation || 'Salaried',
              annual_income || '₹3,00,000 - ₹10,00,000',
              nominee_name || null,
              nominee_relation || null,
              nominee_dob || null,
              initialVkycStatus,
              signature_data || null,
              avatar_data || null,
              card_pin_hash,
            ]
          );

          // 2. Insert Account Record (card_pin set to NULL to prevent plaintext storage)
          await conn.query(
            `INSERT INTO accounts (account_number, customer_id, account_type, balance, ifsc_code, branch_name, opening_date, status, card_pin, card_pin_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', NULL, ?)`,
            [candidateAccNum, candidateCustomerId, finalType, initialGrant, finalIfsc, finalBranch, created_at, card_pin_hash]
          );

          // 3. Insert Initial Welcome Balance Transaction (if demo grant enabled)
          if (initialGrant > 0) {
            await conn.query(
              `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description, reference_number)
               VALUES (?, NULL, ?, ?, 'Deposit', ?, 'Success', 'Welcome Opening Balance Grant - BTB DigiSave', ?)`,
              [txnId, candidateAccNum, initialGrant, created_at, referenceNumber]
            );
          }

          // 4. Record KYC Audit Trail (with high-entropy collision-proof IDs)
          const auditLogs = [
            { type: 'MOBILE_OTP', doc: phone || 'MOBILE', method: 'SMS_OTP_AUTHENTICATION', remarks: 'Simulated 2FA SMS verification' },
            { type: 'PAN_CARD', doc: cleanPan || 'PAN_CARD', method: 'NSDL_TIN_API_SIMULATED', remarks: 'Simulated Income Tax database verification' },
            { type: 'AADHAAR_UIDAI', doc: maskedAadhaar || 'AADHAAR', method: 'UIDAI_DEMOGRAPHIC_EKYC', remarks: 'Simulated Aadhaar demographic check' },
            { type: 'VIDEO_KYC', doc: 'LIVE_FACIAL_CAPTURE', method: 'AI_FACIAL_LIVENESS_GEO_TAG', remarks: 'Simulated RBI officer video check' },
            { type: 'DIGITAL_SIGNATURE', doc: 'CANVAS_SIGNATURE', method: 'TOUCH_CANVAS_DIGITAL_RECORD', remarks: 'Digital signature specimen captured' },
          ];

          for (let i = 0; i < auditLogs.length; i++) {
            const item = auditLogs[i];
            const verifId = `KYC-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${i + 1}`;
            await conn.query(
              `INSERT INTO kyc_verifications (verification_id, customer_id, document_type, document_number, verification_method, status, verified_at, remarks)
               VALUES (?, ?, ?, ?, ?, 'Verified', ?, ?)`,
              [verifId, candidateCustomerId, item.type, item.doc, item.method, created_at, item.remarks]
            );
          }

          // 5. Record System Audit Log
          const auditId = generateAuditId();
          await conn.query(
            `INSERT INTO audit_logs (log_id, customer_id, action, entity_type, entity_id, details, timestamp)
             VALUES (?, ?, 'CUSTOMER_SIGNUP', 'CUSTOMER', ?, ?, ?)`,
            [auditId, candidateCustomerId, candidateCustomerId, `New customer onboarding completed. Primary account: ${candidateAccNum}`, created_at]
          );
        });

        createdCustomerId = candidateCustomerId;
        createdAccNum = candidateAccNum;
        success = true;
      } catch (insertErr: any) {
        const errMsg = String(insertErr?.message || insertErr);
        const lowerErr = errMsg.toLowerCase();

        // 1. Email uniqueness conflict: return HTTP 409 immediately without retrying
        if (
          lowerErr.includes('customers.email') ||
          lowerErr.includes("key 'email'") ||
          lowerErr.includes('key "email"') ||
          (lowerErr.includes('email') && (lowerErr.includes('unique') || lowerErr.includes('duplicate')))
        ) {
          return NextResponse.json(
            { error: 'This email is already registered with Bharat Trust Bank. Please login instead.' },
            { status: 409 }
          );
        }

        // 2. Unrelated errors that must never be retried (schema, null, foreign key, connection)
        if (
          errMsg.includes('NOT NULL') ||
          errMsg.includes('FOREIGN KEY') ||
          errMsg.includes('cannot be null') ||
          errMsg.includes('foreign key constraint fails') ||
          errMsg.includes('syntax') ||
          errMsg.includes('no such table') ||
          errMsg.includes('ECONNREFUSED')
        ) {
          throw insertErr;
        }

        // 3. Specifically recognize identifier collisions (customer_id, account_number, reference_number, transaction_id, PRIMARY key)
        const isUniqueError =
          errMsg.includes('UNIQUE constraint failed') ||
          errMsg.includes('Duplicate entry') ||
          errMsg.includes('ER_DUP_ENTRY');

        const isIdentifierConflict =
          errMsg.includes('customer_id') ||
          errMsg.includes('account_number') ||
          errMsg.includes('reference_number') ||
          errMsg.includes('transaction_id') ||
          errMsg.includes('PRIMARY');

        const isIdCollision = isUniqueError && isIdentifierConflict;

        if (isIdCollision) {
          if (attempt >= maxRetries) {
            console.error('[Signup Collision Exhaustion] Failed to allocate unique ID after max retries:', candidateCustomerId);
            return NextResponse.json(
              { error: 'Registration service temporarily busy. Unable to allocate unique account identifier. Please retry.' },
              { status: 503 }
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
          continue;
        }

        // Unrelated database failures should NOT be retried
        throw insertErr;
      }
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Registration service temporarily busy. Unable to complete onboarding.' },
        { status: 503 }
      );
    }

    const [newCustomer] = await db.query('SELECT * FROM customers WHERE customer_id = ?', [createdCustomerId]);
    const cleanCustomer = sanitizeCustomer(newCustomer?.[0]);

    const [newAccount] = await db.query('SELECT * FROM accounts WHERE account_number = ?', [createdAccNum]);
    const cleanAccount = sanitizeAccount(newAccount?.[0]);

    const token = generateToken(cleanCustomer!);

    return NextResponse.json(
      {
        message: 'Account created and digital onboarding completed successfully',
        token,
        customer: cleanCustomer,
        account: cleanAccount,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Signup error:', err?.message || 'Unknown signup error');
    return NextResponse.json(
      { error: 'Failed to complete digital onboarding. Please try again.' },
      { status: 500 }
    );
  }
}
