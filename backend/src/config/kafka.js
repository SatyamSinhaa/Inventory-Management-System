// src/config/kafka.js – KafkaJS client (compatible with Redpanda / Upstash)
require('dotenv').config();
const { Kafka, logLevel } = require('kafkajs');
const fs = require('fs');
const path = require('path');

const kafkaConfig = {
  clientId: 'ims-backend',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  connectionTimeout: 10000,
  authenticationTimeout: 10000,
  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
  logLevel: process.env.NODE_ENV === 'production' ? logLevel.ERROR : logLevel.WARN,
};

// Support cloud deployment with SASL authentication (e.g. Upstash / Aiven Kafka)
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

module.exports = { kafka };
