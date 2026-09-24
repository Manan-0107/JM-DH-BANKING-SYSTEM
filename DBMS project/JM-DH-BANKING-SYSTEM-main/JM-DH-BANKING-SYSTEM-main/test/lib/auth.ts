import jwt from 'jsonwebtoken';
import { AuthUser } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'bankist-secret-key-2024-jwt-token';
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
