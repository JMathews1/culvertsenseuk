import type { Sensor, ChartDataset, Alert, GatewayStatus, SavingsData, ThresholdConfig } from './types';

export const MOCK_SENSORS: Sensor[] = [
  {
    id: 'CS-001',
    name: 'Cole Harbour Rd',
    lat: '44.6823',
    lng: '-63.4912',
    water_level: 1.42,
    pct: 68,
    status: 'warning',
    battery: '87%',
    rssi: '-82 dBm',
    updated: '2m ago',
    threshold_warning: 1.60,
    threshold_critical: 2.00,
  },
  {
    id: 'CS-002',
    name: 'Sackville River N',
    lat: '44.7512',
    lng: '-63.6748',
    water_level: 0.64,
    pct: 31,
    status: 'normal',
    battery: '93%',
    rssi: '-89 dBm',
    updated: '2m ago',
    threshold_warning: 1.60,
    threshold_critical: 2.00,
  },
  {
    id: 'CS-003',
    name: 'Bissett Run',
    lat: '44.7204',
    lng: '-63.5891',
    water_level: 0.45,
    pct: 22,
    status: 'normal',
    battery: '71%',
    rssi: '-94 dBm',
    updated: '4m ago',
    threshold_warning: 1.80,
    threshold_critical: 2.20,
  },
  {
    id: 'CS-004',
    name: 'Lake Echo Culvert',
    lat: '44.7089',
    lng: '-63.4201',
    water_level: 0.38,
    pct: 18,
    status: 'normal',
    battery: '95%',
    rssi: '-86 dBm',
    updated: '3m ago',
    threshold_warning: 1.60,
    threshold_critical: 2.00,
  },
  {
    id: 'CS-005',
    name: 'Lawrencetown',
    lat: '44.6512',
    lng: '-63.3298',
    water_level: 0.29,
    pct: 14,
    status: 'normal',
    battery: '88%',
    rssi: '-91 dBm',
    updated: '5m ago',
    threshold_warning: 1.60,
    threshold_critical: 2.00,
  },
];

export const MOCK_CHART_LABELS: string[] = [
  'Mar 24', 'Mar 25', 'Mar 26', 'Mar 27', 'Mar 28', 'Mar 29', 'Mar 30',
];

export const MOCK_CHART_DATA: ChartDataset[] = [
  {
    label: 'Cole Harbour Rd',
    color: '#f5a623',
    data: [0.41, 0.38, 0.52, 0.89, 1.21, 1.05, 1.42],
    threshold: 1.60,
  },
  {
    label: 'Sackville River N',
    color: '#00c4a0',
    data: [0.58, 0.61, 0.55, 0.72, 1.74, 0.91, 0.64],
    threshold: 1.60,
  },
  {
    label: 'Bissett Run',
    color: '#3d9cf5',
    data: [0.30, 0.28, 0.35, 0.44, 0.61, 0.52, 0.45],
    threshold: 1.80,
  },
  {
    label: 'Lake Echo Culvert',
    color: '#a78bfa',
    data: [0.22, 0.20, 0.28, 0.35, 0.48, 0.40, 0.38],
    threshold: 1.60,
  },
  {
    label: 'Lawrencetown',
    color: '#fb7185',
    data: [0.18, 0.17, 0.22, 0.31, 0.40, 0.33, 0.29],
    threshold: 1.60,
  },
];

export const MOCK_ALERTS: Alert[] = [
  {
    id: 'a1',
    type: 'warn',
    badge: 'ACTIVE',
    msg: 'Cole Harbour Rd — water level at 68% of alert threshold (1.42m / alert 1.60m). Trend: rising +0.08m/hr.',
    time: 'Today 14:38 ADT',
    node: 'CS-001',
    detail:
      'Rainfall ongoing. 12mm in last 3hrs. Level rose 0.21m in 90 minutes. Email alert sent to ops@derbyshire.gov.uk at 14:38.',
  },
  {
    id: 'a2',
    type: 'ok',
    badge: 'RESOLVED',
    msg: 'Sackville River N — level returned to normal after 3hr 14min elevated period. Peak: 1.74m.',
    time: 'Yesterday 09:12 ADT',
    node: 'CS-002',
    detail:
      'Level fell below 1.60m at 09:12. Auto-resolved. Alert active 3hr 14min. Peak 1.74m at 06:41.',
  },
  {
    id: 'a3',
    type: 'warn',
    badge: 'ALERT',
    msg: 'Sackville River N — exceeded alert threshold (1.74m / alert 1.60m) following 18mm rainfall.',
    time: 'Yesterday 05:58 ADT',
    node: 'CS-002',
    detail:
      'Threshold breach 05:58. Email + SMS dispatched immediately.',
  },
  {
    id: 'a4',
    type: 'info',
    badge: 'INFO',
    msg: 'All 5 nodes online following gateway firmware update v2.1.4 — zero packet loss during 4min window.',
    time: '30 Mar 2026 02:00 ADT',
    node: 'System',
    detail:
      'Scheduled maintenance 02:00–02:04. All nodes rejoined within 90s.',
  },
];

// Uptime_seconds: 14d 6h 22m = (14*86400) + (6*3600) + (22*60)
export const MOCK_GATEWAY: GatewayStatus = {
  name: 'RAK7289V2',
  location: 'Burnside Depot',
  uptime_seconds: 14 * 86400 + 6 * 3600 + 22 * 60,
  packets_hr: 42,
  rssi_avg: '-87 dBm',
  backhaul: 'Ethernet',
  firmware: 'v2.1.4',
  online: true,
};

export const MOCK_SAVINGS: SavingsData = {
  total: 33750,
  inspections: 12750,
  warnings: 12600,
  callouts: 8400,
};

export const MOCK_THRESHOLDS: ThresholdConfig[] = MOCK_SENSORS.map((s) => ({
  sensor_id: s.id,
  warning: s.threshold_warning,
  critical: s.threshold_critical,
}));
