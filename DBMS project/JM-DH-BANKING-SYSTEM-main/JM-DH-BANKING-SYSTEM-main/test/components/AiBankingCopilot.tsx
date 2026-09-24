'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Customer, Account } from '@/types';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  insights?: { label: string; value: string; positive?: boolean }[];
  action?: {
    label: string;
    actionType: 'open_modal';
    modal: 'transfer' | 'book_deposit' | 'upi' | 'deposit';
    params?: any;
  };
  followUps?: string[];
  timestamp: string;
}

interface AiBankingCopilotProps {
  customer: Customer | null;
  activeAccount: Account | null;
  onOpenModal: (modal: any) => void;
}

export default function AiBankingCopilot({
  customer,
  activeAccount,
  onOpenModal,
}: AiBankingCopilotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: `Hello ${customer?.full_name ? customer.full_name.split(' ')[0] : 'there'}! I am your **BTB NetBanking Co-Pilot**.\n\nI have real-time access to your verified accounts, cash-flow run rate, and deposit rates. How can I assist your financial planning today?`,
      insights: [
        { label: 'Status', value: `${customer?.tier || 'Platinum'} Tier`, positive: true },
        { label: 'Primary Account', value: activeAccount?.account_number || 'Active', positive: true },
      ],
      followUps: [
        'Can I afford to lock ₹50,000 in a 1-year FD at 7.5%?',
        'What is my highest spending category this month?',
        'Forecast my projected month-end balance',
      ],
      timestamp: 'Just now',
    },
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (queryToSend?: string) => {
    const q = (queryToSend || inputQuery).trim();
    if (!q || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: q }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI Co-Pilot error');

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: data.reply,
        insights: data.insights,
        action: data.suggestedAction,
        followUps: data.suggestedFollowUps,
        timestamp: 'Just now',
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'assistant',
          text: `I apologize, but I could not reach the banking analytics engine: ${err.message}. Please try again shortly.`,
          timestamp: 'Just now',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Co-Pilot Action Button (Bottom Right) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '2.8rem',
            right: '2.8rem',
            zIndex: 999,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #2563eb 100%)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '9999px',
            padding: '1.2rem 2.2rem',
            boxShadow: '0 10px 25px rgba(15, 23, 42, 0.35)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          className="copilot-launcher-btn"
        >
          <div
            style={{
              width: '2.6rem',
              height: '2.6rem',
              borderRadius: '50%',
              background: '#ffffff',
              color: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '1.3rem',
            }}
          >
            ✦
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '0.3px', lineHeight: 1.1 }}>
              Ask BTB AI
            </span>
            <span style={{ fontSize: '1.05rem', color: '#93c5fd', fontWeight: 500 }}>
              Financial Co-Pilot
            </span>
          </div>
          <span
            style={{
              width: '0.8rem',
              height: '0.8rem',
              borderRadius: '50%',
              backgroundColor: '#4ade80',
              boxShadow: '0 0 8px #4ade80',
            }}
          ></span>
        </button>
      )}

      {/* Slide-Up Co-Pilot Drawer / Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '2.5rem',
            right: '2.5rem',
            width: '44rem',
            maxWidth: 'calc(100vw - 3rem)',
            height: '62rem',
            maxHeight: 'calc(100vh - 5rem)',
            backgroundColor: '#ffffff',
            borderRadius: '1.8rem',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
            border: '1px solid #cbd5e1',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              padding: '1.6rem 2rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #334155',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '3.4rem',
                  height: '3.4rem',
                  borderRadius: '0.8rem',
                  background: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.6rem',
                  fontWeight: 800,
                }}
              >
                ✦
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span>BTB Co-Pilot</span>
                  <span
                    style={{
                      background: '#1e3a8a',
                      color: '#93c5fd',
                      fontSize: '1rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '9999px',
                      border: '1px solid #3b82f6',
                    }}
                  >
                    AI ASSIST
                  </span>
                </div>
                <div style={{ fontSize: '1.15rem', color: '#94a3b8' }}>
                  Analyzing {activeAccount?.account_type || 'NetBanking'}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: 'none',
                color: '#cbd5e1',
                borderRadius: '0.6rem',
                width: '2.8rem',
                height: '2.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
              }}
            >
              ✕
            </button>
          </div>

          {/* Chat Messages Area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.6rem',
              background: '#f8fafc',
            }}
          >
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '100%',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: '1.2rem 1.6rem',
                      borderRadius: isUser ? '1.4rem 1.4rem 0.2rem 1.4rem' : '1.4rem 1.4rem 1.4rem 0.2rem',
                      background: isUser ? '#0f172a' : '#ffffff',
                      color: isUser ? '#ffffff' : '#0f172a',
                      fontSize: '1.3rem',
                      lineHeight: '1.6',
                      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)',
                      border: isUser ? 'none' : '1px solid #e2e8f0',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {msg.text}

                    {/* Insights Badges Grid */}
                    {msg.insights && msg.insights.length > 0 && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))',
                          gap: '0.6rem',
                          marginTop: '1.2rem',
                          paddingTop: '1rem',
                          borderTop: '1px solid #f1f5f9',
                        }}
                      >
                        {msg.insights.map((ins, i) => (
                          <div
                            key={i}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '0.6rem',
                              padding: '0.5rem 0.8rem',
                            }}
                          >
                            <div style={{ fontSize: '1rem', color: '#64748b' }}>{ins.label}</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: ins.positive ? '#15803d' : '#0f172a' }}>
                              {ins.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* One-Click Action Trigger */}
                    {msg.action && (
                      <div style={{ marginTop: '1.2rem' }}>
                        <button
                          onClick={() => {
                            if (msg.action?.modal) {
                              onOpenModal(msg.action.modal);
                            }
                          }}
                          style={{
                            background: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '0.6rem',
                            padding: '0.8rem 1.4rem',
                            fontSize: '1.2rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                          }}
                        >
                          <span>{msg.action.label} →</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Follow-up Prompts Chips */}
                  {msg.followUps && msg.followUps.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.8rem', maxWidth: '90%' }}>
                      {msg.followUps.map((prompt, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => handleSendMessage(prompt)}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '9999px',
                            padding: '0.4rem 1rem',
                            fontSize: '1.15rem',
                            color: '#1d4ed8',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s',
                          }}
                        >
                          ✦ {prompt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '1.2rem',
                  padding: '1rem 1.6rem',
                  fontSize: '1.25rem',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb' }}></div>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb' }}></div>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb' }}></div>
                </div>
                <span>Analyzing your financial profile...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar & Input Box */}
          <div
            style={{
              padding: '1.2rem 1.6rem 1.6rem 1.6rem',
              backgroundColor: '#ffffff',
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              style={{ display: 'flex', gap: '0.8rem' }}
            >
              <input
                type="text"
                placeholder="Ask about spending, FD yields, loans..."
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '1rem 1.4rem',
                  fontSize: '1.3rem',
                  borderRadius: '0.8rem',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={loading || !inputQuery.trim()}
                style={{
                  backgroundColor: inputQuery.trim() ? '#0f172a' : '#94a3b8',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.8rem',
                  padding: '0 1.6rem',
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  cursor: inputQuery.trim() ? 'pointer' : 'default',
                  transition: 'background 0.2s',
                }}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
