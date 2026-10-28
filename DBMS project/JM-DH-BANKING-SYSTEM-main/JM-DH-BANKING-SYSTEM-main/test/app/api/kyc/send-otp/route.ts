import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashOtp } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { identifier, purpose } = body;

    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      return NextResponse.json(
        { error: 'Mobile number or Aadhaar UID is required' },
        { status: 400 }
      );
    }

    const cleanIdentifier = identifier.trim().replace(/\s/g, '');
    const cleanPurpose = (purpose || 'GENERAL').trim();

    // 1. Cryptographically Secure 6-Digit OTP Generation
    const generatedOtp = crypto.randomInt(100000, 1000000).toString();
    const sessionId = `OTP-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes validity

    const db = await getDb();

    // 2. Rate Limiting Check (Cooldown & Frequency Limit)
    const [recentSessions] = await db.query(
      `SELECT session_id, last_sent_at, expires_at, created_at, attempts FROM otp_sessions
       WHERE identifier = ? AND purpose = ?
       ORDER BY expires_at DESC LIMIT 6`,
      [cleanIdentifier, cleanPurpose]
    );

    if (recentSessions && recentSessions.length > 0) {
      const latest = recentSessions[0];
      const lastSentAt = Number(latest.last_sent_at) || (Number(latest.expires_at) - 5 * 60 * 1000) || 0;
      const elapsedSeconds = Math.floor((now - lastSentAt) / 1000);

      // Cooldown rule: Must wait at least 30 seconds between requests
      if (elapsedSeconds < 30) {
        return NextResponse.json(
          { error: `Please wait ${30 - elapsedSeconds} seconds before requesting a new OTP.` },
          { status: 429 }
        );
      }

      // Frequency rule: Max 5 requests per 10-minute window
      const tenMinutesAgo = now - 10 * 60 * 1000;
      const recentCount = recentSessions.filter(
        (s: any) => (Number(s.last_sent_at) || Number(s.expires_at) - 5 * 60 * 1000) > tenMinutesAgo
      ).length;

      if (recentCount >= 5) {
        return NextResponse.json(
          { error: 'Too many OTP requests. Please wait 10 minutes before requesting again.' },
          { status: 429 }
        );
      }
    }

    // 3. Cryptographic Hash computation (Plaintext OTP is NEVER stored in database)
    const otpHash = hashOtp(generatedOtp, sessionId);

    // 4. Invalidate previous active sessions and insert new session with hashed OTP while preserving frequency history
    await db.transaction(async (conn) => {
      // Invalidate any existing active unconsumed sessions so only the newly issued OTP is active
      await conn.query(
        `UPDATE otp_sessions SET expires_at = ? WHERE identifier = ? AND purpose = ? AND verified = 0 AND expires_at > ?`,
        [now - 1000, cleanIdentifier, cleanPurpose, now]
      );

      // Clean up stale sessions older than 24 hours
      await conn.query(
        `DELETE FROM otp_sessions WHERE identifier = ? AND purpose = ? AND expires_at < ?`,
        [cleanIdentifier, cleanPurpose, now - 24 * 60 * 60 * 1000]
      );

      // Insert into normalized otp_sessions (without plaintext otp_code)
      try {
        await conn.query(
          `INSERT INTO otp_sessions (session_id, identifier, purpose, otp_hash, expires_at, verified, attempts, last_sent_at)
           VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
          [sessionId, cleanIdentifier, cleanPurpose, otpHash, expiresAt, now]
        );
      } catch (e: any) {
        // Fallback for legacy tables with otp_code column
        await conn.query(
          `INSERT INTO otp_sessions (session_id, identifier, purpose, otp_code, otp_hash, expires_at, verified, attempts, last_sent_at)
           VALUES (?, ?, ?, NULL, ?, ?, 0, 0, ?)`,
          [sessionId, cleanIdentifier, cleanPurpose, otpHash, expiresAt, now]
        );
      }
    });

    let channelMessage = '';
    if (cleanPurpose === 'AADHAAR_VERIFICATION') {
      channelMessage = `Simulated UIDAI e-KYC OTP sent to mobile registered with Aadhaar ending in ${cleanIdentifier.slice(-4)}`;
    } else {
      channelMessage = `Simulated SMS OTP sent to +91 ${cleanIdentifier}`;
    }

    const responsePayload: any = {
      success: true,
      session_id: sessionId,
      message: channelMessage,
      expires_in_sec: 300,
      disclaimer: 'College DBMS Project Simulation: OTP recorded in database for verification.',
    };

    // Strict OTP Disclosure Control:
    // In production, test_otp is unconditionally suppressed and strictly confidential.
    // In local development/test environments, test_otp is provided ONLY when explicitly enabled
    // via ALLOW_TEST_OTP=true or NODE_ENV=test.
    const isProduction = process.env.NODE_ENV === 'production';
    const allowTestOtp = !isProduction && (process.env.ALLOW_TEST_OTP === 'true' || process.env.NODE_ENV === 'test');
    if (allowTestOtp) {
      responsePayload.test_otp = generatedOtp;
    }

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error('Send OTP Error:', error?.message || 'Server error');
    return NextResponse.json(
      { error: 'Failed to generate OTP. Please try again.' },
      { status: 500 }
    );
  }
}
