'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { fetchAlerts } from '@/lib/api';
import AlertList from '@/components/alerts/AlertList';
import type { Alert } from '@/lib/types';

const TYPE_OPTIONS = [
  { label: 'All Types', value: '' },
  { label: 'Warning', value: 'warn' },
  { label: 'Resolved', value: 'ok' },
  { label: 'Info', value: 'info' },
] as const;

const NODE_OPTIONS = [
  { label: 'All Nodes', value: '' },
  { label: 'CS-001', value: 'CS-001' },
  { label: 'CS-002', value: 'CS-002' },
  { label: 'CS-003', value: 'CS-003' },
  { label: 'CS-004', value: 'CS-004' },
  { label: 'CS-005', value: 'CS-005' },
  { label: 'System', value: 'System' },
];

export default function AlertsPage() {
  const [filterType, setFilterType] = useState('');
  const [filterNode, setFilterNode] = useState('');

  const { data: alerts = [] } = useSWR('alerts', fetchAlerts, { refreshInterval: 30_000 });

  const filtered: Alert[] = alerts.filter((a) => {
    if (filterType && a.type !== filterType) return false;
    if (filterNode && a.node !== filterNode) return false;
    return true;
  });

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Alert History</div>
        <span className="topbar-sub">{alerts.length} total alerts</span>
        <div className="topbar-right">
          <div className="filter-row">
            <select
              className="filter-select"
              value={filterNode}
              onChange={(e) => setFilterNode(e.target.value)}
            >
              {NODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              className="filter-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">
              <span className="dot" style={{ background: 'var(--amber)' }} />
              Alerts
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {filtered.length} of {alerts.length} shown
            </span>
          </div>
          {filtered.length > 0 ? (
            <AlertList alerts={filtered} />
          ) : (
            <div className="empty-state">
              No alerts match the current filters.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
