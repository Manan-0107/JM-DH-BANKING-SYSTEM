'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useLanguage, useToast } from './Providers';
import { Customer } from '@/types';

export default function Header() {
  const { language, toggleLanguage, t } = useLanguage();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        setCustomer(JSON.parse(userStr));
      } catch (e) {}
    } else {
      setCustomer(null);
    }

    const handleStorage = () => {
      const updatedUser = localStorage.getItem('user');
      if (updatedUser) {
        try {
          setCustomer(JSON.parse(updatedUser));
        } catch (e) {
          setCustomer(null);
        }
      } else {
        setCustomer(null);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCustomer(null);
    showToast(language === 'hi' ? 'सफलतापूर्वक लॉग आउट किया गया' : 'Logged out securely', 'info');
    router.push('/');
  };

  return (
    <header className="w-full" style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#ffffff', boxShadow: '0 1px 6px rgba(0, 0, 0, 0.04)' }}>
      {/* Minimalist Top Trust Bar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          color: '#475569',
          fontSize: '1.2rem',
          padding: '0.6rem 3.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <span style={{ color: '#0f172a', fontWeight: 600 }}>
            {t('Scheduled Commercial Bank • Govt of India Partner')}
          </span>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>{t('256-Bit SSL Encrypted | RBI Regulated')}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <span>
            Toll-Free: <strong style={{ color: '#0f172a' }}>1800 120 4444</strong>
          </span>

          {/* Bilingual Language Switcher */}
          <button
            id="lang-toggle-btn"
            onClick={toggleLanguage}
            title={language === 'hi' ? 'Switch to English' : 'हिंदी में अनुवाद करें'}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#0f172a',
              padding: '0.35rem 1rem',
              borderRadius: '9999px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '1.15rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <span>{language === 'hi' ? 'हिंदी / EN' : 'EN / हिंदी'}</span>
          </button>
        </div>
      </div>

      {/* Spacious, Clean Black/Grey/White Navbar with Subtle Blue */}
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '7.6rem',
          padding: '0 3.5rem',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        {/* Brand */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '1.4rem', textDecoration: 'none' }}>
          <div
            style={{
              width: '4.4rem',
              height: '4.4rem',
              background: '#0f172a',
              color: '#ffffff',
              borderRadius: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              fontWeight: 800,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            }}
          >
            BTB
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              {t('BHARAT TRUST BANK')}
            </span>
            <span style={{ fontSize: '1.15rem', color: '#64748b', fontWeight: 500, letterSpacing: '0.5px' }}>
              Digital Banking Portal
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <ul style={{ display: 'flex', gap: '2.8rem', listStyle: 'none', alignItems: 'center', margin: 0, padding: 0 }}>
          <li>
            <Link
              href="/"
              style={{
                textDecoration: 'none',
                fontSize: '1.45rem',
                fontWeight: 600,
                color: pathname === '/' ? '#0f172a' : '#475569',
                borderBottom: pathname === '/' ? '2px solid #2563eb' : '2px solid transparent',
                paddingBottom: '0.4rem',
                transition: 'all 0.2s',
              }}
            >
              {t('Home')}
            </Link>
          </li>
          <li>
            <Link
              href="/table-detail?tab=accounts"
              style={{
                textDecoration: 'none',
                fontSize: '1.45rem',
                fontWeight: 600,
                color: pathname === '/table-detail' ? '#0f172a' : '#475569',
                borderBottom: '2px solid transparent',
                paddingBottom: '0.4rem',
                transition: 'all 0.2s',
              }}
            >
              {t('Accounts')}
            </Link>
          </li>
          <li>
            <Link
              href="/table-detail?tab=deposits"
              style={{
                textDecoration: 'none',
                fontSize: '1.45rem',
                fontWeight: 600,
                color: '#475569',
                borderBottom: '2px solid transparent',
                paddingBottom: '0.4rem',
                transition: 'all 0.2s',
              }}
            >
              {t('Deposits')}
            </Link>
          </li>
          <li>
            <Link
              href="/table-detail?tab=loans"
              style={{
                textDecoration: 'none',
                fontSize: '1.45rem',
                fontWeight: 600,
                color: '#1d4ed8',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '0.6rem 1.4rem',
                borderRadius: '9999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                transition: 'all 0.2s',
              }}
            >
              <span>{t('Loans & EMI Calc')}</span>
            </Link>
          </li>
          <li>
            <Link
              href="/table-detail?tab=cards"
              style={{
                textDecoration: 'none',
                fontSize: '1.45rem',
                fontWeight: 600,
                color: '#475569',
                paddingBottom: '0.4rem',
                transition: 'all 0.2s',
              }}
            >
              {t('RuPay Cards')}
            </Link>
          </li>
          <li>
            <Link
              href="/table-detail?tab=branches"
              style={{
                textDecoration: 'none',
                fontSize: '1.45rem',
                fontWeight: 600,
                color: '#475569',
                paddingBottom: '0.4rem',
                transition: 'all 0.2s',
              }}
            >
              {t('Branches & ATMs')}
            </Link>
          </li>
        </ul>

        {/* Right User or Login Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.6rem' }}>
          {customer ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem' }}>
              <Link
                href="/personal"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  background: '#f8fafc',
                  padding: '0.6rem 1.4rem',
                  borderRadius: '9999px',
                  border: '1px solid #e2e8f0',
                  textDecoration: 'none',
                }}
              >
                <div
                  style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '50%',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.3rem',
                  }}
                >
                  {customer.full_name ? customer.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 600, color: '#0f172a' }}>{customer.full_name}</span>
                  <span style={{ fontSize: '1.1rem', color: '#64748b' }}>My Portal</span>
                </div>
              </Link>

              <button onClick={handleLogout} className="btn--logout" style={{ padding: '0.7rem 1.6rem', fontSize: '1.3rem' }}>
                {t('Log Out →')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
              <Link
                href="/open-account"
                style={{
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  textDecoration: 'none',
                  padding: '1rem 1.8rem',
                  borderRadius: '0.8rem',
                  fontSize: '1.4rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  transition: 'all 0.2s',
                }}
              >
                <span>{language === 'hi' ? 'खाता खोलें (ई-केवाईसी)' : 'Open Account'}</span>
              </Link>

              <Link
                href="/#login-card"
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  textDecoration: 'none',
                  padding: '1rem 2.2rem',
                  borderRadius: '0.8rem',
                  fontSize: '1.4rem',
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                  transition: 'all 0.2s',
                }}
              >
                <span>{t('NetBanking Login →')}</span>
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
