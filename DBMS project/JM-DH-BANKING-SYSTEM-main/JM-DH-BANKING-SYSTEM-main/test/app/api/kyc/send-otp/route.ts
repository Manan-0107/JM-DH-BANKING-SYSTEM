import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
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

    // Generate simulated 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = `OTP-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    const db = await getDb();

    // Invalidate any previous unverified OTPs for this identifier/purpose
    await db.query(
      `DELETE FROM otp_sessions WHERE identifier = ? AND purpose = ?`,
      [cleanIdentifier, cleanPurpose]
    );

    // Persist OTP in database table otp_sessions
    await db.query(
      `INSERT INTO otp_sessions (session_id, identifier, purpose, otp_code, expires_at, verified)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [sessionId, cleanIdentifier, cleanPurpose, generatedOtp, expiresAt]
    );

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

    // In development and testing, supply the simulated OTP for evaluation convenience.
    // In production, OTPs are strictly confidential and must never be echoed in JSON responses.
    if (process.env.NODE_ENV !== 'production') {
      responsePayload.test_otp = generatedOtp;
    }

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error('Send OTP Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate OTP. Please try again.' },
      { status: 500 }
    );
  }
}
