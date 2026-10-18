import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyOtpHash } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { identifier, otp, purpose } = body;

    if (!identifier || !otp) {
      return NextResponse.json(
        { error: 'Identifier and OTP code are required' },
        { status: 400 }
      );
    }

    const cleanIdentifier = identifier.toString().trim().replace(/\s/g, '');
    const cleanPurpose = (purpose || 'GENERAL').toString().trim();
    const cleanOtp = otp.toString().trim();

    // 1. Strict Format Validation
    if (!/^\d{6}$/.test(cleanOtp)) {
      return NextResponse.json(
        { error: 'OTP must be a valid 6-digit numeric code' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // 2. Query active OTP session from database
    const [rows] = await db.query(
      `SELECT session_id, otp_code, otp_hash, expires_at, verified, attempts FROM otp_sessions
       WHERE identifier = ? AND purpose = ?
       ORDER BY expires_at DESC LIMIT 1`,
      [cleanIdentifier, cleanPurpose]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'No active OTP session found. Please request a new OTP.' },
        { status: 400 }
      );
    }

    const session = rows[0];

    // 3. Prevent Replay of Consumed OTPs
    if (session.verified === 1) {
      return NextResponse.json(
        { error: 'This OTP has already been verified and cannot be reused. Please request a new code.' },
        { status: 400 }
      );
    }

    // 4. Bounded Verification Attempts (Max 5 attempts)
    const currentAttempts = Number(session.attempts) || 0;
    if (currentAttempts >= 5) {
      return NextResponse.json(
        { error: 'Maximum verification attempts (5) exceeded. This OTP session is locked. Please request a new OTP.' },
        { status: 429 }
      );
    }

    // 5. Expiration Check
    const isExpired = Date.now() > Number(session.expires_at);
    if (isExpired) {
      return NextResponse.json(
        { error: 'OTP has expired. Please request a new code.' },
        { status: 400 }
      );
    }

    // 6. Increment attempt counter atomically
    await db.query(`UPDATE otp_sessions SET attempts = attempts + 1 WHERE session_id = ?`, [session.session_id]);

    // 7. Cryptographic Hash Verification
    let isValid = false;
    if (session.otp_hash) {
      isValid = verifyOtpHash(cleanOtp, session.otp_hash, session.session_id);
    } else if (session.otp_code) {
      // Legacy fallback for unmigrated sessions
      isValid = session.otp_code === cleanOtp;
    }

    if (!isValid) {
      const remainingAttempts = Math.max(0, 4 - currentAttempts);
      return NextResponse.json(
        {
          error: remainingAttempts > 0
            ? `Invalid OTP code. ${remainingAttempts} attempt(s) remaining before session lock.`
            : 'Invalid OTP code. Maximum attempts exceeded. Session is now locked.',
        },
        { status: 400 }
      );
    }

    // 8. Mark Session as Verified (Consumed)
    await db.query(`UPDATE otp_sessions SET verified = 1 WHERE session_id = ?`, [session.session_id]);

    return NextResponse.json({
      verified: true,
      message: cleanPurpose === 'AADHAAR_VERIFICATION'
        ? 'UIDAI demographic e-KYC authentication successful (Simulated)'
        : 'Mobile OTP verified successfully (Simulated)',
      authenticated_at: new Date().toISOString(),
      disclaimer: 'College DBMS Project Simulation: Verified without external UIDAI/carrier API calls.',
    });
  } catch (error: any) {
    console.error('Verify OTP Error:', error?.message || 'Server error');
    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}
