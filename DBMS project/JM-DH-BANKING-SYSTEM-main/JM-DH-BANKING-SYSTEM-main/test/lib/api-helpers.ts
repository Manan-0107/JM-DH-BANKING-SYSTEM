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

/**
 * Validates customer PIN or NetBanking password against database records.
 */
export async function verifyCustomerCredentials(
  db: DbAdapter,
  customerId: string,
  pin: string,
  invalidPinMessage: string = 'Invalid 4-digit Debit Card PIN entered'
): Promise<{ valid: true; errorResponse?: never } | { valid: false; errorResponse: NextResponse }> {
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
    return {
      valid: false,
      errorResponse: NextResponse.json({ error: invalidPinMessage }, { status: 401 }),
    };
  }

  return { valid: true };
}
