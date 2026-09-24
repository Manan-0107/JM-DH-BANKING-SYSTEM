'use client';

import React, { useState } from 'react';
import { Account, Customer } from '@/types';
import { useToast } from './Providers';

interface UpiPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAccount: Account | null;
  customer: Customer | null;
  onPaymentReceived: (newBalance: number) => void;
}

export default function UpiPaymentModal({
  isOpen,
  onClose,
  activeAccount,
  customer,
  onPaymentReceived,
}: UpiPaymentModalProps) {
  const { showToast } = useToast();

  const [tab, setTab] = useState<'receive' | 'pay'>('receive');

  // Receive / QR state
  const [requestAmount, setRequestAmount] = useState<string>('');
  const [requestNote, setRequestNote] = useState<string>('Personal payment');
  const [simulating, setSimulating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pay VPA state
  const [payVpa, setPayVpa] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [payPin, setPayPin] = useState('');
  const [paying, setPaying] = useState(false);

  if (!isOpen || !activeAccount) return null;

  const defaultVpa = `${(customer?.full_name || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')}@btb`;

  const amountNumber = parseFloat(requestAmount) || 0;
  const upiUri = `upi://pay?pa=${defaultVpa}&pn=${encodeURIComponent(
    customer?.full_name || 'Bharat Trust Customer'
  )}&cu=INR&tn=${encodeURIComponent(requestNote || 'Payment')}${
    amountNumber > 0 ? `&am=${amountNumber.toFixed(2)}` : ''
  }`;

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(defaultVpa);
    setCopied(true);
    showToast(`UPI ID copied: ${defaultVpa}`, 'info');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSimulateInwardPayment = async (customAmt?: number) => {
    const amt = customAmt || amountNumber || 1500;
    setSimulating(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/upi/simulate-receive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          account_number: activeAccount.account_number,
          amount: amt,
          payer_vpa: 'priya.nair@okhdfcbank',
          payer_name: 'Priya Nair',
          remarks: requestNote || 'UPI Scan & Pay',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'UPI simulation failed');

      showToast(`⚡ ${data.message} (UTR: ${data.utr})`, 'success');
      onPaymentReceived(data.new_balance);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Error processing simulated UPI payment', 'error');
    } finally {
      setSimulating(false);
    }
  };

  const handleOutwardUpiPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payVpa || !payAmount || !payPin) {
      showToast('Please fill all required UPI fields', 'error');
      return;
    }

    setPaying(true);
    try {
      const token = localStorage.getItem('token');
      // Look up target account or mock transfer to account
      const res = await fetch('/api/accounts/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          from_account: activeAccount.account_number,
          to_account: 'ACC-553102', // Standard demo beneficiary
          amount: parseFloat(payAmount),
          description: `UPI Outward to ${payVpa} - ${payRemarks || 'Transfer'}`,
          pin: payPin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(`UPI Transfer of ₹${parseFloat(payAmount).toLocaleString('en-IN')} to ${payVpa} successful!`, 'success');
      onPaymentReceived(activeAccount.balance - parseFloat(payAmount));
      onClose();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1.6rem',
          maxWidth: '52rem',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '2.4rem 2.8rem 1.6rem 2.8rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
            <div
              style={{
                width: '4rem',
                height: '4rem',
                borderRadius: '1rem',
                background: 'linear-gradient(135deg, #0f172a 0%, #2563eb 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.6rem',
              }}
            >
              UPI
            </div>
            <div>
              <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                Unified Payments Interface (UPI)
              </h2>
              <span style={{ fontSize: '1.2rem', color: '#64748b' }}>
                Instant 24x7 Real-Time Interbank Payments • NPCI Certified
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '0.8rem',
              width: '3.2rem',
              height: '3.2rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontSize: '1.6rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', padding: '0 2.8rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button
            onClick={() => setTab('receive')}
            style={{
              flex: 1,
              padding: '1.3rem',
              border: 'none',
              background: 'none',
              fontSize: '1.4rem',
              fontWeight: 700,
              color: tab === 'receive' ? '#2563eb' : '#64748b',
              borderBottom: tab === 'receive' ? '2.5px solid #2563eb' : '2.5px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>My QR & Request Money</span>
          </button>

          <button
            onClick={() => setTab('pay')}
            style={{
              flex: 1,
              padding: '1.3rem',
              border: 'none',
              background: 'none',
              fontSize: '1.4rem',
              fontWeight: 700,
              color: tab === 'pay' ? '#2563eb' : '#64748b',
              borderBottom: tab === 'pay' ? '2.5px solid #2563eb' : '2.5px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            <span>Pay to Any UPI VPA</span>
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: '2.4rem 2.8rem' }}>
          {tab === 'receive' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* QR Code Container Card */}
              <div
                style={{
                  background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
                  borderRadius: '1.4rem',
                  border: '1px solid #e2e8f0',
                  padding: '2.4rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                }}
              >
                {/* BHIM UPI Branding */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.8rem',
                    marginBottom: '1.4rem',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  <span style={{ color: '#ea580c', fontWeight: 900 }}>BHIM</span>
                  <span style={{ color: '#2563eb' }}>UPI 2.0</span>
                  <span style={{ color: '#94a3b8' }}>•</span>
                  <span>Bharat Trust Bank</span>
                </div>

                {/* Pure SVG Scalable QR Code with Finder Patterns */}
                <div
                  style={{
                    background: '#ffffff',
                    padding: '1.6rem',
                    borderRadius: '1.2rem',
                    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
                    border: '1px solid #cbd5e1',
                    position: 'relative',
                  }}
                >
                  <svg width="180" height="180" viewBox="0 0 180 180">
                    {/* Background */}
                    <rect width="180" height="180" fill="#ffffff" />

                    {/* Top-Left Finder Pattern */}
                    <rect x="12" y="12" width="46" height="46" rx="6" fill="#0f172a" />
                    <rect x="20" y="20" width="30" height="30" rx="3" fill="#ffffff" />
                    <rect x="26" y="26" width="18" height="18" rx="2" fill="#2563eb" />

                    {/* Top-Right Finder Pattern */}
                    <rect x="122" y="12" width="46" height="46" rx="6" fill="#0f172a" />
                    <rect x="130" y="20" width="30" height="30" rx="3" fill="#ffffff" />
                    <rect x="136" y="26" width="18" height="18" rx="2" fill="#2563eb" />

                    {/* Bottom-Left Finder Pattern */}
                    <rect x="12" y="122" width="46" height="46" rx="6" fill="#0f172a" />
                    <rect x="20" y="130" width="30" height="30" rx="3" fill="#ffffff" />
                    <rect x="26" y="136" width="18" height="18" rx="2" fill="#2563eb" />

                    {/* QR Simulated Matrix Grid */}
                    <rect x="70" y="16" width="10" height="10" rx="1.5" fill="#0f172a" />
                    <rect x="94" y="16" width="10" height="10" rx="1.5" fill="#0f172a" />
                    <rect x="82" y="28" width="10" height="10" rx="1.5" fill="#2563eb" />
                    <rect x="106" y="28" width="8" height="8" rx="1.5" fill="#0f172a" />

                    <rect x="16" y="70" width="10" height="10" rx="1.5" fill="#0f172a" />
                    <rect x="28" y="82" width="10" height="10" rx="1.5" fill="#2563eb" />
                    <rect x="16" y="94" width="10" height="10" rx="1.5" fill="#0f172a" />

                    <rect x="68" y="68" width="44" height="44" rx="8" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
                    {/* BTB Center Logo */}
                    <text x="90" y="94" textAnchor="middle" fill="#1d4ed8" fontSize="13" fontWeight="900" fontFamily="sans-serif">
                      BTB
                    </text>

                    <rect x="124" y="70" width="8" height="8" rx="1" fill="#0f172a" />
                    <rect x="144" y="82" width="12" height="12" rx="1.5" fill="#0f172a" />
                    <rect x="134" y="100" width="10" height="10" rx="1" fill="#2563eb" />
                    <rect x="156" y="94" width="8" height="8" rx="1" fill="#0f172a" />

                    <rect x="70" y="122" width="10" height="10" rx="1.5" fill="#0f172a" />
                    <rect x="94" y="122" width="12" height="12" rx="1.5" fill="#2563eb" />
                    <rect x="82" y="144" width="10" height="10" rx="1" fill="#0f172a" />
                    <rect x="106" y="144" width="8" height="8" rx="1" fill="#0f172a" />

                    <rect x="124" y="124" width="10" height="10" rx="1" fill="#0f172a" />
                    <rect x="144" y="136" width="12" height="12" rx="1.5" fill="#0f172a" />
                    <rect x="132" y="154" width="8" height="8" rx="1" fill="#2563eb" />
                    <rect x="154" y="150" width="12" height="12" rx="1.5" fill="#0f172a" />
                  </svg>
                </div>

                {/* UPI ID Copy Strip */}
                <div
                  style={{
                    marginTop: '1.6rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.8rem',
                    padding: '0.8rem 1.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.2rem',
                  }}
                >
                  <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                    {defaultVpa}
                  </span>
                  <button
                    onClick={handleCopyVpa}
                    style={{
                      background: copied ? '#dcfce7' : '#eff6ff',
                      color: copied ? '#15803d' : '#2563eb',
                      border: '1px solid ' + (copied ? '#86efac' : '#bfdbfe'),
                      borderRadius: '0.6rem',
                      padding: '0.4rem 0.9rem',
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>

                <span style={{ fontSize: '1.15rem', color: '#64748b', marginTop: '0.6rem' }}>
                  Linked to {activeAccount.account_type} ({activeAccount.account_number})
                </span>
              </div>

              {/* Dynamic Amount Specification */}
              <div>
                <label style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '0.6rem' }}>
                  Specify Amount to Request (Optional)
                </label>
                <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1rem' }}>
                  {[500, 1000, 2500, 5000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRequestAmount(preset.toString())}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '1.2rem',
                        fontWeight: 600,
                        borderRadius: '0.6rem',
                        border: requestAmount === preset.toString() ? '1px solid #2563eb' : '1px solid #cbd5e1',
                        background: requestAmount === preset.toString() ? '#eff6ff' : '#ffffff',
                        color: requestAmount === preset.toString() ? '#1d4ed8' : '#334155',
                        cursor: 'pointer',
                      }}
                    >
                      ₹{preset.toLocaleString('en-IN')}
                    </button>
                  ))}
                  {requestAmount && (
                    <button
                      type="button"
                      onClick={() => setRequestAmount('')}
                      style={{
                        padding: '0.5rem 0.8rem',
                        fontSize: '1.1rem',
                        color: '#dc2626',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <input
                  type="number"
                  placeholder="Enter custom amount in ₹"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1rem 1.4rem',
                    fontSize: '1.35rem',
                    borderRadius: '0.8rem',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                    marginBottom: '1rem',
                  }}
                />

                <input
                  type="text"
                  placeholder="Transaction note (e.g. Dinner, Rent, Freelance fee)"
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1rem 1.4rem',
                    fontSize: '1.35rem',
                    borderRadius: '0.8rem',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Instant Simulation Action */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '1rem',
                  padding: '1.6rem',
                }}
              >
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#15803d', marginBottom: '0.4rem' }}>
                  🧪 Live UPI Sandbox Simulation
                </div>
                <p style={{ fontSize: '1.2rem', color: '#166534', marginBottom: '1.2rem', lineHeight: 1.5 }}>
                  Simulate an external Indian customer scanning your QR code or sending funds to <strong>{defaultVpa}</strong> right now. Your balance and ledger will update atomically.
                </p>

                <button
                  onClick={() => handleSimulateInwardPayment()}
                  disabled={simulating}
                  style={{
                    width: '100%',
                    background: '#15803d',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.8rem',
                    padding: '1.2rem',
                    fontSize: '1.35rem',
                    fontWeight: 700,
                    cursor: simulating ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.8rem',
                    boxShadow: '0 2px 6px rgba(21, 128, 61, 0.2)',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                  <span>
                    {simulating
                      ? 'Simulating UPI Inward Webhook...'
                      : `Simulate Receiving ${requestAmount ? `₹${parseFloat(requestAmount).toLocaleString('en-IN')}` : '₹1,500'} Now`}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Pay to UPI VPA Form */
            <form onSubmit={handleOutwardUpiPay} style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '0.8rem',
                  padding: '1.2rem',
                  fontSize: '1.25rem',
                  color: '#1d4ed8',
                }}
              >
                Sending from: <strong>{activeAccount.account_type} ({activeAccount.account_number})</strong>
                <div style={{ color: '#2563eb', marginTop: '0.2rem' }}>
                  Available Balance: ₹{Number(activeAccount.balance).toLocaleString('en-IN')}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '0.6rem' }}>
                  Recipient UPI ID / VPA *
                </label>
                <input
                  type="text"
                  placeholder="e.g. merchant@paytm, rohan@okaxis, priya@btb"
                  value={payVpa}
                  onChange={(e) => setPayVpa(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '1.1rem 1.4rem',
                    fontSize: '1.35rem',
                    borderRadius: '0.8rem',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '0.6rem' }}>
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  max="100000"
                  required
                  style={{
                    width: '100%',
                    padding: '1.1rem 1.4rem',
                    fontSize: '1.35rem',
                    borderRadius: '0.8rem',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: '1.1rem', color: '#64748b' }}>NPCI single transaction limit: ₹1,00,000</span>
              </div>

              <div>
                <label style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '0.6rem' }}>
                  Payment Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Grocery payment, Rent split"
                  value={payRemarks}
                  onChange={(e) => setPayRemarks(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1.1rem 1.4rem',
                    fontSize: '1.35rem',
                    borderRadius: '0.8rem',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '0.6rem' }}>
                  4-Digit NetBanking PIN *
                </label>
                <input
                  type="password"
                  placeholder="Enter default 1234"
                  maxLength={4}
                  value={payPin}
                  onChange={(e) => setPayPin(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '1.1rem 1.4rem',
                    fontSize: '1.35rem',
                    borderRadius: '0.8rem',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                    letterSpacing: '4px',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={paying}
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '1.3rem',
                  fontSize: '1.45rem',
                  fontWeight: 700,
                  borderRadius: '0.8rem',
                  border: 'none',
                  cursor: paying ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.8rem',
                  marginTop: '0.8rem',
                }}
              >
                {paying ? 'Authorizing UPI Transfer...' : 'CONFIRM & SEND UPI PAYMENT →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
