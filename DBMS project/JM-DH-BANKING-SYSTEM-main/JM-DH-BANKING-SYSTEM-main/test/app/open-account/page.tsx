'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage, useToast } from '@/components/Providers';

export default function OpenAccountPage() {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const router = useRouter();

  // Wizard Step (1 to 6)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Identity & Credentials (NO PIN at start; only secure NetBanking password)
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileOtp, setMobileOtp] = useState('');
  const [mobileOtpVerified, setMobileOtpVerified] = useState(false);
  const [demoMobileOtpCode, setDemoMobileOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);

  // Step 2: Statutory e-KYC (PAN & Aadhaar)
  const [panNumber, setPanNumber] = useState('');
  const [panVerified, setPanVerified] = useState(false);
  const [panLoading, setPanLoading] = useState(false);

  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarOtpSent, setAadhaarOtpSent] = useState(false);
  const [aadhaarOtp, setAadhaarOtp] = useState('');
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [demoAadhaarOtpCode, setDemoAadhaarOtpCode] = useState('');
  const [dob, setDob] = useState('1996-08-15');
  const [gender, setGender] = useState('Male');

  // Step 3: Address & Regulatory Profile
  const [fatherName, setFatherName] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('Single');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('Maharashtra');
  const [pincode, setPincode] = useState('');
  const [occupation, setOccupation] = useState('Salaried');
  const [annualIncome, setAnnualIncome] = useState('₹3,00,000 - ₹10,00,000');
  const [sameAsAadhaar, setSameAsAadhaar] = useState(true);
  const [fatcaConsent, setFatcaConsent] = useState(true);
  const [pepConsent, setPepConsent] = useState(true);

  // Step 4: Scheme, Branch, Nominee & Debit Card (Where 4-Digit Card PIN is set)
  const [accountType, setAccountType] = useState('Savings Account');
  const [schemeName, setSchemeName] = useState('BTB DigiSave Zero Balance');
  const [branch, setBranch] = useState('Mumbai Nariman Point Hub');
  const [ifsc, setIfsc] = useState('BTBI0001024');
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('Spouse');
  const [nomineeDob, setNomineeDob] = useState('1997-04-12');
  const [debitCardType, setDebitCardType] = useState('Virtual RuPay Platinum (Instant)');
  const [cardPin, setCardPin] = useState('1234'); // 4-digit PIN for debit card ownership

  // Step 5: Video KYC & Digital Signature
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [vkycStatus, setVkycStatus] = useState<'idle' | 'connecting' | 'verifying' | 'completed'>('idle');
  const [isDrawing, setIsDrawing] = useState(false);

  // Step 6: Welcome Kit
  const [submitting, setSubmitting] = useState(false);
  const [accountResult, setAccountResult] = useState<{
    customer: any;
    account: any;
    token: string;
  } | null>(null);
  const [showCvv, setShowCvv] = useState(false);
  const [showCardPin, setShowCardPin] = useState(false);

  // Canvas Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // OTP Countdown timer
  useEffect(() => {
    let interval: any;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleBranchChange = (branchName: string) => {
    setBranch(branchName);
    const branchMap: Record<string, string> = {
      'Mumbai Nariman Point Hub': 'BTBI0001024',
      'Bengaluru MG Road Branch': 'BTBI0002018',
      'Delhi Connaught Place Branch': 'BTBI0003055',
      'Ahmedabad SG Highway Hub': 'BTBI0005089',
      'Pune Camp Central Branch': 'BTBI0004011',
    };
    setIfsc(branchMap[branchName] || 'BTBI0001024');
  };

  // ----------------------------------------------------
  // STEP 1: Mobile OTP & NetBanking Password
  // ----------------------------------------------------
  const handleSendMobileOtp = async () => {
    if (!mobile || mobile.length < 10) {
      showToast(language === 'hi' ? 'कृपया मान्य 10-अंकीय मोबाइल नंबर दर्ज करें' : 'Please enter a valid 10-digit mobile number', 'error');
      return;
    }
    try {
      const res = await fetch('/api/kyc/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: mobile, purpose: 'MOBILE_VERIFICATION' }),
      });
      const data = await res.json();
      if (res.ok) {
        setMobileOtpSent(true);
        setDemoMobileOtpCode(data.test_otp);
        setOtpTimer(30);
        showToast(language === 'hi' ? 'ओटीपी मोबाइल पर भेजा गया' : `OTP sent to +91 ${mobile}`, 'info');
      } else {
        showToast(data.error || 'Failed to send OTP', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleVerifyMobileOtp = async () => {
    if (!mobileOtp) {
      showToast(language === 'hi' ? 'कृपया 6-अंकीय ओटीपी दर्ज करें' : 'Please enter the 6-digit OTP', 'error');
      return;
    }
    try {
      const res = await fetch('/api/kyc/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: mobile, otp: mobileOtp, purpose: 'MOBILE_VERIFICATION' }),
      });
      const data = await res.json();
      if (res.ok) {
        setMobileOtpVerified(true);
        showToast(language === 'hi' ? 'मोबाइल नंबर सत्यापित हो गया!' : 'Mobile number verified successfully!', 'success');
      } else {
        showToast(data.error || 'Invalid OTP', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleStep1Next = () => {
    if (!fullName.trim()) {
      showToast(language === 'hi' ? 'कृपया पूरा कानूनी नाम दर्ज करें' : 'Please enter your legal name as on PAN/Aadhaar', 'error');
      return;
    }
    if (!mobileOtpVerified) {
      showToast(language === 'hi' ? 'आगे बढ़ने से पहले मोबाइल ओटीपी सत्यापित करें' : 'Please verify your mobile number with OTP first', 'error');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      showToast(language === 'hi' ? 'कृपया मान्य ईमेल आईडी दर्ज करें' : 'Please enter a valid email address', 'error');
      return;
    }
    if (!password || password.length < 6) {
      showToast(language === 'hi' ? 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए' : 'NetBanking Password must be at least 6 characters long', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showToast(language === 'hi' ? 'पासवर्ड और कन्फर्म पासवर्ड मेल नहीं खाते' : 'Password and Confirm Password do not match', 'error');
      return;
    }

    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ----------------------------------------------------
  // STEP 2: PAN & Aadhaar
  // ----------------------------------------------------
  const handleVerifyPan = () => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(panNumber.toUpperCase())) {
      showToast('Invalid PAN format. Must be 10 characters (e.g. ABCDE1234F)', 'error');
      return;
    }

    setPanLoading(true);
    setTimeout(() => {
      setPanLoading(false);
      setPanVerified(true);
      showToast('PAN Verified! Matched with Income Tax & NSDL Database', 'success');
    }, 600);
  };

  const handleSendAadhaarOtp = async () => {
    if (!aadhaarNumber || aadhaarNumber.replace(/\s/g, '').length !== 12) {
      showToast('Please enter a valid 12-digit Aadhaar UID number', 'error');
      return;
    }

    try {
      const res = await fetch('/api/kyc/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: aadhaarNumber.replace(/\s/g, ''), purpose: 'AADHAAR_VERIFICATION' }),
      });
      const data = await res.json();
      if (res.ok) {
        setAadhaarOtpSent(true);
        setDemoAadhaarOtpCode(data.test_otp);
        showToast('UIDAI e-KYC OTP sent to Aadhaar-linked mobile', 'info');
      } else {
        showToast(data.error || 'Failed to trigger Aadhaar OTP', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleVerifyAadhaarOtp = async () => {
    if (!aadhaarOtp) {
      showToast('Please enter the UIDAI OTP code', 'error');
      return;
    }

    try {
      const res = await fetch('/api/kyc/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: aadhaarNumber.replace(/\s/g, ''),
          otp: aadhaarOtp,
          purpose: 'AADHAAR_VERIFICATION',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAadhaarVerified(true);
        showToast('Aadhaar e-KYC Verified successfully!', 'success');
      } else {
        showToast(data.error || 'Invalid UIDAI OTP', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleStep2Next = () => {
    if (!panVerified) {
      showToast('Please verify your PAN card first', 'error');
      return;
    }
    if (!aadhaarVerified) {
      showToast('Please complete Aadhaar e-KYC verification', 'error');
      return;
    }
    if (!dob) {
      showToast('Please select your Date of Birth', 'error');
      return;
    }

    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ----------------------------------------------------
  // STEP 3: Address & Profile
  // ----------------------------------------------------
  const handleStep3Next = () => {
    if (!addressLine.trim() || !city.trim() || !pincode.trim()) {
      showToast('Please complete full residential address, city, and PIN code', 'error');
      return;
    }
    if (!fatcaConsent) {
      showToast('Please accept the FATCA Indian tax resident declaration to proceed', 'error');
      return;
    }

    setCurrentStep(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ----------------------------------------------------
  // STEP 4: Scheme, Nominee & Card PIN
  // ----------------------------------------------------
  const handleStep4Next = () => {
    if (!nomineeName.trim()) {
      showToast('Nominee name is mandatory under RBI Banking Regulations', 'error');
      return;
    }
    if (!cardPin || cardPin.length !== 4) {
      showToast('Please set a 4-digit PIN for your Debit Card transactions', 'error');
      return;
    }

    setCurrentStep(5);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ----------------------------------------------------
  // STEP 5: Camera & Signature
  // ----------------------------------------------------
  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      showToast('Camera unavailable. You can use the verified sample photo option below.', 'info');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const takeSelfieSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedSelfie(dataUrl);
      stopCamera();
      showToast('Live selfie captured successfully!', 'success');
    }
  };

  const useSampleSelfie = () => {
    const sampleAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%230f172a"/><circle cx="100" cy="80" r="45" fill="%23cbd5e1"/><path d="M30 180 C30 130 170 130 170 180 Z" fill="%232563eb"/></svg>`;
    setCapturedSelfie(sampleAvatar);
    showToast('Applied verified KYC photo specimen', 'info');
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = signCanvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureData(null);
    }
  };

  const adoptDefaultSignature = () => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'italic 28px "Caveat", "Brush Script MT", cursive, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(fullName || 'Vikram Sharma', 35, 75);
    setSignatureData(canvas.toDataURL('image/png'));
    showToast('Digital signature generated from legal name', 'info');
  };

  const handleSimulateVkyc = () => {
    setVkycStatus('connecting');
    setTimeout(() => {
      setVkycStatus('verifying');
      setTimeout(() => {
        setVkycStatus('completed');
        showToast('Video KYC approved by RBI Certified Banking Officer!', 'success');
      }, 1400);
    }, 1000);
  };

  // ----------------------------------------------------
  // SUBMIT & ACTIVATE ACCOUNT
  // ----------------------------------------------------
  const handleFinalSubmit = async () => {
    if (!capturedSelfie) {
      showToast('Please capture or select a photo specimen for your KYC dossier', 'error');
      return;
    }
    if (!signatureData) {
      showToast('Please provide your digital signature specimen', 'error');
      return;
    }
    if (vkycStatus !== 'completed') {
      showToast('Please complete the Video KYC check to finalize onboarding', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const fullAddress = `${addressLine}, ${city}, ${stateName} - ${pincode}`;
      const payload = {
        full_name: fullName,
        email,
        phone: mobile,
        password, // Secure NetBanking password
        card_pin: cardPin, // 4-digit Debit Card transaction PIN
        dob,
        address: fullAddress,
        pan_number: panNumber,
        aadhaar_number: aadhaarNumber.replace(/\s/g, ''),
        gender,
        father_name: fatherName || `${fullName.split(' ')[0]}'s Guardian`,
        marital_status: maritalStatus,
        occupation,
        annual_income: annualIncome,
        nominee_name: nomineeName,
        nominee_relation: nomineeRelation,
        nominee_dob: nomineeDob,
        account_type: accountType,
        branch_name: branch,
        ifsc_code: ifsc,
        signature_data: signatureData,
        avatar_data: capturedSelfie,
        vkyc_status: 'Completed',
      };

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to open digital account');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.customer));
      if (data.account) {
        localStorage.setItem('primaryAccount', JSON.stringify(data.account));
      }

      setAccountResult(data);
      setCurrentStep(6);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast('Congratulations! Your Bharat Trust Bank account is now active.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Demo auto-fill helper
  const handleQuickDemoFill = () => {
    setFullName('Aditya Vikram Singhania');
    setMobile('9821098765');
    setEmail(`aditya.${Math.floor(100 + Math.random() * 900)}@example.com`);
    setPassword('Pass@1234');
    setConfirmPassword('Pass@1234');
    setMobileOtpVerified(true);
    setMobileOtp('789012');

    setPanNumber('ABCPS1234K');
    setPanVerified(true);
    setAadhaarNumber('9876 5432 1098');
    setAadhaarVerified(true);
    setAadhaarOtp('654321');
    setDob('1994-06-20');
    setGender('Male');

    setFatherName('Vikramaditya Singhania');
    setMaritalStatus('Married');
    setAddressLine('Penthouse 14B, Altamount Road');
    setCity('Mumbai');
    setStateName('Maharashtra');
    setPincode('400026');
    setOccupation('Salaried');
    setAnnualIncome('₹10,00,000 - ₹25,00,000');

    setNomineeName('Meera Singhania');
    setNomineeRelation('Spouse');
    setNomineeDob('1996-11-05');
    setCardPin('4321');

    useSampleSelfie();
    adoptDefaultSignature();
    setVkycStatus('completed');

    showToast('Loaded compliant demo profile. Ready to submit or customize!', 'info');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a', padding: '3rem 2rem 6rem 2rem' }}>
      <div style={{ maxWidth: '98rem', margin: '0 auto' }}>
        {/* Navigation Breadcrumb & Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                color: '#2563eb',
                fontSize: '1.35rem',
                fontWeight: 600,
                textDecoration: 'none',
                marginBottom: '0.8rem',
              }}
            >
              ← {t('Back to Bank Home')}
            </Link>
            <h1 style={{ fontSize: '3rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
              {language === 'hi' ? 'डिजिटल खाता खोलें (ई-केवाईसी)' : 'Open Digital Savings Account'}
            </h1>
            <p style={{ fontSize: '1.45rem', color: '#64748b', marginTop: '0.4rem' }}>
              100% Paperless Digital Onboarding • Instant Account & Virtual RuPay Card • RBI Regulated
            </p>
          </div>

          <button
            type="button"
            onClick={handleQuickDemoFill}
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
              padding: '0.8rem 1.6rem',
              borderRadius: '9999px',
              fontSize: '1.3rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              transition: 'all 0.2s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>Autofill Sample e-KYC Data</span>
          </button>
        </div>

        {/* 6-Step Stepper Header */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '1.2rem',
            padding: '2rem 2.4rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            marginBottom: '3rem',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem' }}>
            {[
              { num: 1, title: 'Identity & Password', desc: 'Mobile & Auth' },
              { num: 2, title: 'PAN & Aadhaar', desc: 'UIDAI e-KYC' },
              { num: 3, title: 'Profile & Address', desc: 'FATCA Declarations' },
              { num: 4, title: 'Card & Nominee', desc: 'Card PIN Setup' },
              { num: 5, title: 'Video KYC', desc: 'Selfie & Signature' },
              { num: 6, title: 'Welcome Kit', desc: 'Instant Activation' },
            ].map((step) => {
              const isActive = currentStep === step.num;
              const isCompleted = currentStep > step.num;

              return (
                <div
                  key={step.num}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    position: 'relative',
                    cursor: isCompleted ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (isCompleted && currentStep !== 6) setCurrentStep(step.num);
                  }}
                >
                  <div
                    style={{
                      width: '3.6rem',
                      height: '3.6rem',
                      borderRadius: '50%',
                      background: isCompleted ? '#15803d' : isActive ? '#0f172a' : '#f1f5f9',
                      color: isCompleted || isActive ? '#ffffff' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1.4rem',
                      marginBottom: '0.8rem',
                      border: isActive ? '3px solid #bfdbfe' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    {isCompleted ? '✓' : step.num}
                  </div>
                  <span style={{ fontSize: '1.25rem', fontWeight: isActive ? 700 : 600, color: isActive ? '#0f172a' : '#64748b' }}>
                    {step.title}
                  </span>
                  <span style={{ fontSize: '1.05rem', color: '#94a3b8', marginTop: '0.2rem' }}>{step.desc}</span>
                </div>
              );
            })}
          </div>

          <div style={{ width: '100%', height: '0.4rem', backgroundColor: '#f1f5f9', borderRadius: '9999px', marginTop: '1.8rem', overflow: 'hidden' }}>
            <div
              style={{
                width: `${((currentStep - 1) / 5) * 100}%`,
                height: '100%',
                backgroundColor: '#2563eb',
                transition: 'width 0.4s ease-in-out',
              }}
            />
          </div>
        </div>

        {/* ========================================================
            STEP 1: IDENTITY & NETBANKING PASSWORD (NO PIN)
            ======================================================== */}
        {currentStep === 1 && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '1.4rem',
              padding: '4rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
            }}
          >
            <div style={{ marginBottom: '2.8rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.8rem' }}>
              <span style={{ color: '#2563eb', fontSize: '1.25rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Step 1 of 5 • Identity & Access Setup
              </span>
              <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', marginTop: '0.5rem' }}>
                Identity Verification & NetBanking Password
              </h2>
              <p style={{ fontSize: '1.4rem', color: '#64748b', marginTop: '0.4rem' }}>
                Enter your legal name, verify your mobile number via OTP, and create a strong NetBanking login password. (A card PIN is only set when you configure your Debit Card later).
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.4rem' }}>
              {/* Full Legal Name */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.8rem' }}>
                  Full Legal Name (as printed on Govt ID / Aadhaar) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vikramaditya Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1.2rem 1.6rem',
                    fontSize: '1.45rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.8rem',
                    outline: 'none',
                  }}
                  required
                />
              </div>

              {/* Mobile Number & OTP */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.8rem' }}>
                  Mobile Number (for SMS Alerts & Aadhaar OTP) *
                </label>
                <div style={{ display: 'flex', gap: '1.2rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 1.4rem',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.8rem',
                      fontSize: '1.45rem',
                      fontWeight: 600,
                      color: '#475569',
                    }}
                  >
                    🇮🇳 +91
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    disabled={mobileOtpVerified}
                    style={{
                      flex: 1,
                      padding: '1.2rem 1.6rem',
                      fontSize: '1.45rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.8rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSendMobileOtp}
                    disabled={mobileOtpVerified || otpTimer > 0}
                    style={{
                      background: mobileOtpVerified ? '#15803d' : '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      padding: '1.2rem 2rem',
                      borderRadius: '0.8rem',
                      fontWeight: 600,
                      fontSize: '1.35rem',
                      cursor: mobileOtpVerified || otpTimer > 0 ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {mobileOtpVerified
                      ? '✓ Verified'
                      : otpTimer > 0
                      ? `Resend in ${otpTimer}s`
                      : mobileOtpSent
                      ? 'Resend OTP'
                      : 'Send OTP'}
                  </button>
                </div>

                {mobileOtpSent && !mobileOtpVerified && (
                  <div
                    style={{
                      marginTop: '1.6rem',
                      padding: '1.6rem',
                      background: '#f8fafc',
                      borderRadius: '0.8rem',
                      border: '1px dashed #93c5fd',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 600, color: '#1e293b' }}>
                        Enter 6-Digit SMS Verification Code:
                      </span>
                      {demoMobileOtpCode && (
                        <button
                          type="button"
                          onClick={() => setMobileOtp(demoMobileOtpCode)}
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1d4ed8',
                            fontSize: '1.2rem',
                            fontWeight: 600,
                            padding: '0.3rem 0.8rem',
                            borderRadius: '9999px',
                            cursor: 'pointer',
                          }}
                        >
                          Auto-fill Test Code ({demoMobileOtpCode})
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '1.2rem' }}>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="e.g. 789012"
                        value={mobileOtp}
                        onChange={(e) => setMobileOtp(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '1rem 1.4rem',
                          fontSize: '1.6rem',
                          letterSpacing: '4px',
                          fontWeight: 700,
                          textAlign: 'center',
                          border: '1px solid #cbd5e1',
                          borderRadius: '0.6rem',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleVerifyMobileOtp}
                        style={{
                          background: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          padding: '1rem 2rem',
                          borderRadius: '0.6rem',
                          fontWeight: 600,
                          fontSize: '1.35rem',
                          cursor: 'pointer',
                        }}
                      >
                        Verify OTP
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Email Address */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.8rem' }}>
                  Email Address (for e-Statements & Account Alerts) *
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1.2rem 1.6rem',
                    fontSize: '1.45rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.8rem',
                    outline: 'none',
                  }}
                  required
                />
              </div>

              {/* NetBanking Password (Real & Secure) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                  <label style={{ fontSize: '1.35rem', fontWeight: 600, color: '#0f172a' }}>
                    Create NetBanking Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 6 chars (e.g. SecurePass@123)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1.2rem 1.6rem',
                    fontSize: '1.45rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.8rem',
                    outline: 'none',
                  }}
                  required
                />
                <span style={{ fontSize: '1.15rem', color: '#64748b', marginTop: '0.4rem', display: 'block' }}>
                  Must contain letters and numbers for secure NetBanking access.
                </span>
              </div>

              {/* Confirm Password */}
              <div>
                <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.8rem' }}>
                  Confirm NetBanking Password *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1.2rem 1.6rem',
                    fontSize: '1.45rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.8rem',
                    outline: 'none',
                  }}
                  required
                />
                <span style={{ fontSize: '1.15rem', color: '#64748b', marginTop: '0.4rem', display: 'block' }}>
                  Both passwords must match exactly.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '3.5rem' }}>
              <button
                type="button"
                onClick={handleStep1Next}
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '1.4rem 3.6rem',
                  borderRadius: '0.8rem',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.1)',
                }}
              >
                <span>Continue to PAN & Aadhaar e-KYC</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 2: PAN & AADHAAR E-KYC VERIFICATION
            ======================================================== */}
        {currentStep === 2 && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '1.4rem',
              padding: '4rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
            }}
          >
            <div style={{ marginBottom: '2.8rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.8rem' }}>
              <span style={{ color: '#2563eb', fontSize: '1.25rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Step 2 of 5 • Statutory e-KYC Verification
              </span>
              <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', marginTop: '0.5rem' }}>
                PAN & Aadhaar Paperless e-KYC
              </h2>
              <p style={{ fontSize: '1.4rem', color: '#64748b', marginTop: '0.4rem' }}>
                Real-time validation against the Income Tax Department (NSDL) and UIDAI Aadhaar authentication servers.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.6rem' }}>
              {/* PAN Card Verification Card */}
              <div
                style={{
                  border: panVerified ? '1px solid #86efac' : '1px solid #cbd5e1',
                  background: panVerified ? '#f0fdf4' : '#ffffff',
                  borderRadius: '1rem',
                  padding: '2.4rem',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>1. Permanent Account Number (PAN) *</span>
                    {panVerified && (
                      <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '1.2rem', fontWeight: 700, padding: '0.2rem 0.8rem', borderRadius: '9999px' }}>
                        ✓ NSDL Verified
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '1.2rem', color: '#64748b' }}>10-Digit Alphanumeric</span>
                </div>

                <div style={{ display: 'flex', gap: '1.2rem' }}>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="e.g. ABCDE1234F"
                    value={panNumber}
                    disabled={panVerified}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    style={{
                      flex: 1,
                      padding: '1.2rem 1.6rem',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      letterSpacing: '2px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.8rem',
                      outline: 'none',
                      textTransform: 'uppercase',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyPan}
                    disabled={panVerified || panLoading}
                    style={{
                      background: panVerified ? '#15803d' : '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      padding: '1.2rem 2.4rem',
                      borderRadius: '0.8rem',
                      fontWeight: 600,
                      fontSize: '1.35rem',
                      cursor: panVerified ? 'default' : 'pointer',
                    }}
                  >
                    {panLoading ? 'Checking NSDL...' : panVerified ? '✓ Validated' : 'Verify PAN'}
                  </button>
                </div>
                {panVerified && (
                  <p style={{ fontSize: '1.25rem', color: '#15803d', marginTop: '0.8rem', fontWeight: 500 }}>
                    ✓ Legal name matches Income Tax Department records. Validated for banking transactions.
                  </p>
                )}
              </div>

              {/* Aadhaar UIDAI e-KYC Verification Card */}
              <div
                style={{
                  border: aadhaarVerified ? '1px solid #86efac' : '1px solid #cbd5e1',
                  background: aadhaarVerified ? '#f0fdf4' : '#ffffff',
                  borderRadius: '1rem',
                  padding: '2.4rem',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>2. Aadhaar UID e-KYC Authentication *</span>
                    {aadhaarVerified && (
                      <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '1.2rem', fontWeight: 700, padding: '0.2rem 0.8rem', borderRadius: '9999px' }}>
                        ✓ UIDAI Verified
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '1.2rem', color: '#64748b' }}>12-Digit Biometric ID</span>
                </div>

                <div style={{ display: 'flex', gap: '1.2rem' }}>
                  <input
                    type="text"
                    maxLength={14}
                    placeholder="e.g. 9876 5432 1098"
                    value={aadhaarNumber}
                    disabled={aadhaarVerified}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
                      const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
                      setAadhaarNumber(formatted);
                    }}
                    style={{
                      flex: 1,
                      padding: '1.2rem 1.6rem',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      letterSpacing: '2px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.8rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSendAadhaarOtp}
                    disabled={aadhaarVerified}
                    style={{
                      background: aadhaarVerified ? '#15803d' : '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      padding: '1.2rem 2.4rem',
                      borderRadius: '0.8rem',
                      fontWeight: 600,
                      fontSize: '1.35rem',
                      cursor: aadhaarVerified ? 'default' : 'pointer',
                    }}
                  >
                    {aadhaarVerified ? '✓ Authenticated' : aadhaarOtpSent ? 'Resend UIDAI OTP' : 'Request UIDAI OTP'}
                  </button>
                </div>

                {aadhaarOtpSent && !aadhaarVerified && (
                  <div
                    style={{
                      marginTop: '1.6rem',
                      padding: '1.6rem',
                      background: '#eff6ff',
                      borderRadius: '0.8rem',
                      border: '1px dashed #93c5fd',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 600, color: '#1e293b' }}>
                        Enter 6-Digit UIDAI e-KYC OTP (Simulated):
                      </span>
                      {demoAadhaarOtpCode && (
                        <button
                          type="button"
                          onClick={() => setAadhaarOtp(demoAadhaarOtpCode)}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #bfdbfe',
                            color: '#1d4ed8',
                            fontSize: '1.2rem',
                            fontWeight: 600,
                            padding: '0.3rem 0.8rem',
                            borderRadius: '9999px',
                            cursor: 'pointer',
                          }}
                        >
                          Auto-fill UIDAI OTP ({demoAadhaarOtpCode})
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '1.2rem' }}>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="6-digit UIDAI code"
                        value={aadhaarOtp}
                        onChange={(e) => setAadhaarOtp(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '1rem 1.4rem',
                          fontSize: '1.6rem',
                          letterSpacing: '4px',
                          fontWeight: 700,
                          textAlign: 'center',
                          border: '1px solid #cbd5e1',
                          borderRadius: '0.6rem',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleVerifyAadhaarOtp}
                        style={{
                          background: '#0f172a',
                          color: '#ffffff',
                          border: 'none',
                          padding: '1rem 2rem',
                          borderRadius: '0.6rem',
                          fontWeight: 600,
                          fontSize: '1.35rem',
                          cursor: 'pointer',
                        }}
                      >
                        Verify Aadhaar
                      </button>
                    </div>
                  </div>
                )}
                {aadhaarVerified && (
                  <p style={{ fontSize: '1.25rem', color: '#15803d', marginTop: '0.8rem', fontWeight: 500 }}>
                    ✓ UIDAI Demographic biometric validation verified. Identity securely bound to account.
                  </p>
                )}
              </div>

              {/* Date of Birth & Gender */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.8rem' }}>
                    Date of Birth (as per Aadhaar) *
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '1.2rem 1.6rem',
                      fontSize: '1.45rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.8rem',
                      outline: 'none',
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.8rem' }}>
                    Gender (as per Aadhaar) *
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '1.2rem 1.6rem',
                      fontSize: '1.45rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.8rem',
                      outline: 'none',
                      background: '#ffffff',
                    }}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Third Gender / Transgender">Third Gender / Transgender</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3.5rem' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                style={{
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '1.3rem 2.4rem',
                  borderRadius: '0.8rem',
                  fontSize: '1.45rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={handleStep2Next}
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '1.4rem 3.6rem',
                  borderRadius: '0.8rem',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.1)',
                }}
              >
                <span>Continue to Profile & Address</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 3: PERSONAL PROFILE & ADDRESS
            ======================================================== */}
        {currentStep === 3 && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '1.4rem',
              padding: '4rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
            }}
          >
            <div style={{ marginBottom: '2.8rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.8rem' }}>
              <span style={{ color: '#2563eb', fontSize: '1.25rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Step 3 of 5 • Profile & Compliance
              </span>
              <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', marginTop: '0.5rem' }}>
                Personal Profile & Residential Address
              </h2>
              <p style={{ fontSize: '1.4rem', color: '#64748b', marginTop: '0.4rem' }}>
                Required by RBI Master Directions on Customer Due Diligence (CDD) and FATCA/CRS guidelines.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.4rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.8rem' }}>
                  Father's / Mother's Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Chandra Sharma"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1.2rem 1.6rem',
                    fontSize: '1.45rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.8rem',
                    outline: 'none',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.8rem' }}>
                  Marital Status *
                </label>
                <select
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1.2rem 1.6rem',
                    fontSize: '1.45rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.8rem',
                    outline: 'none',
                    background: '#ffffff',
                  }}
                >
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.8rem' }}>
                  Flat / House No., Building Name & Street *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Flat 502, Orchid Heights, MG Road"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1.2rem 1.6rem',
                    fontSize: '1.45rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.8rem',
                    outline: 'none',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.8rem' }}>
                  City / District *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1.2rem 1.6rem',
                    fontSize: '1.45rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.8rem',
                    outline: 'none',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.8rem' }}>
                  State / UT *
                </label>
                <select
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1.2rem 1.6rem',
                    fontSize: '1.45rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.8rem',
                    outline: 'none',
                    background: '#ffffff',
                  }}
                >
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="Karnataka">Karnataka</option>
                  <option value="Delhi">Delhi NCT</option>
                  <option value="Gujarat">Gujarat</option>
                  <option value="Tamil Nadu">Tamil Nadu</option>
                  <option value="Uttar Pradesh">Uttar Pradesh</option>
                  <option value="Telangana">Telangana</option>
                  <option value="West Bengal">West Bengal</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.8rem' }}>
                  Postal PIN Code *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 400001"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  style={{
                    width: '100%',
                    padding: '1.2rem 1.6rem',
                    fontSize: '1.45rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.8rem',
                    outline: 'none',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.8rem' }}>
                  Occupation / Employment Type *
                </label>
                <select
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1.2rem 1.6rem',
                    fontSize: '1.45rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.8rem',
                    outline: 'none',
                    background: '#ffffff',
                  }}
                >
                  <option value="Salaried">Salaried (Private / Govt)</option>
                  <option value="Self-Employed Professional">Self-Employed Professional (Doctor/CA/Lawyer/Engineer)</option>
                  <option value="Business / MSME Owner">Business / MSME Owner</option>
                  <option value="Student">Student</option>
                  <option value="Retired / Homemaker">Retired / Homemaker</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.8rem' }}>
                  Gross Annual Income Bracket *
                </label>
                <select
                  value={annualIncome}
                  onChange={(e) => setAnnualIncome(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1.2rem 1.6rem',
                    fontSize: '1.45rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.8rem',
                    outline: 'none',
                    background: '#ffffff',
                  }}
                >
                  <option value="Below ₹3,00,000">Below ₹3,00,000</option>
                  <option value="₹3,00,000 - ₹10,00,000">₹3,00,000 - ₹10,00,000</option>
                  <option value="₹10,00,000 - ₹25,00,000">₹10,00,000 - ₹25,00,000</option>
                  <option value="Above ₹25,00,000">Above ₹25,00,000</option>
                </select>
              </div>

              {/* Declarations */}
              <div
                style={{
                  gridColumn: 'span 2',
                  padding: '2rem',
                  background: '#f8fafc',
                  borderRadius: '1rem',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.4rem',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1.2rem', cursor: 'pointer', fontSize: '1.35rem', color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={sameAsAadhaar}
                    onChange={(e) => setSameAsAadhaar(e.target.checked)}
                    style={{ marginTop: '0.3rem', width: '1.8rem', height: '1.8rem' }}
                  />
                  <span>My communication address is identical to the residential address linked with my Aadhaar card.</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1.2rem', cursor: 'pointer', fontSize: '1.35rem', color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={fatcaConsent}
                    onChange={(e) => setFatcaConsent(e.target.checked)}
                    style={{ marginTop: '0.3rem', width: '1.8rem', height: '1.8rem' }}
                  />
                  <span>
                    <strong>FATCA / CRS Declaration:</strong> I confirm that I am a tax resident of the Republic of India only and do not hold tax liability or citizenship in the United States or other foreign jurisdictions.
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1.2rem', cursor: 'pointer', fontSize: '1.35rem', color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={pepConsent}
                    onChange={(e) => setPepConsent(e.target.checked)}
                    style={{ marginTop: '0.3rem', width: '1.8rem', height: '1.8rem' }}
                  />
                  <span>I declare that I am not a Politically Exposed Person (PEP) nor closely related to one.</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3.5rem' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                style={{
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '1.3rem 2.4rem',
                  borderRadius: '0.8rem',
                  fontSize: '1.45rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={handleStep3Next}
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '1.4rem 3.6rem',
                  borderRadius: '0.8rem',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.1)',
                }}
              >
                <span>Continue to Scheme & Nominee</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 4: SCHEME, NOMINEE & DEBIT CARD PIN SETUP
            ======================================================== */}
        {currentStep === 4 && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '1.4rem',
              padding: '4rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
            }}
          >
            <div style={{ marginBottom: '2.8rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.8rem' }}>
              <span style={{ color: '#2563eb', fontSize: '1.25rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Step 4 of 5 • Debit Card & Nominee
              </span>
              <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', marginTop: '0.5rem' }}>
                Account Scheme, Branch, Nominee & Card PIN
              </h2>
              <p style={{ fontSize: '1.4rem', color: '#64748b', marginTop: '0.4rem' }}>
                Select your account scheme, register your mandatory nominee, and set your 4-digit Debit Card PIN for ATM cash withdrawals and transactions.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
              {/* Account Scheme Picker */}
              <div>
                <label style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.4rem' }}>
                  Choose Your Banking Account Scheme:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(28rem, 1fr))', gap: '1.6rem' }}>
                  {[
                    {
                      name: 'BTB DigiSave Zero Balance',
                      type: 'Savings Account',
                      tag: 'Most Popular',
                      rate: '6.75% p.a.',
                      balance: '₹0 Min. Balance',
                      features: ['Zero Minimum Balance requirement', 'Instant Virtual RuPay Platinum Card', 'Unlimited UPI & IMPS transfers'],
                    },
                    {
                      name: 'BTB Platinum Advantage Savings',
                      type: 'Savings Account',
                      tag: 'High Yield',
                      rate: '7.25% p.a.',
                      balance: '₹10,000 MAB',
                      features: ['Higher daily ATM limit (₹1,00,000)', 'Free Domestic Airport Lounge access', 'Zero charges on all NEFT/RTGS'],
                    },
                    {
                      name: 'BTB Corporate Salary Account',
                      type: 'Salary Account',
                      tag: 'Salaried Pros',
                      rate: '7.00% p.a.',
                      balance: '₹0 Min. Balance',
                      features: ['Zero balance corporate account', 'Automated Smart-Sweep to FD', 'Pre-approved personal loan offers'],
                    },
                    {
                      name: 'BTB Corporate Current Account',
                      type: 'Current Account',
                      tag: 'Business',
                      rate: 'Overdraft Ready',
                      balance: '₹25,000 MAB',
                      features: ['Custom business chequebook', 'Bulk vendor & payroll payouts', 'Dedicated relationship manager'],
                    },
                    {
                      name: 'BTB Smart Student Saver',
                      type: 'Student Savings',
                      tag: 'Youth & Students',
                      rate: '6.50% p.a.',
                      balance: '₹0 Min. Balance',
                      features: ['Special student cashback perks', 'Budgeting & micro-savings locks', 'Free zero-forex exam fees payment'],
                    },
                  ].map((plan) => {

                    const isSelected = schemeName === plan.name;
                    return (
                      <div
                        key={plan.name}
                        onClick={() => {
                          setSchemeName(plan.name);
                          setAccountType(plan.type);
                        }}
                        style={{
                          border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          borderRadius: '1.2rem',
                          padding: '2.2rem',
                          cursor: 'pointer',
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div>
                          <span
                            style={{
                              background: isSelected ? '#2563eb' : '#f1f5f9',
                              color: isSelected ? '#ffffff' : '#475569',
                              fontSize: '1.15rem',
                              fontWeight: 700,
                              padding: '0.3rem 0.8rem',
                              borderRadius: '9999px',
                              display: 'inline-block',
                              marginBottom: '1rem',
                            }}
                          >
                            {plan.tag}
                          </span>
                          <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem' }}>{plan.name}</h3>
                          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#2563eb', marginBottom: '0.4rem' }}>{plan.rate}</div>
                          <div style={{ fontSize: '1.25rem', color: '#64748b', marginBottom: '1.4rem' }}>{plan.balance}</div>

                          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {plan.features.map((feat, idx) => (
                              <li key={idx} style={{ fontSize: '1.25rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <span style={{ color: '#15803d', fontWeight: 800 }}>✓</span>
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div style={{ marginTop: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <input type="radio" checked={isSelected} readOnly style={{ width: '1.6rem', height: '1.6rem' }} />
                          <span style={{ fontSize: '1.3rem', fontWeight: 600, color: isSelected ? '#2563eb' : '#64748b' }}>
                            {isSelected ? 'Selected Scheme' : 'Select'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Branch Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.8rem' }}>
                  Select Preferred Home Branch & City *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: '1.6rem' }}>
                  <select
                    value={branch}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '1.2rem 1.6rem',
                      fontSize: '1.45rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.8rem',
                      outline: 'none',
                      background: '#ffffff',
                      fontWeight: 600,
                    }}
                  >
                    <option value="Mumbai Nariman Point Hub">Mumbai Nariman Point Hub (Maharashtra)</option>
                    <option value="Bengaluru MG Road Branch">Bengaluru MG Road Branch (Karnataka)</option>
                    <option value="Delhi Connaught Place Branch">Delhi Connaught Place Branch (Delhi NCT)</option>
                    <option value="Ahmedabad SG Highway Hub">Ahmedabad SG Highway Hub (Gujarat)</option>
                    <option value="Pune Camp Central Branch">Pune Camp Central Branch (Maharashtra)</option>
                  </select>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      background: '#f8fafc',
                      padding: '0.8rem 1.6rem',
                      borderRadius: '0.8rem',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assigned IFSC Code</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{ifsc}</span>
                  </div>
                </div>
              </div>

              {/* Mandatory Nominee Details */}
              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: '1.2rem',
                  padding: '2.4rem',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.6rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
                      Mandatory Nominee Registration (Banking Regulation Act)
                    </h3>
                    <p style={{ fontSize: '1.3rem', color: '#64748b', marginTop: '0.2rem' }}>
                      Secures family deposit claim access as required by Reserve Bank of India directions.
                    </p>
                  </div>
                  <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '1.2rem', fontWeight: 700, padding: '0.3rem 0.8rem', borderRadius: '9999px' }}>
                    Required by RBI
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.6rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '1.3rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.6rem' }}>
                      Nominee Full Legal Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Meera Sharma"
                      value={nomineeName}
                      onChange={(e) => setNomineeName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '1.1rem 1.4rem',
                        fontSize: '1.4rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.8rem',
                        outline: 'none',
                        background: '#ffffff',
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '1.3rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.6rem' }}>
                      Relationship with Account Holder *
                    </label>
                    <select
                      value={nomineeRelation}
                      onChange={(e) => setNomineeRelation(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '1.1rem 1.4rem',
                        fontSize: '1.4rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.8rem',
                        outline: 'none',
                        background: '#ffffff',
                      }}
                    >
                      <option value="Spouse">Spouse</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Son">Son</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Brother">Brother</option>
                      <option value="Sister">Sister</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '1.3rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.6rem' }}>
                      Nominee Date of Birth *
                    </label>
                    <input
                      type="date"
                      value={nomineeDob}
                      onChange={(e) => setNomineeDob(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '1.1rem 1.4rem',
                        fontSize: '1.4rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.8rem',
                        outline: 'none',
                        background: '#ffffff',
                      }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Debit Card Preference & 4-DIGIT CARD PIN CREATION */}
              <div
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '1.2rem',
                  padding: '2.4rem',
                  background: '#ffffff',
                }}
              >
                <div style={{ marginBottom: '1.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <h3 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
                      Debit Card Issuance & 4-Digit Card PIN Setup
                    </h3>
                    <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '1.2rem', fontWeight: 700, padding: '0.2rem 0.8rem', borderRadius: '9999px' }}>
                      Card Ownership Security
                    </span>
                  </div>
                  <p style={{ fontSize: '1.3rem', color: '#64748b', marginTop: '0.3rem' }}>
                    As a debit cardholder, you will set a 4-digit transaction PIN to authorize ATM cash withdrawals, point-of-sale swipes, and fund transfers.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.6rem', marginBottom: '2rem' }}>
                  <label
                    style={{
                      border: debitCardType.includes('Virtual') ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: debitCardType.includes('Virtual') ? '#eff6ff' : '#ffffff',
                      borderRadius: '0.8rem',
                      padding: '1.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.2rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="debitCard"
                      checked={debitCardType.includes('Virtual')}
                      onChange={() => setDebitCardType('Virtual RuPay Platinum (Instant)')}
                      style={{ width: '1.8rem', height: '1.8rem' }}
                    />
                    <div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>Virtual RuPay Platinum Card (Instant)</div>
                      <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Zero annual fee • Instant virtual activation for online & UPI</div>
                    </div>
                  </label>

                  <label
                    style={{
                      border: debitCardType.includes('Physical') ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: debitCardType.includes('Physical') ? '#eff6ff' : '#ffffff',
                      borderRadius: '0.8rem',
                      padding: '1.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.2rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="debitCard"
                      checked={debitCardType.includes('Physical')}
                      onChange={() => setDebitCardType('Physical Contactless Visa Signature Debit Card')}
                      style={{ width: '1.8rem', height: '1.8rem' }}
                    />
                    <div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>Physical Contactless Debit Card</div>
                      <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Dispatched via Speed Post to address within 3 days</div>
                    </div>
                  </label>
                </div>

                {/* 4-Digit Debit Card PIN Input */}
                <div
                  style={{
                    background: '#f8fafc',
                    padding: '1.8rem',
                    borderRadius: '0.8rem',
                    border: '1px dashed #94a3b8',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1.4rem',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>
                      Set 4-Digit Debit Card Transaction PIN *
                    </label>
                    <span style={{ fontSize: '1.2rem', color: '#64748b' }}>
                      Used at ATM machines and to authorize debit transfers when using your account card.
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="4-digit PIN"
                      value={cardPin}
                      onChange={(e) => setCardPin(e.target.value.slice(0, 4))}
                      style={{
                        width: '14rem',
                        padding: '1rem 1.4rem',
                        fontSize: '1.8rem',
                        fontWeight: 700,
                        letterSpacing: '6px',
                        textAlign: 'center',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.8rem',
                        outline: 'none',
                        background: '#ffffff',
                      }}
                      required
                    />
                    <span style={{ fontSize: '1.15rem', color: '#15803d', fontWeight: 600 }}>
                      ✓ 4-Digit Card PIN
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3.5rem' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                style={{
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '1.3rem 2.4rem',
                  borderRadius: '0.8rem',
                  fontSize: '1.45rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={handleStep4Next}
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '1.4rem 3.6rem',
                  borderRadius: '0.8rem',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.1)',
                }}
              >
                <span>Continue to Video KYC & Signature</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 5: VIDEO KYC & DIGITAL SIGNATURE
            ======================================================== */}
        {currentStep === 5 && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '1.4rem',
              padding: '4rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
            }}
          >
            <div style={{ marginBottom: '2.8rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.8rem' }}>
              <span style={{ color: '#2563eb', fontSize: '1.25rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Step 5 of 5 • Final Verification
              </span>
              <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', marginTop: '0.5rem' }}>
                Video-KYC Liveness & Digital Signature Capture
              </h2>
              <p style={{ fontSize: '1.4rem', color: '#64748b', marginTop: '0.4rem' }}>
                Capture live photo specimen, draw your specimen signature on screen, and perform automated RBI Video-KYC audit check.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
              {/* Webcam Selfie Viewport */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '1.2rem',
                  padding: '2.4rem',
                  background: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.4rem' }}>
                  <h3 style={{ fontSize: '1.55rem', fontWeight: 700, color: '#0f172a' }}>Live Photo / Selfie Capture *</h3>
                  {capturedSelfie && (
                    <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '1.2rem', fontWeight: 700, padding: '0.2rem 0.8rem', borderRadius: '9999px' }}>
                      ✓ Photo Captured
                    </span>
                  )}
                </div>

                <div
                  style={{
                    width: '26rem',
                    height: '20rem',
                    backgroundColor: '#0f172a',
                    borderRadius: '1rem',
                    overflow: 'hidden',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                >
                  {capturedSelfie ? (
                    <img src={capturedSelfie} alt="Selfie specimen" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : cameraActive ? (
                    <>
                      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div
                        style={{
                          position: 'absolute',
                          width: '13rem',
                          height: '16rem',
                          border: '2px dashed rgba(255,255,255,0.7)',
                          borderRadius: '50%',
                          pointerEvents: 'none',
                        }}
                      />
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '1rem' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" style={{ margin: '0 auto 0.8rem auto' }}>
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                      </svg>
                      <div style={{ fontSize: '1.25rem' }}>Camera is idle</div>
                      <div style={{ fontSize: '1.1rem', color: '#64748b' }}>Click Start Camera below</div>
                    </div>
                  )}
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {!cameraActive && !capturedSelfie && (
                    <button
                      type="button"
                      onClick={startCamera}
                      style={{
                        background: '#0f172a',
                        color: '#ffffff',
                        border: 'none',
                        padding: '1rem 2rem',
                        borderRadius: '0.6rem',
                        fontSize: '1.3rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Start Camera
                    </button>
                  )}

                  {cameraActive && (
                    <button
                      type="button"
                      onClick={takeSelfieSnapshot}
                      style={{
                        background: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        padding: '1rem 2rem',
                        borderRadius: '0.6rem',
                        fontSize: '1.3rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Capture Photo Specimen
                    </button>
                  )}

                  {capturedSelfie && (
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedSelfie(null);
                        startCamera();
                      }}
                      style={{
                        background: '#f1f5f9',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        padding: '1rem 1.6rem',
                        borderRadius: '0.6rem',
                        fontSize: '1.3rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Retake Photo
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={useSampleSelfie}
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '1rem 1.6rem',
                      borderRadius: '0.6rem',
                      fontSize: '1.25rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Use Verified Sample Photo
                  </button>
                </div>
              </div>

              {/* Digital Signature Pad */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '1.2rem',
                  padding: '2.4rem',
                  background: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.4rem' }}>
                  <h3 style={{ fontSize: '1.55rem', fontWeight: 700, color: '#0f172a' }}>Digital Specimen Signature *</h3>
                  {signatureData && (
                    <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '1.2rem', fontWeight: 700, padding: '0.2rem 0.8rem', borderRadius: '9999px' }}>
                      ✓ Signature Recorded
                    </span>
                  )}
                </div>

                <div
                  style={{
                    width: '100%',
                    maxWidth: '32rem',
                    height: '20rem',
                    background: '#ffffff',
                    border: '2px dashed #cbd5e1',
                    borderRadius: '1rem',
                    position: 'relative',
                    touchAction: 'none',
                    boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.04)',
                  }}
                >
                  <canvas
                    ref={signCanvasRef}
                    width={320}
                    height={200}
                    onMouseDown={startDrawing}
                    onMouseMove={drawSignature}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={drawSignature}
                    onTouchEnd={stopDrawing}
                    style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
                  />
                  {!signatureData && !isDrawing && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontSize: '1.3rem',
                      }}
                    >
                      Draw signature here using mouse or touch
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={clearSignature}
                    style={{
                      background: '#ffffff',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      padding: '1rem 1.6rem',
                      borderRadius: '0.6rem',
                      fontSize: '1.3rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Clear Canvas
                  </button>

                  <button
                    type="button"
                    onClick={adoptDefaultSignature}
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '1rem 1.6rem',
                      borderRadius: '0.6rem',
                      fontSize: '1.25rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Generate From Legal Name
                  </button>
                </div>
              </div>

              {/* Video-KYC Officer Check */}
              <div
                style={{
                  gridColumn: 'span 2',
                  border: vkycStatus === 'completed' ? '1px solid #86efac' : '1px solid #cbd5e1',
                  background: vkycStatus === 'completed' ? '#f0fdf4' : '#f8fafc',
                  borderRadius: '1.2rem',
                  padding: '2.4rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1.6rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <h3 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
                      Automated Video-KYC (V-KYC) Liveness Check
                    </h3>
                    <span
                      style={{
                        background: vkycStatus === 'completed' ? '#dcfce7' : '#eff6ff',
                        color: vkycStatus === 'completed' ? '#15803d' : '#1d4ed8',
                        fontSize: '1.2rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.8rem',
                        borderRadius: '9999px',
                      }}
                    >
                      {vkycStatus === 'completed'
                        ? '✓ Certified Officer Approved'
                        : vkycStatus === 'verifying'
                        ? 'Matching Biometrics...'
                        : vkycStatus === 'connecting'
                        ? 'Connecting to Officer...'
                        : 'RBI Compliant'}
                    </span>
                  </div>
                  <p style={{ fontSize: '1.35rem', color: '#64748b', marginTop: '0.4rem', maxWidth: '58rem' }}>
                    {vkycStatus === 'completed'
                      ? 'Liveness confirmed (100% Match), geo-coordinates tagged (India), and audit entry stamped in database.'
                      : 'Connect with our simulated digital banking officer to perform facial match and geo-tagged live verification.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSimulateVkyc}
                  disabled={vkycStatus === 'completed' || vkycStatus === 'connecting' || vkycStatus === 'verifying'}
                  style={{
                    background: vkycStatus === 'completed' ? '#15803d' : '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '1.3rem 2.8rem',
                    borderRadius: '0.8rem',
                    fontSize: '1.45rem',
                    fontWeight: 700,
                    cursor: vkycStatus === 'completed' ? 'default' : 'pointer',
                    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.1)',
                  }}
                >
                  {vkycStatus === 'completed'
                    ? '✓ V-KYC Approved'
                    : vkycStatus === 'verifying'
                    ? 'Auditing Facials...'
                    : vkycStatus === 'connecting'
                    ? 'Connecting...'
                    : 'Initiate Instant Video KYC'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3.5rem' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                style={{
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '1.3rem 2.4rem',
                  borderRadius: '0.8rem',
                  fontSize: '1.45rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                style={{
                  background: '#15803d',
                  color: '#ffffff',
                  border: 'none',
                  padding: '1.5rem 4.2rem',
                  borderRadius: '0.8rem',
                  fontSize: '1.55rem',
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '1rem',
                  boxShadow: '0 4px 14px rgba(21, 128, 61, 0.25)',
                  transition: 'all 0.2s',
                }}
              >
                {submitting ? (
                  <span>Creating Account & Writing e-KYC...</span>
                ) : (
                  <>
                    <span>SUBMIT E-KYC & ACTIVATE ACCOUNT</span>
                    <span>✓</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 6: DIGITAL WELCOME KIT & CARD PIN (SUCCESS)
            ======================================================== */}
        {currentStep === 6 && accountResult && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '1.4rem',
              padding: '4rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 6px 24px rgba(15, 23, 42, 0.08)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <div
                style={{
                  width: '6.4rem',
                  height: '6.4rem',
                  borderRadius: '50%',
                  background: '#dcfce7',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.6rem auto',
                  fontSize: '3rem',
                }}
              >
                ✓
              </div>
              <h2 style={{ fontSize: '3rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                Welcome to Bharat Trust Bank!
              </h2>
              <p style={{ fontSize: '1.6rem', color: '#475569', marginTop: '0.6rem' }}>
                Your digital account is active and full statutory e-KYC compliance has been completed.
              </p>
            </div>

            {/* 3D Virtual Platinum Debit Card with Card PIN */}
            <div style={{ maxWidth: '42rem', margin: '0 auto 3.5rem auto' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #020617 100%)',
                  borderRadius: '1.6rem',
                  padding: '2.8rem',
                  color: '#ffffff',
                  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-40%',
                    right: '-20%',
                    width: '26rem',
                    height: '26rem',
                    background: 'radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.4rem' }}>
                  <div>
                    <span style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '1px' }}>BHARAT TRUST BANK</span>
                    <div style={{ fontSize: '1rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Platinum Digital Debit</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.12)', padding: '0.4rem 1rem', borderRadius: '9999px', fontSize: '1.15rem', fontWeight: 700 }}>
                    RuPay Platinum
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.6rem', marginBottom: '2.4rem' }}>
                  <div
                    style={{
                      width: '4.2rem',
                      height: '3.2rem',
                      background: 'linear-gradient(135deg, #facc15 0%, #ca8a04 100%)',
                      borderRadius: '0.6rem',
                      border: '1px solid #eab308',
                    }}
                  />
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
                    <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
                    <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                  </svg>
                </div>

                <div style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '3px', marginBottom: '2rem', fontFamily: 'monospace' }}>
                  5044 •••• •••• 9241
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: '1rem', color: '#94a3b8', textTransform: 'uppercase' }}>Cardholder Name</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {accountResult.customer.full_name}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1.8rem', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: '1rem', color: '#94a3b8', textTransform: 'uppercase' }}>Expires</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>09/31</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', color: '#94a3b8', textTransform: 'uppercase' }}>CVV</div>
                      <div
                        onClick={() => setShowCvv(!showCvv)}
                        style={{ fontSize: '1.35rem', fontWeight: 700, cursor: 'pointer', color: '#93c5fd' }}
                        title="Click to reveal CVV"
                      >
                        {showCvv ? '824' : '•••'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', color: '#94a3b8', textTransform: 'uppercase' }}>Card PIN</div>
                      <div
                        onClick={() => setShowCardPin(!showCardPin)}
                        style={{ fontSize: '1.35rem', fontWeight: 700, cursor: 'pointer', color: '#86efac' }}
                        title="Click to toggle 4-digit Debit Card PIN"
                      >
                        {showCardPin ? cardPin : '••••'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Credentials Table */}
            <div
              style={{
                background: '#f8fafc',
                borderRadius: '1.2rem',
                padding: '2.8rem',
                border: '1px solid #e2e8f0',
                marginBottom: '3rem',
              }}
            >
              <h3 style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.8rem' }}>
                Official Account Master Record
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.8rem', fontSize: '1.4rem' }}>
                <div style={{ padding: '1rem', background: '#ffffff', borderRadius: '0.8rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '1.2rem' }}>Account Number</span>
                  <strong style={{ fontSize: '1.6rem', color: '#0f172a' }}>{accountResult.account.account_number}</strong>
                </div>

                <div style={{ padding: '1rem', background: '#ffffff', borderRadius: '0.8rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '1.2rem' }}>Customer ID (CIF)</span>
                  <strong style={{ fontSize: '1.6rem', color: '#0f172a' }}>{accountResult.customer.customer_id}</strong>
                </div>

                <div style={{ padding: '1rem', background: '#ffffff', borderRadius: '0.8rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '1.2rem' }}>IFSC Code</span>
                  <strong style={{ fontSize: '1.6rem', color: '#0f172a' }}>{accountResult.account.ifsc_code}</strong>
                </div>

                <div style={{ padding: '1rem', background: '#ffffff', borderRadius: '0.8rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '1.2rem' }}>Home Branch</span>
                  <strong style={{ fontSize: '1.5rem', color: '#0f172a' }}>{accountResult.account.branch_name}</strong>
                </div>

                <div style={{ padding: '1rem', background: '#ffffff', borderRadius: '0.8rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '1.2rem' }}>Debit Card & Transaction PIN</span>
                  <strong style={{ fontSize: '1.5rem', color: '#0f172a' }}>
                    {cardPin} <span style={{ fontSize: '1.2rem', color: '#15803d', fontWeight: 600 }}>(Active for ATM/POS/IMPS)</span>
                  </strong>
                </div>

                <div style={{ padding: '1rem', background: '#ffffff', borderRadius: '0.8rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '1.2rem' }}>Initial Opening Balance</span>
                  <strong style={{ fontSize: '1.6rem', color: '#15803d' }}>₹10,000.00 (Grant Credited)</strong>
                </div>

                <div style={{ padding: '1rem', background: '#ffffff', borderRadius: '0.8rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '1.2rem' }}>Registered Nominee</span>
                  <strong style={{ fontSize: '1.5rem', color: '#0f172a' }}>
                    {accountResult.customer.nominee_name || nomineeName} ({accountResult.customer.nominee_relation || nomineeRelation})
                  </strong>
                </div>

                <div style={{ padding: '1rem', background: '#ffffff', borderRadius: '0.8rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '1.2rem' }}>Deposit Insurance</span>
                  <strong style={{ fontSize: '1.5rem', color: '#2563eb' }}>DICGC Insured up to ₹5,00,000</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  padding: '1.4rem 2.8rem',
                  borderRadius: '0.8rem',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                <span>Download / Print Account Letter</span>
              </button>

              <button
                type="button"
                onClick={() => router.push('/personal')}
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '1.4rem 3.6rem',
                  borderRadius: '0.8rem',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                  boxShadow: '0 4px 14px rgba(15, 23, 42, 0.2)',
                }}
              >
                <span>Proceed to NetBanking Dashboard</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
