'use strict';

const { getDb } = require('../db/database');

class Transaction {
  static async generateId() {
    const db = await getDb();
    const [rows] = await db.query("SELECT transaction_id FROM transactions ORDER BY transaction_id DESC LIMIT 1");
    if (rows.length === 0) return 'TXN-00000001';
    const lastId = rows[0].transaction_id;
    const num = parseInt(lastId.split('-')[1]) + 1;
    return `TXN-${String(num).padStart(8, '0')}`;
  }

  // Fallback for regular creations
  static async create({ sender_account, receiver_account, amount, type, status, description }) {
    const db = await getDb();
    return await Transaction.createWithConnection(db, { sender_account, receiver_account, amount, type, status, description });
  }

  // Allows passing a transaction connection from the pool
  static async createWithConnection(connection, { sender_account, receiver_account, amount, type, status, description }) {
    const transaction_id = await Transaction.generateId();
    const date_time = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await connection.query(`
      INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      transaction_id,
      sender_account || null,
      receiver_account || null,
      amount,
      type,
      date_time,
      status || 'Success',
      description || ''
    ]);

    // findById usually uses main db pool, we could use connection here, but it's fine for simple read
    const [rows] = await connection.query("SELECT * FROM transactions WHERE transaction_id = ?", [transaction_id]);
    return rows[0] || null;
  }

  static async findById(transaction_id) {
    const db = await getDb();
    const [rows] = await db.query("SELECT * FROM transactions WHERE transaction_id = ?", [transaction_id]);
    return rows[0] || null;
  }

  static async findByAccountId(account_number) {
    const db = await getDb();
    const [rows] = await db.query(`
      SELECT * FROM transactions
      WHERE sender_account = ? OR receiver_account = ?
      ORDER BY date_time DESC
    `, [account_number, account_number]);
    return rows;
  }

  static async findAll(filters = {}) {
    const db = await getDb();
    let sql = "SELECT * FROM transactions WHERE 1=1";
    const params = [];

    if (filters.account) {
      sql += " AND (sender_account = ? OR receiver_account = ?)";
      params.push(filters.account, filters.account);
    }

    if (filters.type) {
      sql += " AND type = ?";
      params.push(filters.type);
    }

    if (filters.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }

    if (filters.startDate) {
      sql += " AND date_time >= ?";
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += " AND date_time <= ?";
      params.push(filters.endDate);
    }

    sql += " ORDER BY date_time DESC";

    if (filters.limit) {
      sql += " LIMIT ?";
      params.push(parseInt(filters.limit));
    }

    const [rows] = await db.query(sql, params);
    return rows;
  }

  static async getRecent(limit = 10) {
    const db = await getDb();
    const [rows] = await db.query("SELECT * FROM transactions ORDER BY date_time DESC LIMIT ?", [limit]);
    return rows;
  }

  static async getStatement(account_number, startDate, endDate) {
    const db = await getDb();
    let sql = `
      SELECT * FROM transactions
      WHERE (sender_account = ? OR receiver_account = ?)
    `;
    const params = [account_number, account_number];

    if (startDate) {
      sql += " AND date_time >= ?";
      params.push(startDate);
    }
    if (endDate) {
      sql += " AND date_time <= ?";
      params.push(endDate);
    }

    sql += " ORDER BY date_time ASC";
    const [rows] = await db.query(sql, params);
    return rows;
  }

  static async getMonthlyStats() {
    const db = await getDb();
    const [rows] = await db.query(`
      SELECT
        DATE_FORMAT(date_time, '%Y-%m') as month,
        COUNT(*) as total_transactions,
        SUM(CASE WHEN type = 'Deposit' THEN amount ELSE 0 END) as total_deposits,
        SUM(CASE WHEN type = 'Withdrawal' THEN amount ELSE 0 END) as total_withdrawals,
        SUM(CASE WHEN type = 'Transfer' THEN amount ELSE 0 END) as total_transfers,
        SUM(CASE WHEN status = 'Success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failed
      FROM transactions
      GROUP BY DATE_FORMAT(date_time, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `);
    return rows;
  }

  static async count() {
    const db = await getDb();
    const [rows] = await db.query("SELECT COUNT(*) as c FROM transactions");
    return rows[0].c;
  }
}

module.exports = Transaction;
