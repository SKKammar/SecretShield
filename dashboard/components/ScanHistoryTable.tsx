'use client';

import Link from 'next/link';
import { SeverityBadge } from './SeverityBadge';
import type { GitHubArtifact, ScanReport } from '@/lib/types';

interface ScanRow {
  artifact: GitHubArtifact;
  report: ScanReport | null;
}

interface ScanHistoryTableProps {
  rows: ScanRow[];
  owner: string;
  repo: string;
  isLoading?: boolean;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border bg-surface">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 w-16 animate-pulse bg-[#1f1f1f]" />
        </td>
      ))}
    </tr>
  );
}

export function ScanHistoryTable({ rows, owner, repo, isLoading }: ScanHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="w-full overflow-x-auto border border-border">
        <table className="w-full text-left font-sans text-sm">
          <thead><TableHeader /></thead>
          <tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="terminal-panel text-center py-12">
        <p className="font-mono text-sm text-muted">NO SCANS FOUND FOR REPOSITORY</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto border border-border">
      <table className="w-full text-left font-sans text-sm">
        <thead>
          <TableHeader />
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ artifact, report }, idx) => (
            <ScanTableRow
              key={artifact.id}
              artifact={artifact}
              report={report}
              owner={owner}
              repo={repo}
              even={idx % 2 === 0}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableHeader() {
  return (
    <tr className="border-b border-border bg-[#0a0a0a]">
      {['DATE', 'BRANCH', 'COMMIT', 'FINDINGS', 'SEVERITY', 'ID'].map((h) => (
        <th key={h} className="px-4 py-3 font-mono text-[11px] font-normal tracking-widest text-muted">
          {h}
        </th>
      ))}
    </tr>
  );
}

function ScanTableRow({ artifact, report, owner, repo, even }: { artifact: GitHubArtifact; report: ScanReport | null; owner: string; repo: string; even: boolean }) {
  const date = new Date(artifact.created_at);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const branch = report?.branch ?? artifact.workflow_run?.head_branch ?? '—';
  const commitSha = report?.commit ?? artifact.workflow_run?.head_sha ?? '—';
  const total = report?.summary.total_findings ?? 0;
  const scanId = report?.scan_id ?? String(artifact.id);
  const hasFindings = total > 0;

  return (
    <tr className={`${even ? 'bg-background' : 'bg-surface'} transition-colors hover:bg-[#1a1a1a]`}>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-primary">
        {dateStr} {timeStr}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted">
        {branch}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-mono-value">
        {commitSha !== '—' ? commitSha.slice(0, 7) : '—'}
      </td>
      <td className="px-4 py-3 font-mono text-xs tabular-nums">
        {report ? (
          <span className={hasFindings ? 'text-accent' : 'text-accent-secondary'}>
            {total.toString().padStart(3, '0')}
          </span>
        ) : (
          <span className="text-muted">...</span>
        )}
      </td>
      <td className="px-4 py-3">
        {report && hasFindings ? (
          <div className="flex flex-wrap gap-2">
            {report.summary.critical > 0 && <SeverityBadge severity="CRITICAL" />}
            {report.summary.high > 0 && <SeverityBadge severity="HIGH" />}
            {report.summary.medium > 0 && <SeverityBadge severity="MEDIUM" />}
            {report.summary.low > 0 && <SeverityBadge severity="LOW" />}
          </div>
        ) : (
          <span className="font-mono text-xs text-muted">CLEAN</span>
        )}
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/scan/${scanId}?owner=${owner}&repo=${repo}&artifact_id=${artifact.id}`}
          className="font-mono text-xs text-muted hover:text-primary hover:underline underline-offset-4"
        >
          {String(artifact.id)}
        </Link>
      </td>
    </tr>
  );
}
