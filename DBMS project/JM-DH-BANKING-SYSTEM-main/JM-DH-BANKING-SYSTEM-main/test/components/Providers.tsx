'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { DICTIONARY, translateText } from '@/lib/dictionary';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface LanguageContextType {
  language: 'en' | 'hi';
  toggleLanguage: () => void;
  setLanguage: (lang: 'en' | 'hi') => void;
  t: (text: string) => string;
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  toggleLanguage: () => {},
  setLanguage: () => {},
  t: (text) => text,
});

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useToast() {
  return useContext(ToastContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [language, setLangState] = useState<'en' | 'hi'>('en');
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('userLanguage') as 'en' | 'hi';
    if (saved === 'hi' || saved === 'en') {
      setLangState(saved);
    }
  }, []);

  const setLanguage = (lang: 'en' | 'hi') => {
    setLangState(lang);
    localStorage.setItem('userLanguage', lang);
  };

  const toggleLanguage = () => {
    const next = language === 'en' ? 'hi' : 'en';
    setLanguage(next);
    showToast(next === 'hi' ? 'भाषा सफलतापूर्वक हिंदी में बदली गई।' : 'Language switched to English.', 'info');
  };

  const t = (text: string) => {
    return translateText(text, language);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4500);
  };

  // Expose showToast globally on window for backwards compatibility if needed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).showToast = showToast;
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage, t }}>
      <ToastContext.Provider value={{ showToast }}>
        {children}
        {/* Toast Container */}
        <div className="toast-container" style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast-item toast-item--${toast.type}`}
              style={{
                background: toast.type === 'success' ? '#0f172a' : toast.type === 'error' ? '#dc2626' : '#0f172a',
                color: '#ffffff',
                padding: '1.2rem 2rem',
                borderRadius: '0.8rem',
                boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '1.35rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                animation: 'slideInRight 0.3s ease-out',
                maxWidth: '38rem',
              }}
            >
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    </LanguageContext.Provider>
  );
}
