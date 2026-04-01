'use client';
import { useEffect, useState } from 'react';
import useAnimatedCounter from '@/hooks/useAnimatedCounter';
import type { SavingsData } from '@/lib/types';

interface SavingsPanelProps {
  savings: SavingsData;
}

interface SavingsRowProps {
  label: string;
  value: number;
  pct: number;
  animatedValue: number;
}

function SavingsRow({ label, value: _value, pct, animatedValue }: SavingsRowProps) {
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setBarWidth(pct), 900);
    return () => clearTimeout(id);
  }, [pct]);

  return (
    <div className="savings-row">
      <div className="savings-row-head">
        <span className="savings-row-label">{label}</span>
        <span className="savings-row-value">${animatedValue.toLocaleString()}</span>
      </div>
      <div className="savings-bar-w">
        <div
          className="savings-bar"
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

export default function SavingsPanel({ savings }: SavingsPanelProps) {
  const animInspections = useAnimatedCounter(savings.inspections, 1200, 800);
  const animWarnings = useAnimatedCounter(savings.warnings, 1200, 900);
  const animCallouts = useAnimatedCounter(savings.callouts, 1200, 1000);
  const animTotal = useAnimatedCounter(savings.total, 1400, 700);

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">
          <span className="dot" style={{ background: 'var(--green)' }} />
          Est. Savings YTD
        </div>
      </div>
      <div className="savings-panel">
        <div className="savings-total">
          <div className="savings-total-label">Total Estimated Value</div>
          <div className="savings-total-value">${animTotal.toLocaleString()}</div>
        </div>
        <SavingsRow label="Inspections avoided" value={savings.inspections} pct={85} animatedValue={animInspections} />
        <SavingsRow label="Early warnings issued" value={savings.warnings} pct={84} animatedValue={animWarnings} />
        <SavingsRow label="Callouts prevented" value={savings.callouts} pct={56} animatedValue={animCallouts} />
        <div className="savings-note">
          Estimated based on avg. field inspection cost $150/visit + emergency callout rate. Pilot yr 1 data.
        </div>
      </div>
    </div>
  );
}
