'use strict';

const { getDb } = require('../db/database');

class Account {
  static async generateAccountNumber() {
    const db = await getDb();
    const num = Math.floor(100000 + Math.random() * 900000);
    const accNo = `ACC-${num}`;
    // Ensure unique
    const [rows] = await db.query("SELECT account_number FROM accounts WHERE account_number = ?", [accNo]);
    if (rows.length > 0) return await Account.generateAccountNumber();
    return accNo;
  }

  static async create({ customer_id, account_type, balance, ifsc_code, branch_name }) {
    const db = await getDb();

    // Verify customer exists
    const [customerRows] = await db.query("SELECT customer_id FROM customers WHERE customer_id = ?", [customer_id]);
    if (customerRows.length === 0) throw new Error('Customer not found');

    const account_number = await Account.generateAccountNumber();
    const opening_date = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await db.query(`
      INSERT INTO accounts (account_number, customer_id, account_type, balance, ifsc_code, branch_name, opening_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
    `, [
      account_number,
      customer_id,
      account_type || 'Savings Account',
      balance || 0.0,
      ifsc_code || 'BNKST0001',
      branch_name || 'Downtown Central',
      opening_date
    ]);

    return await Account.findById(account_number);
  }

  static async findById(account_number) {
    const db = await getDb();
    const [rows] = await db.query(`
      SELECT a.*, c.full_name as customer_name
      FROM accounts a
      JOIN customers c ON a.customer_id = c.customer_id
      WHERE a.account_number = ?
    `, [account_number]);
    return rows[0] || null;
  }

  static async findByCustomerId(customer_id) {
    const db = await getDb();
    const [rows] = await db.query("SELECT * FROM accounts WHERE customer_id = ? ORDER BY opening_date DESC", [customer_id]);
    return rows;
  }

  static async findAll() {
    const db = await getDb();
    const [rows] = await db.query(`
      SELECT a.*, c.full_name as customer_name
      FROM accounts a
      JOIN customers c ON a.customer_id = c.customer_id
      ORDER BY a.opening_date DESC
    `);
    return rows;
  }

  static async update(account_number, data) {
    const db = await getDb();
    const [existing] = await db.query("SELECT * FROM accounts WHERE account_number = ?", [account_number]);
    if (existing.length === 0) return null;

    const fields = ['account_type', 'ifsc_code', 'branch_name', 'status'];
    const updates = [];
    const values = [];

    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (updates.length === 0) return await Account.findById(account_number);

    values.push(account_number);
    await db.query(`UPDATE accounts SET ${updates.join(', ')} WHERE account_number = ?`, values);

    return await Account.findById(account_number);
  }

  static async deposit(account_number, amount, description, pin) {
    const db = await getDb();
    const [accountRows] = await db.query("SELECT * FROM accounts WHERE account_number = ?", [account_number]);
    const account = accountRows[0];
    if (!account) throw new Error('Account not found');
    if (account.status !== 'Active') throw new Error('Account is not active');
    if (amount <= 0) throw new Error('Amount must be positive');
    if (amount > 10000) throw new Error('Max transaction limit is $10,000 at once');

    // Verify PIN
    const bcrypt = require('bcryptjs');
    const [customerRows] = await db.query("SELECT password_hash FROM customers WHERE customer_id = ?", [account.customer_id]);
    const customer = customerRows[0];
    if (!customer) throw new Error('Customer not found');
    
    if (!bcrypt.compareSync(pin, customer.password_hash)) {
      throw new Error('Invalid PIN');
    }

    // Check daily limit
    const [dailyTotalRows] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE receiver_account = ? 
        AND type = 'Deposit' 
        AND DATE(date_time) >= CURDATE()
    `, [account_number]);
    
    const dailyTotal = parseFloat(dailyTotalRows[0].total);
    if (dailyTotal + amount > 50000) {
      throw new Error(`Daily deposit limit of $50,000 exceeded. You have already deposited $${dailyTotal} today.`);
    }

    const Transaction = require('./Transaction');

    return await db.transaction(async (connection) => {
      await connection.query("UPDATE accounts SET balance = balance + ? WHERE account_number = ?", [amount, account_number]);

      return await Transaction.createWithConnection(connection, {
        sender_account: null,
        receiver_account: account_number,
        amount,
        type: 'Deposit',
        status: 'Success',
        description: description || 'Cash deposit'
      });
    });
  }

  static async withdraw(account_number, amount, description, pin) {
    const db = await getDb();
    const [accountRows] = await db.query("SELECT * FROM accounts WHERE account_number = ?", [account_number]);
    const account = accountRows[0];
    if (!account) throw new Error('Account not found');
    if (account.status !== 'Active') throw new Error('Account is not active');
    if (amount <= 0) throw new Error('Amount must be positive');
    
    const balance = parseFloat(account.balance);
    if (balance < amount) throw new Error('Insufficient balance');
    if (amount > 10000) throw new Error('Max transaction limit is $10,000 at once');

    // Verify PIN
    const bcrypt = require('bcryptjs');
    const [customerRows] = await db.query("SELECT password_hash FROM customers WHERE customer_id = ?", [account.customer_id]);
    const customer = customerRows[0];
    if (!customer) throw new Error('Customer not found');
    
    if (!bcrypt.compareSync(pin, customer.password_hash)) {
      throw new Error('Invalid PIN');
    }

    // Check daily limit for withdrawals
    const [dailyTotalRows] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE sender_account = ? 
        AND type = 'Withdrawal' 
        AND DATE(date_time) >= CURDATE()
    `, [account_number]);
    
