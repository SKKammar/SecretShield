'use client';

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import type { TrendPoint, ScanSummary } from '@/lib/types';

interface TrendChartProps {
  data: TrendPoint[];
  className?: string;
}

export function TrendChart({ data, className }: TrendChartProps) {
  const formattedData = useMemo(
    () => data.map((d) => ({
      ...d,
      displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    })),
    [data],
  );

  const hasData = data.some((d) => d.total > 0);

  if (!hasData) {
    return (
      <div className={`terminal-panel flex h-[260px] items-center justify-center ${className ?? ''}`}>
        <p className="font-mono text-sm text-muted">NO SCAN DATA [30 DAYS]</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#1f1f1f" vertical={false} />
          <XAxis 
            dataKey="displayDate" 
            tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis 
            tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Line
            type="stepAfter"
            dataKey="total"
            stroke="#ef4444"
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3, fill: '#ef4444', stroke: '#0a0a0a', strokeWidth: 1 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface SeverityPieChartProps {
  summary: ScanSummary;
  className?: string;
}

// Replaces the pie chart with a terminal-style plain text readout
export function SeverityPieChart({ summary, className }: SeverityPieChartProps) {
  const totals = [
    { label: 'CRITICAL', value: summary.critical, color: 'text-accent' },
    { label: 'HIGH',     value: summary.high,     color: 'text-orange-500' },
    { label: 'MEDIUM',   value: summary.medium,   color: 'text-yellow-500' },
    { label: 'LOW',      value: summary.low,      color: 'text-blue-500' },
  ];

  return (
    <div className={`terminal-panel flex flex-col justify-center gap-4 h-[260px] ${className ?? ''}`}>
      <div className="space-y-3">
        {totals.map((t) => (
          <div key={t.label} className="flex items-center justify-between font-mono text-sm">
            <span className="text-muted">[{t.label}]</span>
            <span className={`tabular-nums font-bold ${t.value > 0 ? t.color : 'text-muted'}`}>
              {t.value.toString().padStart(4, '0')}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-border pt-4 flex items-center justify-between font-mono text-sm">
        <span className="text-primary">TOTAL_FINDINGS</span>
        <span className="tabular-nums font-bold text-primary">
          {summary.total_findings.toString().padStart(4, '0')}
        </span>
      </div>
    </div>
  );
}
