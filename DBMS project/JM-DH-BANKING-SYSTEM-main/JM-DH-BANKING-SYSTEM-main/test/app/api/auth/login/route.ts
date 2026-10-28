import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateToken, verifyPin, generateAuditId } from '@/lib/auth';
import { sanitizeCustomer, sanitizeAccounts, checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/api-helpers';
import bcrypt from 'bcryptjs';

const loginAccountRateLimitOptions = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,       // 15 minutes
  lockDurationMs: 15 * 60 * 1000, // 15 minutes lock
};

const loginIpRateLimitOptions = {
  maxAttempts: 25,                // 25 failed attempts per IP window (protects against distributed password spraying)
  windowMs: 15 * 60 * 1000,       // 15 minutes
  lockDurationMs: 15 * 60 * 1000, // 15 minutes lock
};

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

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
    const clientIp = getClientIp(request);
    const ipRateLimitKey = `login:ip:${clientIp}`;
    const accountRateLimitKey = `login:id:${email.toLowerCase()}`;

    // 1. IP-Level Rate Limiting Check (Blocks distributed password spraying)
    const ipLimit = await checkRateLimit(db, ipRateLimitKey, loginIpRateLimitOptions);
    if (!ipLimit.allowed) {
      if (ipLimit.serviceUnavailable) {
        return NextResponse.json(
          { error: 'Security verification service temporarily unavailable. Please try again shortly.' },
          { status: 503 }
        );
      }
      return NextResponse.json(
        {
          error: `Too many login attempts from this network. Access temporarily restricted. Please try again in ${ipLimit.retryAfterSec || 900} seconds.`,
        },
        { status: 429 }
      );
    }

    // 2. Account-Level Rate Limiting Check (Account lockout protection)
    const accountLimit = await checkRateLimit(db, accountRateLimitKey, loginAccountRateLimitOptions);
    if (!accountLimit.allowed) {
      if (accountLimit.serviceUnavailable) {
        return NextResponse.json(
          { error: 'Security verification service temporarily unavailable. Please try again shortly.' },
          { status: 503 }
        );
      }
      return NextResponse.json(
        {
          error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${accountLimit.retryAfterSec || 900} seconds.`,
        },
        { status: 429 }
      );
    }

    const [rows] = await db.query(
      'SELECT * FROM customers WHERE LOWER(email) = LOWER(?) OR customer_id = ? OR phone = ?',
      [email, email, email]
    );

    if (!rows || rows.length === 0) {
      const failedAccount = await recordFailedAttempt(db, accountRateLimitKey, loginAccountRateLimitOptions);
      const failedIp = await recordFailedAttempt(db, ipRateLimitKey, loginIpRateLimitOptions);

      if (failedAccount.serviceUnavailable || failedIp.serviceUnavailable) {
        return NextResponse.json(
          { error: 'Security verification service temporarily unavailable. Please try again shortly.' },
          { status: 503 }
        );
      }
      if (failedAccount.locked || failedIp.locked) {
        return NextResponse.json(
          { error: 'Maximum login attempts exceeded. Access is now locked for 15 minutes.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'Invalid credentials. Please verify your Email/User ID and password/PIN.' },
        { status: 401 }
      );
    }

    const customer = rows[0];

    // Check credentials against password_hash or card_pin_hash in account_card_credentials
    const isPasswordMatch = customer.password_hash && bcrypt.compareSync(password, customer.password_hash);
    let cardPinHash = customer.card_pin_hash;
    if (!cardPinHash) {
      const [cardRows] = await db.query(
        `SELECT c.card_pin_hash FROM account_card_credentials c 
         JOIN accounts a ON c.account_number = a.account_number 
         WHERE a.customer_id = ? AND c.status = 'Active' LIMIT 1`,
        [customer.customer_id]
      );
      if (cardRows && cardRows.length > 0) {
        cardPinHash = cardRows[0].card_pin_hash;
      }
    }
    const isPinMatch = cardPinHash && verifyPin(password, cardPinHash);

    if (!isPasswordMatch && !isPinMatch) {
      const failedAccount = await recordFailedAttempt(db, accountRateLimitKey, loginAccountRateLimitOptions);
      const failedIp = await recordFailedAttempt(db, ipRateLimitKey, loginIpRateLimitOptions);

      if (failedAccount.serviceUnavailable || failedIp.serviceUnavailable) {
        return NextResponse.json(
          { error: 'Security verification service temporarily unavailable. Please try again shortly.' },
          { status: 503 }
        );
      }
      if (failedAccount.locked || failedIp.locked) {
        return NextResponse.json(
          { error: 'Maximum login attempts exceeded. Access is now locked for 15 minutes.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'Invalid credentials. Please verify your Email/User ID and password/PIN.' },
        { status: 401 }
      );
    }

    // Verify account eligibility before granting authentication or resetting rate limit
    if (customer.status !== 'Active') {
      const currentStatus = (customer.status || 'inactive').toLowerCase();
      return NextResponse.json(
        { error: `Your account is currently ${currentStatus}. Contact your home branch.` },
        { status: 403 }
      );
    }

    // Reset account rate limit strictly on eligible, active authenticated sessions
    await resetRateLimit(db, accountRateLimitKey);

    // Record login audit trail
    const auditId = generateAuditId();
    await db.query(
      `INSERT INTO audit_logs (log_id, customer_id, action, entity_type, entity_id, details)
       VALUES (?, ?, 'USER_LOGIN', 'SESSION', ?, 'Customer logged into NetBanking portal')`,
      [auditId, customer.customer_id, customer.customer_id]
    );

    // Check if customer email is configured for administrative privileges
    const configuredAdminEmails = (process.env.ADMIN_EMAILS || 'admin@bharatbank.com,admin@btb.internal')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (customer.email && configuredAdminEmails.includes(customer.email.toLowerCase())) {
      customer.role = 'admin';
    }

    const token = generateToken(customer);
    const cleanCustomer = sanitizeCustomer(customer);

    const [accounts] = await db.query(
      `SELECT a.*, b.branch_name, b.bank_name, b.city AS branch_city 
       FROM accounts a 
       LEFT JOIN branches b ON a.ifsc_code = b.ifsc_code 
       WHERE a.customer_id = ? 
       ORDER BY a.opening_date DESC`,
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
