// src/services/kafkaProducer.js – Internal producer (used by /api/simulate)
require('dotenv').config();
const { kafka } = require('../config/kafka');

let producer = null;

async function getProducer() {
  if (!producer) {
    producer = kafka.producer();
    await producer.connect();
    console.log('[Kafka] Producer connected');
  }
  return producer;
}

/**
 * Send a single event to the inventory-events topic.
 */
async function sendEvent(event) {
  const p = await getProducer();
  const topic = process.env.KAFKA_TOPIC || 'inventory-events';
  await p.send({
    topic,
    messages: [{ value: JSON.stringify(event) }],
  });
}

/**
 * Generate and send 10 simulated inventory events for demo purposes.
 * Mix of purchases and sales across multiple products.
 */
async function simulateEvents() {
  const products = ['PRD001', 'PRD002', 'PRD003'];

  // Pre-seed purchases so FIFO has batches to draw from
  const events = [
    { product_id: 'PRD001', event_type: 'purchase', quantity: 100, unit_price: 50.00,  timestamp: new Date(Date.now() - 6 * 3600000).toISOString() },
    { product_id: 'PRD001', event_type: 'purchase', quantity: 50,  unit_price: 55.00,  timestamp: new Date(Date.now() - 5 * 3600000).toISOString() },
    { product_id: 'PRD002', event_type: 'purchase', quantity: 200, unit_price: 20.00,  timestamp: new Date(Date.now() - 5 * 3600000).toISOString() },
    { product_id: 'PRD003', event_type: 'purchase', quantity: 80,  unit_price: 150.00, timestamp: new Date(Date.now() - 4 * 3600000).toISOString() },
    { product_id: 'PRD001', event_type: 'sale',     quantity: 60,                      timestamp: new Date(Date.now() - 3 * 3600000).toISOString() },
    { product_id: 'PRD002', event_type: 'sale',     quantity: 80,                      timestamp: new Date(Date.now() - 2 * 3600000).toISOString() },
    { product_id: 'PRD001', event_type: 'purchase', quantity: 30,  unit_price: 60.00,  timestamp: new Date(Date.now() - 2 * 3600000).toISOString() },
    { product_id: 'PRD003', event_type: 'sale',     quantity: 40,                      timestamp: new Date(Date.now() - 1 * 3600000).toISOString() },
    { product_id: 'PRD002', event_type: 'purchase', quantity: 100, unit_price: 22.00,  timestamp: new Date(Date.now() - 30 * 60000).toISOString() },
    { product_id: 'PRD001', event_type: 'sale',     quantity: 20,                      timestamp: new Date().toISOString() },
  ];

  const p = await getProducer();
  const topic = process.env.KAFKA_TOPIC || 'inventory-events';

  await p.send({
    topic,
    messages: events.map(e => ({ value: JSON.stringify(e) })),
  });

  console.log(`[Kafka] Simulated ${events.length} events`);
  return events;
}

async function disconnectProducer() {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}

module.exports = { sendEvent, simulateEvents, disconnectProducer };
