// src/components/LiveFeed.jsx – Real-time Socket.io event feed
import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { format } from 'date-fns';
import { api } from '../api/client';

const WS_URL = import.meta.env.VITE_WS_URL || '';

const fmtCurrency = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);

function FeedItem({ item }) {
  const isPurchase = item.event_type === 'purchase';
  const isError    = item.event_type === 'error';

  const icon  = isError ? '⚠️' : isPurchase ? '🟢' : '🔴';
  const label = isError ? 'Error'
    : isPurchase ? `Purchased ${item.batch?.quantity ?? '?'} units`
    : `Sold ${item.sale?.quantity_sold ?? '?'} units`;

  const sub = isError
    ? item.error
    : isPurchase
      ? `${item.product_id}  ·  @ $${item.batch?.unit_price ?? '?'} / unit`
      : `${item.product_id}  ·  FIFO cost ${fmtCurrency(item.sale?.total_cost)}`;

  return (
    <div className="feed-item" style={isError ? { borderColor: 'rgba(251,113,133,0.3)' } : {}}>
      <span className="feed-item-icon">{icon}</span>
      <div className="feed-item-body">
        <div className="feed-item-title">{label}</div>
        <div className="feed-item-meta">{sub} · {format(new Date(item.ts), 'HH:mm:ss')}</div>
      </div>
    </div>
  );
}

export default function LiveFeed({ onUpdate }) {
  const [events, setEvents]   = useState([]);
  const [simulating, setSim]  = useState(false);
  const [connected, setConn]  = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(WS_URL, { path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect',    () => setConn(true));
    socket.on('disconnect', () => setConn(false));

    socket.on('inventoryUpdate', (data) => {
      setEvents((prev) => [{ ...data, ts: new Date().toISOString() }, ...prev].slice(0, 50));
      if (onUpdate) onUpdate();
    });

    socket.on('kafkaError', (data) => {
      setEvents((prev) => [{ event_type: 'error', ...data, ts: new Date().toISOString() }, ...prev].slice(0, 50));
    });

    return () => socket.disconnect();
  }, [onUpdate]);

  const simulate = async () => {
    setSim(true);
    try {
      await api.post('/simulate');
    } catch (err) {
      console.error('Simulate error:', err);
    } finally {
      setTimeout(() => setSim(false), 3000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <span className="pulse-dot" style={{ background: connected ? 'var(--emerald-400)' : 'var(--rose-400)' }} />
          <span style={{ color: connected ? 'var(--emerald-400)' : 'var(--rose-400)' }}>
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
        <button
          id="simulate-btn"
          className="btn btn-primary"
          onClick={simulate}
          disabled={simulating}
          style={{ marginLeft: 'auto', fontSize: 13, padding: '8px 16px' }}
        >
          {simulating ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              Sending…
            </>
          ) : (
            '⚡ Simulate Events'
          )}
        </button>
        {events.length > 0 && (
          <button
            className="btn btn-ghost"
            onClick={() => setEvents([])}
            style={{ fontSize: 13, padding: '8px 16px' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Feed list */}
      <div className="live-feed">
        {events.length === 0 ? (
          <div className="feed-empty">
            <div style={{ fontSize: 28, marginBottom: 8 }}>📡</div>
            <div>Waiting for live events…</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Click "Simulate Events" to push Kafka messages</div>
          </div>
        ) : (
          events.map((ev, i) => <FeedItem key={i} item={ev} />)
        )}
      </div>
    </div>
  );
}
