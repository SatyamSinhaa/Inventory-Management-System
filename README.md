# 📦 Inventory Management System (IMS) – FIFO

> Real-time inventory management for small trading businesses.
> Powered by **Apache Kafka (Redpanda)**, **PostgreSQL**, **Node.js/Express**, and **React**.

---

## 🔗 Links

| Resource | URL |
|----------|-----|
| Frontend (Live) | _Deploy and update this_ |
| Backend API     | _Deploy and update this_ |
| Redpanda Console | http://localhost:8080 (local) |

**Login Credentials:**
- Username: `admin`
- Password: `admin123`

---

## 🧠 FIFO Logic Explained

**FIFO (First-In, First-Out)** means the cost of goods is assigned in the order inventory was acquired.

### How it works

```
Purchase Batch 1: 100 units @ $50.00 each   → total batch value: $5,000
Purchase Batch 2:  60 units @ $55.00 each   → total batch value: $3,300

Sale of 120 units:
  → 100 units from Batch 1 @ $50.00 = $5,000   (batch fully consumed)
  →  20 units from Batch 2 @ $55.00 = $1,100   (partial consumption)
  → Total FIFO Cost = $6,100

Remaining inventory after sale:
  → Batch 2: 40 units @ $55.00 = $2,200
```

### Why FIFO matters

- **Financial accuracy**: Oldest costs are matched against revenue first.
- **Inflation visibility**: Rising prices show more clearly in remaining inventory value.
- **Compliance**: FIFO is accepted under GAAP and IFRS standards.

### Implementation details

- Every `purchase` event creates a new `inventory_batches` record.
- Every `sale` event runs a **transaction** that:
  1. Selects batches with `remaining_qty > 0` ordered by `timestamp ASC`.
  2. Deducts quantity from the oldest batch first.
  3. Accumulates cost: `consumed_qty × unit_price` per batch.
  4. Inserts into `sales` with `total_cost = sum of all batch costs`.
  5. Inserts into `sale_batch_allocations` for a full audit trail.

---

## 🏗 Architecture

```
[Kafka Simulator]  ──→  [Redpanda Broker]
                              │
                         inventory-events topic
                              │
                    [Node.js Kafka Consumer]
                              │
                       [FIFO Service]
                              │
                       [PostgreSQL DB]
                              │
                    [Express REST API]  ←──→  [React Dashboard]
                              │
                       [Socket.io]  ──→  [Live Feed]
```

---

## 🐳 Running Locally with Docker Compose

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Node.js 20+ (for the Kafka simulator)

### Start all services

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd "Inventory Management System"

# 2. Start everything (Redpanda + PostgreSQL + Backend + Frontend)
docker compose up --build

# 3. Wait ~30 seconds for all services to be healthy, then visit:
# Frontend:         http://localhost:5173
# Backend API:      http://localhost:3001/api/health
# Redpanda Console: http://localhost:8080
```

### Stop all services

```bash
docker compose down
# To also remove volumes (delete all data):
docker compose down -v
```

---

## ⚡ Running the Kafka Simulator

The simulator sends events directly to the Redpanda broker.

### Setup

```bash
cd kafka-simulator
npm install
```

### Usage

```bash
# Send 10 default events (mix of purchases and sales)
node producer.js

# Send a custom number of events
node producer.js --count 20

# Continuous stream (one random event every 3 seconds)
node producer.js --stream
```

### Custom broker / topic

```bash
KAFKA_BROKERS=your-broker:9092 KAFKA_TOPIC=inventory-events node producer.js
```

### Sample event format

```json
{
  "product_id": "PRD001",
  "event_type": "purchase",
  "quantity": 100,
  "unit_price": 50.00,
  "timestamp": "2025-07-12T10:00:00Z"
}
```

```json
{
  "product_id": "PRD001",
  "event_type": "sale",
  "quantity": 60,
  "timestamp": "2025-07-12T12:00:00Z"
}
```

> Note: `unit_price` is only required for **purchase** events. Sales are automatically costed using FIFO.

---

## 🌐 Deployment Guide

### Option A: Railway (Recommended)

1. **PostgreSQL**: Add a PostgreSQL plugin in your Railway project.
2. **Kafka**: Use [Upstash Kafka](https://upstash.com/kafka) (free tier) or [Confluent Cloud](https://confluent.io) free tier.
3. **Backend**:
   ```bash
   cd backend
   railway init
   railway up
   ```
   Set environment variables in Railway dashboard:
   - `DATABASE_URL` – from Railway PostgreSQL plugin
   - `KAFKA_BROKERS` – from Upstash/Confluent
   - `JWT_SECRET` – any long random string
   - `ADMIN_PASSWORD` – your preferred password

4. **Frontend**:
   ```bash
   cd frontend
   # Set VITE_API_URL and VITE_WS_URL to your backend Railway URL
   railway up
   ```

### Option B: Render

1. Push code to GitHub.
2. On Render, create a new **Web Service** (Docker) pointing to `/backend`.
3. Create a **PostgreSQL** database on Render.
4. Set env vars as shown in `backend/render.yaml`.
5. Create another Web Service for `/frontend` (Docker).
6. Set `VITE_API_URL` build arg to the backend Render URL.

### Option C: Fly.io

```bash
# Backend
cd backend
fly launch --name ims-backend
fly postgres create --name ims-db
fly postgres attach ims-db
fly deploy

