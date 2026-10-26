'use strict';

const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Account = require('../models/Account');
const { generateToken } = require('../middleware/auth');
const { validateSignup, validateLogin } = require('../middleware/validate');

// POST /api/auth/signup
router.post('/signup', validateSignup, async (req, res) => {
  try {
    const { full_name, email, password, phone, dob, address } = req.body;

    // Check if email already exists
    const existing = await Customer.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create customer
    const customer = await Customer.create({ full_name, email, password, phone, dob, address });

    // Create default savings account
    const account = await Account.create({
      customer_id: customer.customer_id,
      account_type: 'Savings Account',
      balance: 0,
      branch_name: 'Downtown Central'
    });

    // Generate JWT
    const token = generateToken(customer);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      customer,
      account
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Failed to create account. ' + err.message });
  }
});

// POST /api/auth/login
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    const customer = await Customer.validatePassword(email, password);
    if (!customer) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (customer.status === 'Blocked') {
      return res.status(403).json({ error: 'Your account has been blocked. Contact support.' });
    }

    const token = generateToken(customer);
    const accounts = await Account.findByCustomerId(customer.customer_id);

    res.json({
      message: 'Login successful',
      token,
      customer,
      accounts
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. ' + err.message });
  }
});

// GET /api/auth/me — get current user from token
router.get('/me', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.customer_id);
    if (!customer) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accounts = await Account.findByCustomerId(customer.customer_id);
    res.json({ customer, accounts });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

module.exports = router;
