export function SeverityBadge({ severity }: { severity: string }) {
  const colorMap: Record<string, string> = {
    CRITICAL: 'text-accent',
    HIGH: 'text-orange-500',
    MEDIUM: 'text-yellow-500',
    LOW: 'text-blue-500',
  };

  const color = colorMap[severity?.toUpperCase()] || 'text-muted';

  return (
    <span className={`font-mono text-xs font-bold uppercase tracking-wider ${color}`}>
      [{severity}]
    </span>
  );
}

export function severityWeight(severity: string) {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return 0;
    case 'HIGH': return 1;
    case 'MEDIUM': return 2;
    case 'LOW': return 3;
    default: return 99;
  }
}
