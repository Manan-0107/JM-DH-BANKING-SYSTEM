import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

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

    const cleanIdentifier = identifier.trim().replace(/\s/g, '');
    const cleanPurpose = (purpose || 'GENERAL').trim();
    const cleanOtp = otp.toString().trim();

    const db = await getDb();

    // Query active OTP session from database
    const [rows] = await db.query(
      `SELECT session_id, otp_code, expires_at, verified FROM otp_sessions 
       WHERE identifier = ? AND purpose = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [cleanIdentifier, cleanPurpose]
    );

    const validDemoCodes = ['123456', '789012', '999999'];
    let verified = false;

    if (rows && rows.length > 0) {
      const session = rows[0];
      const isExpired = Date.now() > Number(session.expires_at);

      if (!isExpired && (session.otp_code === cleanOtp || validDemoCodes.includes(cleanOtp))) {
        verified = true;
        await db.query(`UPDATE otp_sessions SET verified = 1 WHERE session_id = ?`, [session.session_id]);
      }
    } else if (validDemoCodes.includes(cleanOtp) || /^\d{6}$/.test(cleanOtp)) {
      // In offline simulation without prior send, allow standard demo code
      verified = true;
    }

    if (verified) {
      return NextResponse.json({
        verified: true,
        message: cleanPurpose === 'AADHAAR_VERIFICATION' 
          ? 'UIDAI demographic e-KYC authentication successful (Simulated)' 
          : 'Mobile OTP verified successfully (Simulated)',
        authenticated_at: new Date().toISOString(),
        disclaimer: 'College DBMS Project Simulation: Verified without external UIDAI/carrier API calls.',
      });
    }

    return NextResponse.json(
      { error: 'Invalid or expired OTP. Please check the code or request a new one.' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Verify OTP Error:', error);
    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}
