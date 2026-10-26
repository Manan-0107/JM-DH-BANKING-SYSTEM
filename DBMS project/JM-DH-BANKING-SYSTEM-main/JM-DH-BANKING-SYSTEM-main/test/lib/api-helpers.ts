import { NextResponse } from 'next/server';
import { getUserFromRequest, verifyTransactionPin } from '@/lib/auth';
import { AuthUser } from '@/types';
import { DbAdapter } from '@/lib/db';

/**
 * Formats a Date object into a MySQL/SQLite standard DATETIME string: 'YYYY-MM-DD HH:MM:SS'
 */
export function formatDbDateTime(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Strips sensitive authentication fields (card_pin, card_pin_hash, password_hash)
 * from an account object before returning it over the wire.
 */
export function sanitizeAccount<T extends Record<string, any>>(account: T | null | undefined): T | null {
  if (!account) return null;
  const clone = { ...account };
  delete clone.card_pin;
  delete clone.card_pin_hash;
  delete clone.password_hash;
  return clone;
}

/**
 * Strips sensitive authentication fields from an array of account objects.
 */
export function sanitizeAccounts<T extends Record<string, any>>(accounts: T[] | null | undefined): T[] {
  if (!accounts || !Array.isArray(accounts)) return [];
  return accounts.map((acc) => sanitizeAccount(acc)!);
}

/**
 * Strips sensitive authentication fields from a customer object.
 */
export function sanitizeCustomer<T extends Record<string, any>>(customer: T | null | undefined): T | null {
  if (!customer) return null;
  const clone = { ...customer };
  delete clone.password_hash;
  delete clone.card_pin;
  delete clone.card_pin_hash;
  return clone;
}

/**
 * Authenticates request via Bearer JWT token.
 * Returns either { user } or { errorResponse }.
 */
export function requireAuth(
  request: Request,
  unauthorizedMessage: string = 'Unauthorized: Session invalid or expired'
): { user: AuthUser; errorResponse?: never } | { user?: never; errorResponse: NextResponse } {
  const user = getUserFromRequest(request);
  if (!user) {
    return {
      errorResponse: NextResponse.json({ error: unauthorizedMessage }, { status: 401 }),
    };
  }
  return { user };
}

/**
 * Validates that an account exists, belongs to the specified customer, and optionally is active.
 */
export async function verifyAccountOwnership(
  db: DbAdapter,
  accountNumber: string,
  customerId: string,
  options: { requireActive?: boolean; activeActionName?: string } = {}
): Promise<{ account: any; errorResponse?: never } | { account?: never; errorResponse: NextResponse }> {
  const [rows] = await db.query('SELECT * FROM accounts WHERE account_number = ?', [accountNumber]);
  if (!rows || rows.length === 0) {
    return {
      errorResponse: NextResponse.json({ error: 'Account not found' }, { status: 404 }),
    };
  }

  const account = rows[0];
  if (account.customer_id !== customerId) {
    return {
      errorResponse: NextResponse.json({ error: 'Access Denied: You do not own this account' }, { status: 403 }),
    };
  }

  if (options.requireActive && account.status !== 'Active') {
    const actionName = options.activeActionName || 'transacting';
    return {
      errorResponse: NextResponse.json(
        { error: `Account is ${account.status.toLowerCase()}. Please unfreeze before ${actionName}.` },
        { status: 400 }
      ),
    };
  }

  return { account };
}

export interface RateLimitOptions {
  maxAttempts: number;      // e.g. 5
  windowMs: number;         // e.g. 15 minutes (900000 ms)
  lockDurationMs: number;   // e.g. 15 minutes (900000 ms)
}

/**
 * Checks whether an action for a given key is currently rate-limited or locked.
 */
export async function checkRateLimit(
  db: DbAdapter,
  keyId: string,
  options: RateLimitOptions
): Promise<{ allowed: boolean; remaining: number; lockedUntil?: number; retryAfterSec?: number }> {
  const now = Date.now();
  try {
    const [rows] = await db.query(
      'SELECT attempts, last_attempt_at, locked_until FROM security_rate_limits WHERE key_id = ?',
      [keyId]
    );

    if (!rows || rows.length === 0) {
      return { allowed: true, remaining: options.maxAttempts };
    }

    const record = rows[0];
    const lockedUntil = Number(record.locked_until) || 0;
    if (lockedUntil > now) {
      const retryAfterSec = Math.ceil((lockedUntil - now) / 1000);
      return { allowed: false, remaining: 0, lockedUntil, retryAfterSec };
    }

    const lastAttemptAt = Number(record.last_attempt_at) || 0;
    if (now - lastAttemptAt > options.windowMs) {
      // Window expired, clean up record
      await db.query('DELETE FROM security_rate_limits WHERE key_id = ?', [keyId]);
      return { allowed: true, remaining: options.maxAttempts };
    }

    const attempts = Number(record.attempts) || 0;
    const remaining = Math.max(0, options.maxAttempts - attempts);
    if (attempts >= options.maxAttempts) {
      const retryAfterSec = Math.ceil(options.lockDurationMs / 1000);
      return { allowed: false, remaining: 0, lockedUntil: now + options.lockDurationMs, retryAfterSec };
    }

    return { allowed: true, remaining };
  } catch (err) {
    console.warn('[Rate Limit] checkRateLimit fallback:', err);
    return { allowed: true, remaining: options.maxAttempts };
  }
}

/**
 * Records a failed authentication attempt, incrementing counter and locking if limit is exceeded.
 */
export async function recordFailedAttempt(
  db: DbAdapter,
  keyId: string,
  options: RateLimitOptions
): Promise<{ locked: boolean; remaining: number; lockDurationSec?: number }> {
  const now = Date.now();
  try {
    const [rows] = await db.query(
      'SELECT attempts, last_attempt_at, locked_until FROM security_rate_limits WHERE key_id = ?',
      [keyId]
    );

    let attempts = 1;
    let lockedUntil = 0;

    if (rows && rows.length > 0) {
      const lastAttemptAt = Number(rows[0].last_attempt_at) || 0;
      if (now - lastAttemptAt <= options.windowMs) {
        attempts = (Number(rows[0].attempts) || 0) + 1;
      }
    }

    const isLocked = attempts >= options.maxAttempts;
    if (isLocked) {
      lockedUntil = now + options.lockDurationMs;
    }

    if (db.isSqlite) {
      await db.query(
        `INSERT INTO security_rate_limits (key_id, attempts, last_attempt_at, locked_until)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(key_id) DO UPDATE SET
           attempts = excluded.attempts,
           last_attempt_at = excluded.last_attempt_at,
           locked_until = excluded.locked_until`,
        [keyId, attempts, now, lockedUntil]
      );
    } else {
      await db.query(
        `INSERT INTO security_rate_limits (key_id, attempts, last_attempt_at, locked_until)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           attempts = VALUES(attempts),
           last_attempt_at = VALUES(last_attempt_at),
           locked_until = VALUES(locked_until)`,
        [keyId, attempts, now, lockedUntil]
      );
    }

    const remaining = Math.max(0, options.maxAttempts - attempts);
    return { locked: isLocked, remaining, lockDurationSec: Math.ceil(options.lockDurationMs / 1000) };
  } catch (err) {
    console.warn('[Rate Limit] recordFailedAttempt fallback:', err);
    return { locked: false, remaining: 1 };
  }
}

/**
 * Resets the rate limit counter upon successful credential verification.
 */
export async function resetRateLimit(db: DbAdapter, keyId: string): Promise<void> {
  try {
    await db.query('DELETE FROM security_rate_limits WHERE key_id = ?', [keyId]);
  } catch (err) {
    console.warn('[Rate Limit] resetRateLimit fallback:', err);
  }
}

/**
 * Validates customer 4-digit Debit Card PIN with persistent attempt limits and brute-force protection.
 */
export async function verifyCustomerCredentials(
  db: DbAdapter,
  customerId: string,
  pin: string,
  invalidPinMessage: string = 'Invalid 4-digit Debit Card PIN entered'
): Promise<{ valid: true; errorResponse?: never } | { valid: false; errorResponse: NextResponse }> {
  const pinRateLimitOptions: RateLimitOptions = {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,       // 15 minutes
    lockDurationMs: 15 * 60 * 1000, // 15 minutes lock
  };

  const rateLimitKey = `pin:cust:${customerId}`;
  const rateLimit = await checkRateLimit(db, rateLimitKey, pinRateLimitOptions);
  if (!rateLimit.allowed) {
    return {
      valid: false,
      errorResponse: NextResponse.json(
        {
          error: `Card PIN authentication is locked due to multiple incorrect attempts. Please try again in ${rateLimit.retryAfterSec || 900} seconds.`,
        },
        { status: 429 }
      ),
    };
  }

  const [custRows] = await db.query(
    'SELECT password_hash, card_pin, card_pin_hash FROM customers WHERE customer_id = ?',
    [customerId]
  );

  if (!custRows || custRows.length === 0) {
    return {
      valid: false,
      errorResponse: NextResponse.json({ error: 'Customer verification failed' }, { status: 404 }),
    };
  }

  const isValidPin = verifyTransactionPin(pin, custRows[0]);
  if (!isValidPin) {
    const failedInfo = await recordFailedAttempt(db, rateLimitKey, pinRateLimitOptions);
    const errorMsg = failedInfo.locked
      ? 'Maximum PIN attempts exceeded. Card PIN authentication is now locked for 15 minutes.'
      : `${invalidPinMessage}. ${failedInfo.remaining} attempt(s) remaining before authentication lock.`;

    return {
      valid: false,
      errorResponse: NextResponse.json({ error: errorMsg }, { status: failedInfo.locked ? 429 : 401 }),
    };
  }

  // Reset attempt counter on successful PIN entry
  await resetRateLimit(db, rateLimitKey);

  return { valid: true };
}
