# 📦 Inventory Management System (IMS) – FIFO

> A robust, event-driven, real-time inventory tracking system for trading businesses.
> Powered by **Apache Kafka (Aiven)**, **PostgreSQL (Supabase)**, **Node.js/Express**, and **React (Vite)**.

---

## 🔗 Live Deployments & Links

| Resource | Status / URL |
|----------|-----|
| **Frontend (Live)** | [https://inventory-management-system-9fsaa7hti.vercel.app/](https://inventory-management-system-9fsaa7hti.vercel.app/) |
| **Backend API (Live)** | [https://inventory-management-system-r3iz.onrender.com/api/health](https://inventory-management-system-r3iz.onrender.com/api/health) |
| **Database** | Supabase Serverless Postgres (AP-Northeast-2) |
| **Message Broker** | Aiven Apache Kafka Cloud Cluster |

**Default Admin Credentials:**
- **Username:** `admin`
- **Password:** `admin123`

---

## 🧠 Core Engineering Features

### 1. FIFO (First-In, First-Out) Costing Engine
The core business logic assumes that the oldest purchased items are the first ones sold. 
*   Every **Purchase** event creates a unique record in `inventory_batches` keeping track of the purchase price and the remaining unconsumed quantity.
*   Every **Sale** event runs a strict database transaction:
    1. It queries available batches for the product, sorted by `timestamp ASC` (oldest first).
    2. It deducts the sale quantity across batches, calculating the exact cost of goods sold (COGS).
    3. It records the details in `sales` and inserts audit rows in `sale_batch_allocations` to track which purchase batches were consumed.

### 2. High-Performance Concurrency Handling (Race Condition Protection)
When multiple sales for the same product arrive at the exact same millisecond, standard database reads can lead to race conditions (double spending/overselling). To prevent this:
*   We utilize PostgreSQL row-level locks using the **`FOR UPDATE`** clause during the batch selection query.
*   This locks the matched batches, forcing concurrent transactions to queue and wait until the active batch updates are committed, ensuring absolute financial and stock accuracy under high transaction volumes.

### 3. Automatic Schema Initialization & Migrations
You do not need to manually configure schemas. On backend server startup, the system:
1. Verifies connection with PostgreSQL.
2. Reads the `migrations/001_init.sql` script.
3. Automatically creates schemas, indexes, and tables if they do not exist.
4. Seeds default products (`PRD001`, `PRD002`, `PRD003`) safely (`ON CONFLICT DO NOTHING`).

### 4. Network and DNS Handshake Optimization
Connecting Node.js containers to high-latency cloud services (like Aiven Kafka with >300ms RTT) can fail due to Node's default dual-stack Happy Eyeballs resolver timing out handshakes too early.
*   We configured the server DNS defaults to prioritize IPv4 (`ipv4first`).
*   We disabled parallel dual-stack connection attempts (`net.setDefaultAutoSelectFamily(false)`), allowing secure SSL/TLS and SASL handshakes to complete successfully even over high-latency networks.

---

## 🏗 System Architecture

```
[Kafka Simulator]  ──(SASL SSL)──→  [Aiven Kafka Broker]
                                           │
                                  inventory-events topic
                                           │
                                 [Node.js Consumer]
                                           │
                                     [FIFO Service]
                                           │
                              [Supabase Postgres (Session Pooler)]
                                           │
                    [Express REST API]  ←──→  [React Dashboard (Vercel)]
                                           │
                             [Socket.io]  ──→  [Live Event Feed]
```

---

## 🐳 Running Locally with Docker Compose

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### Setup & Run
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/SatyamSinhaa/Inventory-Management-System.git
    cd "Inventory-Management-System"
    ```
2.  **Configure environment variables**:
    Copy `backend/.env.example` to `backend/.env` and configure the values (by default, it points to local services):
    ```bash
    cp backend/.env.example backend/.env
    ```
3.  **Start all services**:
    ```bash
    docker compose up --build -d
    ```
4.  **Access the applications**:
    *   Frontend Dashboard: [http://localhost:5173](http://localhost:5173)
    *   Backend API Health: [http://localhost:3001/api/health](http://localhost:3001/api/health)
    *   Redpanda Web Console: [http://localhost:8080](http://localhost:8080) (for viewing local topics/messages)

---

## ⚡ Running the Kafka Simulator

The project includes a standalone event simulator to test multi-batch FIFO consumption in real-time.

```bash
cd kafka-simulator
npm install
```

### Usage
Ensure you configure a `.env` file in the `kafka-simulator` directory (containing `KAFKA_BROKERS` and optional SASL credentials if running against Aiven).

```bash
# Send 10 default mock events (mix of purchases and sales)
node producer.js

# Send a custom number of events
node producer.js --count 20

# Stream continuous random events every 3 seconds
node producer.js --stream
```

---

## 📡 API Reference

All protected endpoints require an `Authorization: Bearer <token>` header.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST   | `/api/auth/login`              | ❌ | Validate admin credentials & get JWT token |
| GET    | `/api/health`                  | ❌ | Service health status |
| GET    | `/api/products`                | ✅ | Get all products with real-time stock summaries |
| GET    | `/api/products/:id/batches`    | ✅ | View all inventory batches for a product |
| GET    | `/api/ledger`                  | ✅ | Get full transaction ledger (purchases + sales with FIFO cost) |
| GET    | `/api/stats`                   | ✅ | Fetch aggregate dashboard KPIs (Total Inventory, COGS, units sold) |
| GET    | `/api/sales/:id/allocations`   | ✅ | Get precise FIFO batch allocation breakdown for audit |
| POST   | `/api/simulate`                | ✅ | Trigger 10 demo Kafka events from backend |
| POST   | `/api/events`                  | ✅ | Publish a custom event to the Kafka topic |

---

## 🗄 Database Schema

The database consists of the following key tables:
*   `products` - Catalog of items tracked.
*   `inventory_batches` - Tracks individual purchases, original quantities, remaining quantities, and unit prices.
*   `sales` - Tracks sales, quantities sold, and the total cost calculated using the FIFO logic.
*   `sale_batch_allocations` - Complete audit trail mapping which portion of sales consumed which inventory batch.
*   `users` - Authentication records.

---

## 🔑 Configuration Reference (Environment Variables)

### Backend (`backend/.env`)

| Variable | Description | Default / Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `KAFKA_BROKERS` | Comma-separated Kafka bootstrap brokers | `localhost:9092` |
| `KAFKA_TOPIC` | Kafka topic name | `inventory-events` |
| `KAFKA_GROUP_ID` | Consumer group ID | `inventory-consumer-group` |
| `KAFKA_SASL_USERNAME` | SASL Username (optional for cloud brokers) | `avnadmin` |
| `KAFKA_SASL_PASSWORD` | SASL Password (optional for cloud brokers) | `your-password` |
| `KAFKA_SASL_MECHANISM` | SASL authentication mechanism | `scram-sha-256` |
| `KAFKA_CA_CERT_PATH` | Path to the CA certificate file | `ca.pem` |
| `KAFKA_CA_CERT` | Raw PEM string of CA certificate (Render alternative) | `-----BEGIN CERTIFICATE-----\n...` |
| `KAFKA_SSL_REJECT_UNAUTHORIZED`| Toggle strict certificate validation | `true` |
| `JWT_SECRET` | Secret key for signing authentication tokens | `some-long-random-string` |
| `ADMIN_USERNAME` | Admin login username | `admin` |
| `ADMIN_PASSWORD` | Admin login password | `admin123` |

### Frontend (`frontend/.env.example`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Deployed backend REST API base URL | `https://ims-backend.onrender.com` |
| `VITE_WS_URL` | Deployed backend WebSocket server URL | `https://ims-backend.onrender.com` |
