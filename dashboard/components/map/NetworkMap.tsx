'use client';
import { useState } from 'react';
import type { Sensor, SensorStatus } from '@/lib/types';

interface NetworkMapProps {
  sensors: Sensor[];
  selectedIdx: number;
  onSelect: (i: number) => void;
}

const PIN_POSITIONS = [
  { left: '22%', top: '37%' },
  { left: '44%', top: '55%' },
  { left: '60%', top: '29%' },
  { left: '73%', top: '65%' },
  { left: '86%', top: '44%' },
];

function statusToPinClass(status: SensorStatus): string {
  switch (status) {
    case 'normal': return 'ok';
    case 'warning': return 'warn';
    case 'critical': return 'crit';
    case 'offline': return 'off';
  }
}

export default function NetworkMap({ sensors, selectedIdx, onSelect }: NetworkMapProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">
          <span className="dot" />
          Network Map · Derbyshire
        </div>
      </div>
      <div className="map-container">
        {/* Grid background */}
        <div className="map-bg" />

        {/* Water body 1 */}
        <div
          className="map-water"
          style={{
            width: 170,
            height: 85,
            top: 38,
            left: 55,
            opacity: 0.6,
            borderRadius: '40% 60% 55% 45% / 50% 40% 60% 50%',
          }}
        />

        {/* Water body 2 */}
        <div
          className="map-water"
          style={{
            width: 110,
            height: 55,
            top: 175,
            left: 275,
            opacity: 0.4,
            borderRadius: '60% 40% 50% 50%',
          }}
        />

        {/* Road 1 - horizontal */}
        <div
          className="map-road"
          style={{
            left: 0,
            right: 0,
            height: 2,
            top: 128,
          }}
        />

        {/* Road 2 - vertical */}
        <div
          className="map-road"
          style={{
            top: 0,
            bottom: 0,
            width: 2,
            left: 198,
          }}
        />

        {/* Road 3 - angled */}
        <div
          className="map-road"
          style={{
            top: 0,
            height: '65%',
            width: 2,
            left: 345,
            transform: 'rotate(11deg)',
            transformOrigin: 'top',
          }}
        />

        {/* Hint */}
        <div className="map-hint">Hover / click nodes</div>

        {/* Sensor pins */}
        {sensors.map((sensor, i) => {
          const pos = PIN_POSITIONS[i] ?? { left: '50%', top: '50%' };
          const pinClass = statusToPinClass(sensor.status);
          const isSelected = selectedIdx === i;
          const isHovered = hoveredIdx === i;

          return (
            <div
              key={sensor.id}
              className={`sensor-pin ${pinClass}${isSelected ? ' selected' : ''}`}
              style={{ left: pos.left, top: pos.top }}
              onClick={() => onSelect(i)}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="pin-outer">
                <div className="pin-inner" />
              </div>

              {/* Tooltip */}
              {isHovered && (
                <div className="map-tooltip">
                  <div className="tt-name">{sensor.name}</div>
                  <div className="tt-row">
                    <span>Level</span>
                    <span className="tt-val">{sensor.water_level.toFixed(2)}m</span>
                  </div>
                  <div className="tt-row">
                    <span>Status</span>
                    <span className="tt-val" style={{ color: pinClass === 'warn' ? 'var(--amber)' : pinClass === 'crit' ? 'var(--red)' : 'var(--teal)' }}>
                      {sensor.status}
                    </span>
                  </div>
                  <div className="tt-row">
                    <span>Battery</span>
                    <span className="tt-val">{sensor.battery}</span>
                  </div>
                  <div className="tt-row">
                    <span>RSSI</span>
                    <span className="tt-val">{sensor.rssi}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Legend */}
        <div className="map-legend">
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'var(--teal)' }} />
            Normal
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'var(--amber)' }} />
            Warning
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'var(--red)' }} />
            Critical
          </div>
        </div>
      </div>
    </div>
  );
}
