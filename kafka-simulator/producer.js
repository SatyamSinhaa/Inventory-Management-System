#!/usr/bin/env node
/**
 * =====================================================================
 * IMS Kafka / Redpanda Event Producer (Simulator)
 * =====================================================================
 *
 * Sends inventory-events to the Kafka/Redpanda broker.
 * Events are processed by the backend consumer using FIFO costing.
 *
 * Usage:
 *   node producer.js                  # sends 10 default events
 *   node producer.js --count 20       # sends 20 events
 *   node producer.js --interactive    # manual event entry
 *   node producer.js --stream         # continuous random events every 3s
 *
 * Environment (override via .env or CLI):
 *   KAFKA_BROKERS=localhost:9092
 *   KAFKA_TOPIC=inventory-events
 */

require('dotenv').config();
const { Kafka, logLevel } = require('kafkajs');
const fs = require('fs');
const path = require('path');

// ─── Config ────────────────────────────────────────────────────────────────
const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC   = process.env.KAFKA_TOPIC    || 'inventory-events';

const kafkaConfig = {
  clientId: 'ims-simulator',
  brokers: BROKERS,
  connectionTimeout: 10000,
  authenticationTimeout: 10000,
  logLevel: logLevel.ERROR,
  retry: { initialRetryTime: 500, retries: 5 },
};

// Support cloud deployment with SASL authentication (e.g. Upstash Kafka)
if (process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD) {
  const sslConfig = {
    rejectUnauthorized: process.env.KAFKA_SSL_REJECT_UNAUTHORIZED !== 'false',
  };

  if (process.env.KAFKA_CA_CERT) {
    sslConfig.ca = [process.env.KAFKA_CA_CERT.replace(/\\n/g, '\n')];
  } else if (process.env.KAFKA_CA_CERT_PATH) {
    try {
      const caPath = path.resolve(process.env.KAFKA_CA_CERT_PATH);
      sslConfig.ca = [fs.readFileSync(caPath, 'utf-8')];
    } catch (err) {
      console.warn(`[Kafka] Failed to load CA cert from path: ${process.env.KAFKA_CA_CERT_PATH}`, err.message);
    }
  }

  kafkaConfig.ssl = sslConfig;
  kafkaConfig.sasl = {
    mechanism: process.env.KAFKA_SASL_MECHANISM || 'scram-sha-256',
    username: process.env.KAFKA_SASL_USERNAME,
    password: process.env.KAFKA_SASL_PASSWORD,
  };
}

const kafka = new Kafka(kafkaConfig);

// ─── Sample data ───────────────────────────────────────────────────────────
const PRODUCTS = [
  { id: 'PRD001', name: 'Widget Alpha'      },
  { id: 'PRD002', name: 'Gadget Beta'       },
  { id: 'PRD003', name: 'Component Gamma'   },
];

const PURCHASE_PRICES = {
  PRD001: [50, 55, 60, 65],
  PRD002: [20, 22, 25],
  PRD003: [150, 160, 170],
};

/**
 * Generate a realistic batch of events:
 * - Multiple purchases per product (at different prices to make FIFO interesting)
 * - Sales that span across multiple batches (demonstrating multi-batch FIFO)
 */
function generateEvents(count = 10) {
  const events = [];
  const now = Date.now();

  // Always start with purchases so FIFO has batches to draw from
  const purchases = [
    { product_id: 'PRD001', event_type: 'purchase', quantity: 100, unit_price: 50.00,  timestamp: new Date(now - 8 * 3600000).toISOString() },
    { product_id: 'PRD001', event_type: 'purchase', quantity: 60,  unit_price: 55.00,  timestamp: new Date(now - 7 * 3600000).toISOString() },
    { product_id: 'PRD002', event_type: 'purchase', quantity: 200, unit_price: 20.00,  timestamp: new Date(now - 7 * 3600000).toISOString() },
    { product_id: 'PRD003', event_type: 'purchase', quantity: 80,  unit_price: 150.00, timestamp: new Date(now - 6 * 3600000).toISOString() },
    { product_id: 'PRD001', event_type: 'sale',     quantity: 80,                      timestamp: new Date(now - 5 * 3600000).toISOString() },
    // ^ This sale spans 2 batches: 80 from PRD001's first batch (@ $50) = $4,000
    //   Wait – batch 1 has 100 units, so 80 units all from batch 1 @ $50 = $4,000 FIFO cost

    { product_id: 'PRD002', event_type: 'sale',     quantity: 120, timestamp: new Date(now - 4 * 3600000).toISOString() },
    { product_id: 'PRD001', event_type: 'purchase', quantity: 40,  unit_price: 60.00,  timestamp: new Date(now - 3 * 3600000).toISOString() },
    { product_id: 'PRD003', event_type: 'sale',     quantity: 50,  timestamp: new Date(now - 2 * 3600000).toISOString() },
    // ^ spans batches: 50 from PRD003's batch (@ $150) = $7,500

    { product_id: 'PRD001', event_type: 'sale',     quantity: 60,  timestamp: new Date(now - 1 * 3600000).toISOString() },
    // ^ spans 2 batches: remaining 20 from batch1 @ $50 ($1,000) + 40 from batch2 @ $55 ($2,200) = $3,200

    { product_id: 'PRD002', event_type: 'purchase', quantity: 150, unit_price: 22.00,  timestamp: new Date(now - 30 * 60000).toISOString() },
  ];

  // If count <= purchases.length, truncate; otherwise add random extras
  const base = purchases.slice(0, Math.min(count, purchases.length));

  if (count > purchases.length) {
    for (let i = purchases.length; i < count; i++) {
      const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
      const isPourchase = Math.random() > 0.4;
      const prices = PURCHASE_PRICES[product.id];
      events.push({
        product_id: product.id,
        event_type: isPourchase ? 'purchase' : 'sale',
        quantity: Math.ceil(Math.random() * 50) + 5,
        ...(isPourchase && { unit_price: prices[Math.floor(Math.random() * prices.length)] }),
        timestamp: new Date(now - Math.floor(Math.random() * 3600000)).toISOString(),
      });
    }
  }

  return [...base, ...events];
}

