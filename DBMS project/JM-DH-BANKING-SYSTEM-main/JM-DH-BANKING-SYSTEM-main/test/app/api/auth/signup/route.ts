import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateToken, hashPin, generateTransactionReference } from '@/lib/auth';
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

    // Support both multi-step wizard (password + card_pin) and quick home page signup (pin)
    const effectivePassword = (password || pin || 'SecureBank@123').toString().trim();
    const effectivePin = (card_pin || pin || '1234').toString().trim();

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

    // Generate unique account number and reference
    const randomAccSuffix = crypto.randomInt(100000, 999999);
    const accNum = `ACC-${randomAccSuffix}`;
    const finalBranch = branch_name || 'Mumbai Nariman Point Hub';
    const finalIfsc = ifsc_code || 'BTBI0001024';
    const finalType = account_type || 'Savings Account';
    const initialGrant = 10000.00;

    const { txnId, referenceNumber } = generateTransactionReference('TXN-GRANT');

    await db.transaction(async (conn) => {
      // 1. Insert Customer Record
      await conn.query(
        `INSERT INTO customers (
          customer_id, full_name, email, phone, dob, address, created_at,
          status, kyc_status, password_hash, credit_score, tier,
          pan_number, aadhaar_number, gender, father_name, marital_status,
          occupation, annual_income, nominee_name, nominee_relation, nominee_dob,
          vkyc_status, signature_data, avatar_data, card_pin, card_pin_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', 'Verified', ?, 770, 'Silver', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customer_id,
          cleanName,
          cleanEmail,
          phone || null,
          dob || null,
          address || null,
          created_at,
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
          vkyc_status || 'Completed',
          signature_data || null,
          avatar_data || null,
          effectivePin,
          card_pin_hash,
        ]
      );

      // 2. Insert Account Record
      await conn.query(
        `INSERT INTO accounts (account_number, customer_id, account_type, balance, ifsc_code, branch_name, opening_date, status, card_pin, card_pin_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [accNum, customer_id, finalType, initialGrant, finalIfsc, finalBranch, created_at, effectivePin, card_pin_hash]
      );

      // 3. Insert Initial Welcome Balance Transaction
      await conn.query(
        `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description, reference_number)
         VALUES (?, NULL, ?, ?, 'Deposit', ?, 'Success', 'Welcome Opening Balance Grant - BTB DigiSave', ?)`,
        [txnId, accNum, initialGrant, created_at, referenceNumber]
      );

      // 4. Record KYC Audit Trail
      const auditLogs = [
        { type: 'MOBILE_OTP', doc: phone || 'MOBILE', method: 'SMS_OTP_AUTHENTICATION', remarks: 'Simulated 2FA SMS verification' },
        { type: 'PAN_CARD', doc: cleanPan || 'PAN_CARD', method: 'NSDL_TIN_API_SIMULATED', remarks: 'Simulated Income Tax database verification' },
        { type: 'AADHAAR_UIDAI', doc: maskedAadhaar || 'AADHAAR', method: 'UIDAI_DEMOGRAPHIC_EKYC', remarks: 'Simulated Aadhaar demographic check' },
        { type: 'VIDEO_KYC', doc: 'LIVE_FACIAL_CAPTURE', method: 'AI_FACIAL_LIVENESS_GEO_TAG', remarks: 'Simulated RBI officer video check' },
        { type: 'DIGITAL_SIGNATURE', doc: 'CANVAS_SIGNATURE', method: 'TOUCH_CANVAS_DIGITAL_RECORD', remarks: 'Digital signature specimen captured' },
      ];

      for (let i = 0; i < auditLogs.length; i++) {
        const item = auditLogs[i];
        const verifId = `KYC-${Date.now().toString().slice(-6)}${i + 1}`;
        await conn.query(
          `INSERT INTO kyc_verifications (verification_id, customer_id, document_type, document_number, verification_method, status, verified_at, remarks)
           VALUES (?, ?, ?, ?, ?, 'Verified', ?, ?)`,
          [verifId, customer_id, item.type, item.doc, item.method, created_at, item.remarks]
        );
      }

      // 5. Record System Audit Log
      const auditId = `AUD-${Date.now().toString().slice(-6)}`;
      await conn.query(
        `INSERT INTO audit_logs (log_id, customer_id, action, entity_type, entity_id, details, timestamp)
         VALUES (?, ?, 'CUSTOMER_SIGNUP', 'CUSTOMER', ?, ?, ?)`,
        [auditId, customer_id, customer_id, `New customer onboarding completed. Primary account: ${accNum}`, created_at]
      );
    });

    const [newCustomer] = await db.query('SELECT * FROM customers WHERE customer_id = ?', [customer_id]);
    delete newCustomer[0].password_hash;

    const [newAccount] = await db.query('SELECT * FROM accounts WHERE account_number = ?', [accNum]);

    const token = generateToken(newCustomer[0]);

    return NextResponse.json(
      {
        message: 'Account created and digital onboarding completed successfully',
        token,
        customer: newCustomer[0],
        account: newAccount[0],
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Signup error:', err);
    return NextResponse.json(
      { error: 'Failed to complete digital onboarding. Please try again.' },
      { status: 500 }
    );
  }
}
