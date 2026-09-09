'use strict';

const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

// GET /api/dashboard — aggregated dashboard stats
router.get('/', async (req, res) => {
  try {
    const totalCustomers = await Customer.count();
    const activeCustomers = await Customer.countActive();
    const totalAccounts = await Account.count();
    const totalBalance = await Account.totalBalance();
    const totalTransactions = await Transaction.count();
    const recentTransactions = await Transaction.getRecent(5);
    const monthlyStats = await Transaction.getMonthlyStats();

    res.json({
      summary: {
        totalCustomers,
        activeCustomers,
        totalAccounts,
        totalBalance,
        totalTransactions
      },
      recentTransactions,
      monthlyStats
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;
