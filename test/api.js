'use strict';

/**
 * BankAPI - Frontend client for communicating with the Bankist Node.js backend.
 */

const API_URL = '/api';

class BankAPI {
  static getToken() {
    return localStorage.getItem('bankist_token');
  }

  static setToken(token) {
    localStorage.setItem('bankist_token', token);
  }

  static clearToken() {
    localStorage.removeItem('bankist_token');
  }

  static async request(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = BankAPI.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details?.join(', ') || 'API request failed');
      }

      return data;
    } catch (err) {
      console.error(`API Error (${endpoint}):`, err);
      throw err;
    }
  }

  // --- Auth API ---
  static auth = {
    login: (email, password) => BankAPI.request('/auth/login', { method: 'POST', body: { email, password } }),
    signup: (userData) => BankAPI.request('/auth/signup', { method: 'POST', body: userData }),
    me: () => BankAPI.request('/auth/me')
  };

  // --- Dashboard API ---
  static dashboard = {
    get: () => BankAPI.request('/dashboard')
  };

  // --- Customers API ---
  static customers = {
    getAll: (search = '') => BankAPI.request(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    getById: (id) => BankAPI.request(`/customers/${id}`),
    create: (data) => BankAPI.request('/customers', { method: 'POST', body: data }),
    update: (id, data) => BankAPI.request(`/customers/${id}`, { method: 'PUT', body: data }),
    delete: (id) => BankAPI.request(`/customers/${id}`, { method: 'DELETE' })
  };

  // --- Accounts API ---
  static accounts = {
    getAll: (customerId = '') => BankAPI.request(`/accounts${customerId ? `?customer_id=${customerId}` : ''}`),
    getById: (id) => BankAPI.request(`/accounts/${id}`),
    create: (data) => BankAPI.request('/accounts', { method: 'POST', body: data }),
    update: (id, data) => BankAPI.request(`/accounts/${id}`, { method: 'PUT', body: data }),
    deposit: (id, amount, desc, pin) => BankAPI.request(`/accounts/${id}/deposit`, { method: 'POST', body: { amount, description: desc, pin } }),
    withdraw: (id, amount, desc, pin) => BankAPI.request(`/accounts/${id}/withdraw`, { method: 'POST', body: { amount, description: desc, pin } }),
    transfer: (from, to, amount, desc) => BankAPI.request('/accounts/transfer', { method: 'POST', body: { from_account: from, to_account: to, amount, description: desc } }),
    getBalance: (id) => BankAPI.request(`/accounts/${id}/balance`)
  };

  // --- Transactions API ---
  static transactions = {
    getAll: (filters = {}) => {
      const params = new URLSearchParams(filters).toString();
      return BankAPI.request(`/transactions${params ? `?${params}` : ''}`);
    },
    getRecent: (limit = 10) => BankAPI.request(`/transactions/recent?limit=${limit}`),
    getStatement: (accountId, startDate, endDate) => {
      const filters = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      const params = new URLSearchParams(filters).toString();
      return BankAPI.request(`/transactions/statement/${accountId}${params ? `?${params}` : ''}`);
    }
  };
}

// Toast Notification System
function showToast(message, type = 'success') {
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  
  toastContainer.appendChild(toast);

  // Trigger reflow for animation
  void toast.offsetWidth;
  toast.classList.add('toast--visible');

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Ensure elements exist globally for other scripts
window.BankAPI = BankAPI;
window.showToast = showToast;
