import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim();
    const password = (body.password || '').trim();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email or User ID and Password/PIN are required' },
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
        { error: 'Invalid email, User ID, or password/PIN. Default PIN is 1234.' },
        { status: 401 }
      );
    }

    const customer = rows[0];
    const isMatch = bcrypt.compareSync(password, customer.password_hash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid email, User ID, or password/PIN. Default PIN is 1234.' },
        { status: 401 }
      );
    }

    if (customer.status === 'Blocked') {
      return NextResponse.json(
        { error: 'Your account has been blocked. Contact branch support.' },
        { status: 403 }
      );
    }

    delete customer.password_hash;
    const token = generateToken(customer);

    const [accounts] = await db.query(
      "SELECT * FROM accounts WHERE customer_id = ? ORDER BY opening_date DESC",
      [customer.customer_id]
    );

    return NextResponse.json({
      message: 'Login successful',
      token,
      customer,
      accounts: accounts || []
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'Login failed. ' + err.message },
      { status: 500 }
    );
  }
}
