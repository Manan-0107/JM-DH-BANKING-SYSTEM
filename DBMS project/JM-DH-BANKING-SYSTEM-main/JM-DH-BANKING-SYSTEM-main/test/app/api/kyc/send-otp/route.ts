import { NextResponse } from 'next/server';

// In-memory OTP store for simulated verification session (keyed by identifier + purpose)
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, purpose } = body;

    if (!identifier) {
      return NextResponse.json(
        { error: 'Mobile number or Aadhaar UID is required' },
        { status: 400 }
      );
    }

    // Generate simulated 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `${purpose || 'GENERAL'}_${identifier.trim()}`;

    // Store OTP for 5 minutes
    otpStore.set(key, {
      otp: generatedOtp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    let channelMessage = '';
    if (purpose === 'AADHAAR_VERIFICATION') {
      channelMessage = `Simulated UIDAI e-KYC OTP sent to mobile registered with Aadhaar ending in ${identifier.slice(-4)}`;
    } else {
      channelMessage = `Simulated SMS OTP sent to +91 ${identifier}`;
    }

    return NextResponse.json({
      success: true,
      message: channelMessage,
      test_otp: generatedOtp,
      expires_in_sec: 300,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to generate OTP: ' + error.message },
      { status: 500 }
    );
  }
}
