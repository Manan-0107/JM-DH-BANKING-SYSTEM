import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, otp, purpose } = body;

    if (!identifier || !otp) {
      return NextResponse.json(
        { error: 'Identifier and OTP are required' },
        { status: 400 }
      );
    }

    const trimmedOtp = otp.toString().trim();

    // Standard demo fallback codes for instant convenience if user types standard test OTPs
    const validDemoCodes = ['123456', '789012', '999999'];

    // In simulated environment, any 6-digit number or matching demo code is valid
    if (/^\d{6}$/.test(trimmedOtp)) {
      return NextResponse.json({
        verified: true,
        message: purpose === 'AADHAAR_VERIFICATION' 
          ? 'UIDAI demographic e-KYC authentication successful' 
          : 'Mobile OTP verified successfully',
        authenticated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { error: 'Invalid OTP. Please enter a valid 6-digit numeric code.' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Verification failed: ' + error.message },
      { status: 500 }
    );
  }
}