    const dailyTotal = parseFloat(dailyTotalRows[0].total);
    if (dailyTotal + amount > 50000) {
      throw new Error(`Daily withdrawal limit of $50,000 exceeded. You have already withdrawn $${dailyTotal} today.`);
    }

    const Transaction = require('./Transaction');

    return await db.transaction(async (connection) => {
      await connection.query("UPDATE accounts SET balance = balance - ? WHERE account_number = ?", [amount, account_number]);

      return await Transaction.createWithConnection(connection, {
        sender_account: account_number,
        receiver_account: null,
        amount,
        type: 'Withdrawal',
        status: 'Success',
        description: description || 'Cash withdrawal'
      });
    });
  }

  static async transfer(from_account, to_account, amount, description) {
    const db = await getDb();
    const [senderRows] = await db.query("SELECT * FROM accounts WHERE account_number = ?", [from_account]);
    const sender = senderRows[0];
    if (!sender) throw new Error('Sender account not found');
    if (sender.status !== 'Active') throw new Error('Sender account is not active');

    const [receiverRows] = await db.query("SELECT * FROM accounts WHERE account_number = ?", [to_account]);
    const receiver = receiverRows[0];
    if (!receiver) throw new Error('Receiver account not found');
    if (receiver.status !== 'Active') throw new Error('Receiver account is not active');

    if (amount <= 0) throw new Error('Amount must be positive');
    const senderBalance = parseFloat(sender.balance);
    if (senderBalance < amount) throw new Error('Insufficient balance');
    if (from_account === to_account) throw new Error('Cannot transfer to the same account');

    const Transaction = require('./Transaction');

    return await db.transaction(async (connection) => {
      await connection.query("UPDATE accounts SET balance = balance - ? WHERE account_number = ?", [amount, from_account]);
      await connection.query("UPDATE accounts SET balance = balance + ? WHERE account_number = ?", [amount, to_account]);

      return await Transaction.createWithConnection(connection, {
        sender_account: from_account,
        receiver_account: to_account,
        amount,
        type: 'Transfer',
        status: 'Success',
        description: description || `Transfer from ${from_account} to ${to_account}`
      });
    });
  }

  static async getBalance(account_number) {
    const db = await getDb();
    const [rows] = await db.query("SELECT balance, status FROM accounts WHERE account_number = ?", [account_number]);
    if (rows.length === 0) throw new Error('Account not found');
    return rows[0];
  }

  static async count() {
    const db = await getDb();
    const [rows] = await db.query("SELECT COUNT(*) as c FROM accounts");
    return rows[0].c;
  }

  static async totalBalance() {
    const db = await getDb();
    const [rows] = await db.query("SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE status = 'Active'");
    return parseFloat(rows[0].total);
  }
}

module.exports = Account;
