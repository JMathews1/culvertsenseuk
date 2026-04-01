'use client';
import useSWR from 'swr';
import { fetchSensors } from '@/lib/api';
import NetworkMap from '@/components/map/NetworkMap';
import { useState } from 'react';

export default function MapPage() {
  const { data: sensors = [] } = useSWR('sensors', fetchSensors, { refreshInterval: 30_000 });
  const [selectedIdx, setSelectedIdx] = useState(0);

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Site Map</div>
        <span className="topbar-sub">HRM Stormwater · sensor network overview</span>
      </div>
      <div className="content">
        {sensors.length > 0 && (
          <NetworkMap
            sensors={sensors}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
          />
        )}
      </div>
    </>
  );
}
