'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { fetchScanReport, validatePat } from '@/lib/github';
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
    validatePat().catch(() => router.push('/'));
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

  function downloadReport(data: object, scanId: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `secretshield-${scanId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const handleDownload = () => {
    if (!report) return;
    downloadReport(report, report.scan_id);
  };

  const filteredFindings: Finding[] = (report?.findings ?? [])
    .filter((f) => filter === 'ALL' || f.severity === filter)
    .sort((a, b) => severityWeight(a.severity) - severityWeight(b.severity));

  return (
    <div className="space-y-10">
      {/* Breadcrumb */}
      <nav className="font-mono text-xs text-muted uppercase tracking-widest">
        <Link href="/" className="hover:text-primary transition-colors">OVERVIEW</Link>
        <span className="mx-2">›</span>
        {owner && repo && (
          <>
            <Link href={`/repo/${owner}/${repo}`} className="hover:text-primary transition-colors">
              {owner} / {repo}
            </Link>
            <span className="mx-2">›</span>
          </>
        )}
        <span className="text-primary">{params.scan_id.slice(0, 8)}</span>
      </nav>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center py-24 font-mono text-sm text-accent">
          [ SYSTEM ] Fetching scan report artifact...
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="terminal-panel text-center py-16 border-accent">
          <p className="font-mono text-sm font-bold text-accent mb-2">FAILED_TO_LOAD_REPORT</p>
          <p className="font-mono text-xs text-muted mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="terminal-button">
            RETRY_FETCH
          </button>
        </div>
      )}

      {/* Not found */}
      {!isLoading && !error && !report && (
        <div className="terminal-panel text-center py-16">
          <p className="font-mono text-sm font-bold text-muted mb-2">REPORT_NOT_FOUND</p>
          <p className="font-mono text-xs text-muted">
            Artifact may have expired or report was not generated.
          </p>
        </div>
      )}

      {/* Report */}
      {!isLoading && report && (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
            <div>
              <h1 className="font-mono text-2xl font-bold tracking-tight text-primary">
                SCAN_REPORT <span className="text-muted ml-2">[{report.scan_id.slice(0, 8)}]</span>
              </h1>
              <p className="mt-2 font-mono text-xs text-muted tracking-widest tabular-nums uppercase">
                {new Date(report.timestamp).toLocaleString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                  year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
                })}
              </p>
            </div>
            <button
              onClick={handleDownload}
              className="font-mono text-xs text-muted hover:underline underline-offset-4 outline-none"
            >
              ↓ download report.json
            </button>
          </div>

          {/* Meta + Summary Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-border border border-border">
            <MetaCard label="REPO"    value={report.repo} />
            <MetaCard label="BRANCH"  value={report.branch} />
            <MetaCard label="COMMIT"  value={report.commit.slice(0, 7)} />
            <MetaCard label="TRIGGER" value={report.triggered_by} />
            <StatCard label="TOTAL"   value={report.summary.total_findings} highlight={report.summary.total_findings > 0} />
          </div>

          {/* Files removed */}
          {report.summary.files_removed.length > 0 && (
            <div>
              <h3 className="mb-2 font-mono text-xs font-bold text-accent uppercase tracking-widest">
                ▸ FILES_REMOVED (FILE-PATTERN SCANNER)
              </h3>
              <div className="terminal-panel bg-[#1a0f0f] border-accent/30 space-y-1">
                {report.summary.files_removed.map((f) => (
                  <div key={f} className="font-mono text-xs text-accent">
                    - {f}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Findings */}
          <div>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-2">
              <h2 className="font-mono text-sm font-bold text-primary uppercase tracking-widest">
                ▸ FINDINGS <span className="text-muted ml-1">[{filteredFindings.length}]</span>
              </h2>
              {/* Severity filter */}
              <div className="flex gap-4">
                {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`font-mono text-[11px] tracking-widest transition-colors ${
                      filter === s
                        ? 'text-primary underline underline-offset-4'
                        : 'text-muted hover:text-primary'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {filteredFindings.length === 0 ? (
              <div className="terminal-panel py-12 text-center">
                <p className="font-mono text-xs text-muted uppercase">
                  {report.findings.length === 0 ? '[CLEAN] NO FINDINGS DETECTED' : `NO FINDINGS MATCH FILTER: [${filter}]`}
                </p>
              </div>
            ) : (
              <div className="space-y-px bg-border border border-border">
                {filteredFindings.map((finding, idx) => (
                  <FindingRow key={`${finding.id}-${idx}`} finding={finding} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-4 flex flex-col justify-between h-full">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 font-mono text-sm text-primary truncate" title={value}>
        {value}
      </p>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`p-4 flex flex-col justify-between h-full ${highlight ? 'bg-[#1a0f0f]' : 'bg-background'}`}>
      <p className={`font-mono text-[10px] uppercase tracking-widest ${highlight ? 'text-accent' : 'text-muted'}`}>{label}</p>
      <p className={`mt-2 font-mono text-2xl font-bold tabular-nums ${highlight ? 'text-accent' : 'text-primary'}`}>
        {value.toString().padStart(4, '0')}
      </p>
    </div>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const colorMap: Record<string, string> = {
    CRITICAL: 'text-accent',
    HIGH: 'text-orange-500',
    MEDIUM: 'text-yellow-500',
    LOW: 'text-blue-500',
  };
  const color = colorMap[finding.severity] || 'text-muted';

  return (
    <div className="bg-background p-4 hover:bg-surface transition-colors flex flex-col sm:flex-row sm:items-start gap-4">
      <div className="w-32 flex-shrink-0">
        <span className={`font-mono text-xs font-bold ${color}`}>
          [{finding.severity}]
        </span>
      </div>
      
      <div className="flex-1 space-y-1.5 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-primary break-all">{finding.file}</span>
          <span className="text-muted">·</span>
          <span className="text-muted">line {finding.line.toString().padStart(3, '0')}</span>
          <span className="text-muted">·</span>
          <span className="text-muted">[{finding.source}]</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted w-12">RULE:</span>
          <span className="text-primary">{finding.rule}</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted w-12">MATCH:</span>
          <span className="text-mono-value px-1 bg-[#1a2e05]">{finding.match}</span>
        </div>
      </div>
    </div>
  );
}

function severityWeight(severity: string) {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return 0;
    case 'HIGH': return 1;
    case 'MEDIUM': return 2;
    case 'LOW': return 3;
    default: return 99;
  }
}
