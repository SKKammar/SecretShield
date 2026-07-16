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
    <div className="space-y-10">
      {/* Breadcrumb */}
      <nav className="font-mono text-xs text-muted uppercase tracking-widest">
        <Link href="/" className="hover:text-primary transition-colors">OVERVIEW</Link>
        <span className="mx-2">›</span>
        <a
          href={`https://github.com/${owner}/${repo}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline underline-offset-4"
        >
          {owner} / {repo}
        </a>
      </nav>

      {/* Header */}
      <div className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-primary">
            {repo.toUpperCase()}
          </h1>
          <p className="mt-2 font-mono text-xs text-muted tracking-widest">
            SCAN_HISTORY & ANALYSIS
          </p>
        </div>
        <a
          href={`https://github.com/${owner}/${repo}/actions`}
          target="_blank"
          rel="noopener noreferrer"
          className="terminal-button"
        >
          VIEW_ACTIONS ↗
        </a>
      </div>

      {/* Error */}
      {error && (
        <div className="border border-accent bg-transparent px-4 py-3 font-mono text-xs text-accent">
          [ERROR] {error}
          <button
            onClick={() => loadScans(page)}
            className="ml-4 underline underline-offset-4 hover:text-primary"
          >
            RETRY
          </button>
        </div>
      )}

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5 border border-border">
        <StatCard label="SCANS"    value={rows.length}                       color="text-primary" />
        <StatCard label="FINDINGS" value={aggregateSummary.total_findings}  color="text-primary" />
        <StatCard label="CRITICAL"       value={aggregateSummary.critical}         color="text-accent" />
        <StatCard label="HIGH"           value={aggregateSummary.high}             color="text-orange-500" />
        <StatCard label="MED_LOW"   value={aggregateSummary.medium + aggregateSummary.low} color="text-yellow-500" />
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-widest text-muted">
            ▸ FINDINGS_TREND [30D]
          </h2>
          <TrendChart data={trendData} className="terminal-panel !p-0 !pt-5" />
        </div>
        <div>
          <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-widest text-muted">
            ▸ SEVERITY_BREAKDOWN
          </h2>
          <SeverityPieChart summary={aggregateSummary} />
        </div>
      </div>

      {/* History table */}
      <div>
        <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-widest text-muted">
          ▸ SCAN_HISTORY
        </h2>
        <ScanHistoryTable rows={rows} owner={owner} repo={repo} isLoading={isLoading} />
      </div>

      {/* Pagination */}
      {!isLoading && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="font-mono text-xs text-primary hover:text-accent disabled:opacity-30 disabled:hover:text-primary transition-colors"
          >
            ← PREV
          </button>
          <span className="font-mono text-xs text-muted tabular-nums">PAGE_{page.toString().padStart(2, '0')}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="font-mono text-xs text-primary hover:text-accent disabled:opacity-30 disabled:hover:text-primary transition-colors"
          >
            NEXT →
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-background p-5 flex flex-col justify-between">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-2 font-mono text-xl font-bold tabular-nums ${color}`}>
        {value.toString().padStart(4, '0')}
      </p>
    </div>
  );
}
