'use client';
import { useState } from 'react';
import useSWR from 'swr';
import useLiveClock from '@/hooks/useLiveClock';
import useAnimatedCounter from '@/hooks/useAnimatedCounter';
import { fetchSensors, fetchAlerts, fetchGateway, fetchSavings } from '@/lib/api';
import { MOCK_CHART_DATA, MOCK_CHART_LABELS } from '@/lib/mock-data';
import NetworkMap from '@/components/map/NetworkMap';
import SensorTable from '@/components/sensors/SensorTable';
import WaterLevelChart from '@/components/charts/WaterLevelChart';
import GatewayPanel from '@/components/gateway/GatewayPanel';
import SavingsPanel from '@/components/savings/SavingsPanel';
import AlertList from '@/components/alerts/AlertList';

export default function DashboardPage() {
  const clock = useLiveClock();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const savingsCounter = useAnimatedCounter(33750);

  const { data: sensors = [] } = useSWR('sensors', fetchSensors, { refreshInterval: 30_000 });
  const { data: alerts = [] } = useSWR('alerts', fetchAlerts, { refreshInterval: 30_000 });
  const { data: gateway } = useSWR('gateway', fetchGateway, { refreshInterval: 30_000 });
  const { data: savings } = useSWR('savings', fetchSavings);

  const activeAlerts = alerts.filter((a) => a.badge === 'ACTIVE' || a.badge === 'ALERT');
  const activeAlert = activeAlerts[0];
  const lastUpdated = sensors[0]?.updated ?? '—';
  const lastSensor = sensors.reduce<string>((best, s) => {
    if (!best) return s.name;
    const tA = parseInt(s.updated);
    const tB = parseInt(best);
    return tA < tB ? s.name : best;
  }, '');

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-title">Operations Overview</div>
        <span className="topbar-sub">
          HRM Stormwater · {sensors.length} nodes · pilot yr 1
        </span>
        <div className="topbar-right">
          <div className="live-pill">
            <div className="live-dot" />
            LIVE
          </div>
          <div className="time-display">{clock}</div>
        </div>
      </div>

      <div className="content">
        {/* Stat strip */}
        <div className="stat-strip">
          <div className="stat-card ok">
            <div className="stat-label">Online Nodes</div>
            <div className="stat-value">{sensors.filter((s) => s.status !== 'offline').length}/{sensors.length || 5}</div>
            <div className="stat-desc">All nodes reporting</div>
          </div>
          <div className="stat-card warn">
            <div className="stat-label">Active Alerts</div>
            <div className="stat-value">{activeAlerts.length || 1}</div>
            <div className="stat-desc">
              {activeAlert ? activeAlert.node + ' — elevated' : 'Cole Harbour Rd — elevated'}
            </div>
          </div>
          <div className="stat-card info">
            <div className="stat-label">Last Packet</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{lastUpdated}</div>
            <div className="stat-desc">{lastSensor || sensors[0]?.name || 'Cole Harbour Rd'}</div>
          </div>
          <div className="stat-card save">
            <div className="stat-label">Est. Savings YTD</div>
            <div className="stat-value" style={{ fontSize: 20 }}>${savingsCounter.toLocaleString()}</div>
            <div className="stat-desc">Based on pilot yr 1 data</div>
          </div>
        </div>

        {/* 3:1 grid */}
        <div className="grid-3-1">
          {sensors.length > 0 ? (
            <NetworkMap
              sensors={sensors}
              selectedIdx={selectedIdx}
              onSelect={setSelectedIdx}
            />
          ) : (
            <div className="panel" style={{ height: 380 }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {gateway && <GatewayPanel gateway={gateway} />}
            {savings && <SavingsPanel savings={savings} />}
          </div>
        </div>

        {/* 2-col grid */}
        <div className="grid-2">
          {sensors.length > 0 && (
            <SensorTable
              sensors={sensors}
              selectedIdx={selectedIdx}
              onSelect={setSelectedIdx}
            />
          )}
          <WaterLevelChart
            datasets={MOCK_CHART_DATA}
            labels={MOCK_CHART_LABELS}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
          />
        </div>

        {/* Full width alerts */}
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">
              <span className="dot" style={{ background: 'var(--amber)' }} />
              Alert History
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {alerts.length} total · {activeAlerts.length} active
            </span>
          </div>
          <AlertList alerts={alerts} />
        </div>
      </div>
    </>
  );
}