// ─── Producer functions ────────────────────────────────────────────────────
async function sendEvents(events) {
  const producer = kafka.producer();

  console.log('\n📦  IMS Kafka Event Simulator');
  console.log('═'.repeat(50));
  console.log(`  Broker : ${BROKERS.join(', ')}`);
  console.log(`  Topic  : ${TOPIC}`);
  console.log(`  Events : ${events.length}`);
  console.log('═'.repeat(50));

  try {
    await producer.connect();
    console.log('✅  Connected to Kafka/Redpanda\n');

    // Ensure topic exists
    const admin = kafka.admin();
    await admin.connect();
    const existingTopics = await admin.listTopics();
    if (!existingTopics.includes(TOPIC)) {
      await admin.createTopics({
        topics: [{ topic: TOPIC, numPartitions: 1, replicationFactor: 1 }],
      });
      console.log(`📋  Created topic: ${TOPIC}`);
    }
    await admin.disconnect();

    // Send all events
    await producer.send({
      topic: TOPIC,
      messages: events.map((e, i) => ({
        key: e.product_id,
        value: JSON.stringify(e),
      })),
    });

    console.log('Events sent:\n');
    events.forEach((e, i) => {
      const icon = e.event_type === 'purchase' ? '🟢 BUY ' : '🔴 SELL';
      const price = e.unit_price ? ` @ $${e.unit_price}` : '';
      console.log(`  ${String(i + 1).padStart(2)}. ${icon}  ${e.product_id}  qty:${e.quantity}${price}  [${e.timestamp}]`);
    });

    console.log(`\n✅  All ${events.length} events sent successfully!`);
    console.log('   Check the dashboard for live updates.\n');
  } finally {
    await producer.disconnect();
  }
}

/** Continuous stream mode – sends a random event every 3 seconds */
async function streamMode() {
  const producer = kafka.producer();
  await producer.connect();
  console.log('🔄  Stream mode: sending random events every 3 seconds (Ctrl+C to stop)\n');

  const interval = setInterval(async () => {
    const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
    const isPurchase = Math.random() > 0.45;
    const prices = PURCHASE_PRICES[product.id];
    const event = {
      product_id: product.id,
      event_type: isPurchase ? 'purchase' : 'sale',
      quantity: Math.ceil(Math.random() * 30) + 5,
      ...(isPurchase && { unit_price: prices[Math.floor(Math.random() * prices.length)] }),
      timestamp: new Date().toISOString(),
    };
    await producer.send({ topic: TOPIC, messages: [{ key: event.product_id, value: JSON.stringify(event) }] });
    const icon = event.event_type === 'purchase' ? '🟢 BUY ' : '🔴 SELL';
    console.log(`  ${icon}  ${event.product_id}  qty:${event.quantity}  @ $${event.unit_price || 'FIFO'}  [${event.timestamp}]`);
  }, 3000);

  process.on('SIGINT', async () => {
    clearInterval(interval);
    await producer.disconnect();
    console.log('\n👋  Stream stopped.');
    process.exit(0);
  });
}

// ─── CLI entry ─────────────────────────────────────────────────────────────
(async () => {
  const args = process.argv.slice(2);
  const countArg = args.indexOf('--count');
  const count = countArg !== -1 ? parseInt(args[countArg + 1]) || 10 : 10;

  try {
    if (args.includes('--stream')) {
      await streamMode();
    } else {
      const events = generateEvents(count);
      await sendEvents(events);
      process.exit(0);
    }
  } catch (err) {
    console.error('\n❌  Error:', err.message);
    console.error('   Make sure Redpanda/Kafka is running: docker compose up redpanda -d');
    process.exit(1);
  }
})();
