'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { SeverityBadge, severityWeight } from '@/components/SeverityBadge';
import { fetchScanReport, hasPat } from '@/lib/github';
import type { ScanReport, Finding } from '@/lib/types';
import { useRouter } from 'next/navigation';

export default function ScanDetailPage() {
  const params       = useParams<{ scan_id: string }>();
  const searchParams = useSearchParams();
  const router       = useRouter();

  const owner      = searchParams.get('owner') ?? '';
  const repo       = searchParams.get('repo')  ?? '';
  const artifactId = Number(searchParams.get('artifact_id') ?? '0');

  const [report, setReport]     = useState<ScanReport | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<string>('ALL');

  useEffect(() => {
    if (!hasPat()) { router.push('/'); return; }
    if (!owner || !repo || !artifactId) { setLoading(false); return; }

    fetchScanReport(owner, repo, artifactId)
      .then((r) => {
        setReport(r);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load report');
        setLoading(false);
      });
  }, [owner, repo, artifactId, router]);

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `secretshield-${report.scan_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredFindings: Finding[] = (report?.findings ?? [])
    .filter((f) => filter === 'ALL' || f.severity === filter)
    .sort((a, b) => severityWeight(a.severity) - severityWeight(b.severity));

  return (
    <div className="animate-fade-in space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-300 transition-colors">Overview</Link>
        <span>/</span>
        {owner && repo && (
          <>
            <Link href={`/repo/${owner}/${repo}`} className="hover:text-slate-300 transition-colors">
              {owner}/{repo}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="font-mono text-slate-400">{params.scan_id.slice(0, 8)}…</span>
      </nav>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="mb-4 text-4xl animate-spin-slow">🛡️</div>
            <p className="text-sm text-slate-400">Loading scan report…</p>
          </div>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 text-5xl">❌</div>
          <h3 className="mb-2 text-lg font-semibold text-white">Failed to load report</h3>
          <p className="mb-4 text-sm text-slate-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      )}

      {/* Not found */}
      {!isLoading && !error && !report && (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 text-5xl">🔍</div>
          <h3 className="mb-2 text-lg font-semibold text-white">Report not found</h3>
          <p className="text-sm text-slate-400">
            This artifact may have expired or the report file was not generated.
          </p>
        </div>
      )}

      {/* Report */}
      {!isLoading && report && (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Scan Report —{' '}
                <span className="gradient-text font-mono">{report.scan_id.slice(0, 8)}</span>
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {new Date(report.timestamp).toLocaleString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                  year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
            <button
              id="download-json-btn"
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-xl border border-shield-500/30 bg-shield-600/20 px-4 py-2 text-sm font-medium text-shield-300 transition-all hover:bg-shield-600/30"
            >
              ⬇️ Download JSON
            </button>
          </div>

          {/* Meta cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetaCard label="Repository"  value={report.repo} mono />
            <MetaCard label="Branch"      value={report.branch} mono />
            <MetaCard label="Commit"      value={report.commit.slice(0, 8)} mono />
            <MetaCard label="Triggered by" value={report.triggered_by} />
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <SummaryCard label="Total" value={report.summary.total_findings} color="text-white" highlight={report.summary.total_findings > 0} />
            <SummaryCard label="Critical" value={report.summary.critical} color="text-red-400" />
            <SummaryCard label="High"     value={report.summary.high}     color="text-orange-400" />
            <SummaryCard label="Medium"   value={report.summary.medium}   color="text-yellow-400" />
            <SummaryCard label="Low"      value={report.summary.low}      color="text-blue-400" />
          </div>

          {/* Files removed */}
          {report.summary.files_removed.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-300">🗑️ Files Flagged / Removed</h3>
              <div className="flex flex-wrap gap-2">
                {report.summary.files_removed.map((f) => (
                  <span key={f} className="rounded-md bg-red-500/10 px-2 py-1 font-mono text-xs text-red-300 border border-red-500/20">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Findings */}
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">
                Findings <span className="ml-2 text-sm text-slate-500">({filteredFindings.length})</span>
              </h2>
              {/* Severity filter */}
              <div className="flex gap-2">
                {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      filter === s
                        ? 'bg-shield-600/40 text-shield-300'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {filteredFindings.length === 0 ? (
              <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 text-4xl">✅</div>
                <p className="text-sm text-slate-400">
                  {report.findings.length === 0 ? 'No findings — repository is clean!' : `No findings match the "${filter}" filter.`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFindings.map((finding, idx) => (
                  <FindingCard key={`${finding.id}-${idx}`} finding={finding} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MetaCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="glass-card px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-medium text-slate-200 ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function SummaryCard({
  label, value, color, highlight,
}: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div className={`stat-card ${highlight && value > 0 ? 'border-red-500/20' : ''}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <div className="glass-card p-4 transition-all hover:border-white/20">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={finding.severity} />
          <span className="font-mono text-xs text-slate-400 bg-white/5 rounded-md px-2 py-0.5">
            {finding.source}
          </span>
        </div>
        <span className="text-xs text-slate-500">Line {finding.line}</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="text-slate-500">File:</span>
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-slate-300 break-all">{finding.file}</code>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="text-slate-500">Rule:</span>
          <span className="text-slate-300">{finding.rule}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="text-slate-500">Match:</span>
          <code className="rounded bg-red-500/10 px-1.5 py-0.5 font-mono text-red-300 border border-red-500/20">
            {finding.match}
          </code>
          <span className="text-xs text-slate-600">(redacted)</span>
        </div>
      </div>
    </div>
  );
}
