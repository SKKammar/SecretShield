import type { Severity } from '@/lib/types';
import { clsx } from 'clsx';

interface SeverityBadgeProps {
  severity: Severity;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; icon: string; bg: string; text: string; border: string; glow: string }
> = {
  CRITICAL: {
    label:  'CRITICAL',
    icon:   '🔴',
    bg:     'bg-red-500/20',
    text:   'text-red-300',
    border: 'border-red-500/40',
    glow:   'shadow-red-500/20',
  },
  HIGH: {
    label:  'HIGH',
    icon:   '🟠',
    bg:     'bg-orange-500/20',
    text:   'text-orange-300',
    border: 'border-orange-500/40',
    glow:   'shadow-orange-500/20',
  },
  MEDIUM: {
    label:  'MEDIUM',
    icon:   '🟡',
    bg:     'bg-yellow-500/20',
    text:   'text-yellow-300',
    border: 'border-yellow-500/40',
    glow:   'shadow-yellow-500/20',
  },
  LOW: {
    label:  'LOW',
    icon:   '🔵',
    bg:     'bg-blue-500/20',
    text:   'text-blue-300',
    border: 'border-blue-500/40',
    glow:   'shadow-blue-500/20',
  },
};

const SIZE_CLASSES = {
  sm: 'text-xs px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
};

export function SeverityBadge({
  severity,
  size = 'md',
  showIcon = true,
  className,
}: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.LOW;

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border font-semibold tracking-wide shadow-sm transition-all',
        config.bg,
        config.text,
        config.border,
        config.glow,
        SIZE_CLASSES[size],
        className,
      )}
    >
      {showIcon && <span className="leading-none">{config.icon}</span>}
      {config.label}
    </span>
  );
}

/** Return a numeric sort weight for a severity (lower = more critical) */
export function severityWeight(s: Severity): number {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[s] ?? 4;
}
