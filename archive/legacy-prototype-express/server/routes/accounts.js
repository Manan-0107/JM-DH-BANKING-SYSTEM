'use strict';

const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const { authenticateToken } = require('../middleware/auth');
const { validateAccount, validateTransaction } = require('../middleware/validate');

// GET /api/accounts — list all (optionally filter by customer_id)
router.get('/', async (req, res) => {
  try {
    const { customer_id } = req.query;
    let accounts;
    if (customer_id) {
      accounts = await Account.findByCustomerId(customer_id);
    } else {
      accounts = await Account.findAll();
    }
    res.json({ accounts, total: accounts.length });
  } catch (err) {
    console.error('Get accounts error:', err);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// GET /api/accounts/:id — get by account number
router.get('/:id', async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ account });
  } catch (err) {
    console.error('Get account error:', err);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// POST /api/accounts — create account for customer
router.post('/', authenticateToken, validateAccount, async (req, res) => {
  try {
    const { customer_id, account_type, balance, ifsc_code, branch_name } = req.body;
    const account = await Account.create({ customer_id, account_type, balance, ifsc_code, branch_name });
    res.status(201).json({ message: 'Account created successfully', account });
  } catch (err) {
    console.error('Create account error:', err);
    res.status(500).json({ error: 'Failed to create account. ' + err.message });
  }
});

// PUT /api/accounts/:id — update account
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const account = await Account.update(req.params.id, req.body);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ message: 'Account updated successfully', account });
  } catch (err) {
    console.error('Update account error:', err);
    res.status(500).json({ error: 'Failed to update account. ' + err.message });
  }
});

// POST /api/accounts/:id/deposit — deposit money
router.post('/:id/deposit', authenticateToken, validateTransaction, async (req, res) => {
  try {
    const { amount, description, pin } = req.body;
    if (!pin) {
      return res.status(400).json({ error: 'PIN is required for deposits' });
    }
    const transaction = await Account.deposit(req.params.id, amount, description, pin);
    const account = await Account.findById(req.params.id);
    res.json({ message: 'Deposit successful', transaction, account });
  } catch (err) {
    console.error('Deposit error:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/accounts/:id/withdraw — withdraw money
router.post('/:id/withdraw', authenticateToken, validateTransaction, async (req, res) => {
  try {
    const { amount, description, pin } = req.body;
    if (!pin) {
      return res.status(400).json({ error: 'PIN is required for withdrawals' });
    }
    const transaction = await Account.withdraw(req.params.id, amount, description, pin);
    const account = await Account.findById(req.params.id);
    res.json({ message: 'Withdrawal successful', transaction, account });
  } catch (err) {
    console.error('Withdrawal error:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/accounts/transfer — transfer between accounts
router.post('/transfer', authenticateToken, async (req, res) => {
  try {
    const { from_account, to_account, amount, description } = req.body;

    if (!from_account || !to_account) {
      return res.status(400).json({ error: 'Both sender and receiver account numbers are required' });
    }

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const transaction = await Account.transfer(from_account, to_account, parseFloat(amount), description);
    const senderAccount = await Account.findById(from_account);
    const receiverAccount = await Account.findById(to_account);

    res.json({
      message: 'Transfer successful',
      transaction,
      sender: senderAccount,
      receiver: receiverAccount
    });
  } catch (err) {
    console.error('Transfer error:', err);
    res.status(400).json({ error: err.message });
  }
});

// GET /api/accounts/:id/balance — check balance
router.get('/:id/balance', async (req, res) => {
  try {
    const result = await Account.getBalance(req.params.id);
    res.json({ account_number: req.params.id, balance: parseFloat(result.balance), status: result.status });
  } catch (err) {
    console.error('Balance check error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
