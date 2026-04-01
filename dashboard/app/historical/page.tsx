'use client';
import { MOCK_CHART_DATA, MOCK_CHART_LABELS } from '@/lib/mock-data';
import WaterLevelChart from '@/components/charts/WaterLevelChart';
import { useState } from 'react';

export default function HistoricalPage() {
  const [selectedIdx, setSelectedIdx] = useState(0);

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Historical Data</div>
        <span className="topbar-sub">7-day water level trends · HRM Stormwater</span>
      </div>
      <div className="content">
        <WaterLevelChart
          datasets={MOCK_CHART_DATA}
          labels={MOCK_CHART_LABELS}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
        />
      </div>
    </>
  );
}
