'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/components/Providers';

function TableDetailContent() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'branches' | 'accounts' | 'deposits' | 'loans' | 'cards' | 'charter'>('branches');
  const [branchSearch, setBranchSearch] = useState('');

  // Loan EMI Calculator State
  const [loanPrincipal, setLoanPrincipal] = useState<number>(2500000);
  const [loanRate, setLoanRate] = useState<number>(8.5);
  const [loanTenure, setLoanTenure] = useState<number>(20);

  const monthlyRate = loanRate / 12 / 100;
  const totalMonths = loanTenure * 12;
  const emi =
    monthlyRate > 0
      ? (loanPrincipal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1)
      : loanPrincipal / totalMonths;
  const totalAmount = emi * totalMonths;
  const totalInterest = totalAmount - loanPrincipal;

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['branches', 'accounts', 'deposits', 'loans', 'cards', 'charter'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  const branches = [
    { name: 'Mumbai Nariman Point Hub', ifsc: 'BTBI0001024', city: 'Mumbai', address: 'Ground Floor, Express Towers, Nariman Point, Mumbai 400021', timing: '09:30 AM - 04:30 PM', phone: '022-22881024' },
    { name: 'Bengaluru MG Road Branch', ifsc: 'BTBI0002018', city: 'Bengaluru', address: 'Prestige Meridian, 29 MG Road, Bengaluru 560001', timing: '09:30 AM - 04:30 PM', phone: '080-25582018' },
    { name: 'Delhi Connaught Place Branch', ifsc: 'BTBI0003055', city: 'New Delhi', address: 'Inner Circle, Blocks A-C, Connaught Place, New Delhi 110001', timing: '09:30 AM - 04:30 PM', phone: '011-23343055' },
    { name: 'Pune Camp Central Branch', ifsc: 'BTBI0004011', city: 'Pune', address: 'Moledina Road, Camp, Pune 411001', timing: '09:30 AM - 04:30 PM', phone: '020-26124011' },
    { name: 'Ahmedabad Ashram Road Hub', ifsc: 'BTBI0005089', city: 'Ahmedabad', address: 'Near Sakar III, Ashram Road, Ahmedabad 380009', timing: '09:30 AM - 04:30 PM', phone: '079-26585089' },
    { name: 'Hyderabad Banjara Hills Branch', ifsc: 'BTBI0006033', city: 'Hyderabad', address: 'Road No. 12, Banjara Hills, Hyderabad 500034', timing: '09:30 AM - 04:30 PM', phone: '040-23396033' },
    { name: 'Chennai Anna Salai Branch', ifsc: 'BTBI0007019', city: 'Chennai', address: 'Mount Road, Anna Salai, Chennai 600002', timing: '09:30 AM - 04:30 PM', phone: '044-28527019' },
    { name: 'Kolkata Park Street Branch', ifsc: 'BTBI0008044', city: 'Kolkata', address: 'Park Street Crossing, Kolkata 700016', timing: '09:30 AM - 04:30 PM', phone: '033-22298044' },
  ];

  const filteredBranches = branches.filter((b) => {
    const q = branchSearch.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.ifsc.toLowerCase().includes(q) ||
      b.city.toLowerCase().includes(q) ||
      b.address.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: '124rem', margin: '3.5rem auto', padding: '0 3rem' }}>
      {/* Header Banner - Black, Grey, White Theme with Subtle Blue Accent */}
      <div
        style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
          borderRadius: '1.4rem',
          padding: '4rem 4.5rem',
          color: '#0f172a',
          marginBottom: '3.5rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        }}
      >
        <span
          style={{
            background: '#eff6ff',
            color: '#1d4ed8',
            border: '1px solid #bfdbfe',
            padding: '0.4rem 1.2rem',
            borderRadius: '9999px',
            fontSize: '1.2rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            display: 'inline-block',
            marginBottom: '1.2rem',
            boxShadow: '0 1px 2px rgba(37, 99, 235, 0.05)',
          }}
        >
          Institutional Directory & Disclosures
        </span>
        <h1 style={{ fontSize: '3.2rem', fontWeight: 800, margin: '0.6rem 0 1.2rem 0', color: '#0f172a', letterSpacing: '-0.02em' }}>
          Bharat Trust Bank Services Catalog
        </h1>
        <p style={{ fontSize: '1.55rem', color: '#475569', maxWidth: '68rem', lineHeight: '1.6' }}>
          Transparent public directory of authorized branches, deposit interest matrices, retail loan calculators, and RBI compliance charters.
        </p>
      </div>

      {/* Directory Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.8rem',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '3.5rem',
          overflowX: 'auto',
          paddingBottom: '0.2rem',
        }}
      >
        {[
          { id: 'branches', label: 'Branches & IFSC' },
          { id: 'accounts', label: 'Savings & Current Accounts' },
          { id: 'deposits', label: 'Fixed Deposit Rates' },
          { id: 'loans', label: 'Loans & EMI Calculator' },
          { id: 'cards', label: 'RuPay Card Portfolio' },
          { id: 'charter', label: 'Citizen Charter & RBI Rules' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '1.2rem 2.2rem',
              fontSize: '1.45rem',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? '#0f172a' : '#64748b',
              background: activeTab === tab.id ? '#f1f5f9' : 'transparent',
              border: 'none',
              borderRadius: '0.8rem 0.8rem 0 0',
              borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '1.4rem',
          border: '1px solid #e2e8f0',
          padding: '3.5rem',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        }}
      >
        {/* Branches Tab */}
        {activeTab === 'branches' && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2.8rem',
                flexWrap: 'wrap',
                gap: '1.8rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a' }}>
                  Authorized National Branch Network
                </h2>
                <p style={{ fontSize: '1.4rem', color: '#64748b', marginTop: '0.4rem' }}>
                  RTGS / NEFT / IMPS 24x7 enabled CBS branches across major metropolitan centers
                </p>
              </div>
              <input
                type="text"
                placeholder="Search city, branch, IFSC..."
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                className="form-input"
                style={{ width: '28rem', padding: '0.9rem 1.4rem', fontSize: '1.35rem', borderColor: '#e2e8f0' }}
              />
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1.35rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#0f172a' }}>
                    <th style={{ padding: '1.4rem 1.8rem' }}>Branch Name</th>
                    <th style={{ padding: '1.4rem 1.8rem' }}>IFSC Code</th>
                    <th style={{ padding: '1.4rem 1.8rem' }}>City</th>
                    <th style={{ padding: '1.4rem 1.8rem' }}>Branch Address</th>
                    <th style={{ padding: '1.4rem 1.8rem' }}>Business Hours</th>
                    <th style={{ padding: '1.4rem 1.8rem' }}>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBranches.map((b) => (
                    <tr key={b.ifsc} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1.6rem 1.8rem', fontWeight: 600, color: '#0f172a' }}>{b.name}</td>
                      <td style={{ padding: '1.6rem 1.8rem' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: '#1d4ed8',
                            background: '#eff6ff',
                            padding: '0.4rem 0.9rem',
                            borderRadius: '0.6rem',
                            border: '1px solid #bfdbfe',
                          }}
                        >
                          {b.ifsc}
                        </span>
                      </td>
                      <td style={{ padding: '1.6rem 1.8rem', color: '#0f172a', fontWeight: 500 }}>{b.city}</td>
                      <td style={{ padding: '1.6rem 1.8rem', color: '#64748b', maxWidth: '30rem' }}>{b.address}</td>
                      <td style={{ padding: '1.6rem 1.8rem', color: '#475569' }}>{b.timing}</td>
                      <td style={{ padding: '1.6rem 1.8rem', color: '#0f172a', fontWeight: 700 }}>{b.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Accounts Tab */}
        {activeTab === 'accounts' && (
          <div>
            <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem' }}>
              Personal & Business Account Products
            </h2>
            <p style={{ fontSize: '1.4rem', color: '#64748b', marginBottom: '3rem' }}>
              Transparent terms, zero hidden charges, and quarterly interest payouts
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(30rem, 1fr))', gap: '2.8rem' }}>
              <div style={{ border: '1px solid #0f172a', borderRadius: '1.4rem', padding: '3rem', background: '#ffffff', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)' }}>
                <span style={{ background: '#0f172a', color: '#ffffff', padding: '0.4rem 1.2rem', borderRadius: '9999px', fontSize: '1.15rem', fontWeight: 600 }}>
                  MOST POPULAR
                </span>
                <h3 style={{ fontSize: '1.9rem', fontWeight: 700, color: '#0f172a', marginTop: '1.4rem' }}>
                  High-Yield Digital Savings
                </h3>
                <div style={{ fontSize: '3.2rem', fontWeight: 800, color: '#0f172a', margin: '1rem 0' }}>
                  4.50% <span style={{ fontSize: '1.4rem', color: '#64748b', fontWeight: 400 }}>p.a.</span>
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1.2rem', fontSize: '1.35rem', color: '#475569', margin: '2rem 0' }}>
                  <li>• Zero minimum balance maintenance</li>
                  <li>• Free RuPay Platinum Contactless Debit Card</li>
                  <li>• Unlimited free NEFT / IMPS / RTGS transfers</li>
                  <li>• DICGC insurance up to ₹5 Lakh</li>
                </ul>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '1.4rem', padding: '3rem', background: '#ffffff' }}>
                <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '0.4rem 1.2rem', borderRadius: '9999px', fontSize: '1.15rem', fontWeight: 600 }}>
                  SENIOR CITIZENS
                </span>
                <h3 style={{ fontSize: '1.9rem', fontWeight: 700, color: '#0f172a', marginTop: '1.4rem' }}>
                  Senior Citizen Advantage
                </h3>
                <div style={{ fontSize: '3.2rem', fontWeight: 800, color: '#0f172a', margin: '1rem 0' }}>
                  5.00% <span style={{ fontSize: '1.4rem', color: '#64748b', fontWeight: 400 }}>p.a.</span>
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1.2rem', fontSize: '1.35rem', color: '#475569', margin: '2rem 0' }}>
                  <li>• Additional 0.50% interest over standard rate</li>
                  <li>• Priority teller queuing at all branches</li>
                  <li>• Complimentary doorstep banking support</li>
                  <li>• Free annual locker fee waiver for first year</li>
                </ul>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '1.4rem', padding: '3rem', background: '#ffffff' }}>
                <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '0.4rem 1.2rem', borderRadius: '9999px', fontSize: '1.15rem', fontWeight: 600 }}>
                  BUSINESS ENTERPRISE
                </span>
                <h3 style={{ fontSize: '1.9rem', fontWeight: 700, color: '#0f172a', marginTop: '1.4rem' }}>
                  Corporate Current Account
                </h3>
                <div style={{ fontSize: '3.2rem', fontWeight: 800, color: '#0f172a', margin: '1rem 0' }}>
                  Zero Fee <span style={{ fontSize: '1.4rem', color: '#64748b', fontWeight: 400 }}>Bulk RTGS</span>
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1.2rem', fontSize: '1.35rem', color: '#475569', margin: '2rem 0' }}>
                  <li>• Dynamic auto-sweep facility into fixed deposits</li>
                  <li>• Comprehensive multi-user corporate permissions</li>
                  <li>• Free bulk payroll & vendor settlement API</li>
                  <li>• Dedicated Relationship Manager assigned</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Deposits Tab */}
        {activeTab === 'deposits' && (
          <div>
            <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem' }}>
              Fixed Deposit Interest Rate Matrix
            </h2>
            <p style={{ fontSize: '1.4rem', color: '#64748b', marginBottom: '2.8rem' }}>
              Domestic term deposits below ₹2 Crore (Quarterly compounding, Effective Q3 FY2026)
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1.35rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#0f172a' }}>
                    <th style={{ padding: '1.4rem 1.8rem' }}>Tenure Bracket</th>
                    <th style={{ padding: '1.4rem 1.8rem', textAlign: 'center' }}>General Public (% p.a.)</th>
                    <th style={{ padding: '1.4rem 1.8rem', textAlign: 'center' }}>Senior Citizens (% p.a.)</th>
                    <th style={{ padding: '1.4rem 1.8rem' }}>Premature Liquidity</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { tenure: '7 Days to 45 Days', reg: '3.50%', senior: '4.00%', pre: 'Permitted (0.5% penalty)' },
                    { tenure: '46 Days to 179 Days', reg: '4.75%', senior: '5.25%', pre: 'Permitted (0.5% penalty)' },
                    { tenure: '180 Days to 210 Days', reg: '5.75%', senior: '6.25%', pre: 'Permitted (0.5% penalty)' },
                    { tenure: '211 Days to < 1 Year', reg: '6.00%', senior: '6.50%', pre: 'Permitted (0.5% penalty)' },
                    { tenure: '1 Year to 399 Days', reg: '6.80%', senior: '7.30%', pre: 'Permitted without penalty' },
                    { tenure: '400 Days Special Scheme', reg: '7.25%', senior: '7.75%', pre: 'Permitted after 6 months' },
                    { tenure: '2 Years to 3 Years', reg: '7.00%', senior: '7.50%', pre: 'Permitted without penalty' },
                    { tenure: '5 Years Tax-Saver Scheme', reg: '7.10%', senior: '7.60%', pre: '5-year lock-in (Sec 80C)' },
                  ].map((row) => (
                    <tr key={row.tenure} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1.6rem 1.8rem', fontWeight: 600, color: '#0f172a' }}>{row.tenure}</td>
                      <td style={{ padding: '1.6rem 1.8rem', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>{row.reg}</td>
                      <td style={{ padding: '1.6rem 1.8rem', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>{row.senior}</td>
                      <td style={{ padding: '1.6rem 1.8rem', color: '#64748b' }}>{row.pre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Loans Tab with Interactive EMI Calculator */}
        {activeTab === 'loans' && (
          <div>
            <div style={{ marginBottom: '3.5rem' }}>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem' }}>
                Real-Time Loan EMI Calculator
              </h2>
              <p style={{ fontSize: '1.4rem', color: '#64748b', marginBottom: '3rem' }}>
                Accurate Indian Rupee repayment estimates configured according to RBI benchmark guidelines
              </p>

              {/* Calculator Container */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.3fr 1fr',
                  gap: '3.5rem',
                  background: '#f8fafc',
                  padding: '3.5rem',
                  borderRadius: '1.4rem',
                  border: '1px solid #e2e8f0',
                  marginBottom: '4rem',
                }}
              >
                {/* Sliders */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.8rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <label style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a' }}>Loan Principal Amount</label>
                      <span style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0f172a' }}>₹{loanPrincipal.toLocaleString('en-IN')}</span>
                    </div>
                    <input
                      type="range"
                      min={100000}
                      max={10000000}
                      step={50000}
                      value={loanPrincipal}
                      onChange={(e) => setLoanPrincipal(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', color: '#64748b', marginTop: '0.6rem' }}>
                      <span>₹1 Lakh</span>
                      <span>₹1 Crore</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <label style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a' }}>Annual Interest Rate (%)</label>
                      <span style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0f172a' }}>{loanRate}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={15}
                      step={0.1}
                      value={loanRate}
                      onChange={(e) => setLoanRate(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', color: '#64748b', marginTop: '0.6rem' }}>
                      <span>5%</span>
                      <span>15%</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <label style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a' }}>Loan Tenure (Years)</label>
                      <span style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0f172a' }}>{loanTenure} Years</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={30}
                      step={1}
                      value={loanTenure}
                      onChange={(e) => setLoanTenure(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', color: '#64748b', marginTop: '0.6rem' }}>
                      <span>1 Year</span>
                      <span>30 Years</span>
                    </div>
                  </div>
                </div>

                {/* Result Card */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    color: '#ffffff',
                    borderRadius: '1.4rem',
                    padding: '3.2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.12)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '1.25rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Estimated Monthly EMI
                    </span>
                    <div style={{ fontSize: '3.8rem', fontWeight: 800, color: '#ffffff', margin: '0.8rem 0 2rem 0' }}>
                      ₹{Math.round(emi).toLocaleString('en-IN')}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '1.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem' }}>
                        <span style={{ color: '#94a3b8' }}>Principal Amount</span>
                        <strong>₹{loanPrincipal.toLocaleString('en-IN')}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem' }}>
                        <span style={{ color: '#94a3b8' }}>Total Interest</span>
                        <strong>₹{Math.round(totalInterest).toLocaleString('en-IN')}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', borderTop: '1px dashed rgba(255,255,255,0.2)', paddingTop: '1.2rem' }}>
                        <span style={{ color: '#ffffff', fontWeight: 700 }}>Total Payable</span>
                        <strong style={{ color: '#ffffff', fontSize: '1.6rem' }}>₹{Math.round(totalAmount).toLocaleString('en-IN')}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '1.2rem', color: '#94a3b8', marginTop: '2rem', textAlign: 'center' }}>
                    Standard processing fees & taxes apply per RBI rules
                  </div>
                </div>
              </div>
            </div>

            {/* Loan Products */}
            <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem' }}>
              Retail & Priority Sector Loan Products
            </h3>
            <p style={{ fontSize: '1.4rem', color: '#64748b', marginBottom: '2.8rem' }}>
              Financing products tailored for home ownership, electric mobility, or enterprise growth
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(30rem, 1fr))', gap: '2.8rem' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '1.4rem', padding: '3rem', background: '#ffffff' }}>
                <h4 style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0f172a' }}>Home Mortgage Loan</h4>
                <div style={{ fontSize: '2.8rem', fontWeight: 800, color: '#0f172a', margin: '0.8rem 0' }}>
                  8.40% <span style={{ fontSize: '1.35rem', color: '#64748b', fontWeight: 400 }}>starting p.a.</span>
                </div>
                <p style={{ fontSize: '1.4rem', color: '#475569', lineHeight: '1.6' }}>
                  Zero prepayment penalty on floating rate loans. Maximum tenure up to 30 years. Quick digital sanction within 48 hours.
                </p>
              </div>

              <div style={{ border: '1px solid #0f172a', borderRadius: '1.4rem', padding: '3rem', background: '#ffffff', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)' }}>
                <h4 style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0f172a' }}>Electric Vehicle (EV) Loan</h4>
                <div style={{ fontSize: '2.8rem', fontWeight: 800, color: '#0f172a', margin: '0.8rem 0' }}>
                  8.25% <span style={{ fontSize: '1.35rem', color: '#64748b', fontWeight: 400 }}>starting p.a.</span>
                </div>
                <p style={{ fontSize: '1.4rem', color: '#475569', lineHeight: '1.6' }}>
                  Special green concession of 0.50% interest for zero-emission vehicles. Up to 90% on-road funding.
                </p>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '1.4rem', padding: '3rem', background: '#ffffff' }}>
                <h4 style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0f172a' }}>MSME / SME Business Loan</h4>
                <div style={{ fontSize: '2.8rem', fontWeight: 800, color: '#0f172a', margin: '0.8rem 0' }}>
                  9.50% <span style={{ fontSize: '1.35rem', color: '#64748b', fontWeight: 400 }}>starting p.a.</span>
                </div>
                <p style={{ fontSize: '1.4rem', color: '#475569', lineHeight: '1.6' }}>
                  Collateral-free loans up to ₹2 Crore under CGTMSE credit guarantee scheme. Working capital and machinery financing.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cards Tab */}
        {activeTab === 'cards' && (
          <div>
            <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem' }}>
              National RuPay Debit & Credit Card Portfolio
            </h2>
            <p style={{ fontSize: '1.4rem', color: '#64748b', marginBottom: '3rem' }}>
              Empowered by NPCI infrastructure with global acceptance via Discover & JCB
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(30rem, 1fr))', gap: '2.8rem' }}>
              <div style={{ border: '1px solid #0f172a', borderRadius: '1.4rem', padding: '3rem', background: '#ffffff', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)' }}>
                <span style={{ background: '#0f172a', color: '#ffffff', padding: '0.4rem 1.2rem', borderRadius: '9999px', fontSize: '1.15rem', fontWeight: 600 }}>
                  PERSONAL DEBIT
                </span>
                <h3 style={{ fontSize: '1.9rem', fontWeight: 700, color: '#0f172a', marginTop: '1.4rem' }}>
                  RuPay Platinum Contactless
                </h3>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1.2rem', fontSize: '1.35rem', color: '#475569', marginTop: '1.6rem' }}>
                  <li>• Free Domestic Airport Lounge Access (2/quarter)</li>
                  <li>• ₹2,00,000 Personal Accidental Insurance Cover</li>
                  <li>• Daily ATM Cash Limit: ₹50,000</li>
                  <li>• Daily POS / E-commerce Limit: ₹2,00,000</li>
                  <li>• Zero Fuel Surcharge at all Indian petrol pumps</li>
                </ul>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '1.4rem', padding: '3rem', background: '#ffffff' }}>
                <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.4rem 1.2rem', borderRadius: '9999px', fontSize: '1.15rem', fontWeight: 600, border: '1px solid #e2e8f0' }}>
                  BUSINESS EXECUTIVE
                </span>
                <h3 style={{ fontSize: '1.9rem', fontWeight: 700, color: '#0f172a', marginTop: '1.4rem' }}>
                  RuPay Select Business
                </h3>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1.2rem', fontSize: '1.35rem', color: '#475569', marginTop: '1.6rem' }}>
                  <li>• International & Domestic Airport Lounge Access</li>
                  <li>• Comprehensive Annual Health Checkup Voucher</li>
                  <li>• ₹10,00,000 Accidental Death Insurance</li>
                  <li>• Daily POS / Online Limit: ₹5,00,000</li>
                  <li>• 24x7 Dedicated Concierge Helpline</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Citizen Charter Tab */}
        {activeTab === 'charter' && (
          <div>
            <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem' }}>
              Customer Citizen Charter & Grievance Redressal
            </h2>
            <p style={{ fontSize: '1.4rem', color: '#64748b', marginBottom: '3rem' }}>
              Committed to the Reserve Bank of India Integrated Ombudsman Scheme, 2021
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.2rem', fontSize: '1.4rem', color: '#475569', lineHeight: '1.7' }}>
              <div style={{ background: '#f8fafc', padding: '2.4rem', borderRadius: '1.2rem', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1.7rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.8rem' }}>
                  Level 1: Branch & 24x7 Customer Care
                </h3>
                <p>
                  Customers can lodge grievances at any branch or call our toll-free national helpline at 1800 120 4444. Expected resolution turnaround time (TAT): 3 working days.
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: '2.4rem', borderRadius: '1.2rem', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1.7rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.8rem' }}>
                  Level 2: Principal Nodal Officer (PNO)
                </h3>
                <p>
                  If unsatisfied with branch resolution within 10 days, escalate to our Principal Nodal Officer, Customer Care Department, Bharat Trust Bank Corporate Towers, Mumbai. Email: pno@bharattrustbank.in.
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: '2.4rem', borderRadius: '1.2rem', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1.7rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.8rem' }}>
                  Level 3: Reserve Bank of India (RBI) Ombudsman
                </h3>
                <p>
                  If the complaint remains unresolved within 30 days, customers may approach the RBI Banking Ombudsman directly through the official CMS portal: https://cms.rbi.org.in or by calling 14448.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TableDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: '6rem', textAlign: 'center', color: '#0f172a' }}>Loading Institutional Directory...</div>}>
      <TableDetailContent />
    </Suspense>
  );
}
