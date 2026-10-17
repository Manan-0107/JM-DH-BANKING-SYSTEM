import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AuthUser } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'btb-banking-auth-token-key-2026-secure-hash-jwt';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export function generateToken(user: { customer_id: string; full_name: string; email: string; role?: string }): string {
  return jwt.sign(
    {
      customer_id: user.customer_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role || 'customer'
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as any }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch (err) {
    return null;
  }
}

export function getUserFromRequest(request: Request): AuthUser | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return verifyToken(parts[1]);
}

/**
 * Securely hashes a 4-digit Debit Card PIN with bcrypt
 */
export function hashPin(pin: string): string {
  return bcrypt.hashSync(pin.toString().trim(), 10);
}

/**
 * Verifies a PIN against a bcrypt hash, with backward-compatibility for legacy plaintext pins
 */
export function verifyPin(pin: string, storedHashOrPlain: string | null | undefined): boolean {
  if (!storedHashOrPlain || !pin) return false;
  const trimmedPin = pin.toString().trim();
  if (storedHashOrPlain.startsWith('$2a$') || storedHashOrPlain.startsWith('$2b$')) {
    return bcrypt.compareSync(trimmedPin, storedHashOrPlain);
  }
  return trimmedPin === storedHashOrPlain.trim();
}

/**
 * Verifies PIN against either the card PIN (hashed or plain) or the account password hash
 */
export function verifyTransactionPin(
  providedPin: string,
  customer: { password_hash: string; card_pin?: string; card_pin_hash?: string }
): boolean {
  if (!providedPin) return false;
  const pin = providedPin.toString().trim();

  // 1. Check card_pin_hash if present
  if (customer.card_pin_hash && verifyPin(pin, customer.card_pin_hash)) {
    return true;
  }

  // 2. Check legacy card_pin if present
  if (customer.card_pin && verifyPin(pin, customer.card_pin)) {
    return true;
  }

  // 3. Fallback: check NetBanking password hash
  if (customer.password_hash && bcrypt.compareSync(pin, customer.password_hash)) {
    return true;
  }

  return false;
}

/**
 * Generates an authentic, collision-proof banking transaction ID and UTR reference number
 */
export function generateTransactionReference(prefix = 'TXN'): { txnId: string; referenceNumber: string } {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  const txnId = `${prefix}-${datePart}-${randomHex}`;
  const rrnSuffix = crypto.randomInt(10000000, 99999999);
  const referenceNumber = `BTB${datePart}${rrnSuffix}`;
  return { txnId, referenceNumber };
}
