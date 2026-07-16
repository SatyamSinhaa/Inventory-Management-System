// src/services/kafkaConsumer.js – Kafka / Redpanda consumer
require('dotenv').config();
const { kafka } = require('../config/kafka');
const { handlePurchase, handleSale } = require('./fifoService');

let consumer = null;
let _emitter = null;  // Socket.io instance injected at startup

/**
 * Start the Kafka consumer. Listens on the `inventory-events` topic.
 * @param {object} io  Socket.io server instance for real-time push
 */
async function startConsumer(io) {
  _emitter = io;

  consumer = kafka.consumer({
    groupId: process.env.KAFKA_GROUP_ID || 'inventory-consumer-group',
  });

  await consumer.connect();
  console.log('[Kafka] Consumer connected');

  const topic = process.env.KAFKA_TOPIC || 'inventory-events';

  // Create topic if it doesn't exist (Redpanda auto-creates, but being explicit)
  const admin = kafka.admin();
  await admin.connect();
  const topics = await admin.listTopics();
  if (!topics.includes(topic)) {
    await admin.createTopics({
      topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
    });
    console.log(`[Kafka] Created topic: ${topic}`);
  }
  await admin.disconnect();

  await consumer.subscribe({ topic, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      let payload;
      try {
        payload = JSON.parse(message.value.toString());
      } catch (e) {
        console.error('[Kafka] Invalid JSON message:', message.value.toString());
        return;
      }

      const { product_id, event_type, quantity, unit_price, timestamp } = payload;

      if (!product_id || !event_type || !quantity) {
        console.warn('[Kafka] Skipping incomplete event:', payload);
        return;
      }

      console.log(`[Kafka] Received ${event_type} event for ${product_id} – qty: ${quantity}`);

      try {
        if (event_type === 'purchase') {
          if (!unit_price) {
            console.warn('[Kafka] Purchase event missing unit_price, skipping.');
            return;
          }
          await handlePurchase({ product_id, quantity, unit_price, timestamp }, io);
        } else if (event_type === 'sale') {
          await handleSale({ product_id, quantity, timestamp }, io);
        } else {
          console.warn('[Kafka] Unknown event_type:', event_type);
        }
      } catch (err) {
        console.error(`[Kafka] Error processing ${event_type} for ${product_id}:`, err.message);
        // Emit error to frontend for display
        if (io) {
          io.emit('kafkaError', { product_id, event_type, error: err.message });
        }
      }
    },
  });

  console.log(`[Kafka] Subscribed to topic: ${topic}`);
}

/**
 * Gracefully disconnect the consumer.
 */
async function stopConsumer() {
  if (consumer) {
    await consumer.disconnect();
    console.log('[Kafka] Consumer disconnected');
  }
}

module.exports = { startConsumer, stopConsumer };
