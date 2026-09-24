'use client';

import React, { useState } from 'react';
import { Transaction, Account } from '@/types';

interface SpendingAnalyticsHubProps {
  transactions: Transaction[];
  activeAccount: Account | null;
  totalBalance: number;
  onOpenDepositModal: () => void;
  onOpenUpiModal: () => void;
}

export default function SpendingAnalyticsHub({
  transactions,
  activeAccount,
  totalBalance,
  onOpenDepositModal,
  onOpenUpiModal,
}: SpendingAnalyticsHubProps) {
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number | null>(null);
  const [timeframe, setTimeframe] = useState<'30d' | 'all'>('30d');

  // Filter transactions for active account
  const accountTxns = transactions.filter((t) => {
    if (!activeAccount) return true;
    return t.sender_account === activeAccount.account_number || t.receiver_account === activeAccount.account_number;
  });

  // Calculate Inflows & Outflows
  const totalInflow = accountTxns
    .filter((t) => t.flow === 'Credit' || t.type === 'Deposit' || t.receiver_account === activeAccount?.account_number)
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const totalOutflow = accountTxns
    .filter((t) => t.flow === 'Debit' || t.type === 'Withdrawal' || (t.type === 'Transfer' && t.sender_account === activeAccount?.account_number))
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const netSavings = Math.max(0, totalInflow - totalOutflow);
  const savingsRate = totalInflow > 0 ? Math.round((netSavings / totalInflow) * 100) : 0;

  // Categories definitions
  const categories = [
    { name: 'Transfers & UPI', color: '#2563eb', keywords: ['transfer', 'imps', 'neft', 'upi'] },
    { name: 'Cash & ATM', color: '#f59e0b', keywords: ['atm', 'cash', 'cashout', 'withdrawal'] },
    { name: 'Investments & Deposits', color: '#10b981', keywords: ['deposit', 'fd', 'rd', 'booking'] },
    { name: 'Utilities & Bills', color: '#8b5cf6', keywords: ['rent', 'bill', 'electric', 'recharge'] },
    { name: 'Shopping & Others', color: '#ec4899', keywords: [] },
  ];

  // Map category totals
  const categoryStats = categories.map((cat) => {
    const matchingTxns = accountTxns.filter((t) => {
      const isDebit = t.flow === 'Debit' || t.type === 'Withdrawal' || (t.type === 'Transfer' && t.sender_account === activeAccount?.account_number);
      if (!isDebit) return false;
      const desc = (t.description || '').toLowerCase();
      if (cat.keywords.length === 0) return true;
      return cat.keywords.some((k) => desc.includes(k));
    });

    const total = matchingTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return {
      ...cat,
      total,
      count: matchingTxns.length,
      percentage: totalOutflow > 0 ? Math.round((total / totalOutflow) * 100) : 0,
    };
  });

  // SVG Donut Math
  const radius = 64;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  // Burn Rate calculations
  const daysInCycle = 30;
  const dailyBurn = Math.round(totalOutflow / daysInCycle);
  const remainingDays = 14;
  const projectedBalance = Math.max(0, (activeAccount ? Number(activeAccount.balance) : totalBalance) - dailyBurn * remainingDays);

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '1.4rem',
        border: '1px solid #e2e8f0',
        padding: '3rem',
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
        marginBottom: '3rem',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.4rem',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '2rem',
          marginBottom: '2.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <div
            style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '1rem',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Cash Flow & Spending Intelligence
            </h2>
            <span style={{ fontSize: '1.25rem', color: '#64748b' }}>
              Real-time ledger analytics for {activeAccount?.account_type || 'Active Account'}
            </span>
          </div>
        </div>

        {/* Timeframe pill & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.3rem', borderRadius: '0.8rem', border: '1px solid #cbd5e1' }}>
            <button
              onClick={() => setTimeframe('30d')}
              style={{
                background: timeframe === '30d' ? '#ffffff' : 'none',
                color: timeframe === '30d' ? '#0f172a' : '#64748b',
                boxShadow: timeframe === '30d' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                border: 'none',
                padding: '0.5rem 1.2rem',
                borderRadius: '0.6rem',
                fontSize: '1.2rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setTimeframe('all')}
              style={{
                background: timeframe === 'all' ? '#ffffff' : 'none',
                color: timeframe === 'all' ? '#0f172a' : '#64748b',
                boxShadow: timeframe === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                border: 'none',
                padding: '0.5rem 1.2rem',
                borderRadius: '0.6rem',
                fontSize: '1.2rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              All Time
            </button>
          </div>

          <button
            onClick={onOpenUpiModal}
            style={{
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.8rem',
              padding: '0.8rem 1.4rem',
              fontSize: '1.25rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Instant UPI Hub</span>
          </button>
        </div>
      </div>

      {/* Grid: Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(22rem, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        {/* Total Inflow */}
        <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '1.2rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
            <span style={{ fontSize: '1.2rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Monthly Inflow</span>
            <span style={{ color: '#15803d', background: '#dcfce7', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '1.1rem', fontWeight: 700 }}>
              +CREDIT
            </span>
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#15803d', letterSpacing: '-0.02em' }}>
            ₹{totalInflow.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '1.2rem', color: '#64748b' }}>Salary, UPI credits, deposits</span>
        </div>

        {/* Total Outflow */}
        <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '1.2rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
            <span style={{ fontSize: '1.2rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Monthly Outflow</span>
            <span style={{ color: '#b91c1c', background: '#fee2e2', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '1.1rem', fontWeight: 700 }}>
              -DEBIT
            </span>
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#b91c1c', letterSpacing: '-0.02em' }}>
            ₹{totalOutflow.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '1.2rem', color: '#64748b' }}>Transfers, cash, merchant spends</span>
        </div>

        {/* Net Savings & Health */}
        <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '1.2rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
            <span style={{ fontSize: '1.2rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Savings Retention</span>
            <span style={{ color: '#1d4ed8', background: '#eff6ff', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '1.1rem', fontWeight: 700 }}>
              {savingsRate}% RATE
            </span>
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            ₹{netSavings.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '1.2rem', color: savingsRate >= 50 ? '#15803d' : '#b45309', fontWeight: 600 }}>
            {savingsRate >= 50 ? '● High Financial Health' : '● Moderate Buffer'}
          </span>
        </div>

        {/* Projected Balance */}
        <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '1.2rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
            <span style={{ fontSize: '1.2rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Daily Run-Rate</span>
            <span style={{ color: '#475569', background: '#e2e8f0', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '1.1rem', fontWeight: 700 }}>
              ₹{dailyBurn}/DAY
            </span>
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            ₹{projectedBalance.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '1.2rem', color: '#64748b' }}>Forecasted month-end liquidity</span>
        </div>
      </div>

      {/* Main Charts Row: SVG Donut + Inflow vs Outflow Bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '3rem', alignItems: 'center' }}>
        {/* Left: Category Breakdown with SVG Donut */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '1.2rem',
            border: '1px solid #e2e8f0',
            padding: '2.4rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0f172a' }}>Expense Distribution by Category</h3>
            <span style={{ fontSize: '1.2rem', color: '#64748b' }}>Hover segment to inspect</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '3rem', flexWrap: 'wrap' }}>
            {/* SVG Donut */}
            <div style={{ position: 'relative', width: '160px', height: '160px', margin: '0 auto' }}>
              <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background Ring */}
                <circle cx="80" cy="80" r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth={strokeWidth} />

                {categoryStats.map((cat, idx) => {
                  const percent = cat.percentage;
                  if (percent <= 0) return null;
                  const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
                  const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                  accumulatedPercent += percent;

                  const isHovered = activeCategoryIndex === idx;

                  return (
                    <circle
                      key={cat.name}
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="transparent"
                      stroke={cat.color}
                      strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      style={{
                        transition: 'stroke-width 0.2s, opacity 0.2s',
                        cursor: 'pointer',
                        opacity: activeCategoryIndex === null || isHovered ? 1 : 0.5,
                      }}
                      onMouseEnter={() => setActiveCategoryIndex(idx)}
                      onMouseLeave={() => setActiveCategoryIndex(null)}
                    />
                  );
                })}
              </svg>

              {/* Centered Donut Value */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                <span style={{ fontSize: '1.1rem', color: '#64748b', fontWeight: 600 }}>Total Outflow</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                  ₹{Math.round(totalOutflow / 1000)}k
                </span>
              </div>
            </div>

            {/* Category Legend List */}
            <div style={{ flex: 1, minWidth: '18rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {categoryStats.map((cat, idx) => (
                <div
                  key={cat.name}
                  onMouseEnter={() => setActiveCategoryIndex(idx)}
                  onMouseLeave={() => setActiveCategoryIndex(null)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '0.6rem',
                    background: activeCategoryIndex === idx ? '#f8fafc' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{ width: '1rem', height: '1rem', borderRadius: '50%', backgroundColor: cat.color }}></div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#334155' }}>{cat.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                      ₹{cat.total.toLocaleString('en-IN')}
                    </span>
                    <span style={{ fontSize: '1.15rem', color: '#64748b', minWidth: '3.2rem', textAlign: 'right' }}>
                      {cat.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Cash Flow Comparative Visualizer & Investment Opportunity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Comparative Inflow vs Outflow Bars */}
          <div
            style={{
              background: '#f8fafc',
              borderRadius: '1.2rem',
              border: '1px solid #e2e8f0',
              padding: '2.2rem',
            }}
          >
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.6rem' }}>
              Monthly Flow Comparison
            </h3>

            {/* Inflow Bar */}
            <div style={{ marginBottom: '1.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', marginBottom: '0.4rem' }}>
                <span style={{ fontWeight: 600, color: '#334155' }}>Income & Deposits Inflow</span>
                <span style={{ fontWeight: 700, color: '#15803d' }}>₹{totalInflow.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ height: '1rem', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '100%', background: '#15803d', borderRadius: '9999px' }}></div>
              </div>
            </div>

            {/* Outflow Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', marginBottom: '0.4rem' }}>
                <span style={{ fontWeight: 600, color: '#334155' }}>Debits & Expense Outflow</span>
                <span style={{ fontWeight: 700, color: '#b91c1c' }}>₹{totalOutflow.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ height: '1rem', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, totalInflow > 0 ? (totalOutflow / totalInflow) * 100 : 50)}%`,
                    background: '#b91c1c',
                    borderRadius: '9999px',
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Smart Surplus Deployment Callout */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              borderRadius: '1.2rem',
              padding: '2.2rem',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <span style={{ color: '#60a5fa', fontSize: '1.2rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Smart Surplus Wealth Strategy
              </span>
            </div>
            <p style={{ fontSize: '1.35rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '1.4rem' }}>
              You currently retain a surplus balance of <strong>₹{netSavings.toLocaleString('en-IN')}</strong> this month. Deploy ₹50,000 into a 1-year High-Yield Fixed Deposit at <strong>7.50% p.a.</strong> to generate safe, guaranteed passive wealth.
            </p>
            <button
              onClick={onOpenDepositModal}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.8rem',
                padding: '1rem 1.8rem',
                fontSize: '1.3rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                transition: 'background 0.2s',
              }}
            >
              <span>Deploy into Fixed Deposit Matrix →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
