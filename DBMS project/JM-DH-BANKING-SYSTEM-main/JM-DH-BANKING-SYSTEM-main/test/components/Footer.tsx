'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from './Providers';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer style={{ backgroundColor: '#f8fafc', color: '#64748b', padding: '5rem 3.5rem 3rem 3.5rem', marginTop: 'auto', borderTop: '1px solid #e2e8f0' }}>
      <div style={{ maxWidth: '118rem', margin: '0 auto', display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: '4rem', marginBottom: '3.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', marginBottom: '1.4rem' }}>
            <div
              style={{
                width: '3.8rem',
                height: '3.8rem',
                background: '#0f172a',
                color: '#ffffff',
                borderRadius: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.6rem',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.1)',
              }}
            >
              BTB
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                {t('BHARAT TRUST BANK')}
              </div>
              <div style={{ fontSize: '1.15rem', color: '#64748b', fontWeight: 600 }}>
                {t('Scheduled Commercial Bank • Govt of India Partner')}
              </div>
            </div>
          </div>
          <p style={{ fontSize: '1.35rem', lineHeight: '1.7', color: '#475569', maxWidth: '34rem' }}>
            {t('Empowering Indian citizens with transparent, secure, and modern digital banking. Registered under the Banking Regulation Act, 1949.')}
          </p>
        </div>

        <div>
          <h4 style={{ color: '#0f172a', fontSize: '1.45rem', fontWeight: 700, marginBottom: '1.6rem', borderLeft: '3px solid #2563eb', paddingLeft: '1rem' }}>
            {t('Personal Banking')}
          </h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '1.35rem', margin: 0, padding: 0 }}>
            <li><Link href="/table-detail?tab=accounts" style={{ color: '#64748b', textDecoration: 'none' }}>{t('Savings Account')}</Link></li>
            <li><Link href="/table-detail?tab=deposits" style={{ color: '#64748b', textDecoration: 'none' }}>{t('Fixed Deposit Rates')}</Link></li>
            <li><Link href="/table-detail?tab=loans" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Loan EMI Calculator →</Link></li>
            <li><Link href="/table-detail?tab=cards" style={{ color: '#64748b', textDecoration: 'none' }}>{t('RuPay Platinum Card')}</Link></li>
          </ul>
        </div>

        <div>
          <h4 style={{ color: '#0f172a', fontSize: '1.45rem', fontWeight: 700, marginBottom: '1.6rem', borderLeft: '3px solid #2563eb', paddingLeft: '1rem' }}>
            {t('Customer Care')}
          </h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '1.35rem', margin: 0, padding: 0 }}>
            <li><Link href="/table-detail?tab=branches" style={{ color: '#64748b', textDecoration: 'none' }}>{t('Locate Branch / ATM')}</Link></li>
            <li><span style={{ color: '#0f172a', fontWeight: 700 }}>1800 120 4444 (Toll-Free)</span></li>
            <li><Link href="/table-detail?tab=charter" style={{ color: '#64748b', textDecoration: 'none' }}>{t('Customer Citizen Charter')}</Link></li>
          </ul>
        </div>

        <div>
          <h4 style={{ color: '#0f172a', fontSize: '1.45rem', fontWeight: 700, marginBottom: '1.6rem', borderLeft: '3px solid #2563eb', paddingLeft: '1rem' }}>
            {t('Security & Legal')}
          </h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '1.35rem', margin: 0, padding: 0 }}>
            <li><Link href="/table-detail?tab=charter" style={{ color: '#64748b', textDecoration: 'none' }}>{t('Banking Ombudsman Scheme')}</Link></li>
            <li><Link href="/table-detail?tab=charter" style={{ color: '#64748b', textDecoration: 'none' }}>{t('RBI Kehta Hai Advisory')}</Link></li>
            <li><Link href="/table-detail?tab=charter" style={{ color: '#64748b', textDecoration: 'none' }}>{t('Privacy & Data Protection Policy')}</Link></li>
          </ul>
        </div>
      </div>

      <div style={{ maxWidth: '118rem', margin: '0 auto', paddingTop: '2rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', fontSize: '1.25rem', color: '#64748b' }}>
        <div>
          {t('© 2026 Bharat Trust Bank Ltd. All Rights Reserved. Scheduled Commercial Bank.')}
        </div>
        <div>
          {t('Compliant with Reserve Bank of India (RBI) Digital Banking Guidelines.')}
        </div>
      </div>
    </footer>
  );
}
