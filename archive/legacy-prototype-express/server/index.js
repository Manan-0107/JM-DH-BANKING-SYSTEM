'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db/database');

// Initialize database
getDb().then(() => console.log('Database connected successfully')).catch(err => console.error('Database init failed:', err));

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files from the parent directory
app.use(express.static(path.join(__dirname, '../')));

// Mount API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`Bankist backend running on http://localhost:${PORT}`);
});
