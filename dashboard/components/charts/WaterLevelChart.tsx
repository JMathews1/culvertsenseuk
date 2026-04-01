'use client';
import { useEffect, useRef } from 'react';
import {
  Chart,
  CategoryScale,
  LinearScale,
  LineController,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  type ChartConfiguration,
  type Plugin,
} from 'chart.js';
import type { ChartDataset } from '@/lib/types';

Chart.register(CategoryScale, LinearScale, LineController, PointElement, LineElement, Filler, Tooltip);

interface WaterLevelChartProps {
  datasets: ChartDataset[];
  labels: string[];
  selectedIdx: number;
  onSelect: (i: number) => void;
}

function makeThresholdPlugin(threshold: number, color: string): Plugin<'line'> {
  return {
    id: 'thresholdLine',
    afterDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      const y = scales['y']?.getPixelForValue(threshold);
      if (y === undefined || y < chartArea.top || y > chartArea.bottom) return;

      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      ctx.fillText(`alert ${threshold}m`, chartArea.right - 4, y - 4);
      ctx.restore();
    },
  };
}

export default function WaterLevelChart({
  datasets,
  labels,
  selectedIdx,
  onSelect,
}: WaterLevelChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<'line'> | null>(null);

  const selected = datasets[selectedIdx];

  useEffect(() => {
    if (!canvasRef.current || !selected) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    };

    const thresholdPlugin = makeThresholdPlugin(
      selected.threshold,
      'rgba(232,69,60,0.8)',
    );

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: selected.label,
            data: selected.data,
            borderColor: selected.color,
            backgroundColor: hexToRgba(selected.color, 0.1),
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: selected.color,
            pointBorderColor: '#0e1518',
            pointBorderWidth: 1.5,
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        scales: {
          x: {
            grid: { color: 'rgba(30,47,56,0.8)', drawTicks: false },
            border: { display: false },
            ticks: {
              color: '#5a7a8a',
              font: { family: "'JetBrains Mono', monospace", size: 10 },
              maxRotation: 0,
            },
          },
          y: {
            min: 0,
            max: 2.2,
            grid: { color: 'rgba(30,47,56,0.8)', drawTicks: false },
            border: { display: false },
            ticks: {
              color: '#5a7a8a',
              font: { family: "'JetBrains Mono', monospace", size: 10 },
              callback: (v) => `${v}m`,
              stepSize: 0.4,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0e1518',
            borderColor: '#1e2f38',
            borderWidth: 1,
            titleColor: '#8aabba',
            bodyColor: '#d4e4ec',
            bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
            titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
            padding: 10,
            callbacks: {
              label: (ctx) => ` ${(ctx.parsed.y as number).toFixed(2)}m`,
            },
          },
        },
      },
      plugins: [thresholdPlugin],
    };

    chartRef.current = new Chart(canvasRef.current, config);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [selected, labels]);

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-head">
        <div className="panel-title">
          <span className="dot" />
          7-Day Water Level
        </div>
        <div className="sel-btns">
          {datasets.map((ds, i) => (
            <button
              key={ds.label}
              className={`sel-btn${selectedIdx === i ? ' active' : ''}`}
              style={selectedIdx === i ? { borderColor: ds.color, color: ds.color, background: `${ds.color}1a` } : {}}
              onClick={() => onSelect(i)}
            >
              {ds.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-wrap">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
