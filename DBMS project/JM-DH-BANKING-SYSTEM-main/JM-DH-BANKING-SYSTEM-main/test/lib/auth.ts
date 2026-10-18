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
    return bcrypt.compareSync(trimmedPin, storedHash);
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
    (customer.password_hash.startsWith('$2a$') || customer.password_hash.startsWith('$2b$')) &&
    bcrypt.compareSync(pin, customer.password_hash)
  ) {
    return true;
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
