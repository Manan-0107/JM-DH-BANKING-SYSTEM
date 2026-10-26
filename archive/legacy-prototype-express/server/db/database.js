const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

let pool;


async function getDb() {
  if (!pool) {
    // 1. Connect without specifying the database to ensure it exists
    const initConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306
    });

    const dbName = process.env.DB_NAME || 'bankist';
    await initConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await initConnection.end();

    // 2. Create the actual connection pool
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: dbName,
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Ensure the pool can handle transactions for backwards compatibility in existing APIs
    pool.transaction = async function (callback) {
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      try {
        const result = await callback(connection);
        await connection.commit();
        return result;
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    };

  }
  return pool;
}

module.exports = { getDb };
