'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { fetchSensors } from '@/lib/api';
import type { SensorStatus } from '@/lib/types';

function statusLabel(status: SensorStatus): string {
  switch (status) {
    case 'normal': return 'Normal';
    case 'warning': return 'Warning';
    case 'critical': return 'Critical';
    case 'offline': return 'Offline';
  }
}

function statusColor(status: SensorStatus): string {
  switch (status) {
    case 'normal': return 'var(--teal)';
    case 'warning': return 'var(--amber)';
    case 'critical': return 'var(--red)';
    case 'offline': return 'var(--text-dim)';
  }
}

export default function SensorsPage() {
  const { data: sensors = [] } = useSWR('sensors', fetchSensors, { refreshInterval: 30_000 });

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Live Feed</div>
        <span className="topbar-sub">{sensors.length} sensor nodes · Derbyshire</span>
      </div>
      <div className="content">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">
              <span className="dot" />
              Sensor Nodes
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {sensors.filter((s) => s.status !== 'offline').length}/{sensors.length} online
            </span>
          </div>
          {sensors.map((sensor) => (
            <Link
              key={sensor.id}
              href={`/sensors/${sensor.id.toLowerCase()}`}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div className="sensor-row">
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div
                    className="s-dot"
                    style={{ background: statusColor(sensor.status) }}
                  />
                </div>
                <div>
                  <div className="s-name">{sensor.name}</div>
                  <div className="s-id">{sensor.id} · {sensor.lat}N {sensor.lng}W</div>
                  <div style={{ marginTop: 5 }}>
                    <div className="s-bar-w">
                      <div
                        className="s-bar"
                        style={{ width: `${sensor.pct}%`, background: statusColor(sensor.status) }}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="s-level" style={{ color: statusColor(sensor.status) }}>
                    {sensor.water_level.toFixed(2)}m
                  </div>
                  <div className="s-updated">{sensor.updated}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {sensor.battery}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    {sensor.rssi}
                  </div>
                  <div style={{ fontSize: 10, color: statusColor(sensor.status), fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    {statusLabel(sensor.status)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
