// src/config/db.js – PostgreSQL connection pool
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err);
});

/**
 * Execute a parameterised query.
 * @param {string} text   SQL string with $1, $2 placeholders
 * @param {any[]}  params Parameter array
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'test') {
    console.debug(`[DB] query (${duration}ms): ${text.slice(0, 80)}`);
  }
  return res;
}

/**
 * Begin a transaction and return a client.
 * Remember to call client.release() after committing / rolling back.
 */
async function getClient() {
  const client = await pool.connect();
  return client;
}

module.exports = { query, getClient, pool };
