'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage, useToast } from '@/components/Providers';

export default function Home() {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const router = useRouter();

  // Auth Tabs State
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPin, setSignupPin] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  // Quick Demo Profiles Helper
  const demoUsers = [
    { label: '-- Select a Quick Demo Profile --', email: '', pin: '' },
    { label: 'Aarav Lynn (Mumbai) - Platinum Savings', email: 'aarav@example.com', pin: '1234' },
    { label: 'Priya Nair (Bengaluru) - Gold Savings', email: 'priya@example.com', pin: '1234' },
    { label: 'Rohan Gupta (Delhi) - Current', email: 'rohan@example.com', pin: '1234' },
    { label: 'Ananya Sen (Pune) - Savings', email: 'ananya@example.com', pin: '1234' },
    { label: 'Het Nasit (Ahmedabad) - VIP', email: 'het@example.com', pin: '1234' },
  ];

  const handleDemoSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = demoUsers.find((u) => u.email === e.target.value);
    if (selected && selected.email) {
      setLoginEmail(selected.email);
      setLoginPassword(selected.pin);
      showToast(language === 'hi' ? 'डेमो खाता चुना गया' : `Loaded ${selected.label}. Click Login to enter.`, 'info');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      showToast(language === 'hi' ? 'कृपया ईमेल और पिन भरें' : 'Please enter Email / User ID and PIN', 'error');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.customer));
      if (data.accounts && data.accounts.length > 0) {
        localStorage.setItem('primaryAccount', JSON.stringify(data.accounts[0]));
      }

      showToast(language === 'hi' ? 'लॉगिन सफल रहा! डैशबोर्ड लोड हो रहा है...' : 'Login successful! Entering NetBanking...', 'success');
      router.push('/personal');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName || !signupEmail || !signupPin) {
      showToast(language === 'hi' ? 'कृपया सभी आवश्यक फ़ील्ड भरें' : 'Please fill all required fields', 'error');
      return;
    }

    setSignupLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: signupName,
          email: signupEmail,
          phone: signupPhone,
          pin: signupPin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.customer));
      if (data.account) {
        localStorage.setItem('primaryAccount', JSON.stringify(data.account));
      }

      showToast(language === 'hi' ? 'खाता सफलतापूर्वक खोला गया! स्वागत है।' : 'Account opened successfully! Welcome.', 'success');
      router.push('/personal');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="homepage-wrapper">
      {/* Light Clean Black, Grey & White Hero Section with Subtle Blue Accents */}
      <section
        style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
          color: '#0f172a',
          padding: '6.5rem 4rem 8rem 4rem',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div style={{ maxWidth: '118rem', margin: '0 auto', display: 'grid', gridTemplateColumns: '1.2fr 0.95fr', gap: '6rem', alignItems: 'center' }}>
          {/* Left Column: Hero Intro */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.8rem',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '0.6rem 1.4rem',
                borderRadius: '9999px',
                fontSize: '1.3rem',
                fontWeight: 600,
                color: '#1d4ed8',
                marginBottom: '2rem',
                boxShadow: '0 1px 2px rgba(37, 99, 235, 0.05)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <span>{t('DICGC Deposit Insured up to ₹5,00,000')}</span>
            </div>

            <h1 style={{ fontSize: '4.4rem', fontWeight: 800, lineHeight: '1.18', letterSpacing: '-1px', color: '#0f172a', marginBottom: '2rem' }}>
              {language === 'hi' ? 'भारत का ' : "India's "}
              <span style={{ color: '#2563eb' }}>{language === 'hi' ? 'विश्वसनीय एवं सरल' : 'Trusted & Minimalist'}</span>{' '}
              {language === 'hi' ? 'डिजिटल बैंक' : 'Digital Bank'}
            </h1>

            <p style={{ fontSize: '1.65rem', color: '#475569', lineHeight: '1.7', marginBottom: '3.5rem', maxWidth: '52rem' }}>
              {t('Experience frictionless Indian NetBanking with zero-latency IMPS/UPI transfers, high-yield fixed deposits, and bank-grade 256-bit security protocols.')}
            </p>

            <div style={{ display: 'flex', gap: '1.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Link
                href="/table-detail?tab=accounts"
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  textDecoration: 'none',
                  padding: '1.3rem 2.6rem',
                  borderRadius: '0.8rem',
                  fontSize: '1.45rem',
                  fontWeight: 600,
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.1)',
                  transition: 'all 0.2s',
                }}
              >
                {t('Explore Savings Schemes →')}
              </Link>
              <Link
                href="/table-detail?tab=loans"
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  textDecoration: 'none',
                  padding: '1.3rem 2.6rem',
                  borderRadius: '0.8rem',
                  fontSize: '1.45rem',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                  transition: 'all 0.2s',
                }}
              >
                Loan EMI Calculator →
              </Link>
            </div>
          </div>

          {/* Right Column: Crisp White NetBanking Auth Card */}
          <div
            id="login-card"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1.4rem',
              padding: '3.5rem',
              boxShadow: '0 4px 20px rgba(15, 23, 42, 0.06)',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              maxWidth: '44rem',
              width: '100%',
              margin: '0 auto',
            }}
          >
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '2.4rem' }}>
              <button
                className={`netbanking-tab ${authTab === 'login' ? 'netbanking-tab--active' : ''}`}
                onClick={() => setAuthTab('login')}
                style={{
                  flex: 1,
                  padding: '1rem',
                  textAlign: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: authTab === 'login' ? '#0f172a' : '#64748b',
                  background: 'none',
                  border: 'none',
                  borderBottom: authTab === 'login' ? '2px solid #2563eb' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {t('NetBanking Login')}
              </button>
              <button
                className={`netbanking-tab ${authTab === 'signup' ? 'netbanking-tab--active' : ''}`}
                onClick={() => setAuthTab('signup')}
                style={{
                  flex: 1,
                  padding: '1rem',
                  textAlign: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: authTab === 'signup' ? '#0f172a' : '#64748b',
                  background: 'none',
                  border: 'none',
                  borderBottom: authTab === 'signup' ? '2px solid #2563eb' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {t('Open Account')}
              </button>
            </div>

            {authTab === 'login' ? (
              <form onSubmit={handleLogin} className="netbanking-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
                {/* Quick Demo User Dropdown */}
                <div className="form-group">
                  <label style={{ fontSize: '1.2rem', fontWeight: 600, color: '#0f172a' }}>
                    Quick Demo NetBanking Profile
                  </label>
                  <select
                    className="form-input"
                    onChange={handleDemoSelect}
                    value={loginEmail}
                    style={{
                      padding: '1rem 1.4rem',
                      fontSize: '1.35rem',
                      cursor: 'pointer',
                      background: '#f8fafc',
                      borderColor: '#e2e8f0',
                      color: '#0f172a',
                      fontWeight: 500,
                    }}
                  >
                    {demoUsers.map((u) => (
                      <option key={u.label} value={u.email}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('Registered Email / User ID')}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. aarav@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('NetBanking Password / PIN')}</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter 4-digit PIN (default 1234)"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    padding: '1.3rem',
                    fontSize: '1.45rem',
                    fontWeight: 600,
                    borderRadius: '0.8rem',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: '0.6rem',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.1)',
                    transition: 'all 0.2s',
                  }}
                >
                  {loginLoading ? 'Authenticating...' : t('SECURE NETBANKING LOGIN →')}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', fontSize: '1.2rem', color: '#64748b', marginTop: '0.4rem' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  <span>Protected by 256-Bit SSL Encryption</span>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '1rem',
                    padding: '1.6rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#1d4ed8', fontWeight: 700, fontSize: '1.35rem', marginBottom: '0.8rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <span>Real-Life e-KYC Account Opening</span>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.7rem', fontSize: '1.3rem', color: '#334155' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ color: '#15803d', fontWeight: 800 }}>✓</span>
                      <span>Instant PAN & Aadhaar UIDAI verification</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ color: '#15803d', fontWeight: 800 }}>✓</span>
                      <span>Live Webcam Selfie & Digital Signature Pad</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ color: '#15803d', fontWeight: 800 }}>✓</span>
                      <span>RBI Certified Video-KYC (V-KYC) Liveness</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ color: '#15803d', fontWeight: 800 }}>✓</span>
                      <span>Virtual RuPay Platinum Card + ₹10,000 Grant</span>
                    </li>
                  </ul>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('Enter Legal Name to Start')}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Vikram Sharma"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                  />
                </div>

                <Link
                  href={signupName ? `/open-account?name=${encodeURIComponent(signupName)}` : '/open-account'}
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    padding: '1.4rem',
                    fontSize: '1.45rem',
                    fontWeight: 700,
                    borderRadius: '0.8rem',
                    textAlign: 'center',
                    textDecoration: 'none',
                    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.8rem',
                    transition: 'all 0.2s',
                  }}
                >
                  <span>START 6-STEP DIGITAL e-KYC →</span>
                </Link>

                <div style={{ textAlign: 'center', fontSize: '1.2rem', color: '#64748b' }}>
                  Takes under 3 minutes • 100% Paperless • Zero-Balance Option
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Spacious 4-Card Services Showcase (Black, Grey, White with subtle Blue) */}
      <section style={{ maxWidth: '118rem', margin: '7rem auto', padding: '0 3rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4.5rem' }}>
          <span style={{ color: '#2563eb', fontSize: '1.3rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px' }}>
            {t('Digital Banking Solutions')}
          </span>
          <h2 style={{ fontSize: '3.2rem', fontWeight: 800, color: '#0f172a', marginTop: '0.6rem' }}>
            {t('Engineered for Seamless Financial Freedom')}
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(26rem, 1fr))', gap: '3rem' }}>
          {/* Card 1: Savings */}
          <Link
            href="/table-detail?tab=accounts"
            className="service-card"
            style={{
              padding: '3.2rem',
              borderRadius: '1.4rem',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div>
              <div
                style={{
                  width: '5rem',
                  height: '5rem',
                  background: '#f1f5f9',
                  borderRadius: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                  marginBottom: '2rem',
                  border: '1px solid #e2e8f0',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
                {t('High-Yield Savings Account')}
              </h3>
              <p style={{ fontSize: '1.4rem', color: '#64748b', lineHeight: '1.6' }}>
                {t('Earn 4.5% interest compounded quarterly. Zero balance fee.')}
              </p>
            </div>
            <div style={{ marginTop: '2.5rem', fontSize: '1.4rem', fontWeight: 600, color: '#2563eb' }}>
              View Account Types &rarr;
            </div>
          </Link>

          {/* Card 2: Deposits */}
          <Link
            href="/table-detail?tab=deposits"
            className="service-card"
            style={{
              padding: '3.2rem',
              borderRadius: '1.4rem',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div>
              <div
                style={{
                  width: '5rem',
                  height: '5rem',
                  background: '#f1f5f9',
                  borderRadius: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                  marginBottom: '2rem',
                  border: '1px solid #e2e8f0',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
                {t('Fixed Deposit (FD) Schemes')}
              </h3>
              <p style={{ fontSize: '1.4rem', color: '#64748b', lineHeight: '1.6' }}>
                {t('Secure yields up to 7.25% p.a. Special senior citizen rates.')}
              </p>
            </div>
            <div style={{ marginTop: '2.5rem', fontSize: '1.4rem', fontWeight: 600, color: '#2563eb' }}>
              Explore FD Matrix &rarr;
            </div>
          </Link>

          {/* Card 3: Loans & EMI Calc */}
          <Link
            href="/table-detail?tab=loans"
            className="service-card"
            style={{
              padding: '3.2rem',
              borderRadius: '1.4rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
            }}
          >
            <div>
              <div
                style={{
                  width: '5rem',
                  height: '5rem',
                  background: '#0f172a',
                  borderRadius: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  marginBottom: '2rem',
                  border: '1px solid #0f172a',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                  <line x1="8" y1="6" x2="16" y2="6"></line>
                  <line x1="16" y1="14" x2="16" y2="18"></line>
                  <path d="M16 10h.01"></path>
                  <path d="M12 10h.01"></path>
                  <path d="M8 10h.01"></path>
                  <path d="M12 14h.01"></path>
                  <path d="M8 14h.01"></path>
                  <path d="M12 18h.01"></path>
                  <path d="M8 18h.01"></path>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
                Loans & EMI Calculator
              </h3>
              <p style={{ fontSize: '1.4rem', color: '#64748b', lineHeight: '1.6' }}>
                Calculate real-time monthly EMI for Home, EV, and MSME loans starting at 8.25% p.a.
              </p>
            </div>
            <div style={{ marginTop: '2.5rem', fontSize: '1.4rem', fontWeight: 600, color: '#2563eb' }}>
              Calculate EMI & Rates &rarr;
            </div>
          </Link>

          {/* Card 4: Cards */}
          <Link
            href="/table-detail?tab=cards"
            className="service-card"
            style={{
              padding: '3.2rem',
              borderRadius: '1.4rem',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div>
              <div
                style={{
                  width: '5rem',
                  height: '5rem',
                  background: '#f1f5f9',
                  borderRadius: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                  marginBottom: '2rem',
                  border: '1px solid #e2e8f0',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
                {t('Bharat RuPay Platinum Card')}
              </h3>
              <p style={{ fontSize: '1.4rem', color: '#64748b', lineHeight: '1.6' }}>
                {t('Free airport lounge access, ₹2 Lakh accidental insurance cover.')}
              </p>
            </div>
            <div style={{ marginTop: '2.5rem', fontSize: '1.4rem', fontWeight: 600, color: '#2563eb' }}>
              Compare RuPay Cards &rarr;
            </div>
          </Link>
        </div>
      </section>

      {/* Clean Trust Ribbon */}
      <section style={{ maxWidth: '118rem', margin: '0 auto 7rem auto', padding: '0 3rem' }}>
        <div
          style={{
            background: '#ffffff',
            borderRadius: '1.4rem',
            border: '1px solid #e2e8f0',
            padding: '3rem 4rem',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '3rem',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>DICGC Insured</div>
              <div style={{ fontSize: '1.25rem', color: '#64748b' }}>Deposits up to ₹5 Lakh</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>256-Bit SSL</div>
              <div style={{ fontSize: '1.25rem', color: '#64748b' }}>Bank-grade encryption</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>RBI Regulated</div>
              <div style={{ fontSize: '1.25rem', color: '#64748b' }}>Scheduled Commercial Bank</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>24x7 Support</div>
              <div style={{ fontSize: '1.25rem', color: '#64748b' }}>Toll-free 1800 120 4444</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
