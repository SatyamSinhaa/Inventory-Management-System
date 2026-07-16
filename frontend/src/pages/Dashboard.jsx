// src/pages/Dashboard.jsx – Main dashboard page
import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import StatsBar from '../components/StatsBar';
import StockOverview from '../components/StockOverview';
import TransactionLedger from '../components/TransactionLedger';
import LiveFeed from '../components/LiveFeed';

export default function Dashboard() {
  const { user, logout } = useAuth();

  const [products, setProducts] = useState([]);
  const [ledger,   setLedger]   = useState([]);
  const [stats,    setStats]    = useState(null);
  const [loadingP, setLoadingP] = useState(true);
  const [loadingL, setLoadingL] = useState(true);
  const [loadingS, setLoadingS] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoadingP(true); setLoadingL(true); setLoadingS(true);
    try {
      const [pRes, lRes, sRes] = await Promise.all([
        api.get('/products'),
        api.get('/ledger?limit=100'),
        api.get('/stats'),
      ]);
      setProducts(pRes.data.products || []);
      setLedger(lRes.data.ledger || []);
      setStats(sRes.data);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoadingP(false); setLoadingL(false); setLoadingS(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Called by LiveFeed when a Kafka event arrives
  const handleLiveUpdate = useCallback(() => {
    // Debounce: refresh after 800ms to batch updates
    setTimeout(fetchAll, 800);
  }, [fetchAll]);

  return (
    <div className="dashboard-page">
      {/* ─── Navbar ─────────────────────────────────────────── */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="7" width="20" height="14" rx="2" fill="url(#g1)" opacity="0.9"/>
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"/>
              <defs>
                <linearGradient id="g1" x1="2" y1="7" x2="22" y2="21" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#7c3aed"/>
                  <stop offset="1" stopColor="#06b6d4"/>
                </linearGradient>
              </defs>
            </svg>
            IMS Dashboard
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="pulse-dot" />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Live</span>
            </div>
            <button
              className="btn btn-ghost"
              onClick={fetchAll}
              style={{ fontSize: 13, padding: '6px 14px' }}
              id="refresh-btn"
            >
              ↻ Refresh
            </button>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              👤 {user?.username}
            </div>
            <button
              id="logout-btn"
              className="btn btn-ghost"
              onClick={logout}
              style={{ fontSize: 13, padding: '6px 14px' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Content ─────────────────────────────────────────── */}
      <div className="container">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Inventory Overview</h1>
            <div className="dashboard-subtitle">
              Real-time FIFO inventory tracking · Kafka-powered · PostgreSQL
            </div>
          </div>
        </div>

        {/* Stats */}
        <StatsBar stats={stats} loading={loadingS} />

        {/* Product stock + Live feed */}
        <div className="main-grid" style={{ marginBottom: 20 }}>
          {/* Stock Overview – full width */}
          <div className="glass-card full-width">
            <div className="section-header">
              <div className="section-title">
                <span>📦</span> Product Stock Overview
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                FIFO-based inventory valuation
              </span>
            </div>
            <div className="section-body">
              <StockOverview products={products} loading={loadingP} />
            </div>
          </div>

          {/* Live Feed */}
          <div className="glass-card" style={{ gridColumn: '2 / -1' }}>
            <div className="section-header">
              <div className="section-title">
                <span>📡</span> Live Event Feed
              </div>
            </div>
            <div className="section-body">
              <LiveFeed onUpdate={handleLiveUpdate} />
            </div>
          </div>

          {/* Placeholder chart area */}
          <div className="glass-card">
            <div className="section-header">
              <div className="section-title">
                <span>📊</span> Inventory Value by Product
              </div>
            </div>
            <div className="section-body">
              {loadingP ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="spinner" />
                </div>
              ) : (
                <InventoryChart products={products} />
              )}
            </div>
          </div>
        </div>

        {/* Transaction Ledger – full width */}
        <div className="glass-card">
          <div className="section-header">
            <div className="section-title">
              <span>🧾</span> Transaction Ledger
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Purchase & sale history with FIFO costing
            </span>
          </div>
          <div className="section-body">
            <TransactionLedger ledger={ledger} loading={loadingL} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Inline bar chart (no extra library needed) ─────────── */
function InventoryChart({ products }) {
  if (!products.length) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No data yet
      </div>
    );
  }

  const maxVal = Math.max(...products.map(p => parseFloat(p.total_inventory_cost) || 0), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
      {products.map((p, i) => {
        const val = parseFloat(p.total_inventory_cost) || 0;
        const pct = (val / maxVal) * 100;
        const colors = ['var(--purple-500)', 'var(--cyan-500)', 'var(--emerald-400)', 'var(--amber-400)', 'var(--rose-400)'];

        return (
          <div key={p.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{p.id} – {p.name}</span>
              <span style={{ color: colors[i % colors.length], fontWeight: 600 }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)}
              </span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: colors[i % colors.length],
                borderRadius: 4,
                transition: 'width 0.8s ease',
                boxShadow: `0 0 10px ${colors[i % colors.length]}`,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
