'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetchThresholds, updateThreshold, fetchSensors } from '@/lib/api';
import type { ThresholdConfig } from '@/lib/types';

interface ToastState {
  msg: string;
  type: 'success' | 'error';
}

export default function SettingsPage() {
  const { data: thresholds = [] } = useSWR('thresholds', fetchThresholds);
  const { data: sensors = [] } = useSWR('sensors', fetchSensors);

  const [configs, setConfigs] = useState<ThresholdConfig[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (thresholds.length > 0) {
      setConfigs(thresholds.map((t) => ({ ...t })));
    }
  }, [thresholds]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (sensorId: string) => {
    const config = configs.find((c) => c.sensor_id === sensorId);
    if (!config) return;

    setSaving(sensorId);
    try {
      await updateThreshold(config);
      showToast(`Thresholds saved for ${sensorId}`, 'success');
    } catch {
      showToast(`Failed to save thresholds for ${sensorId}`, 'error');
    } finally {
      setSaving(null);
    }
  };

  const updateConfig = (sensorId: string, field: 'warning' | 'critical', value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setConfigs((prev) =>
      prev.map((c) =>
        c.sensor_id === sensorId ? { ...c, [field]: num } : c,
      ),
    );
  };

  const getSensorName = (sensorId: string) =>
    sensors.find((s) => s.id === sensorId)?.name ?? sensorId;

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Threshold Configuration</div>
        <span className="topbar-sub">Configure alert levels per sensor node</span>
      </div>

      <div className="content">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">
              <span className="dot" />
              Alert Thresholds
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Warning and critical water levels (metres)
            </span>
          </div>
          <div className="settings-form">
            {configs.map((config) => (
              <div key={config.sensor_id} className="settings-sensor-block">
                <div className="settings-sensor-name">
                  {getSensorName(config.sensor_id)}
                  <span className="settings-sensor-id">{config.sensor_id}</span>
                </div>
                <div className="settings-fields">
                  <div className="settings-field">
                    <label className="settings-label" htmlFor={`warn-${config.sensor_id}`}>
                      Warning Level (m)
                    </label>
                    <input
                      id={`warn-${config.sensor_id}`}
                      type="number"
                      step="0.05"
                      min="0"
                      max="5"
                      className="settings-input"
                      value={config.warning}
                      onChange={(e) => updateConfig(config.sensor_id, 'warning', e.target.value)}
                    />
                  </div>
                  <div className="settings-field">
                    <label className="settings-label" htmlFor={`crit-${config.sensor_id}`}>
                      Critical Level (m)
                    </label>
                    <input
                      id={`crit-${config.sensor_id}`}
                      type="number"
                      step="0.05"
                      min="0"
                      max="5"
                      className="settings-input"
                      value={config.critical}
                      onChange={(e) => updateConfig(config.sensor_id, 'critical', e.target.value)}
                    />
                  </div>
                  <button
                    className="settings-save-btn"
                    onClick={() => handleSave(config.sensor_id)}
                    disabled={saving === config.sensor_id}
                  >
                    {saving === config.sensor_id ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info card */}
        <div className="panel">
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 8, fontWeight: 600 }}>
              About Alert Thresholds
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              <p>Warning level: Email notification dispatched to ops@halifaxwater.ca when water level exceeds this value.</p>
              <br />
              <p>Critical level: Email + SMS dispatched immediately. Escalation to on-call engineer.</p>
              <br />
              <p>Changes take effect within 60 seconds after saving.</p>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
