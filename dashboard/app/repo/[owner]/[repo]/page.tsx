'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ScanHistoryTable } from '@/components/ScanHistoryTable';
import { TrendChart, SeverityPieChart } from '@/components/TrendChart';
import { listScanArtifacts, fetchScanReport, buildTrendData, hasPat } from '@/lib/github';
import type { GitHubArtifact, ScanReport, TrendPoint } from '@/lib/types';
import { useParams, useRouter } from 'next/navigation';

interface ScanRow {
  artifact: GitHubArtifact;
  report: ScanReport | null;
}

export default function RepoPage() {
  const params = useParams<{ owner: string; repo: string }>();
  const router = useRouter();
  const owner = params.owner;
  const repo  = params.repo;

  const [rows, setRows]           = useState<ScanRow[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(false);

  // Aggregate summary for current page
  const aggregateSummary = {
    total_findings: rows.reduce((s, r) => s + (r.report?.summary.total_findings ?? 0), 0),
    critical:       rows.reduce((s, r) => s + (r.report?.summary.critical ?? 0), 0),
    high:           rows.reduce((s, r) => s + (r.report?.summary.high ?? 0), 0),
    medium:         rows.reduce((s, r) => s + (r.report?.summary.medium ?? 0), 0),
    low:            rows.reduce((s, r) => s + (r.report?.summary.low ?? 0), 0),
    files_removed:  [],
  };

  const loadScans = useCallback(async (pageNum: number) => {
    if (!hasPat()) { router.push('/'); return; }
    setIsLoading(true);
    setError(null);
    try {
      const { artifacts, total_count } = await listScanArtifacts(owner, repo, 10, pageNum);
      setHasMore((pageNum * 10) < total_count);

      // Fetch all reports in parallel
      const reportMap = new Map<number, ScanReport | null>();
      await Promise.all(
        artifacts.map(async (a) => {
          const report = await fetchScanReport(owner, repo, a.id);
          reportMap.set(a.id, report);
        })
      );

      const newRows = artifacts.map((a) => ({ artifact: a, report: reportMap.get(a.id) ?? null }));
      setRows(newRows);

      // Build trend data from all fetched reports
      const trend = buildTrendData(artifacts, reportMap);
      setTrendData(trend);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scans');
    } finally {
      setIsLoading(false);
    }
  }, [owner, repo, router]);

  useEffect(() => { loadScans(page); }, [page, loadScans]);

  return (
    <div className="animate-fade-in space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-300 transition-colors">Overview</Link>
        <span>/</span>
        <a
          href={`https://github.com/${owner}/${repo}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-slate-300 hover:text-white transition-colors"
        >
          {owner}/{repo}
        </a>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="gradient-text">{repo}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {owner} · Scan history &amp; analysis
          </p>
        </div>
        <a
          href={`https://github.com/${owner}/${repo}/actions`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 transition-all hover:bg-white/10 hover:text-slate-200"
        >
          View Actions →
        </a>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span>⚠️</span>
          <span>{error}</span>
          <button
            onClick={() => loadScans(page)}
            className="ml-auto rounded-lg bg-red-500/20 px-3 py-1 text-xs font-medium hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        <StatCard label="Total Scans"    value={rows.length}                       color="text-white" />
        <StatCard label="Total Findings" value={aggregateSummary.total_findings}  color="text-white" />
        <StatCard label="Critical"       value={aggregateSummary.critical}         color="text-red-400" />
        <StatCard label="High"           value={aggregateSummary.high}             color="text-orange-400" />
        <StatCard label="Medium / Low"   value={aggregateSummary.medium + aggregateSummary.low} color="text-yellow-400" />
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass-card p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-300">📉 Findings Trend (30 days)</h2>
          <TrendChart data={trendData} />
        </div>
        <div className="glass-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-300">🥧 Severity Breakdown</h2>
          <SeverityPieChart summary={aggregateSummary} />
        </div>
      </div>

      {/* History table */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Scan History</h2>
        <ScanHistoryTable rows={rows} owner={owner} repo={repo} isLoading={isLoading} />
      </div>

      {/* Pagination */}
      {!isLoading && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-500">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="stat-card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
