import type { Sensor, Alert, GatewayStatus, ThresholdConfig, SavingsData } from './types';
import { MOCK_SENSORS, MOCK_ALERTS, MOCK_GATEWAY, MOCK_SAVINGS, MOCK_THRESHOLDS } from './mock-data';

// Default to mock data unless explicitly set to 'false'
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== 'false';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export async function fetchSensors(): Promise<Sensor[]> {
  if (USE_MOCK) return MOCK_SENSORS;
  try {
    const d = await apiFetch<{ sensors: Sensor[] }>('/sensors');
    return d.sensors;
  } catch {
    return MOCK_SENSORS;
  }
}

export async function fetchAlerts(): Promise<Alert[]> {
  if (USE_MOCK) return MOCK_ALERTS;
  try {
    const d = await apiFetch<{ alerts: Alert[] }>('/alerts');
    return d.alerts;
  } catch {
    return MOCK_ALERTS;
  }
}

export async function fetchGateway(): Promise<GatewayStatus> {
  if (USE_MOCK) return MOCK_GATEWAY;
  try {
    return await apiFetch<GatewayStatus>('/gateway');
  } catch {
    return MOCK_GATEWAY;
  }
}

export async function fetchThresholds(): Promise<ThresholdConfig[]> {
  if (USE_MOCK) return MOCK_THRESHOLDS;
  try {
    const d = await apiFetch<{ thresholds: ThresholdConfig[] }>('/thresholds');
    return d.thresholds;
  } catch {
    return MOCK_THRESHOLDS;
  }
}

export async function updateThreshold(config: ThresholdConfig): Promise<void> {
  if (USE_MOCK) {
    console.log('[mock] updateThreshold', config);
    return;
  }
  await fetch(`${API_BASE}/api/v1/thresholds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}

export async function fetchSavings(): Promise<SavingsData> {
  if (USE_MOCK) return MOCK_SAVINGS;
  try {
    return await apiFetch<SavingsData>('/savings');
  } catch {
    return MOCK_SAVINGS;
  }
}
