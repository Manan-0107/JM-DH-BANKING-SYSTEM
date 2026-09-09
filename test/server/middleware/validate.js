'use strict';

function validateCustomer(req, res, next) {
  const { full_name, email } = req.body;
  const errors = [];

  if (!full_name || full_name.trim().length < 2) {
    errors.push('Full name is required (minimum 2 characters)');
  }

  if (!email || !isValidEmail(email)) {
    errors.push('A valid email address is required');
  }

  if (req.body.phone && !isValidPhone(req.body.phone)) {
    errors.push('Phone number format is invalid');
  }

  if (req.body.dob && !isValidDate(req.body.dob)) {
    errors.push('Date of birth must be in YYYY-MM-DD format');
  }

  if (req.body.status && !['Active', 'Blocked'].includes(req.body.status)) {
    errors.push('Status must be Active or Blocked');
  }

  if (req.body.kyc_status && !['Verified', 'Pending'].includes(req.body.kyc_status)) {
    errors.push('KYC status must be Verified or Pending');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
}

function validateAccount(req, res, next) {
  const { customer_id, account_type } = req.body;
  const errors = [];

  if (!customer_id) {
    errors.push('Customer ID is required');
  }

  const validTypes = ['Savings Account', 'Current Account', 'Fixed Deposit'];
  if (account_type && !validTypes.includes(account_type)) {
    errors.push(`Account type must be one of: ${validTypes.join(', ')}`);
  }

  if (req.body.balance !== undefined && (isNaN(req.body.balance) || req.body.balance < 0)) {
    errors.push('Balance must be a non-negative number');
  }

  if (req.body.status && !['Active', 'Frozen', 'Closed'].includes(req.body.status)) {
    errors.push('Account status must be Active, Frozen, or Closed');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
}

function validateTransaction(req, res, next) {
  const { amount } = req.body;
  const errors = [];

  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    errors.push('Amount must be a positive number');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  req.body.amount = parseFloat(req.body.amount);
  next();
}

function validateSignup(req, res, next) {
  const { full_name, email, password } = req.body;
  const errors = [];

  if (!full_name || full_name.trim().length < 2) {
    errors.push('Full name is required (minimum 2 characters)');
  }

  if (!email || !isValidEmail(email)) {
    errors.push('A valid email address is required');
  }

  if (!password || password.length < 4) {
    errors.push('Password/PIN must be at least 4 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (!email) {
    errors.push('Email / User ID is required');
  }

  if (!password) {
    errors.push('Password / PIN is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
}

// Helper functions
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[\+]?[\d\s\-()]{7,20}$/.test(phone);
}

function isValidDate(dateStr) {
  const d = new Date(dateStr);
  return d instanceof Date && !isNaN(d) && /^\d{4}-\d{2}-\d{2}/.test(dateStr);
}

module.exports = {
  validateCustomer,
  validateAccount,
  validateTransaction,
  validateSignup,
  validateLogin
};
