import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateToken, verifyPin, generateAuditId } from '@/lib/auth';
import { sanitizeCustomer, sanitizeAccounts, checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/api-helpers';
import bcrypt from 'bcryptjs';

const loginRateLimitOptions = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,       // 15 minutes
  lockDurationMs: 15 * 60 * 1000, // 15 minutes lock
};

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
    const rateLimitKey = `login:id:${email.toLowerCase()}`;

    // 1. Check Rate Limit / Account Lockout
    const rateLimit = await checkRateLimit(db, rateLimitKey, loginRateLimitOptions);
    if (!rateLimit.allowed) {
      if (rateLimit.serviceUnavailable) {
        return NextResponse.json(
          { error: 'Security verification service temporarily unavailable. Please try again shortly.' },
          { status: 503 }
        );
      }
      return NextResponse.json(
        {
          error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${rateLimit.retryAfterSec || 900} seconds.`,
        },
        { status: 429 }
      );
    }

    const [rows] = await db.query(
      'SELECT * FROM customers WHERE LOWER(email) = LOWER(?) OR customer_id = ? OR phone = ?',
      [email, email, email]
    );

    if (!rows || rows.length === 0) {
      const failedInfo = await recordFailedAttempt(db, rateLimitKey, loginRateLimitOptions);
      if (failedInfo.serviceUnavailable) {
        return NextResponse.json(
          { error: 'Security verification service temporarily unavailable. Please try again shortly.' },
          { status: 503 }
        );
      }
      if (failedInfo.locked) {
        return NextResponse.json(
          { error: 'Maximum login attempts exceeded. Account is now locked for 15 minutes.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'Invalid credentials. Please verify your Email/User ID and password/PIN.' },
        { status: 401 }
      );
    }

    const customer = rows[0];

    // Check credentials against password_hash or card_pin_hash
    const isPasswordMatch = customer.password_hash && bcrypt.compareSync(password, customer.password_hash);
    const isPinMatch = customer.card_pin_hash && verifyPin(password, customer.card_pin_hash);

    if (!isPasswordMatch && !isPinMatch) {
      const failedInfo = await recordFailedAttempt(db, rateLimitKey, loginRateLimitOptions);
      if (failedInfo.serviceUnavailable) {
        return NextResponse.json(
          { error: 'Security verification service temporarily unavailable. Please try again shortly.' },
          { status: 503 }
        );
      }
      if (failedInfo.locked) {
        return NextResponse.json(
          { error: 'Maximum login attempts exceeded. Account is now locked for 15 minutes.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'Invalid credentials. Please verify your Email/User ID and password/PIN.' },
        { status: 401 }
      );
    }

    // Reset rate limit on successful authentication
    await resetRateLimit(db, rateLimitKey);

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

    const token = generateToken(customer);
    const cleanCustomer = sanitizeCustomer(customer);

    const [accounts] = await db.query(
      'SELECT * FROM accounts WHERE customer_id = ? ORDER BY opening_date DESC',
      [cleanCustomer!.customer_id]
    );

    const sanitizedAccounts = sanitizeAccounts(accounts);

    return NextResponse.json({
      message: 'Login successful',
      token,
      customer: cleanCustomer,
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
