// src/controllers/inventoryController.js – REST API handlers
const db = require('../config/db');
const { getAllStockSummaries, getStockSummary, handlePurchase, handleSale } = require('../services/fifoService');
const { simulateEvents, sendEvent } = require('../services/kafkaProducer');

/**
 * GET /api/products
 * Returns all products with current stock, inventory cost, and avg cost/unit.
 */
async function getProducts(req, res) {
  try {
    const summaries = await getAllStockSummaries();
    res.json({ products: summaries });
  } catch (err) {
    console.error('[API] getProducts error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/products/:id/batches
 * Returns all inventory batches for a product (including exhausted ones).
 */
async function getProductBatches(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT * FROM inventory_batches WHERE product_id = $1 ORDER BY timestamp ASC`,
      [id]
    );
    res.json({ batches: rows });
  } catch (err) {
    console.error('[API] getProductBatches error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/ledger
 * Returns a time-series of all purchases and sales, sorted by timestamp desc.
 * Query params: ?limit=50&offset=0&product_id=PRD001
 */
async function getLedger(req, res) {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || '100'), 500);
    const offset = parseInt(req.query.offset || '0');
    const productFilter = req.query.product_id;

    const productWhere = productFilter ? `AND product_id = '${productFilter}'` : '';

    // Union of purchases and sales
    const { rows } = await db.query(
      `(
         SELECT
           'purchase'          AS event_type,
           product_id,
           quantity            AS quantity,
           unit_price,
           quantity * unit_price AS total_value,
           NULL                AS total_cost,
           timestamp,
           id                  AS ref_id
         FROM inventory_batches
         WHERE 1=1 ${productWhere}
       )
       UNION ALL
       (
         SELECT
           'sale'              AS event_type,
           product_id,
           quantity_sold       AS quantity,
           NULL                AS unit_price,
           NULL                AS total_value,
           total_cost,
           timestamp,
           id                  AS ref_id
         FROM sales
         WHERE 1=1 ${productWhere}
       )
       ORDER BY timestamp DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Total count
    const { rows: countRows } = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM inventory_batches WHERE 1=1 ${productWhere}) +
         (SELECT COUNT(*) FROM sales WHERE 1=1 ${productWhere}) AS total`
    );

    res.json({ ledger: rows, total: parseInt(countRows[0].total), limit, offset });
  } catch (err) {
    console.error('[API] getLedger error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/stats
 * Returns aggregate stats for the dashboard summary bar.
 */
async function getStats(req, res) {
  try {
    const { rows: [inv] } = await db.query(
      `SELECT
         COUNT(DISTINCT product_id)           AS total_products,
         COALESCE(SUM(remaining_qty * unit_price), 0) AS total_inventory_value,
         COALESCE(SUM(remaining_qty), 0)      AS total_units_on_hand
       FROM inventory_batches`
    );

    const { rows: [sal] } = await db.query(
      `SELECT
         COUNT(*)                AS total_sales,
         COALESCE(SUM(total_cost), 0)  AS total_cost_of_goods_sold,
         COALESCE(SUM(quantity_sold), 0) AS total_units_sold
       FROM sales`
    );

    res.json({
      total_products:           parseInt(inv.total_products),
      total_inventory_value:    parseFloat(inv.total_inventory_value),
      total_units_on_hand:      parseFloat(inv.total_units_on_hand),
      total_sales:              parseInt(sal.total_sales),
      total_cost_of_goods_sold: parseFloat(sal.total_cost_of_goods_sold),
      total_units_sold:         parseFloat(sal.total_units_sold),
    });
  } catch (err) {
    console.error('[API] getStats error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/simulate
 * Triggers 10 dummy Kafka events (purchases + sales).
 */
async function simulate(req, res) {
  try {
    const events = await simulateEvents();
    res.json({ message: `Sent ${events.length} simulated events to Kafka`, events });
  } catch (err) {
    console.error('[API] simulate error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/events
 * Send a single custom event directly.
 * Body: { product_id, event_type, quantity, unit_price?, timestamp? }
 */
async function postEvent(req, res) {
  try {
    const { product_id, event_type, quantity, unit_price, timestamp } = req.body;
    if (!product_id || !event_type || !quantity) {
      return res.status(400).json({ error: 'product_id, event_type, quantity are required' });
    }
    if (event_type === 'purchase' && !unit_price) {
      return res.status(400).json({ error: 'unit_price is required for purchase events' });
    }
    await sendEvent({ product_id, event_type, quantity: parseFloat(quantity), unit_price: parseFloat(unit_price || 0), timestamp });
    res.json({ message: 'Event sent to Kafka', event: req.body });
  } catch (err) {
    console.error('[API] postEvent error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/sales/:id/allocations
 * Returns FIFO batch allocations for a specific sale.
 */
async function getSaleAllocations(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT sba.*, ib.timestamp AS batch_timestamp
         FROM sale_batch_allocations sba
         JOIN inventory_batches ib ON ib.id = sba.batch_id
        WHERE sba.sale_id = $1
        ORDER BY ib.timestamp ASC`,
      [id]
    );
    res.json({ allocations: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getProducts, getProductBatches, getLedger, getStats, simulate, postEvent, getSaleAllocations };
