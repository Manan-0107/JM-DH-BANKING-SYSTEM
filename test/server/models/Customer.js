'use strict';

const { getDb } = require('../db/database');
const bcrypt = require('bcryptjs');

class Customer {
  static async generateId() {
    const db = await getDb();
    const [rows] = await db.query("SELECT customer_id FROM customers ORDER BY customer_id DESC LIMIT 1");
    if (rows.length === 0) return 'CUST-101';
    const lastId = rows[0].customer_id;
    const num = parseInt(lastId.split('-')[1]) + 1;
    return `CUST-${num}`;
  }

  static async create({ full_name, email, phone, dob, address, password, credit_score, tier }) {
    const db = await getDb();
    const customer_id = await Customer.generateId();
    const password_hash = bcrypt.hashSync(password || '1234', 10);
    const created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await db.query(`
      INSERT INTO customers (customer_id, full_name, email, phone, dob, address, created_at, status, kyc_status, password_hash, credit_score, tier)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', 'Pending', ?, ?, ?)
    `, [
      customer_id,
      full_name,
      email,
      phone || null,
      dob || null,
      address || null,
      created_at,
      password_hash,
      credit_score || 700,
      tier || 'Silver'
    ]);

    return await Customer.findById(customer_id);
  }

  static async findById(customer_id) {
    const db = await getDb();
    const [rows] = await db.query("SELECT * FROM customers WHERE customer_id = ?", [customer_id]);
    if (rows.length === 0) return null;
    const row = rows[0];
    delete row.password_hash;
    return row;
  }

  static async findByEmail(email) {
    const db = await getDb();
    const [rows] = await db.query("SELECT * FROM customers WHERE email = ?", [email]);
    if (rows.length === 0) return null;
    return rows[0];
  }

  static async findAll() {
    const db = await getDb();
    const [rows] = await db.query("SELECT * FROM customers ORDER BY created_at DESC");
    return rows.map(r => { delete r.password_hash; return r; });
  }

  static async search(query) {
    const db = await getDb();
    const q = `%${query}%`;
    const [rows] = await db.query(`
      SELECT * FROM customers
      WHERE customer_id LIKE ? OR full_name LIKE ? OR email LIKE ?
      ORDER BY created_at DESC
    `, [q, q, q]);
    return rows.map(r => { delete r.password_hash; return r; });
  }

  static async update(customer_id, data) {
    const db = await getDb();
    const [existingRows] = await db.query("SELECT * FROM customers WHERE customer_id = ?", [customer_id]);
    if (existingRows.length === 0) return null;

    const fields = ['full_name', 'email', 'phone', 'dob', 'address', 'status', 'kyc_status', 'credit_score', 'tier'];
    const updates = [];
    const values = [];

    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (data.password) {
      updates.push('password_hash = ?');
      values.push(bcrypt.hashSync(data.password, 10));
    }

    if (updates.length === 0) return await Customer.findById(customer_id);

    values.push(customer_id);
    await db.query(`UPDATE customers SET ${updates.join(', ')} WHERE customer_id = ?`, values);

    return await Customer.findById(customer_id);
  }

  static async delete(customer_id) {
    const db = await getDb();
    const [existingRows] = await db.query("SELECT * FROM customers WHERE customer_id = ?", [customer_id]);
    if (existingRows.length === 0) return false;
    await db.query("DELETE FROM customers WHERE customer_id = ?", [customer_id]);
    return true;
  }

  static async validatePassword(email, password) {
    const db = await getDb();
    const [rows] = await db.query("SELECT * FROM customers WHERE email = ?", [email]);
    if (rows.length === 0) return null;
    const user = rows[0];
    if (!bcrypt.compareSync(password, user.password_hash)) return null;
    delete user.password_hash;
    return user;
  }

  static async count() {
    const db = await getDb();
    const [rows] = await db.query("SELECT COUNT(*) as c FROM customers");
    return rows[0].c;
  }

  static async countActive() {
    const db = await getDb();
    const [rows] = await db.query("SELECT COUNT(*) as c FROM customers WHERE status = 'Active'");
    return rows[0].c;
  }
}

module.exports = Customer;
