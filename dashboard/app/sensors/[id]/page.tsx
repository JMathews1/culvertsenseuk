'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { fetchSensors, fetchAlerts } from '@/lib/api';
import { MOCK_CHART_DATA, MOCK_CHART_LABELS } from '@/lib/mock-data';
import WaterLevelChart from '@/components/charts/WaterLevelChart';
import AlertList from '@/components/alerts/AlertList';
import type { SensorStatus } from '@/lib/types';

function levelColor(status: SensorStatus): string {
  switch (status) {
    case 'normal': return 'var(--teal)';
    case 'warning': return 'var(--amber)';
    case 'critical': return 'var(--red)';
    case 'offline': return 'var(--text-dim)';
  }
}

function statusBadgeStyle(status: SensorStatus): React.CSSProperties {
  switch (status) {
    case 'normal':
      return { background: 'var(--teal-dim)', color: 'var(--teal)', border: '1px solid rgba(0,196,160,0.3)' };
    case 'warning':
      return { background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(245,166,35,0.3)' };
    case 'critical':
      return { background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(232,69,60,0.3)' };
    case 'offline':
      return { background: 'var(--surface3)', color: 'var(--text-dim)', border: '1px solid var(--border)' };
  }
}

export default function SensorDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id.toUpperCase() : '';

  const { data: sensors = [] } = useSWR('sensors', fetchSensors);
  const { data: alerts = [] } = useSWR('alerts', fetchAlerts);

  const sensor = sensors.find((s) => s.id === id);
  const sensorAlerts = alerts.filter((a) => a.node === id);

  const chartIdx = MOCK_CHART_DATA.findIndex((d) =>
    sensor ? d.label === sensor.name : false,
  );
  const chartIndex = chartIdx >= 0 ? chartIdx : 0;

  if (sensors.length > 0 && !sensor) {
    return (
      <div className="content">
        <Link href="/" className="back-btn">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Overview
        </Link>
        <div className="panel">
          <div className="empty-state">Sensor {id} not found.</div>
        </div>
      </div>
    );
  }

  if (!sensor) {
    return (
      <div className="content">
        <div className="panel">
          <div className="empty-state">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Sensor Detail</div>
        <span className="topbar-sub">{sensor.id} · {sensor.name}</span>
      </div>
      <div className="content">
        <Link href="/" className="back-btn">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Overview
        </Link>

        {/* Header card */}
        <div className="panel">
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  {sensor.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  {sensor.lat}N, {sensor.lng}W · Updated {sensor.updated}
                </div>
              </div>
              <span
                style={{
                  ...statusBadgeStyle(sensor.status),
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {sensor.status}
              </span>
            </div>

            {/* Large level display */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                Current Water Level
              </div>
              <div
                className="detail-level"
                style={{ color: levelColor(sensor.status) }}
              >
                {sensor.water_level.toFixed(2)}m
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                {sensor.pct}% of alert threshold ({sensor.threshold_warning}m)
              </div>
            </div>

            {/* Stats grid */}
            <div className="detail-stats-grid">
              <div className="detail-stat">
                <div className="detail-stat-label">Battery</div>
                <div className="detail-stat-value">{sensor.battery}</div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-label">RSSI</div>
                <div className="detail-stat-value">{sensor.rssi}</div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-label">Warning Threshold</div>
                <div className="detail-stat-value" style={{ color: 'var(--amber)' }}>{sensor.threshold_warning}m</div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-label">Critical Threshold</div>
                <div className="detail-stat-value" style={{ color: 'var(--red)' }}>{sensor.threshold_critical}m</div>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <WaterLevelChart
          datasets={MOCK_CHART_DATA}
          labels={MOCK_CHART_LABELS}
          selectedIdx={chartIndex}
          onSelect={() => {}}
        />

        {/* Sensor alerts */}
        {sensorAlerts.length > 0 && (
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">
                <span className="dot" style={{ background: 'var(--amber)' }} />
                Recent Alerts for {sensor.id}
              </div>
            </div>
            <AlertList alerts={sensorAlerts} />
          </div>
        )}
      </div>
    </>
  );
}
