// src/index.js – Main entry point
require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const net = require('net');
net.setDefaultAutoSelectFamily(false);

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const routes = require('./routes');
const { startConsumer, stopConsumer } = require('./services/kafkaConsumer');
const { pool } = require('./config/db');

const app = express();
const server = http.createServer(app);

// ─── Socket.io setup ───────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// ─── Express middleware ────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ────────────────────────────────────────────────────────────────
app.use('/api', routes);

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Express] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Startup ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

async function start() {
  // Test DB connection and auto-run migrations
  try {
    await pool.query('SELECT 1');
    console.log('[DB] PostgreSQL connected');

    const initSqlPath = path.join(__dirname, '../migrations/001_init.sql');
    const initSql = fs.readFileSync(initSqlPath, 'utf8');
    await pool.query(initSql);
    console.log('[DB] Schema and tables automatically verified/created');
  } catch (err) {
    console.error('[DB] Connection or migration failed:', err.message);
    process.exit(1);
  }

  // Start Kafka consumer
  try {
    await startConsumer(io);
  } catch (err) {
    console.error('[Kafka] Consumer startup failed:', err.message);
    // Non-fatal – app can still serve cached data; Kafka will retry
  }

  server.listen(PORT, () => {
    console.log(`[Server] Listening on http://localhost:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// ─── Graceful shutdown ─────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[Server] Received ${signal}, shutting down…`);
  await stopConsumer();
  await pool.end();
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

start();
