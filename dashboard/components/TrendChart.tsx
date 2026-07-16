'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  TooltipProps,
} from 'recharts';
import type { TrendPoint, ScanSummary } from '@/lib/types';

// ─── Trend Line Chart ──────────────────────────────────────────────────────

interface TrendChartProps {
  data: TrendPoint[];
  className?: string;
}

const LINE_CONFIG = [
  { key: 'total',    color: '#a5bbfd', label: 'Total',    strokeWidth: 2 },
  { key: 'critical', color: '#ef4444', label: 'Critical', strokeWidth: 1.5 },
  { key: 'high',     color: '#f97316', label: 'High',     strokeWidth: 1.5 },
  { key: 'medium',   color: '#eab308', label: 'Medium',   strokeWidth: 1.5 },
  { key: 'low',      color: '#3b82f6', label: 'Low',      strokeWidth: 1.5 },
];

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/95 px-4 py-3 shadow-2xl backdrop-blur-sm">
      <p className="mb-2 text-xs font-semibold text-slate-400">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="capitalize text-slate-300">{entry.name}:</span>
          <span className="font-bold text-white">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data, className }: TrendChartProps) {
  // Format dates for display
  const formattedData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      })),
    [data],
  );

  const hasData = data.some((d) => d.total > 0);

  if (!hasData) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-8 ${className ?? ''}`}>
        <div className="text-center">
          <div className="mb-2 text-3xl">📊</div>
          <p className="text-sm text-slate-400">No scan data in the last 30 days</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={formattedData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="displayDate"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px', color: '#94a3b8', paddingTop: '12px' }}
          />
          {LINE_CONFIG.map(({ key, color, label, strokeWidth }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={label}
              stroke={color}
              strokeWidth={strokeWidth}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Severity Pie Chart ────────────────────────────────────────────────────

interface SeverityPieChartProps {
  summary: ScanSummary;
  className?: string;
}

const PIE_DATA_CONFIG = [
  { key: 'critical', color: '#ef4444', label: 'Critical' },
  { key: 'high',     color: '#f97316', label: 'High'     },
  { key: 'medium',   color: '#eab308', label: 'Medium'   },
  { key: 'low',      color: '#3b82f6', label: 'Low'      },
] as const;

function PieTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/95 px-3 py-2 shadow-2xl backdrop-blur-sm">
      <p className="text-xs font-semibold text-slate-300">
        {payload[0].name}: <span className="text-white">{payload[0].value}</span>
      </p>
    </div>
  );
}

export function SeverityPieChart({ summary, className }: SeverityPieChartProps) {
  const pieData = PIE_DATA_CONFIG
    .map(({ key, color, label }) => ({
      name:  label,
      value: summary[key],
      color,
    }))
    .filter((d) => d.value > 0);

  if (pieData.length === 0) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-8 ${className ?? ''}`}>
        <div className="text-center">
          <div className="mb-2 text-3xl">✅</div>
          <p className="text-sm text-slate-400">No findings</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<PieTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
