// src/routes/index.js – Express router
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { login } = require('../controllers/authController');
const {
  getProducts,
  getProductBatches,
  getLedger,
  getStats,
  simulate,
  postEvent,
  getSaleAllocations,
} = require('../controllers/inventoryController');

// ─── Public ────────────────────────────────────────────────────────────────
router.post('/auth/login', login);

// Health check
router.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Protected (require JWT) ───────────────────────────────────────────────
router.use(authenticate);

// Products & stock
router.get('/products',                 getProducts);
router.get('/products/:id/batches',     getProductBatches);

// Ledger
router.get('/ledger',                   getLedger);

// Stats
router.get('/stats',                    getStats);

// Sale FIFO allocations (audit)
router.get('/sales/:id/allocations',    getSaleAllocations);

// Kafka event endpoints
router.post('/simulate',               simulate);
router.post('/events',                 postEvent);

module.exports = router;
