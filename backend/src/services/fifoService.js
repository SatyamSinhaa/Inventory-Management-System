// src/services/fifoService.js – Core FIFO costing logic
//
// FIFO (First-In, First-Out) principle:
//   When goods are sold, the cost of the oldest purchased batch is used first.
//   This ensures the earliest inventory costs are matched against sales first.
//
// Example:
//   Batch 1: 10 units @ $100  (purchased first)
//   Batch 2: 20 units @ $120  (purchased second)
//   Sale of 15 units:
//     → 10 units from Batch 1 @ $100 = $1,000
//     → 5  units from Batch 2 @ $120 = $600
//     → Total FIFO cost = $1,600  (avg cost would be $1,583.33 – different!)

const db = require('../config/db');

/**
 * Handle a PURCHASE event.
 * Creates a new inventory batch and upserts the product.
 *
 * @param {string} product_id
 * @param {number} quantity
 * @param {number} unit_price
 * @param {string} timestamp  ISO-8601
 * @param {object} emitter    Socket.io instance (optional, for live push)
 * @returns {object} Created batch record
 */
async function handlePurchase({ product_id, quantity, unit_price, timestamp }, emitter) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Upsert product (in case it arrives for the first time via Kafka)
    await client.query(
      `INSERT INTO products (id, name) VALUES ($1, $1)
       ON CONFLICT (id) DO NOTHING`,
      [product_id]
    );

    // Create a new inventory batch
    const { rows: [batch] } = await client.query(
      `INSERT INTO inventory_batches
         (product_id, quantity, remaining_qty, unit_price, timestamp)
       VALUES ($1, $2, $2, $3, $4)
       RETURNING *`,
      [product_id, quantity, unit_price, timestamp || new Date().toISOString()]
    );

    await client.query('COMMIT');

    const stockSummary = await getStockSummary(product_id);
    if (emitter) {
      emitter.emit('inventoryUpdate', {
        event_type: 'purchase',
        product_id,
        batch,
        stock: stockSummary,
      });
    }

    console.log(`[FIFO] PURCHASE  – ${product_id}: ${quantity} units @ $${unit_price}  | batch #${batch.id}`);
    return { batch, stock: stockSummary };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Handle a SALE event using FIFO logic.
 * Consumes the oldest batches first and records exact cost per batch.
 *
 * @param {string} product_id
 * @param {number} quantity
 * @param {string} timestamp  ISO-8601
 * @param {object} emitter    Socket.io instance (optional)
 * @returns {object} Sale record with FIFO cost breakdown
 */
async function handleSale({ product_id, quantity, timestamp }, emitter) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Fetch available batches ordered by timestamp (oldest first = FIFO)
    const { rows: batches } = await client.query(
      `SELECT id, remaining_qty, unit_price, timestamp
         FROM inventory_batches
        WHERE product_id = $1
          AND remaining_qty > 0
        ORDER BY timestamp ASC, id ASC
        FOR UPDATE`,
      [product_id]
    );

    // Validate sufficient stock
    const totalAvailable = batches.reduce((sum, b) => sum + parseFloat(b.remaining_qty), 0);
    if (totalAvailable < quantity) {
      throw new Error(
        `Insufficient stock for ${product_id}: requested ${quantity}, available ${totalAvailable.toFixed(4)}`
      );
    }

    let remaining = parseFloat(quantity);
    let totalCost = 0;
    const allocations = [];

    // FIFO deduction loop
    for (const batch of batches) {
      if (remaining <= 0) break;

      const batchAvailable = parseFloat(batch.remaining_qty);
      const consumed = Math.min(remaining, batchAvailable);
      const costFromBatch = consumed * parseFloat(batch.unit_price);

      totalCost += costFromBatch;
      remaining -= consumed;

      // Update the batch's remaining quantity
      await client.query(
        `UPDATE inventory_batches SET remaining_qty = remaining_qty - $1 WHERE id = $2`,
        [consumed, batch.id]
      );

      allocations.push({ batch_id: batch.id, quantity_used: consumed, unit_price: batch.unit_price });
    }

    // Record the sale
    const { rows: [sale] } = await client.query(
      `INSERT INTO sales (product_id, quantity_sold, total_cost, timestamp)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [product_id, quantity, totalCost.toFixed(4), timestamp || new Date().toISOString()]
    );

    // Record per-batch allocations (audit trail)
    for (const alloc of allocations) {
      await client.query(
        `INSERT INTO sale_batch_allocations (sale_id, batch_id, quantity_used, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [sale.id, alloc.batch_id, alloc.quantity_used, alloc.unit_price]
      );
    }

    await client.query('COMMIT');

    const stockSummary = await getStockSummary(product_id);
    if (emitter) {
      emitter.emit('inventoryUpdate', {
        event_type: 'sale',
        product_id,
        sale,
        allocations,
        stock: stockSummary,
      });
    }

    console.log(
      `[FIFO] SALE     – ${product_id}: ${quantity} units | FIFO cost $${totalCost.toFixed(4)} | sale #${sale.id}`
    );
    return { sale, allocations, stock: stockSummary };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get current stock summary for a product.
 */
async function getStockSummary(product_id) {
  const { rows } = await db.query(
    `SELECT
       p.id,
       p.name,
       COALESCE(SUM(b.remaining_qty), 0)                          AS current_qty,
       COALESCE(SUM(b.remaining_qty * b.unit_price), 0)           AS total_inventory_cost,
       CASE WHEN COALESCE(SUM(b.remaining_qty), 0) > 0
            THEN SUM(b.remaining_qty * b.unit_price) / SUM(b.remaining_qty)
            ELSE 0
       END                                                          AS avg_cost_per_unit
     FROM products p
     LEFT JOIN inventory_batches b
            ON b.product_id = p.id AND b.remaining_qty > 0
    WHERE p.id = $1
    GROUP BY p.id, p.name`,
    [product_id]
  );
  return rows[0] || null;
}

/**
 * Get stock summary for all products.
 */
async function getAllStockSummaries() {
  const { rows } = await db.query(
    `SELECT
       p.id,
       p.name,
       COALESCE(SUM(b.remaining_qty), 0)                          AS current_qty,
       COALESCE(SUM(b.remaining_qty * b.unit_price), 0)           AS total_inventory_cost,
       CASE WHEN COALESCE(SUM(b.remaining_qty), 0) > 0
            THEN SUM(b.remaining_qty * b.unit_price) / SUM(b.remaining_qty)
            ELSE 0
       END                                                          AS avg_cost_per_unit
     FROM products p
     LEFT JOIN inventory_batches b
            ON b.product_id = p.id AND b.remaining_qty > 0
    GROUP BY p.id, p.name
    ORDER BY p.id`
  );
  return rows;
}

module.exports = { handlePurchase, handleSale, getStockSummary, getAllStockSummaries };
