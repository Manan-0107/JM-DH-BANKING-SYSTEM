'use strict';

const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');

// GET /api/transactions — list all with filters
router.get('/', async (req, res) => {
  try {
    const { account, type, status, startDate, endDate, limit } = req.query;
    const transactions = await Transaction.findAll({ account, type, status, startDate, endDate, limit });
    res.json({ transactions, total: transactions.length });
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /api/transactions/recent — recent transactions
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const transactions = await Transaction.getRecent(limit);
    res.json({ transactions });
  } catch (err) {
    console.error('Get recent transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch recent transactions' });
  }
});

// GET /api/transactions/stats — monthly statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await Transaction.getMonthlyStats();
    res.json({ stats });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Failed to fetch transaction statistics' });
  }
});

// GET /api/transactions/statement/:accountId — account statement
router.get('/statement/:accountId', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const statement = await Transaction.getStatement(req.params.accountId, startDate, endDate);
    res.json({
      account: req.params.accountId,
      period: { startDate: startDate || 'all', endDate: endDate || 'all' },
      transactions: statement,
      total: statement.length
    });
  } catch (err) {
    console.error('Get statement error:', err);
    res.status(500).json({ error: 'Failed to generate statement' });
  }
});

// GET /api/transactions/:id — get by ID
router.get('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ transaction });
  } catch (err) {
    console.error('Get transaction error:', err);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

module.exports = router;
