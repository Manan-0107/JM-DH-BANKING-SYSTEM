'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage, useToast } from '@/components/Providers';
import { Customer, Account, Transaction, Beneficiary, Deposit } from '@/types';
import UpiPaymentModal from '@/components/UpiPaymentModal';
import SpendingAnalyticsHub from '@/components/SpendingAnalyticsHub';
import AiBankingCopilot from '@/components/AiBankingCopilot';

export default function PersonalPortal() {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);

  // Session countdown (10 minutes)
  const [sessionSeconds, setSessionSeconds] = useState(600);

  // Privacy mask for balance and account numbers
  const [isMasked, setIsMasked] = useState(false);

  // Virtual card flip state
  const [cardFlipped, setCardFlipped] = useState(false);
  const [cardFrozen, setCardFrozen] = useState(false);
  const [freezeLoading, setFreezeLoading] = useState(false);

  // Modals
  const [activeModal, setActiveModal] = useState<
    'transfer' | 'deposit' | 'withdraw' | 'add_beneficiary' | 'book_deposit' | 'open_account' | 'break_deposit' | 'upi' | null
  >(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states: Transfer
  const [transferBeneficiary, setTransferBeneficiary] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferRemarks, setTransferRemarks] = useState('');
  const [transferPin, setTransferPin] = useState('');

  // Form states: Deposit & Withdrawal
  const [depositAmount, setDepositAmount] = useState('');
  const [depositRemarks, setDepositRemarks] = useState('');
  const [depositPin, setDepositPin] = useState('');

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawRemarks, setWithdrawRemarks] = useState('');
  const [withdrawPin, setWithdrawPin] = useState('');

  // Form states: Add Beneficiary
  const [newBenName, setNewBenName] = useState('');
  const [newBenAcc, setNewBenAcc] = useState('');
  const [newBenConfirmAcc, setNewBenConfirmAcc] = useState('');
  const [newBenIfsc, setNewBenIfsc] = useState('BTBI0001024');
  const [newBenBank, setNewBenBank] = useState('Bharat Trust Bank');
  const [newBenLimit, setNewBenLimit] = useState('100000');

  // Form states: Book Deposit & Calculator
  const [fdAmount, setFdAmount] = useState<number>(50000);
  const [fdTenure, setFdTenure] = useState<number>(12); // months
  const [fdType, setFdType] = useState<'Fixed Deposit' | 'Recurring Deposit'>('Fixed Deposit');
  const [fdPin, setFdPin] = useState('');
  const [selectedDepositForBreak, setSelectedDepositForBreak] = useState<Deposit | null>(null);

  // Form states: Open Additional Account
  const [newAccType, setNewAccType] = useState<'Savings Account' | 'Current Account' | 'Salary Account' | 'Student Savings'>('Current Account');
  const [newAccBranch, setNewAccBranch] = useState('Mumbai Nariman Point Hub');
  const [newAccPin, setNewAccPin] = useState('');

  // Transaction tab & search
  const [txnTab, setTxnTab] = useState<'all' | 'credit' | 'debit'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load session & all data
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/#login-card');
      return;
    }

    const fetchData = async () => {
      try {
        const [meRes, txRes, benRes, depRes] = await Promise.all([
          fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/transactions/my-transactions', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/beneficiaries', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/deposits', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (meRes.status === 401 || txRes.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/#login-card');
          return;
        }

        const meData = await meRes.json();
        const txData = await txRes.json();
        const benData = benRes.ok ? await benRes.json() : { beneficiaries: [] };
        const depData = depRes.ok ? await depRes.json() : { deposits: [] };

        setCustomer(meData.customer);
        setAccounts(meData.accounts || []);
        if (meData.accounts && meData.accounts.length > 0) {
          setActiveAccount(meData.accounts[0]);
          setCardFrozen(meData.accounts[0].status === 'Frozen');
        }
        setTransactions(txData.transactions || []);
        setBeneficiaries(benData.beneficiaries || []);
        setDeposits(depData.deposits || []);
      } catch (err: any) {
        showToast('Error loading personal banking session', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  // Session timer countdown
  useEffect(() => {
    if (sessionSeconds <= 0) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      showToast('Session timed out for security. Please login again.', 'info');
      router.push('/#login-card');
      return;
    }

    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionSeconds, router]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const reloadData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const [meRes, txRes, benRes, depRes] = await Promise.all([
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/transactions/my-transactions', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/beneficiaries', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/deposits', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const meData = await meRes.json();
      const txData = await txRes.json();
      const benData = benRes.ok ? await benRes.json() : { beneficiaries: [] };
      const depData = depRes.ok ? await depRes.json() : { deposits: [] };

      setCustomer(meData.customer);
      setAccounts(meData.accounts || []);
      if (meData.accounts && meData.accounts.length > 0) {
        const found = meData.accounts.find((a: Account) => a.account_number === activeAccount?.account_number) || meData.accounts[0];
        setActiveAccount(found);
        setCardFrozen(found.status === 'Frozen');
      }
      setTransactions(txData.transactions || []);
      setBeneficiaries(benData.beneficiaries || []);
      setDeposits(depData.deposits || []);
    } catch (e) {}
  };

  const handleToggleFreeze = async () => {
    if (!activeAccount) return;
    const token = localStorage.getItem('token');
    setFreezeLoading(true);

    try {
      const res = await fetch(`/api/accounts/${activeAccount.account_number}/freeze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCardFrozen(data.account.status === 'Frozen');
      setActiveAccount(data.account);
      showToast(data.message, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setFreezeLoading(false);
    }
  };

  // Transfer Handler
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;
    const token = localStorage.getItem('token');
    setActionLoading(true);

    try {
      const res = await fetch('/api/accounts/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          from_account: activeAccount.account_number,
          to_account: transferBeneficiary.trim(),
          amount: parseFloat(transferAmount),
          description: transferRemarks || `IMPS to ${transferBeneficiary}`,
          pin: transferPin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, 'success');
      setActiveModal(null);
      setTransferBeneficiary('');
      setTransferAmount('');
      setTransferRemarks('');
      setTransferPin('');
      await reloadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Deposit Handler
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;
    const token = localStorage.getItem('token');
    setActionLoading(true);

    try {
      const res = await fetch(`/api/accounts/${activeAccount.account_number}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: parseFloat(depositAmount),
          description: depositRemarks || 'Cash / Cheque Deposit',
          pin: depositPin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, 'success');
      setActiveModal(null);
      setDepositAmount('');
      setDepositRemarks('');
      setDepositPin('');
      await reloadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Withdraw Handler
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;
    const token = localStorage.getItem('token');
    setActionLoading(true);

    try {
      const res = await fetch(`/api/accounts/${activeAccount.account_number}/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: parseFloat(withdrawAmount),
          description: withdrawRemarks || 'ATM Cashout Terminal',
          pin: withdrawPin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, 'success');
      setActiveModal(null);
      setWithdrawAmount('');
      setWithdrawRemarks('');
      setWithdrawPin('');
      await reloadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Add Beneficiary Handler
  const handleAddBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBenName.trim() || !newBenAcc.trim()) {
      showToast('Please fill in all beneficiary details', 'error');
      return;
    }
    if (newBenAcc.trim() !== newBenConfirmAcc.trim()) {
      showToast('Account numbers do not match', 'error');
      return;
    }

    const token = localStorage.getItem('token');
    setActionLoading(true);
    try {
      const res = await fetch('/api/beneficiaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          beneficiary_name: newBenName.trim(),
          account_number: newBenAcc.trim(),
          ifsc_code: newBenIfsc.trim(),
          bank_name: newBenBank.trim(),
          transfer_limit: parseFloat(newBenLimit) || 100000,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, 'success');
      setActiveModal(null);
      setNewBenName('');
      setNewBenAcc('');
      setNewBenConfirmAcc('');
      await reloadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Beneficiary Handler
  const handleDeleteBeneficiary = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from your registered payees?`)) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/beneficiaries/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message, 'info');
      await reloadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Book Deposit Handler
  const handleBookDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;
    const token = localStorage.getItem('token');
    setActionLoading(true);

    try {
      const res = await fetch('/api/deposits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source_account: activeAccount.account_number,
          deposit_type: fdType,
          principal_amount: fdAmount,
          tenure_months: fdTenure,
          pin: fdPin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, 'success');
      setActiveModal(null);
      setFdPin('');
      await reloadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Break Deposit Handler
  const handleBreakDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDepositForBreak) return;
    const token = localStorage.getItem('token');
    setActionLoading(true);

    try {
      const res = await fetch(`/api/deposits/${selectedDepositForBreak.deposit_id}/break`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin: fdPin.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, 'success');
      setActiveModal(null);
      setSelectedDepositForBreak(null);
      setFdPin('');
      await reloadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Additional Account Handler
  const handleOpenAdditionalAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setActionLoading(true);

    try {
      const res = await fetch('/api/accounts/open-additional', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          account_type: newAccType,
          branch_name: newAccBranch,
          pin: newAccPin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, 'success');
      setActiveModal(null);
      setNewAccPin('');
      await reloadData();
      if (data.account) {
        setActiveAccount(data.account);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // FD calculations
  const getFdRate = (tenure: number) => {
    if (tenure <= 3) return 6.25;
    if (tenure <= 6) return 6.75;
    if (tenure <= 12) return 7.50;
    if (tenure <= 36) return 7.75;
    return 8.10;
  };

  const calculateFdMaturity = (principal: number, tenureMonths: number, rate: number) => {
    const tYears = tenureMonths / 12;
    const n = 4;
    return Math.round(principal * Math.pow(1 + (rate / 100) / n, n * tYears));
  };

  const isCoolingActive = (coolingUntil?: string | null) => {
    if (!coolingUntil) return false;
    return new Date(coolingUntil).getTime() > Date.now();
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter((txn) => {
    const isCredit = txn.flow === 'Credit' || txn.type === 'Deposit';
    const matchesTab =
      txnTab === 'all'
        ? true
        : txnTab === 'credit'
        ? isCredit
        : !isCredit;

    const matchesSearch =
      txn.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.transaction_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (txn.receiver_account && txn.receiver_account.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesTab && matchesSearch;
  });

  if (loading) {
    return (
      <div style={{ padding: '8rem', textAlign: 'center', fontSize: '1.6rem', color: '#0f172a', fontWeight: 600 }}>
        Connecting to encrypted NetBanking session...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '124rem', margin: '3.5rem auto', padding: '0 3rem' }}>
      {/* Welcome & Session Banner */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '1.4rem',
          padding: '2.5rem 3.5rem',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '2rem',
          marginBottom: '2.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem', marginBottom: '0.6rem' }}>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Welcome, {customer?.full_name || 'Customer'}
            </h1>
            <span
              style={{
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: '1.2rem',
                fontWeight: 600,
                padding: '0.4rem 1.2rem',
                borderRadius: '9999px',
                border: '1px solid #bfdbfe',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              KYC Verified • {customer?.tier || 'Platinum'} Tier
            </span>
          </div>
          <div style={{ fontSize: '1.35rem', color: '#64748b', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span><strong style={{ color: '#0f172a' }}>CIF ID:</strong> {customer?.customer_id}</span>
            <span><strong style={{ color: '#0f172a' }}>Branch:</strong> {activeAccount?.branch_name || 'Downtown Central'}</span>
            <span><strong style={{ color: '#0f172a' }}>IFSC:</strong> {activeAccount?.ifsc_code || 'BTBI0001024'}</span>
            {customer?.pan_number && (
              <span><strong style={{ color: '#0f172a' }}>PAN:</strong> {customer.pan_number}</span>
            )}
            {customer?.aadhaar_number && (
              <span><strong style={{ color: '#0f172a' }}>Aadhaar:</strong> {customer.aadhaar_number}</span>
            )}
          </div>
        </div>

        {/* Security & Masking Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem' }}>
          <button
            onClick={() => setIsMasked(!isMasked)}
            style={{
              background: isMasked ? '#eff6ff' : '#f8fafc',
              border: `1px solid ${isMasked ? '#bfdbfe' : '#e2e8f0'}`,
              color: isMasked ? '#2563eb' : '#475569',
              padding: '1rem 1.6rem',
              borderRadius: '0.8rem',
              fontSize: '1.3rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              {isMasked ? (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </>
              ) : (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </>
              )}
            </svg>
            <span>{isMasked ? 'Unmask Privacy' : 'Mask Balance'}</span>
          </button>

          <div
            style={{
              background: sessionSeconds < 120 ? '#fef2f2' : '#f8fafc',
              border: `1px solid ${sessionSeconds < 120 ? '#fecaca' : '#e2e8f0'}`,
              padding: '1rem 1.6rem',
              borderRadius: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sessionSeconds < 120 ? '#dc2626' : '#0f172a'} strokeWidth="2.2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '1rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                Auto-Logout
              </span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: sessionSeconds < 120 ? '#dc2626' : '#0f172a', fontFamily: 'monospace' }}>
                {formatTimer(sessionSeconds)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Multiple Accounts Switcher & Open Account Button */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '1.2rem',
          padding: '1.6rem 2.4rem',
          border: '1px solid #e2e8f0',
          marginBottom: '3rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.4rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#475569' }}>
            Active Accounts ({accounts.length}):
          </span>
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
            {accounts.map((acc) => {
              const isActive = activeAccount?.account_number === acc.account_number;
              return (
                <button
                  key={acc.account_number}
                  onClick={() => {
                    setActiveAccount(acc);
                    setCardFrozen(acc.status === 'Frozen');
                  }}
                  style={{
                    background: isActive ? '#0f172a' : '#f1f5f9',
                    color: isActive ? '#ffffff' : '#0f172a',
                    border: isActive ? '1px solid #0f172a' : '1px solid #cbd5e1',
                    borderRadius: '0.8rem',
                    padding: '0.8rem 1.6rem',
                    fontSize: '1.3rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.8rem',
                    transition: 'all 0.2s',
                  }}
                >
                  <span>{acc.account_type}</span>
                  <span style={{ fontFamily: 'monospace', opacity: isActive ? 0.9 : 0.6 }}>
                    {isMasked ? '•••• ' + acc.account_number.slice(-4) : acc.account_number}
                  </span>
                  <span
                    style={{
                      background: isActive ? '#2563eb' : '#e2e8f0',
                      color: isActive ? '#ffffff' : '#475569',
                      fontSize: '1.1rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '9999px',
                    }}
                  >
                    {isMasked ? '₹••••' : `₹${Number(acc.balance).toLocaleString('en-IN')}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => setActiveModal('open_account')}
          style={{
            background: '#eff6ff',
            color: '#2563eb',
            border: '1px solid #bfdbfe',
            padding: '0.9rem 1.8rem',
            borderRadius: '0.8rem',
            fontSize: '1.35rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>+</span>
          <span>Open Another Account</span>
        </button>
      </div>

      {/* Main Account & Card Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '3.5rem', marginBottom: '3.5rem' }}>
        {/* Left: Account Summary & Quick Actions */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            borderRadius: '1.4rem',
            padding: '3.5rem',
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.12)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '1.35rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                  {t('Total Available Balance')}
                </span>
                <div style={{ fontSize: '4.2rem', fontWeight: 800, color: '#ffffff', margin: '0.8rem 0 1.8rem 0', letterSpacing: '-0.02em' }}>
                  {isMasked ? '₹ ••••••••' : `₹${(activeAccount ? Number(activeAccount.balance) : 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                </div>
              </div>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  padding: '0.6rem 1.6rem',
                  borderRadius: '9999px',
                  fontSize: '1.3rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                {activeAccount?.account_type || 'Savings Account'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '3.5rem', fontSize: '1.4rem', color: '#e2e8f0', marginBottom: '2.8rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '1.2rem', color: '#94a3b8' }}>Account Number</div>
                <div style={{ fontWeight: 700, color: '#ffffff', letterSpacing: '0.5px', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                  {isMasked ? '•••• •••• ' + (activeAccount?.account_number.slice(-4) || '0000') : activeAccount?.account_number}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', color: '#94a3b8' }}>Account Status</div>
                <div style={{ fontWeight: 700, color: activeAccount?.status === 'Active' ? '#4ade80' : '#fca5a5', marginTop: '0.2rem' }}>
                  {activeAccount?.status || 'Active'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', color: '#94a3b8' }}>Daily Transfer Limit</div>
                <div style={{ fontWeight: 700, color: '#ffffff', marginTop: '0.2rem' }}>₹5,00,000</div>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: '1.2rem', paddingTop: '2.4rem', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            <button
              onClick={() => setActiveModal('transfer')}
              style={{
                background: '#ffffff',
                color: '#0f172a',
                padding: '1.2rem',
                fontSize: '1.35rem',
                fontWeight: 700,
                borderRadius: '0.8rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.7rem',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.1)',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              <span>{t('Instant Transfer')}</span>
            </button>

            <button
              onClick={() => setActiveModal('upi')}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                padding: '1.2rem',
                fontSize: '1.35rem',
                fontWeight: 700,
                borderRadius: '0.8rem',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.7rem',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              <span>Instant UPI Hub</span>
            </button>

            <button
              onClick={() => setActiveModal('deposit')}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                padding: '1.2rem',
                fontSize: '1.35rem',
                fontWeight: 600,
                borderRadius: '0.8rem',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.7rem',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>{t('Deposit Funds')}</span>
            </button>

            <button
              onClick={() => setActiveModal('withdraw')}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                padding: '1.2rem',
                fontSize: '1.35rem',
                fontWeight: 600,
                borderRadius: '0.8rem',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.7rem',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                <circle cx="12" cy="12" r="2"></circle>
              </svg>
              <span>{t('ATM Cashout')}</span>
            </button>
          </div>
        </div>

        {/* Right: Virtual RuPay Platinum Debit Card */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            onClick={() => setCardFlipped(!cardFlipped)}
            style={{
              width: '100%',
              maxWidth: '39rem',
              height: '24rem',
              perspective: '1000px',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                transition: 'transform 0.6s',
                transformStyle: 'preserve-3d',
                transform: cardFlipped ? 'rotateY(180deg)' : 'none',
              }}
            >
              {/* Card Front */}
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  borderRadius: '1.4rem',
                  padding: '2.8rem',
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  color: '#ffffff',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.2)',
                  border: '1px solid #334155',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                }}
              >
                {/* Frozen Overlay */}
                {cardFrozen && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(15, 23, 42, 0.94)',
                      backdropFilter: 'blur(4px)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10,
                      gap: '0.8rem',
                    }}
                  >
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fca5a5', letterSpacing: '1px' }}>
                      CARD TEMPORARILY FROZEN
                    </span>
                    <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>Click Unfreeze below to reactivate</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#ffffff', letterSpacing: '1px' }}>
                    BHARAT TRUST BANK
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', fontStyle: 'italic' }}>
                    RuPay <span style={{ fontSize: '1.15rem', color: '#94a3b8', fontWeight: 600, fontStyle: 'normal' }}>Platinum</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.6rem', margin: '1rem 0' }}>
                  <div style={{ width: '4.4rem', height: '3.4rem', background: 'linear-gradient(135deg, #d4af37 0%, #f3e5ab 100%)', borderRadius: '0.6rem', border: '1px solid #b8972e' }}></div>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                    <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
                    <path d="M8.5 15.5a6 6 0 0 1 7 0"></path>
                    <path d="M12 18.5a1 1 0 0 1 0 0"></path>
                  </svg>
                </div>

                <div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 700, letterSpacing: '3px', fontFamily: 'monospace', color: '#ffffff', marginBottom: '1.2rem' }}>
                    {isMasked ? '•••• •••• •••• ' + (activeAccount?.account_number.slice(-4) || '7120') : `5421 9901 2844 ${activeAccount?.account_number.slice(-4) || '7120'}`}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: '1.05rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cardholder</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, textTransform: 'uppercase', color: '#ffffff', marginTop: '0.2rem' }}>
                        {customer?.full_name || 'Customer'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.05rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valid Thru</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff', marginTop: '0.2rem' }}>08/29</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Back */}
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  borderRadius: '1.4rem',
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  color: '#ffffff',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.2)',
                  border: '1px solid #334155',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '2.2rem 0',
                }}
              >
                <div style={{ width: '100%', height: '4.2rem', background: '#020617', marginTop: '1rem' }}></div>
                <div style={{ padding: '0 2.8rem' }}>
                  <div style={{ background: '#ffffff', color: '#0f172a', padding: '0.7rem 1.4rem', textAlign: 'right', fontFamily: 'monospace', fontSize: '1.45rem', fontWeight: 800, borderRadius: '0.6rem' }}>
                    CVV: {isMasked ? '•••' : '821'}
                  </div>
                </div>
                <div style={{ padding: '0 2.8rem', fontSize: '1.15rem', color: '#94a3b8', textAlign: 'center' }}>
                  24x7 Customer Care: 1800 120 4444. Authorized for ATM & NetBanking transactions.
                </div>
              </div>
            </div>
          </div>

          {/* Card action controls */}
          <div style={{ display: 'flex', gap: '1.4rem', marginTop: '2rem', width: '100%', maxWidth: '39rem' }}>
            <button
              onClick={handleToggleFreeze}
              disabled={freezeLoading}
              className="btn w-full"
              style={{
                background: cardFrozen ? '#0f172a' : '#dc2626',
                color: '#ffffff',
                justifyContent: 'center',
                padding: '1.2rem',
                fontSize: '1.4rem',
                fontWeight: 600,
                borderRadius: '0.8rem',
              }}
            >
              {freezeLoading
                ? 'Updating...'
                : cardFrozen
                ? t('Unfreeze Card')
                : t('Freeze Card')}
            </button>
            <button
              onClick={() => setCardFlipped(!cardFlipped)}
              style={{
                background: '#f8fafc',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                padding: '1.2rem 1.8rem',
                fontSize: '1.4rem',
                fontWeight: 600,
                borderRadius: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Flip
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          PHASE 2: BENEFICIARY / PAYEE MANAGEMENT
          ======================================================== */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '1.4rem',
          padding: '3rem 3.5rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          marginBottom: '3.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.4rem', marginBottom: '2rem' }}>
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>
              Registered Beneficiaries & Quick Pay
            </h2>
            <p style={{ fontSize: '1.35rem', color: '#64748b', marginTop: '0.3rem' }}>
              Manage trusted payees with automatic RBI 2-hour anti-fraud cooling protection.
            </p>
          </div>
          <button
            onClick={() => setActiveModal('add_beneficiary')}
            style={{
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              padding: '1rem 2rem',
              borderRadius: '0.8rem',
              fontSize: '1.35rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.1)',
            }}
          >
            <span>+ Add New Payee</span>
          </button>
        </div>

        {/* Beneficiaries Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(28rem, 1fr))', gap: '1.8rem' }}>
          {beneficiaries.map((b) => {
            const underCooling = isCoolingActive(b.cooling_until);
            return (
              <div
                key={b.beneficiary_id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '1.2rem',
                  padding: '2rem',
                  background: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.4rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div
                        style={{
                          width: '4rem',
                          height: '4rem',
                          borderRadius: '9999px',
                          background: '#e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.5rem',
                          fontWeight: 700,
                          color: '#0f172a',
                        }}
                      >
                        {b.beneficiary_name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{b.beneficiary_name}</div>
                        <div style={{ fontSize: '1.2rem', color: '#64748b' }}>{b.bank_name}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteBeneficiary(b.beneficiary_id, b.beneficiary_name)}
                      title="Remove Payee"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.6rem', padding: '0.2rem' }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ fontSize: '1.3rem', color: '#475569', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div>
                      <strong>A/C:</strong> <span style={{ fontFamily: 'monospace' }}>{isMasked ? '•••• ' + b.account_number.slice(-4) : b.account_number}</span>
                    </div>
                    <div>
                      <strong>IFSC:</strong> <span style={{ fontFamily: 'monospace' }}>{b.ifsc_code}</span>
                    </div>
                    <div>
                      <strong>Daily Limit:</strong> ₹{Number(b.transfer_limit || 100000).toLocaleString('en-IN')}
                    </div>
                  </div>

                  {underCooling && (
                    <div
                      style={{
                        marginTop: '1.2rem',
                        background: '#fef3c7',
                        color: '#92400e',
                        padding: '0.6rem 1rem',
                        borderRadius: '0.6rem',
                        fontSize: '1.15rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        border: '1px solid #fde68a',
                      }}
                    >
                      <span>🔒 2-Hr Cooling Active (Max ₹25,000)</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setTransferBeneficiary(b.account_number);
                    setActiveModal('transfer');
                  }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    padding: '0.9rem',
                    borderRadius: '0.8rem',
                    fontSize: '1.3rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                  }}
                >
                  Pay Now →
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================
          PHASE 2: TERM DEPOSITS (FD / RD) & CALCULATOR
          ======================================================== */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '1.4rem',
          padding: '3.5rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          marginBottom: '3.5rem',
        }}
      >
        <div style={{ marginBottom: '2.5rem' }}>
          <span style={{ background: '#f0fdf4', color: '#15803d', padding: '0.4rem 1.2rem', borderRadius: '9999px', fontSize: '1.2rem', fontWeight: 700, border: '1px solid #bbf7d0' }}>
            High Yield Wealth • Up to 8.10% p.a.
          </span>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0f172a', marginTop: '0.8rem' }}>
            Term Deposits & Smart Saver (FD / RD)
          </h2>
          <p style={{ fontSize: '1.4rem', color: '#64748b', marginTop: '0.3rem' }}>
            Lock your surplus capital into guaranteed compound interest deposits or liquidate anytime with instant credit.
          </p>
        </div>

        {/* Interactive Deposit Calculator */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '1.2rem',
            padding: '3rem',
            marginBottom: '3rem',
            display: 'grid',
            gridTemplateColumns: '1.3fr 1fr',
            gap: '3rem',
            alignItems: 'center',
          }}
        >
          {/* Controls */}
          <div>
            {/* Type selector */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <button
                type="button"
                onClick={() => setFdType('Fixed Deposit')}
                style={{
                  background: fdType === 'Fixed Deposit' ? '#0f172a' : '#ffffff',
                  color: fdType === 'Fixed Deposit' ? '#ffffff' : '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.8rem',
                  padding: '0.8rem 1.6rem',
                  fontSize: '1.3rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Fixed Deposit (Cumulative)
              </button>
              <button
                type="button"
                onClick={() => setFdType('Recurring Deposit')}
                style={{
                  background: fdType === 'Recurring Deposit' ? '#0f172a' : '#ffffff',
                  color: fdType === 'Recurring Deposit' ? '#ffffff' : '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.8rem',
                  padding: '0.8rem 1.6rem',
                  fontSize: '1.3rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Recurring Deposit (Monthly)
              </button>
            </div>

            {/* Principal Amount Slider */}
            <div style={{ marginBottom: '2.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                <label style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>
                  {fdType === 'Recurring Deposit' ? 'Monthly Deposit Amount (₹)' : 'Deposit Principal Amount (₹)'}
                </label>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2563eb' }}>
                  ₹{fdAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min="5000"
                max="500000"
                step="5000"
                value={fdAmount}
                onChange={(e) => setFdAmount(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: '#2563eb' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                <span>₹5,000</span>
                <span>₹2,50,000</span>
                <span>₹5,00,000</span>
              </div>
            </div>

            {/* Tenure Options */}
            <div>
              <label style={{ display: 'block', fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
                Tenure Duration:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                {[
                  { m: 3, label: '3 Months', rate: '6.25%' },
                  { m: 6, label: '6 Months', rate: '6.75%' },
                  { m: 12, label: '1 Year', rate: '7.50%' },
                  { m: 36, label: '3 Years', rate: '7.75%' },
                  { m: 60, label: '5 Years', rate: '8.10%' },
                ].map((item) => (
                  <button
                    key={item.m}
                    type="button"
                    onClick={() => setFdTenure(item.m)}
                    style={{
                      background: fdTenure === item.m ? '#eff6ff' : '#ffffff',
                      border: fdTenure === item.m ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      borderRadius: '0.8rem',
                      padding: '1rem 0.6rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{item.label}</div>
                    <div style={{ fontSize: '1.15rem', color: '#2563eb', fontWeight: 600, marginTop: '0.2rem' }}>{item.rate}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Calculator Output Projection */}
          <div
            style={{
              background: '#0f172a',
              borderRadius: '1.2rem',
              padding: '2.8rem',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '2rem',
            }}
          >
            <div>
              <span style={{ fontSize: '1.2rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                Projected Maturity Value
              </span>
              <div style={{ fontSize: '3.6rem', fontWeight: 800, color: '#4ade80', margin: '0.6rem 0 1.4rem 0' }}>
                ₹{calculateFdMaturity(fdAmount, fdTenure, getFdRate(fdTenure)).toLocaleString('en-IN')}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.4rem', borderTop: '1px solid #334155', paddingTop: '1.6rem' }}>
                <div>
                  <div style={{ fontSize: '1.15rem', color: '#94a3b8' }}>Interest Earned</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff', marginTop: '0.2rem' }}>
                    +₹{(calculateFdMaturity(fdAmount, fdTenure, getFdRate(fdTenure)) - fdAmount).toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '1.15rem', color: '#94a3b8' }}>Annual Interest Rate</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#60a5fa', marginTop: '0.2rem' }}>
                    {getFdRate(fdTenure)}% p.a.
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveModal('book_deposit')}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.8rem',
                padding: '1.3rem',
                fontSize: '1.45rem',
                fontWeight: 700,
                cursor: 'pointer',
                width: '100%',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
              }}
            >
              Book {fdType} Now →
            </button>
          </div>
        </div>

        {/* Active Deposits Portfolio List */}
        <div>
          <h3 style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.6rem' }}>
            My Active Deposit Portfolio ({deposits.length})
          </h3>

          {deposits.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '1.4rem', border: '1px dashed #cbd5e1', borderRadius: '1rem' }}>
              No active deposits booked yet. Use the calculator above to start earning up to 8.10% p.a.!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(32rem, 1fr))', gap: '2rem' }}>
              {deposits.map((dep) => {
                const isLiquidated = dep.status === 'Liquidated';
                return (
                  <div
                    key={dep.deposit_id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '1.2rem',
                      padding: '2.4rem',
                      background: isLiquidated ? '#f8fafc' : '#ffffff',
                      boxShadow: isLiquidated ? 'none' : '0 2px 6px rgba(15, 23, 42, 0.04)',
                      opacity: isLiquidated ? 0.7 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '1.6rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                          {dep.deposit_id}
                        </span>
                        <span
                          style={{
                            background: isLiquidated ? '#f1f5f9' : '#f0fdf4',
                            color: isLiquidated ? '#64748b' : '#15803d',
                            fontSize: '1.15rem',
                            fontWeight: 700,
                            padding: '0.3rem 0.9rem',
                            borderRadius: '9999px',
                            border: `1px solid ${isLiquidated ? '#e2e8f0' : '#bbf7d0'}`,
                          }}
                        >
                          {dep.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem' }}>
                        {dep.deposit_type}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '1.3rem', color: '#475569', marginTop: '1.2rem' }}>
                        <div>
                          <span style={{ fontSize: '1.1rem', color: '#94a3b8' }}>Principal</span>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>₹{Number(dep.principal_amount).toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '1.1rem', color: '#94a3b8' }}>Interest Rate</span>
                          <div style={{ fontWeight: 700, color: '#2563eb' }}>{dep.interest_rate}% p.a.</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '1.1rem', color: '#94a3b8' }}>Maturity Date</span>
                          <div style={{ fontWeight: 600 }}>{dep.maturity_date}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '1.1rem', color: '#94a3b8' }}>Maturity Value</span>
                          <div style={{ fontWeight: 800, color: '#15803d' }}>₹{Number(dep.maturity_amount).toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                    </div>

                    {!isLiquidated && (
                      <button
                        onClick={() => {
                          setSelectedDepositForBreak(dep);
                          setActiveModal('break_deposit');
                        }}
                        style={{
                          background: '#fff1f2',
                          color: '#e11d48',
                          border: '1px solid #fecdd3',
                          padding: '0.8rem',
                          borderRadius: '0.6rem',
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          width: '100%',
                          textAlign: 'center',
                        }}
                      >
                        Premature Liquidation (Break FD)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Flagship Tier-1: Interactive Spending Analytics & Cash Flow Intelligence Hub */}
      <SpendingAnalyticsHub
        transactions={transactions}
        activeAccount={activeAccount}
        totalBalance={accounts.reduce((acc, a) => acc + Number(a.balance || 0), 0)}
        onOpenDepositModal={() => setActiveModal('book_deposit')}
        onOpenUpiModal={() => setActiveModal('upi')}
      />

      {/* Transaction History Ledger Section */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '1.4rem',
          padding: '3.5rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.8rem', marginBottom: '2.8rem' }}>
          <div>
            <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a' }}>
              {t('Recent Transactions Ledger')}
            </h2>
            <p style={{ fontSize: '1.4rem', color: '#64748b', marginTop: '0.4rem' }}>
              Audited transaction stream for {activeAccount?.account_number}
            </p>
          </div>

          {/* Search & Tabs */}
          <div style={{ display: 'flex', gap: '1.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.4rem', borderRadius: '0.8rem', gap: '0.4rem', border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setTxnTab('all')}
                style={{
                  background: txnTab === 'all' ? '#ffffff' : 'transparent',
                  color: txnTab === 'all' ? '#0f172a' : '#64748b',
                  fontWeight: 600,
                  fontSize: '1.35rem',
                  padding: '0.7rem 1.6rem',
                  borderRadius: '0.6rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: txnTab === 'all' ? '0 1px 3px rgba(15, 23, 42, 0.06)' : 'none',
                }}
              >
                {t('All Transactions')}
              </button>
              <button
                onClick={() => setTxnTab('credit')}
                style={{
                  background: txnTab === 'credit' ? '#ffffff' : 'transparent',
                  color: txnTab === 'credit' ? '#15803d' : '#64748b',
                  fontWeight: 600,
                  fontSize: '1.35rem',
                  padding: '0.7rem 1.6rem',
                  borderRadius: '0.6rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: txnTab === 'credit' ? '0 1px 3px rgba(15, 23, 42, 0.06)' : 'none',
                }}
              >
                {t('Credits (Inward)')}
              </button>
              <button
                onClick={() => setTxnTab('debit')}
                style={{
                  background: txnTab === 'debit' ? '#ffffff' : 'transparent',
                  color: txnTab === 'debit' ? '#b91c1c' : '#64748b',
                  fontWeight: 600,
                  fontSize: '1.35rem',
                  padding: '0.7rem 1.6rem',
                  borderRadius: '0.6rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: txnTab === 'debit' ? '0 1px 3px rgba(15, 23, 42, 0.06)' : 'none',
                }}
              >
                {t('Debits (Outward)')}
              </button>
            </div>

            <input
              type="text"
              placeholder="Search description, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ width: '24rem', padding: '0.8rem 1.4rem', fontSize: '1.35rem', borderColor: '#e2e8f0' }}
            />
          </div>
        </div>

        {/* Transactions Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1.35rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#0f172a' }}>
                <th style={{ padding: '1.4rem 1.8rem' }}>{t('Date & Time')}</th>
                <th style={{ padding: '1.4rem 1.8rem' }}>{t('Txn ID')}</th>
                <th style={{ padding: '1.4rem 1.8rem' }}>{t('Description')}</th>
                <th style={{ padding: '1.4rem 1.8rem' }}>{t('Type')}</th>
                <th style={{ padding: '1.4rem 1.8rem' }}>{t('Counterparty / Account')}</th>
                <th style={{ padding: '1.4rem 1.8rem', textAlign: 'right' }}>{t('Amount')}</th>
                <th style={{ padding: '1.4rem 1.8rem', textAlign: 'center' }}>{t('Status')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '5rem', textAlign: 'center', color: '#64748b', fontSize: '1.45rem' }}>
                    No transaction records matching your filters.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((txn) => {
                  const isCredit = txn.flow === 'Credit' || txn.type === 'Deposit';
                  const counterparty = isCredit
                    ? txn.sender_account || 'Bharat Trust Bank'
                    : txn.receiver_account || 'ATM Terminal';

                  return (
                    <tr key={txn.transaction_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1.6rem 1.8rem', color: '#64748b' }}>
                        {txn.date_time}
                      </td>
                      <td style={{ padding: '1.6rem 1.8rem', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                        {txn.transaction_id}
                      </td>
                      <td style={{ padding: '1.6rem 1.8rem', fontWeight: 600, color: '#0f172a' }}>
                        {txn.description}
                      </td>
                      <td style={{ padding: '1.6rem 1.8rem' }}>
                        <span
                          style={{
                            background: isCredit ? '#f0fdf4' : '#fef2f2',
                            color: isCredit ? '#15803d' : '#b91c1c',
                            padding: '0.4rem 1rem',
                            borderRadius: '0.6rem',
                            fontSize: '1.2rem',
                            fontWeight: 600,
                            border: `1px solid ${isCredit ? '#bbf7d0' : '#fecaca'}`,
                          }}
                        >
                          {txn.type} ({txn.flow || (isCredit ? 'Credit' : 'Debit')})
                        </span>
                      </td>
                      <td style={{ padding: '1.6rem 1.8rem', color: '#475569', fontWeight: 500 }}>
                        {counterparty}
                      </td>
                      <td
                        style={{
                          padding: '1.6rem 1.8rem',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: isCredit ? '#15803d' : '#b91c1c',
                          fontSize: '1.5rem',
                        }}
                      >
                        {isCredit ? '+' : '-'}₹{Number(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '1.6rem 1.8rem', textAlign: 'center' }}>
                        <span
                          style={{
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '0.3rem 0.9rem',
                            borderRadius: '9999px',
                            fontSize: '1.15rem',
                            fontWeight: 600,
                            border: '1px solid #bfdbfe',
                          }}
                        >
                          {txn.status || 'Success'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================
          MODALS
          ======================================================== */}
      {activeModal && activeModal !== 'upi' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '2rem',
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '1.4rem',
              padding: '3.5rem',
              width: '100%',
              maxWidth: '56rem',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 16px 40px rgba(15, 23, 42, 0.12)',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.4rem' }}>
              <h3 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a' }}>
                {activeModal === 'transfer' && t('Instant Transfer')}
                {activeModal === 'deposit' && t('Deposit Funds')}
                {activeModal === 'withdraw' && t('ATM Cashout')}
                {activeModal === 'add_beneficiary' && 'Add Registered Beneficiary'}
                {activeModal === 'book_deposit' && `Book ${fdType}`}
                {activeModal === 'open_account' && 'Open Additional Banking Account'}
                {activeModal === 'break_deposit' && 'Premature Deposit Liquidation'}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '2.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Transfer Modal Form */}
            {activeModal === 'transfer' && (
              <form onSubmit={handleTransfer} className="netbanking-form">
                <div className="form-group">
                  <label className="form-label">Select Registered Payee or Enter Account Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ACC-553102"
                    value={transferBeneficiary}
                    onChange={(e) => setTransferBeneficiary(e.target.value)}
                    required
                  />

                  {/* Registered Beneficiaries Quick Chips */}
                  {beneficiaries.length > 0 && (
                    <div style={{ marginTop: '0.8rem' }}>
                      <span style={{ fontSize: '1.15rem', color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>
                        Quick Select Saved Payee:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                        {beneficiaries
                          .filter((b) => b.account_number !== activeAccount?.account_number)
                          .map((b) => (
                            <button
                              key={b.account_number}
                              type="button"
                              onClick={() => setTransferBeneficiary(b.account_number)}
                              style={{
                                background: transferBeneficiary === b.account_number ? '#0f172a' : '#f1f5f9',
                                color: transferBeneficiary === b.account_number ? '#ffffff' : '#0f172a',
                                border: '1px solid #cbd5e1',
                                padding: '0.4rem 1rem',
                                borderRadius: '0.6rem',
                                fontSize: '1.2rem',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              {b.beneficiary_name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Cooling warning if selected payee is cooling */}
                  {(() => {
                    const foundBen = beneficiaries.find((b) => b.account_number === transferBeneficiary.trim());
                    if (foundBen && isCoolingActive(foundBen.cooling_until)) {
                      return (
                        <div style={{ marginTop: '0.8rem', background: '#fef3c7', color: '#92400e', padding: '0.8rem', borderRadius: '0.6rem', fontSize: '1.2rem', border: '1px solid #fde68a' }}>
                          ⚠️ Security Cooling Active for {foundBen.beneficiary_name}: Transfers are capped at ₹25,000 during this 2-hour window.
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="form-group">
                  <label className="form-label">Transfer Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    max="500000"
                    step="0.01"
                    className="form-input"
                    placeholder="e.g. 5000"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Remarks</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Monthly rent / Consultant fee"
                    value={transferRemarks}
                    onChange={(e) => setTransferRemarks(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Authorize with 4-Digit Debit Card PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    className="form-input"
                    placeholder="Enter 4-digit Debit Card PIN (default 1234)"
                    value={transferPin}
                    onChange={(e) => setTransferPin(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    marginTop: '1.4rem',
                    padding: '1.3rem',
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    borderRadius: '0.8rem',
                    border: 'none',
                    width: '100%',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.1)',
                  }}
                >
                  {actionLoading ? 'Processing Transfer...' : 'Confirm IMPS Transfer →'}
                </button>
              </form>
            )}

            {/* Deposit Modal Form */}
            {activeModal === 'deposit' && (
              <form onSubmit={handleDeposit} className="netbanking-form">
                <div className="form-group">
                  <label className="form-label">Receiving Account</label>
                  <input
                    type="text"
                    disabled
                    className="form-input"
                    value={`${activeAccount?.account_number} (${activeAccount?.account_type})`}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Deposit Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    max="500000"
                    step="0.01"
                    className="form-input"
                    placeholder="e.g. 25000"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Deposit Source / Note</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Branch Cheque / Inward remittance"
                    value={depositRemarks}
                    onChange={(e) => setDepositRemarks(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Authorize with 4-Digit Debit Card PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    className="form-input"
                    placeholder="Enter 4-digit Debit Card PIN (default 1234)"
                    value={depositPin}
                    onChange={(e) => setDepositPin(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    marginTop: '1.4rem',
                    padding: '1.3rem',
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    borderRadius: '0.8rem',
                    border: 'none',
                    width: '100%',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.1)',
                  }}
                >
                  {actionLoading ? 'Processing Deposit...' : 'Confirm Cash Deposit →'}
                </button>
              </form>
            )}

            {/* Withdrawal Modal Form */}
            {activeModal === 'withdraw' && (
              <form onSubmit={handleWithdraw} className="netbanking-form">
                <div className="form-group">
                  <label className="form-label">Debit Source Account</label>
                  <input
                    type="text"
                    disabled
                    className="form-input"
                    value={`${activeAccount?.account_number} (Avail: ₹${parseFloat((activeAccount?.balance || 0).toString()).toLocaleString('en-IN')})`}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Cashout Amount (₹) (Max ₹50,000 per txn)</label>
                  <input
                    type="number"
                    min="1"
                    max="50000"
                    step="100"
                    className="form-input"
                    placeholder="e.g. 2000"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">ATM Terminal Reference</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Nariman Point ATM #04"
                    value={withdrawRemarks}
                    onChange={(e) => setWithdrawRemarks(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Authorize with 4-Digit Debit Card ATM PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    className="form-input"
                    placeholder="Enter 4-digit Debit Card PIN (default 1234)"
                    value={withdrawPin}
                    onChange={(e) => setWithdrawPin(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    marginTop: '1.4rem',
                    padding: '1.3rem',
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    borderRadius: '0.8rem',
                    border: 'none',
                    width: '100%',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.1)',
                  }}
                >
                  {actionLoading ? 'Dispensing Cash...' : 'Confirm Cash Withdrawal →'}
                </button>
              </form>
            )}

            {/* Add Beneficiary Modal Form */}
            {activeModal === 'add_beneficiary' && (
              <form onSubmit={handleAddBeneficiary} className="netbanking-form">
                <div className="form-group">
                  <label className="form-label">Payee Full Legal Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Vikramaditya Sharma"
                    value={newBenName}
                    onChange={(e) => setNewBenName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Beneficiary Account Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ACC-442991"
                    value={newBenAcc}
                    onChange={(e) => setNewBenAcc(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Account Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Re-enter account number"
                    value={newBenConfirmAcc}
                    onChange={(e) => setNewBenConfirmAcc(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.4rem' }}>
                  <div className="form-group">
                    <label className="form-label">IFSC Code</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. BTBI0001024"
                      value={newBenIfsc}
                      onChange={(e) => setNewBenIfsc(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bank Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Bharat Trust Bank"
                      value={newBenBank}
                      onChange={(e) => setNewBenBank(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Daily IMPS/NEFT Transfer Limit (₹)</label>
                  <input
                    type="number"
                    min="1000"
                    max="500000"
                    className="form-input"
                    value={newBenLimit}
                    onChange={(e) => setNewBenLimit(e.target.value)}
                    required
                  />
                </div>

                <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '0.8rem', fontSize: '1.2rem', color: '#64748b', marginBottom: '1.4rem', border: '1px solid #e2e8f0' }}>
                  🔒 <strong>Regulatory Notice:</strong> Under RBI guidelines, a newly registered beneficiary is subject to a 2-hour cooling period where total transfers are capped at ₹25,000.
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    padding: '1.3rem',
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    borderRadius: '0.8rem',
                    border: 'none',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                >
                  {actionLoading ? 'Registering Payee...' : 'Save Beneficiary Details →'}
                </button>
              </form>
            )}

            {/* Book Deposit Confirmation Modal Form */}
            {activeModal === 'book_deposit' && (
              <form onSubmit={handleBookDeposit} className="netbanking-form">
                <div style={{ background: '#f8fafc', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '1.3rem', color: '#64748b', marginBottom: '0.4rem' }}>Booking Summary:</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.2rem' }}>
                    ₹{fdAmount.toLocaleString('en-IN')} in {fdType}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '1.3rem' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Tenure:</span> <strong>{fdTenure} Months</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Interest Rate:</span> <strong style={{ color: '#2563eb' }}>{getFdRate(fdTenure)}% p.a.</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Maturity Amount:</span> <strong style={{ color: '#15803d' }}>₹{calculateFdMaturity(fdAmount, fdTenure, getFdRate(fdTenure)).toLocaleString('en-IN')}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Debit Source:</span> <strong>{activeAccount?.account_number}</strong>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Authorize with 4-Digit Debit Card PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    className="form-input"
                    placeholder="Enter 4-digit Debit Card PIN (default 1234)"
                    value={fdPin}
                    onChange={(e) => setFdPin(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    backgroundColor: '#15803d',
                    color: '#ffffff',
                    marginTop: '1.4rem',
                    padding: '1.3rem',
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    borderRadius: '0.8rem',
                    border: 'none',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                >
                  {actionLoading ? 'Allocating Deposit...' : `Confirm & Lock ₹${fdAmount.toLocaleString('en-IN')} Deposit →`}
                </button>
              </form>
            )}

            {/* Premature Liquidation Modal */}
            {activeModal === 'break_deposit' && selectedDepositForBreak && (
              <form onSubmit={handleBreakDeposit} className="netbanking-form">
                <div style={{ background: '#fff1f2', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem', border: '1px solid #fecdd3' }}>
                  <div style={{ fontSize: '1.3rem', color: '#9f1239', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Premature Liquidation Warning:
                  </div>
                  <p style={{ fontSize: '1.3rem', color: '#be123c', lineHeight: 1.5 }}>
                    Closing certificate <strong>{selectedDepositForBreak.deposit_id}</strong> before its maturity date ({selectedDepositForBreak.maturity_date}) incurs a 0.50% premature withdrawal penalty on the accrued interest.
                  </p>
                  <div style={{ marginTop: '1.4rem', fontSize: '1.4rem', color: '#0f172a' }}>
                    Refund destination: <strong>{selectedDepositForBreak.linked_account}</strong>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Authorize Liquidation with 4-Digit Debit Card PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    className="form-input"
                    placeholder="Enter 4-digit PIN (default 1234)"
                    value={fdPin}
                    onChange={(e) => setFdPin(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    backgroundColor: '#e11d48',
                    color: '#ffffff',
                    marginTop: '1.4rem',
                    padding: '1.3rem',
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    borderRadius: '0.8rem',
                    border: 'none',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                >
                  {actionLoading ? 'Crediting Funds...' : 'Liquidate Deposit & Refund Principal →'}
                </button>
              </form>
            )}

            {/* Open Additional Account Modal Form */}
            {activeModal === 'open_account' && (
              <form onSubmit={handleOpenAdditionalAccount} className="netbanking-form">
                <div className="form-group">
                  <label className="form-label">Select Account Type to Open:</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.6rem' }}>
                    {[
                      { type: 'Current Account' as const, name: 'BTB Corporate Current Account', desc: 'Overdraft ready, unlimited transactions for business & freelancing (₹25,000 opening grant)' },
                      { type: 'Salary Account' as const, name: 'BTB Corporate Salary Account', desc: 'Zero minimum balance, auto-sweep to FD, personal loan pre-approval (₹10,000 opening grant)' },
                      { type: 'Student Savings' as const, name: 'BTB Smart Student Saver', desc: 'Custom student cashbacks, zero balance, budget micro-savings locks (₹10,000 opening grant)' },
                      { type: 'Savings Account' as const, name: 'BTB Platinum Advantage Savings', desc: 'High yield 7.25% p.a., free airport lounge access, priority relationship manager' },
                    ].map((plan) => (
                      <div
                        key={plan.type}
                        onClick={() => setNewAccType(plan.type)}
                        style={{
                          border: newAccType === plan.type ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          background: newAccType === plan.type ? '#eff6ff' : '#ffffff',
                          borderRadius: '1rem',
                          padding: '1.4rem',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a' }}>{plan.name}</div>
                        <div style={{ fontSize: '1.2rem', color: '#64748b', marginTop: '0.3rem' }}>{plan.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Branch Allotment</label>
                  <select
                    className="form-input"
                    value={newAccBranch}
                    onChange={(e) => setNewAccBranch(e.target.value)}
                  >
                    <option value="Mumbai Nariman Point Hub">Mumbai Nariman Point Hub (BTBI0001024)</option>
                    <option value="Bengaluru MG Road Branch">Bengaluru MG Road Branch (BTBI0002018)</option>
                    <option value="Delhi Connaught Place Branch">Delhi Connaught Place Branch (BTBI0003055)</option>
                    <option value="Pune Camp Central Branch">Pune Camp Central Branch (BTBI0004011)</option>
                    <option value="Ahmedabad SG Highway Hub">Ahmedabad SG Highway Hub (BTBI0005089)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Authorize with 4-Digit Debit Card PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    className="form-input"
                    placeholder="Enter 4-digit PIN (default 1234)"
                    value={newAccPin}
                    onChange={(e) => setNewAccPin(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    marginTop: '1.4rem',
                    padding: '1.3rem',
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    borderRadius: '0.8rem',
                    border: 'none',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                >
                  {actionLoading ? 'Creating Account...' : 'Open Account Now →'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Flagship Tier-1: UPI Payment & QR Hub Modal */}
      <UpiPaymentModal
        isOpen={activeModal === 'upi'}
        onClose={() => setActiveModal(null)}
        activeAccount={activeAccount}
        customer={customer}
        onPaymentReceived={async () => {
          await reloadData();
        }}
      />

      {/* Flagship Tier-1: AI Banking Co-Pilot Assistant */}
      <AiBankingCopilot
        customer={customer}
        activeAccount={activeAccount}
        onOpenModal={(modalName) => setActiveModal(modalName)}
      />
    </div>
  );
}