# Frontend
cd frontend
fly launch --name ims-frontend
fly deploy --build-arg VITE_API_URL=https://ims-backend.fly.dev
```

---

## 📡 API Reference

All protected endpoints require `Authorization: Bearer <token>` header.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST   | `/api/auth/login`              | ❌ | Get JWT token |
| GET    | `/api/health`                  | ❌ | Health check |
| GET    | `/api/products`                | ✅ | All products + stock summary |
| GET    | `/api/products/:id/batches`    | ✅ | Inventory batches for a product |
| GET    | `/api/ledger`                  | ✅ | Time-series of all transactions |
| GET    | `/api/stats`                   | ✅ | Dashboard summary statistics |
| GET    | `/api/sales/:id/allocations`   | ✅ | FIFO batch breakdown for a sale |
| POST   | `/api/simulate`                | ✅ | Send 10 demo Kafka events |
| POST   | `/api/events`                  | ✅ | Send a custom event to Kafka |

---

## 🗄 Database Schema

```sql
products               → product catalog
inventory_batches      → each purchase = one batch (with unit_price)
sales                  → each sale (with FIFO total_cost)
sale_batch_allocations → audit trail: which batches contributed to each sale
users                  → authentication
```

---

## 📁 Project Structure

```
Inventory Management System/
├── backend/
│   ├── migrations/001_init.sql     ← PostgreSQL schema
│   ├── src/
│   │   ├── config/db.js            ← PostgreSQL pool
│   │   ├── config/kafka.js         ← KafkaJS client
│   │   ├── services/
│   │   │   ├── fifoService.js      ← FIFO core logic ⭐
│   │   │   ├── kafkaConsumer.js    ← Event consumer
│   │   │   └── kafkaProducer.js    ← Simulate endpoint producer
│   │   ├── controllers/            ← REST handlers
│   │   ├── routes/index.js         ← API routes
│   │   ├── middleware/auth.js      ← JWT auth
│   │   └── index.js               ← Server entry
│   ├── Dockerfile
│   ├── render.yaml
│   └── railway.toml
├── frontend/
│   ├── src/
│   │   ├── pages/Login.jsx         ← Login page
│   │   ├── pages/Dashboard.jsx     ← Main dashboard
│   │   ├── components/
│   │   │   ├── StatsBar.jsx        ← Summary KPIs
│   │   │   ├── StockOverview.jsx   ← Product cards
│   │   │   ├── TransactionLedger.jsx ← Ledger table
│   │   │   └── LiveFeed.jsx        ← Socket.io live feed
│   │   ├── context/AuthContext.jsx ← Auth state
│   │   └── api/client.js          ← Axios client
│   └── Dockerfile
├── kafka-simulator/
│   └── producer.js                ← Standalone event producer ⭐
├── docker-compose.yml             ← Full stack orchestration
└── README.md
```

---

## 🔑 Environment Variables

### Backend

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `KAFKA_BROKERS` | Comma-separated Kafka brokers | `localhost:9092` |
| `KAFKA_TOPIC` | Topic name | `inventory-events` |
| `KAFKA_GROUP_ID` | Consumer group ID | `inventory-consumer-group` |
| `JWT_SECRET` | Secret for JWT signing | any random string |
| `ADMIN_USERNAME` | Login username | `admin` |
| `ADMIN_PASSWORD` | Login password | `admin123` |

### Frontend (build-time)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend base URL | `https://ims-backend.railway.app` |
| `VITE_WS_URL` | WebSocket URL | `https://ims-backend.railway.app` |

---

## 🧪 Testing FIFO Accuracy

Run the simulator and check the ledger:

```bash
node kafka-simulator/producer.js
```

Expected FIFO calculation for PRD001:
- Batch 1: 100 units @ $50
- Batch 2:  60 units @ $55
- **Sale of 80 units** → 80 from Batch 1 @ $50 = **$4,000** ✓
- **Sale of 60 units** → 20 from Batch 1 @ $50 + 40 from Batch 2 @ $55 = **$1,000 + $2,200 = $3,200** ✓
