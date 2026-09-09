'use strict';

const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const { authenticateToken } = require('../middleware/auth');
const { validateCustomer } = require('../middleware/validate');

// GET /api/customers — list all or search
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const customers = search ? await Customer.search(search) : await Customer.findAll();
    res.json({ customers, total: customers.length });
  } catch (err) {
    console.error('Get customers error:', err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET /api/customers/:id — get by ID
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ customer });
  } catch (err) {
    console.error('Get customer error:', err);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// POST /api/customers — create new customer
router.post('/', authenticateToken, validateCustomer, async (req, res) => {
  try {
    const { full_name, email, phone, dob, address, password, credit_score, tier } = req.body;

    // Check if email already exists
    const existing = await Customer.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const customer = await Customer.create({ full_name, email, phone, dob, address, password, credit_score, tier });
    res.status(201).json({ message: 'Customer created successfully', customer });
  } catch (err) {
    console.error('Create customer error:', err);
    res.status(500).json({ error: 'Failed to create customer. ' + err.message });
  }
});

// PUT /api/customers/:id — update customer
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await Customer.update(req.params.id, req.body);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ message: 'Customer updated successfully', customer });
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ error: 'Failed to update customer. ' + err.message });
  }
});

// DELETE /api/customers/:id — delete customer
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await Customer.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ error: 'Failed to delete customer. ' + err.message });
  }
});

module.exports = router;
