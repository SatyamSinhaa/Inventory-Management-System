// src/components/StatsBar.jsx – Summary statistics cards
import React from 'react';

function fmt(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n || 0);
}
function fmtNum(n) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n || 0);
}

export default function StatsBar({ stats, loading }) {
  const cards = [
    { icon: '📦', label: 'Products',          value: stats?.total_products        || 0,  format: fmtNum,  color: '#a78bfa' },
    { icon: '🏭', label: 'Units on Hand',     value: stats?.total_units_on_hand   || 0,  format: fmtNum,  color: '#22d3ee' },
    { icon: '💰', label: 'Inventory Value',   value: stats?.total_inventory_value || 0,  format: fmt,     color: '#34d399' },
    { icon: '🧾', label: 'Total Sales',       value: stats?.total_sales           || 0,  format: fmtNum,  color: '#fbbf24' },
    { icon: '📉', label: 'COGS (FIFO)',       value: stats?.total_cost_of_goods_sold || 0, format: fmt,  color: '#fb7185' },
  ];

  return (
    <div className="stats-grid">
      {cards.map((c) => (
        <div key={c.label} className="glass-card stat-card">
          <div className="stat-icon">{c.icon}</div>
          {loading ? (
            <div style={{ height: 32, background: 'rgba(255,255,255,0.05)', borderRadius: 6, marginBottom: 8 }} />
          ) : (
            <div className="stat-value" style={{ fontSize: 24 }}>
              {c.format(c.value)}
            </div>
          )}
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
