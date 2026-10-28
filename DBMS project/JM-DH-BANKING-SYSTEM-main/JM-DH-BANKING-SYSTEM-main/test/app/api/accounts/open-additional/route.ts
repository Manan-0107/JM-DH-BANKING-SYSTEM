import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateTransactionReference, generateAuditId } from '@/lib/auth';
import { requireAuth, verifyCustomerCredentials, formatDbDateTime, sanitizeAccount } from '@/lib/api-helpers';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request, 'Unauthorized: Session invalid or expired');
    if (auth.errorResponse) return auth.errorResponse;
    const authUser = auth.user;

    const body = await request.json().catch(() => ({}));
    const { account_type, branch_name, pin } = body;

    const validTypes = ['Savings Account', 'Current Account', 'Salary Account', 'Student Savings'];
    const chosenType = validTypes.includes(account_type) ? account_type : 'Savings Account';

    const db = await getDb();

    // 1. Verify PIN and ensure customer exists
    const [custRows] = await db.query(
      'SELECT password_hash, card_pin, card_pin_hash FROM customers WHERE customer_id = ?',
      [authUser.customer_id]
    );

    if (!custRows || custRows.length === 0) {
      return NextResponse.json({ error: 'Customer record not found' }, { status: 404 });
    }

    const credCheck = await verifyCustomerCredentials(db, authUser.customer_id, pin);
    if (credCheck.errorResponse) return credCheck.errorResponse;

    // 2. Generate unique account number with collision protection
    let accNum = '';
    for (let attempts = 0; attempts < 5; attempts++) {
      const candidate = `ACC-${crypto.randomInt(100000, 999999)}`;
      const [existing] = await db.query('SELECT account_number FROM accounts WHERE account_number = ?', [candidate]);
      if (!existing || existing.length === 0) {
        accNum = candidate;
        break;
      }
    }
    if (!accNum) {
      return NextResponse.json({ error: 'System busy. Unable to allocate unique account number.' }, { status: 500 });
    }

    const branch = branch_name || 'Mumbai Nariman Point Hub';
    const ifsc = 'BTBI0001024';

    // 3. Security Hardening: Strict Environment & Flag Gating for Demo Cash Grants
    // Demo cash grants are strictly opt-in in non-production environments.
    // In production, the initial balance must be 0.00 and no grant transaction is created.
    const isProduction = process.env.NODE_ENV === 'production';
    const allowDemoGrant = !isProduction && (process.env.ENABLE_DEMO_GRANT === 'true' || process.env.ALLOW_DEMO_GRANT === 'true');
    const initialGrant = allowDemoGrant ? (chosenType === 'Current Account' ? 25000.0 : 10000.0) : 0.0;
    const nowTime = formatDbDateTime();

    const { txnId, referenceNumber } = generateTransactionReference('TXN-GRANT');
    const pinHashToUse = custRows[0].card_pin_hash || null;

    await db.transaction(async (conn) => {
      // 1. Create account (card_pin is explicitly NULL; uses pin_hash)
      await conn.query(
        `INSERT INTO accounts (account_number, customer_id, account_type, balance, ifsc_code, branch_name, opening_date, status, card_pin, card_pin_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', NULL, ?)`,
        [accNum, authUser.customer_id, chosenType, initialGrant, ifsc, branch, nowTime, pinHashToUse]
      );

      // 2. Initial welcome funding transaction ONLY if demo grant is explicitly enabled
      if (initialGrant > 0) {
        await conn.query(
          `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description, reference_number)
           VALUES (?, NULL, ?, ?, 'Deposit', ?, 'Success', ?, ?)`,
          [txnId, accNum, initialGrant, nowTime, `Welcome Activation Credit - ${chosenType}`, referenceNumber]
        );
      }

      // 3. Record audit log
      const auditId = generateAuditId();
      const auditDetails = initialGrant > 0
        ? `Opened new ${chosenType} with ₹${initialGrant} opening balance. Ref: ${referenceNumber}`
        : `Opened new ${chosenType} with zero opening balance. Account active.`;

      await conn.query(
        `INSERT INTO audit_logs (log_id, customer_id, action, entity_type, entity_id, details, timestamp)
         VALUES (?, ?, 'OPEN_ADDITIONAL_ACCOUNT', 'ACCOUNT', ?, ?, ?)`,
        [auditId, authUser.customer_id, accNum, auditDetails, nowTime]
      );
    });

    const [newAccount] = await db.query('SELECT * FROM accounts WHERE account_number = ?', [accNum]);
    const cleanAccount = sanitizeAccount(newAccount?.[0]);

    const message = initialGrant > 0
      ? `Congratulations! Your new ${chosenType} (${accNum}) is now active with ₹${initialGrant.toLocaleString('en-IN')} opening balance.`
      : `Congratulations! Your new ${chosenType} (${accNum}) is now active. Please deposit funds to begin transacting.`;

    return NextResponse.json({
      message,
      account: cleanAccount,
    }, { status: 201 });
  } catch (err: any) {
    console.error('Open additional account error:', err);
    return NextResponse.json({ error: 'Failed to create new account. Please try again.' }, { status: 500 });
  }
}
