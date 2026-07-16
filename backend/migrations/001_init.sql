-- =============================================================
-- Inventory Management System – PostgreSQL Schema (FIFO)
-- =============================================================

-- Products
CREATE TABLE IF NOT EXISTS products (
    id          VARCHAR(20) PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Inventory batches (each purchase creates one batch)
CREATE TABLE IF NOT EXISTS inventory_batches (
    id            SERIAL PRIMARY KEY,
    product_id    VARCHAR(20)    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity      DECIMAL(12, 4) NOT NULL CHECK (quantity > 0),
    remaining_qty DECIMAL(12, 4) NOT NULL CHECK (remaining_qty >= 0),
    unit_price    DECIMAL(12, 4) NOT NULL CHECK (unit_price >= 0),
    timestamp     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_product_ts
    ON inventory_batches(product_id, timestamp ASC);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
    id            SERIAL PRIMARY KEY,
    product_id    VARCHAR(20)    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_sold DECIMAL(12, 4) NOT NULL CHECK (quantity_sold > 0),
    total_cost    DECIMAL(12, 4) NOT NULL CHECK (total_cost >= 0),
    timestamp     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_product_ts
    ON sales(product_id, timestamp ASC);

-- Sale-to-batch allocations (audit trail for FIFO)
CREATE TABLE IF NOT EXISTS sale_batch_allocations (
    id            SERIAL PRIMARY KEY,
    sale_id       INT            NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    batch_id      INT            NOT NULL REFERENCES inventory_batches(id),
    quantity_used DECIMAL(12, 4) NOT NULL CHECK (quantity_used > 0),
    unit_price    DECIMAL(12, 4) NOT NULL,
    created_at    TIMESTAMPTZ    DEFAULT NOW()
);

-- Users (basic auth)
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- Seed default products
INSERT INTO products (id, name, description) VALUES
    ('PRD001', 'Widget Alpha',  'Standard aluminum widget'),
    ('PRD002', 'Gadget Beta',   'Electronic micro-gadget'),
    ('PRD003', 'Component Gamma', 'Precision machined component')
ON CONFLICT (id) DO NOTHING;
