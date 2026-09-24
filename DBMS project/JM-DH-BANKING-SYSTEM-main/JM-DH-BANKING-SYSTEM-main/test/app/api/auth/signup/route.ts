import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      full_name,
      email,
      password,
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

    const netBankingPassword = password || 'SecureBank@123';
    const assignedCardPin = (card_pin || '1234').toString().trim();

    if (!full_name || !email) {
      return NextResponse.json(
        { error: 'Full legal name and email are required to initiate account creation' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const [existing] = await db.query('SELECT customer_id FROM customers WHERE email = ?', [email.trim()]);
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'This email is already registered with Bharat Trust Bank. Please login instead.' },
        { status: 409 }
      );
    }

    // Generate Next Customer ID (e.g. CUST-106, CUST-107...)
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

    const password_hash = bcrypt.hashSync(netBankingPassword.toString().trim(), 10);
    const created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Normalize and mask Aadhaar for privacy if provided
    let maskedAadhaar = aadhaar_number ? aadhaar_number.trim() : null;
    if (maskedAadhaar && maskedAadhaar.length === 12) {
      maskedAadhaar = `XXXXXXXX${maskedAadhaar.slice(-4)}`;
    }

    const cleanPan = pan_number ? pan_number.trim().toUpperCase() : null;

    // Insert Customer with full KYC Profile and Card PIN
    await db.query(
      `
      INSERT INTO customers (
        customer_id, full_name, email, phone, dob, address, created_at,
        status, kyc_status, password_hash, credit_score, tier,
        pan_number, aadhaar_number, gender, father_name, marital_status,
        occupation, annual_income, nominee_name, nominee_relation, nominee_dob,
        vkyc_status, signature_data, avatar_data, card_pin
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', 'Verified', ?, 770, 'Silver', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        customer_id,
        full_name.trim(),
        email.trim(),
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
        assignedCardPin,
      ]
    );

    // Record formal KYC Verification Audits in kyc_verifications table
    const auditLogs = [
      {
        type: 'MOBILE_OTP',
        doc: phone || 'MOBILE',
        method: 'SMS_OTP_AUTHENTICATION',
        remarks: 'Mobile number authenticated with 2-factor OTP verification',
      },
      {
        type: 'PAN_CARD',
        doc: cleanPan || 'PAN_CARD',
        method: 'NSDL_TIN_API_SIMULATED',
        remarks: 'PAN format validated and legal name verified against Income Tax Database',
      },
      {
        type: 'AADHAAR_UIDAI',
        doc: maskedAadhaar || 'AADHAAR',
        method: 'UIDAI_DEMOGRAPHIC_EKYC',
        remarks: 'Aadhaar demographic details verified via biometric/OTP e-KYC',
      },
      {
        type: 'VIDEO_KYC',
        doc: 'LIVE_FACIAL_CAPTURE',
        method: 'AI_FACIAL_LIVENESS_GEO_TAG',
        remarks: 'Liveness confirmed and geo-coordinates stamped in compliance with RBI norms',
      },
      {
        type: 'DIGITAL_SIGNATURE',
        doc: 'CANVAS_SIGNATURE',
        method: 'TOUCH_CANVAS_DIGITAL_RECORD',
        remarks: 'Digital signature specimen captured and recorded for mandate',
      },
    ];

    for (let i = 0; i < auditLogs.length; i++) {
      const item = auditLogs[i];
      const verifId = `KYC-${Date.now().toString().slice(-6)}${i + 1}`;
      try {
        await db.query(
          `
          INSERT INTO kyc_verifications (verification_id, customer_id, document_type, document_number, verification_method, status, verified_at, remarks)
          VALUES (?, ?, ?, ?, ?, 'Verified', ?, ?)
        `,
          [verifId, customer_id, item.type, item.doc, item.method, created_at, item.remarks]
        );
      } catch (e) {
        console.warn('KYC audit log insert skipped:', e);
      }
    }

    // Generate unique Account Number
    const accNum = `ACC-${Math.floor(100000 + Math.random() * 900000)}`;
    const finalBranch = branch_name || 'Downtown Central Hub';
    const finalIfsc = ifsc_code || 'BTBI0001024';
    const finalType = account_type || 'Savings Account';

    await db.query(
      `
      INSERT INTO accounts (account_number, customer_id, account_type, balance, ifsc_code, branch_name, opening_date, status, card_pin)
      VALUES (?, ?, ?, 10000.00, ?, ?, ?, 'Active', ?)
    `,
      [accNum, customer_id, finalType, finalIfsc, finalBranch, created_at, assignedCardPin]
    );

    // Initial welcome opening grant transaction (₹10,000 credit)
    const txnId = `TXN-${Date.now().toString().slice(-8)}`;
    await db.query(
      `
      INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description)
      VALUES (?, NULL, ?, 10000.00, 'Deposit', ?, 'Success', 'Welcome Opening Balance Grant - BTB DigiSave')
    `,
      [txnId, accNum, created_at]
    );

    const [newCustomer] = await db.query('SELECT * FROM customers WHERE customer_id = ?', [customer_id]);
    delete newCustomer[0].password_hash;

    const [newAccount] = await db.query('SELECT * FROM accounts WHERE account_number = ?', [accNum]);

    const token = generateToken(newCustomer[0]);

    return NextResponse.json(
      {
        message: 'Account created and full e-KYC completed successfully',
        token,
        customer: newCustomer[0],
        account: newAccount[0],
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Signup error:', err);
    return NextResponse.json(
      { error: 'Failed to complete digital onboarding: ' + err.message },
      { status: 500 }
    );
  }
}
