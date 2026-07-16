// src/components/StockOverview.jsx – Product stock cards
import React from 'react';

const fmtCurrency = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
const fmtNum = (n) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n || 0);

function StockCard({ product, maxQty }) {
  const qty   = parseFloat(product.current_qty) || 0;
  const cost  = parseFloat(product.total_inventory_cost) || 0;
  const avg   = parseFloat(product.avg_cost_per_unit) || 0;
  const pct   = maxQty > 0 ? Math.min((qty / maxQty) * 100, 100) : 0;

  return (
    <div className="glass-card product-card">
      <div className="product-id">{product.id}</div>
      <div className="product-name">{product.name}</div>

      <div className="stock-bar">
        <div className="stock-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="product-metrics">
        <div className="metric-row">
          <span className="metric-label">Current Stock</span>
          <span className="metric-value qty">{fmtNum(qty)} units</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Inventory Cost</span>
          <span className="metric-value cost">{fmtCurrency(cost)}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Avg Cost / Unit</span>
          <span className="metric-value avg">{fmtCurrency(avg)}</span>
        </div>
      </div>
    </div>
  );
}

export default function StockOverview({ products, loading }) {
  const maxQty = products.reduce((m, p) => Math.max(m, parseFloat(p.current_qty) || 0), 0);

  if (loading) {
    return (
      <div className="product-grid">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card product-card" style={{ minHeight: 200 }}>
            <div style={{ height: 14, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 10, width: '40%' }} />
            <div style={{ height: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 24, width: '70%' }} />
            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 20 }} />
            {[1, 2, 3].map((j) => (
              <div key={j} style={{ height: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 4, marginBottom: 10 }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
        <div>No products yet. Use "Simulate Events" to generate inventory data.</div>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((p) => (
        <StockCard key={p.id} product={p} maxQty={maxQty} />
      ))}
    </div>
  );
}
