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
    <tr className="border-b border-white/5">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded-md bg-white/10" />
        </td>
      ))}
    </tr>
  );
}

export function ScanHistoryTable({ rows, owner, repo, isLoading }: ScanHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
        <table className="w-full text-sm">
          <thead>
            <TableHeader />
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 py-16 backdrop-blur-sm">
        <div className="mb-4 text-5xl">🔍</div>
        <h3 className="mb-2 text-lg font-semibold text-white">No scans found</h3>
        <p className="max-w-sm text-center text-sm text-slate-400">
          SecretShield hasn&apos;t run on this repository yet, or no{' '}
          <code className="rounded bg-white/10 px-1 text-xs text-slate-300">secretshield-report</code>{' '}
          artifacts were found.
        </p>
        <p className="mt-4 text-xs text-slate-500">
          Add SecretShield to your workflow to start scanning.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <TableHeader />
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map(({ artifact, report }) => (
              <ScanTableRow
                key={artifact.id}
                artifact={artifact}
                report={report}
                owner={owner}
                repo={repo}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableHeader() {
  return (
    <tr className="border-b border-white/10 bg-white/5">
      {['Date', 'Branch', 'Commit', 'Findings', 'Severity Breakdown', 'Details'].map((h) => (
        <th
          key={h}
          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400"
        >
          {h}
        </th>
      ))}
    </tr>
  );
}

function ScanTableRow({
  artifact,
  report,
  owner,
  repo,
}: {
  artifact: GitHubArtifact;
  report: ScanReport | null;
  owner: string;
  repo: string;
}) {
  const date       = new Date(artifact.created_at);
  const dateStr    = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr    = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const branch     = report?.branch ?? artifact.workflow_run?.head_branch ?? '—';
  const commitSha  = report?.commit ?? artifact.workflow_run?.head_sha ?? '—';
  const total      = report?.summary.total_findings ?? 0;
  const scanId     = report?.scan_id ?? String(artifact.id);
  const hasFindings = total > 0;

  return (
    <tr className="group transition-colors hover:bg-white/5">
      {/* Date */}
      <td className="whitespace-nowrap px-4 py-3">
        <div className="text-slate-200">{dateStr}</div>
        <div className="text-xs text-slate-500">{timeStr}</div>
      </td>

      {/* Branch */}
      <td className="px-4 py-3">
        <span className="inline-block max-w-[120px] truncate rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs text-slate-300">
          {branch}
        </span>
      </td>

      {/* Commit */}
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-slate-400">
          {commitSha !== '—' ? commitSha.slice(0, 8) : '—'}
        </span>
      </td>

      {/* Total findings */}
      <td className="px-4 py-3">
        {report ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
              hasFindings
                ? 'bg-red-500/20 text-red-300'
                : 'bg-green-500/20 text-green-300'
            }`}
          >
            {hasFindings ? `🚨 ${total}` : '✅ 0'}
          </span>
        ) : (
          <span className="text-xs text-slate-500">Loading…</span>
        )}
      </td>

      {/* Severity breakdown */}
      <td className="px-4 py-3">
        {report && hasFindings ? (
          <div className="flex flex-wrap gap-1">
            {report.summary.critical > 0 && (
              <SeverityBadge severity="CRITICAL" size="sm" showIcon={false} />
            )}
            {report.summary.high > 0 && (
              <SeverityBadge severity="HIGH" size="sm" showIcon={false} />
            )}
            {report.summary.medium > 0 && (
              <SeverityBadge severity="MEDIUM" size="sm" showIcon={false} />
            )}
            {report.summary.low > 0 && (
              <SeverityBadge severity="LOW" size="sm" showIcon={false} />
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-500">—</span>
        )}
      </td>

      {/* Details link */}
      <td className="px-4 py-3">
        <Link
          href={`/scan/${scanId}?owner=${owner}&repo=${repo}&artifact_id=${artifact.id}`}
          className="inline-flex items-center gap-1 rounded-lg bg-shield-600/30 px-3 py-1.5 text-xs font-medium text-shield-300 transition-all hover:bg-shield-600/50 hover:text-shield-200"
        >
          View →
        </Link>
      </td>
    </tr>
  );
}
