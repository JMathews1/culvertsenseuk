export type SensorStatus = 'normal' | 'warning' | 'critical' | 'offline';

export interface Sensor {
  id: string;
  name: string;
  lat: string;
  lng: string;
  water_level: number;
  pct: number;
  status: SensorStatus;
  battery: string;
  rssi: string;
  updated: string;
  threshold_warning: number;
  threshold_critical: number;
}

export interface ChartDataset {
  label: string;
  color: string;
  data: number[];
  threshold: number;
}

export interface Alert {
  id: string;
  type: 'warn' | 'ok' | 'info';
  msg: string;
  time: string;
  node: string;
  badge: 'ACTIVE' | 'RESOLVED' | 'ALERT' | 'INFO';
  detail: string;
}

export interface GatewayStatus {
  name: string;
  location: string;
  uptime_seconds: number;
  packets_hr: number;
  rssi_avg: string;
  backhaul: string;
  firmware: string;
  online: boolean;
}

export interface ThresholdConfig {
  sensor_id: string;
  warning: number;
  critical: number;
}

export interface SavingsData {
  total: number;
  inspections: number;
  warnings: number;
  callouts: number;
}
