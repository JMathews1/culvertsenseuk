'use client';
import useSWR from 'swr';
import { fetchGateway } from '@/lib/api';
import GatewayPanel from '@/components/gateway/GatewayPanel';

export default function GatewayPage() {
  const { data: gateway } = useSWR('gateway', fetchGateway, { refreshInterval: 30_000 });

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Gateway</div>
        <span className="topbar-sub">LoRaWAN gateway status · Derbyshire</span>
      </div>
      <div className="content">
        <div className="grid-3-1">
          {gateway && <GatewayPanel gateway={gateway} />}
        </div>
      </div>
    </>
  );
}
