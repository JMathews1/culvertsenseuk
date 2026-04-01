'use client';
import type { Sensor, SensorStatus } from '@/lib/types';

interface SensorTableProps {
  sensors: Sensor[];
  selectedIdx: number;
  onSelect: (i: number) => void;
}

function statusDotClass(status: SensorStatus): string {
  switch (status) {
    case 'normal': return 's-dot s-ok';
    case 'warning': return 's-dot s-warn';
    case 'critical': return 's-dot s-crit';
    case 'offline': return 's-dot s-off';
  }
}

function levelClass(status: SensorStatus): string {
  switch (status) {
    case 'normal': return 's-level ok';
    case 'warning': return 's-level warn';
    case 'critical': return 's-level crit';
    case 'offline': return 's-level';
  }
}

function rowSelClass(status: SensorStatus, selected: boolean): string {
  if (!selected) return '';
  return status === 'warning' || status === 'critical' ? 'sel-warn' : 'sel-ok';
}

function barColor(status: SensorStatus): string {
  switch (status) {
    case 'normal': return 'var(--teal)';
    case 'warning': return 'var(--amber)';
    case 'critical': return 'var(--red)';
    case 'offline': return 'var(--text-dim)';
  }
}

export default function SensorTable({ sensors, selectedIdx, onSelect }: SensorTableProps) {
  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-head">
        <div className="panel-title">
          <span className="dot" />
          Sensor Nodes
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          {sensors.length} active
        </span>
      </div>
      <div>
        {sensors.map((sensor, i) => {
          const selected = selectedIdx === i;
          return (
            <div
              key={sensor.id}
              className={`sensor-row ${rowSelClass(sensor.status, selected)}`}
              onClick={() => onSelect(i)}
            >
              {/* Status dot */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div className={statusDotClass(sensor.status)} />
              </div>

              {/* Name + ID */}
              <div>
                <div className="s-name">{sensor.name}</div>
                <div className="s-id">{sensor.id} · {sensor.lat}N {sensor.lng}W</div>
                {/* Bar */}
                <div style={{ marginTop: 5 }}>
                  <div className="s-bar-w">
                    <div
                      className="s-bar"
                      style={{
                        width: `${sensor.pct}%`,
                        background: barColor(sensor.status),
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Level */}
              <div>
                <div className={levelClass(sensor.status)}>
                  {sensor.water_level.toFixed(2)}m
                </div>
                <div className="s-updated">{sensor.updated}</div>
              </div>

              {/* Battery / RSSI */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  {sensor.battery}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {sensor.rssi}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
