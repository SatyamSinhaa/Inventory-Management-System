// src/components/TransactionLedger.jsx – Time-series ledger table
import React, { useState } from 'react';
import { format } from 'date-fns';

const fmtCurrency = (n) =>
  n != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
    : '—';

const fmtNum = (n) =>
  n != null ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(n) : '—';

const fmtDate = (d) => {
  try { return format(new Date(d), 'MMM dd, HH:mm:ss'); } catch { return d; }
};

export default function TransactionLedger({ ledger, loading }) {
  const [filter, setFilter] = useState('all');

  const filtered = ledger.filter((row) =>
    filter === 'all' ? true : row.event_type === filter
  );

  return (
    <>
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        {['all', 'purchase', 'sale'].map((f) => (
          <button
            key={f}
            className={`filter-btn${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
            id={`filter-${f}`}
          >
            {f === 'all' ? 'All' : f === 'purchase' ? '🟢 Purchases' : '🔴 Sales'}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {filtered.length} records
        </span>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Product</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>FIFO Cost / Value</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No transactions yet. Run "Simulate Events" to populate the ledger.
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((row, i) => {
                const isPurchase = row.event_type === 'purchase';
                return (
                  <tr key={`${row.event_type}-${row.ref_id}-${i}`}>
                    <td>
                      <span className={`badge badge-${row.event_type}`}>
                        {isPurchase ? '↑ Purchase' : '↓ Sale'}
                      </span>
                    </td>
                    <td className="font-mono" style={{ color: 'var(--purple-400)' }}>
                      {row.product_id}
                    </td>
                    <td className="font-mono">{fmtNum(row.quantity)}</td>
                    <td>
                      {isPurchase
                        ? <span style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(row.unit_price)}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td>
                      {isPurchase ? (
                        <span className="text-cyan">{fmtCurrency(row.total_value)}</span>
                      ) : (
                        <span className="text-green" style={{ fontWeight: 700 }}>
                          {fmtCurrency(row.total_cost)}
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                            FIFO
                          </span>
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {fmtDate(row.timestamp)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </>
  );
}
