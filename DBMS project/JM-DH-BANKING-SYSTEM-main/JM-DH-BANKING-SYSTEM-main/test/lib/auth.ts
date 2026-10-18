import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AuthUser } from '@/types';

// In-memory runtime cache for development/test ephemeral secret
const globalForJwt = globalThis as unknown as { devEphemeralJwtSecret?: string };

export function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET ? process.env.JWT_SECRET.trim() : '';

  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing or too short. ' +
      'A secure 32+ character random secret must be configured in production.'
    );
  }

  // Development/Test mode: Generate a secure runtime ephemeral secret
  if (!globalForJwt.devEphemeralJwtSecret) {
    globalForJwt.devEphemeralJwtSecret = crypto.randomBytes(32).toString('hex');
    console.warn(
      '[SECURITY NOTICE] No valid JWT_SECRET found in environment. ' +
      'Generated a secure random ephemeral secret for this session. ' +
      'Define JWT_SECRET in your .env file for persistent authentication across server restarts.'
    );
  }

  return globalForJwt.devEphemeralJwtSecret;
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export function generateToken(user: { customer_id: string; full_name: string; email: string; role?: string }): string {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      customer_id: user.customer_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role || 'customer'
    },
    secret,
    { expiresIn: JWT_EXPIRES_IN as any }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as AuthUser;
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
 * Generates collision-proof audit log IDs under high concurrency
 */
export function generateAuditId(): string {
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `AUD-${Date.now()}-${randomHex}`;
}

/**
 * Securely hashes a 4-digit Debit Card PIN with bcrypt
 */
export function hashPin(pin: string): string {
  return bcrypt.hashSync(pin.toString().trim(), 10);
}

/**
 * Verifies a 4-digit PIN against a bcrypt hash.
 * Plaintext PIN equality is strictly disallowed to prevent credential leakage.
 */
export function verifyPin(pin: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !pin) return false;
  const trimmedPin = pin.toString().trim();
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    try {
      return bcrypt.compareSync(trimmedPin, storedHash);
    } catch {
      // Malformed or invalid bcrypt format fails closed
      return false;
    }
  }
  return false;
}

/**
 * Verifies PIN against the card PIN hash (bcrypt) or the NetBanking password hash (bcrypt)
 */
export function verifyTransactionPin(
  providedPin: string,
  customer: { password_hash: string; card_pin_hash?: string; card_pin?: string | null }
): boolean {
  if (!providedPin) return false;
  const pin = providedPin.toString().trim();

  // 1. Primary check: card_pin_hash
  if (customer.card_pin_hash && verifyPin(pin, customer.card_pin_hash)) {
    return true;
  }

  // 2. Fallback check: NetBanking password hash (if hashed with bcrypt)
  if (
    customer.password_hash &&
    (customer.password_hash.startsWith('$2a$') || customer.password_hash.startsWith('$2b$'))
  ) {
    try {
      return bcrypt.compareSync(pin, customer.password_hash);
    } catch {
      return false;
    }
  }

  return false;
}

export function generateTransactionReference(prefix = 'TXN'): { txnId: string; referenceNumber: string } {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  const txnId = `${prefix}-${datePart}-${randomHex}`;
  const rrnSuffix = crypto.randomBytes(5).toString('hex').toUpperCase();
  const referenceNumber = `BTB${datePart}${rrnSuffix}`;
  return { txnId, referenceNumber };
}

/**
 * Result of monetary validation
 */
export interface MonetaryValidationResult {
  valid: boolean;
  amount?: number;
  amountPaise?: number;
  error?: string;
}

/**
 * Strictly validates a monetary amount.
 * - Rejects malformed strings (e.g. "100abc", "1.2.3", "NaN", "Infinity", empty strings, negative values).
 * - Enforces standard decimal format with at most 2 decimal places.
 * - Normalizes to 2-decimal float and integer paise to avoid floating-point drift.
 * - Enforces minimum and maximum limits.
 */
export function validateMonetaryAmount(
  input: any,
  options: { min?: number; max?: number; fieldName?: string } = {}
): MonetaryValidationResult {
  const fieldName = options.fieldName || 'Amount';
  const min = options.min !== undefined ? options.min : 0.01;
  const max = options.max !== undefined ? options.max : 500000;

  if (input === null || input === undefined || input === '') {
    return { valid: false, error: `${fieldName} is required` };
  }

  let str = '';
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || Number.isNaN(input)) {
      return { valid: false, error: `${fieldName} must be a valid finite number` };
    }
    str = input.toString();
  } else if (typeof input === 'string') {
    str = input.trim();
  } else {
    return { valid: false, error: `${fieldName} must be a number or numeric string` };
  }

  // Reject malformed patterns: letters, extra dots, negative numbers, scientific notation
  // Exactly matching positive integer or decimal with at most 2 fractional digits
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(str)) {
    return {
      valid: false,
      error: `${fieldName} is invalid. Must be a positive amount with at most 2 decimal places (e.g., 500 or 500.50)`
    };
  }

  const num = parseFloat(str);
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return { valid: false, error: `${fieldName} is not a valid number` };
  }

  if (num < min) {
    return { valid: false, error: `${fieldName} must be at least ₹${min.toLocaleString('en-IN')}` };
  }

  if (num > max) {
    return { valid: false, error: `${fieldName} cannot exceed ₹${max.toLocaleString('en-IN')}` };
  }

  const amountPaise = Math.round(num * 100);
  const normalizedAmount = amountPaise / 100;

  return { valid: true, amount: normalizedAmount, amountPaise };
}

/**
 * Generates cryptographic HMAC-SHA256 hash for OTP storage with session salt
 */
export function hashOtp(otp: string, salt: string = ''): string {
  const secret = getJwtSecret();
  return crypto.createHmac('sha256', secret).update(`${salt}:${otp.toString().trim()}`).digest('hex');
}

/**
 * Constant-time verification of an entered OTP against the stored cryptographic hash
 */
export function verifyOtpHash(otp: string, storedHash: string, salt: string = ''): boolean {
  if (!otp || !storedHash) return false;
  const computed = hashOtp(otp, salt);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
