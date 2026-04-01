'use client';
import { useState, useEffect } from 'react';
import type { GatewayStatus } from '@/lib/types';

interface GatewayPanelProps {
  gateway: GatewayStatus;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export default function GatewayPanel({ gateway }: GatewayPanelProps) {
  const [uptimeSeconds, setUptimeSeconds] = useState(gateway.uptime_seconds);
  const [packetsHr, setPacketsHr] = useState(gateway.packets_hr);

  // Live uptime counter
  useEffect(() => {
    setUptimeSeconds(gateway.uptime_seconds);
    const id = setInterval(() => {
      setUptimeSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [gateway.uptime_seconds]);

  // Packet counter randomized every 8s
  useEffect(() => {
    const id = setInterval(() => {
      setPacketsHr(Math.floor(Math.random() * 9) + 40); // 40-48
    }, 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">
          <span className="dot" />
          Gateway
        </div>
        {gateway.online && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--teal)' }}>
            <div className="gw-online-dot" />
            Online
          </div>
        )}
      </div>
      <div className="gw-panel">
        <div className="gw-status-row">
          <div className="gw-name">{gateway.name}</div>
        </div>
        <div className="gw-row">
          <span className="gw-key">Uptime</span>
          <span className="gw-val live">{formatUptime(uptimeSeconds)}</span>
        </div>
        <div className="gw-row">
          <span className="gw-key">Location</span>
          <span className="gw-val">{gateway.location}</span>
        </div>
        <div className="gw-row">
          <span className="gw-key">Packets/hr</span>
          <span className="gw-val live">{packetsHr}</span>
        </div>
        <div className="gw-row">
          <span className="gw-key">RSSI avg</span>
          <span className="gw-val">{gateway.rssi_avg}</span>
        </div>
        <div className="gw-row">
          <span className="gw-key">Backhaul</span>
          <span className="gw-val">{gateway.backhaul}</span>
        </div>
        <div className="gw-row">
          <span className="gw-key">Firmware</span>
          <span className="gw-val">{gateway.firmware}</span>
        </div>
      </div>
    </div>
  );
}
