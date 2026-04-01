'use client';
import { useState } from 'react';
import type { Alert } from '@/lib/types';

interface AlertListProps {
  alerts: Alert[];
}

function WarnIcon() {
  return (
    <svg className="alert-icon" viewBox="0 0 18 18" fill="none">
      <path d="M9 1.5L1.5 15h15L9 1.5z" stroke="var(--amber)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M9 7v4" stroke="var(--amber)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="9" cy="13" r="0.7" fill="var(--amber)" />
    </svg>
  );
}

function OkIcon() {
  return (
    <svg className="alert-icon" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="var(--teal)" strokeWidth="1.4" />
      <path d="M5.5 9l2.5 2.5 4.5-5" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="alert-icon" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="var(--blue)" strokeWidth="1.4" />
      <path d="M9 8v5" stroke="var(--blue)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="9" cy="5.5" r="0.7" fill="var(--blue)" />
    </svg>
  );
}

function badgeClass(badge: Alert['badge']): string {
  switch (badge) {
    case 'ACTIVE': return 'alert-badge badge-active';
    case 'RESOLVED': return 'alert-badge badge-resolved';
    case 'ALERT': return 'alert-badge badge-alert';
    case 'INFO': return 'alert-badge badge-info';
  }
}

function AlertRow({ alert }: { alert: Alert }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="alert-row" onClick={() => setExpanded((e) => !e)}>
      <div className="alert-row-head">
        {alert.type === 'warn' && <WarnIcon />}
        {alert.type === 'ok' && <OkIcon />}
        {alert.type === 'info' && <InfoIcon />}
        <div className="alert-msg">{alert.msg}</div>
        <span className={badgeClass(alert.badge)}>{alert.badge}</span>
      </div>
      <div className="alert-meta">
        <span>{alert.time}</span>
        <span>·</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{alert.node}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: 10 }}>
          {expanded ? '▲ hide' : '▼ details'}
        </span>
      </div>
      <div className={`alert-detail${expanded ? ' expanded' : ''}`}>
        <div className="alert-detail-inner">{alert.detail}</div>
      </div>
    </div>
  );
}

export default function AlertList({ alerts }: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <div className="empty-state">No alerts to display.</div>
    );
  }

  return (
    <div>
      {alerts.map((alert) => (
        <AlertRow key={alert.id} alert={alert} />
      ))}
    </div>
  );
}
