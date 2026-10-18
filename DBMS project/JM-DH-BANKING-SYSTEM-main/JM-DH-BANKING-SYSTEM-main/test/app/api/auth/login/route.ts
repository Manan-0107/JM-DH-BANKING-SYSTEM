import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateToken, verifyTransactionPin, generateAuditId } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body.email || '').toString().trim();
    const password = (body.password || body.pin || '').toString().trim();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email, User ID, or Mobile number and Password/PIN are required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const [rows] = await db.query(
      "SELECT * FROM customers WHERE LOWER(email) = LOWER(?) OR customer_id = ? OR phone = ?",
      [email, email, email]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials. Please verify your Email/User ID and password/PIN.' },
        { status: 401 }
      );
    }

    const customer = rows[0];

    // Check credentials against password_hash or card_pin_hash / card_pin
    const isPasswordMatch = customer.password_hash && bcrypt.compareSync(password, customer.password_hash);
    const isPinMatch = verifyTransactionPin(password, customer);

    if (!isPasswordMatch && !isPinMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials. Please verify your Email/User ID and password/PIN.' },
        { status: 401 }
      );
    }

    if (customer.status === 'Blocked' || customer.status === 'Suspended') {
      return NextResponse.json(
        { error: `Your account is currently ${customer.status.toLowerCase()}. Contact your home branch.` },
        { status: 403 }
      );
    }

    // Record login audit trail
    const auditId = generateAuditId();
    await db.query(
      `INSERT INTO audit_logs (log_id, customer_id, action, entity_type, entity_id, details)
       VALUES (?, ?, 'USER_LOGIN', 'SESSION', ?, 'Customer logged into NetBanking portal')`,
      [auditId, customer.customer_id, customer.customer_id]
    );

    delete customer.password_hash;
    delete customer.card_pin;
    delete customer.card_pin_hash;

    const token = generateToken(customer);

    const [accounts] = await db.query(
      "SELECT * FROM accounts WHERE customer_id = ? ORDER BY opening_date DESC",
      [customer.customer_id]
    );

    // Sanitize account pins from response
    const sanitizedAccounts = (accounts || []).map((acc: any) => {
      const copy = { ...acc };
      delete copy.card_pin;
      delete copy.card_pin_hash;
      return copy;
    });

    return NextResponse.json({
      message: 'Login successful',
      token,
      customer,
      accounts: sanitizedAccounts,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'Login service encountered an unexpected error. Please try again.' },
      { status: 500 }
    );
  }
}
