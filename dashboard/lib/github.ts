/**
 * SecretShield Dashboard — API Client
 *
 * Calls the Next.js API routes, which securely proxy requests to GitHub
 * using a server-side session token.
 */

import type {
  GitHubArtifact,
  GitHubArtifactsResponse,
  GitHubRepoSearchResponse,
  GitHubRepo,
  ScanReport,
  TrendPoint,
} from './types';

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) throw new GitHubAuthError('Session expired. Please log in again.');
  if (res.status === 403) throw new GitHubAuthError('Insufficient permissions.');
  if (res.status === 404) throw new GitHubNotFoundError(`Resource not found: ${path}`);
  if (!res.ok) throw new GitHubApiError(`API error ${res.status}: ${res.statusText}`, res.status);

  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

// ─── Custom Error Types ───────────────────────────────────────────────────────

export class GitHubAuthError extends Error {
  constructor(message: string) { super(message); this.name = 'GitHubAuthError'; }
}
export class GitHubNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = 'GitHubNotFoundError'; }
}
export class GitHubApiError extends Error {
  public status: number;
  constructor(message: string, status: number) {
    super(message); this.name = 'GitHubApiError'; this.status = status;
  }
}

// ─── Repository Search ────────────────────────────────────────────────────────

export async function searchRepos(query: string): Promise<GitHubRepo[]> {
  if (!query.trim()) return [];
  const encoded = encodeURIComponent(query);
  const data = await apiFetch<GitHubRepoSearchResponse>(`/api/search?q=${encoded}`);
  return data.items || [];
}

export async function getUserRepos(): Promise<GitHubRepo[]> {
  const data = await apiFetch<GitHubRepo[]>(`/api/repos`);
  return data;
}

// ─── Artifacts API ────────────────────────────────────────────────────────────

export async function listScanArtifacts(
  owner: string,
  repo: string,
  perPage = 30,
  page = 1,
): Promise<GitHubArtifactsResponse> {
  return apiFetch<GitHubArtifactsResponse>(
    `/api/scans/list?owner=${owner}&repo=${repo}&per_page=${perPage}&page=${page}`
  );
}

/** Fetch and parse a scan report from a GitHub artifact download URL. */
export async function fetchScanReport(
  owner: string,
  repo: string,
  artifactId: number,
): Promise<ScanReport | null> {
  try {
    return await apiFetch<ScanReport>(`/api/scans?owner=${owner}&repo=${repo}&artifact_id=${artifactId}`);
  } catch {
    return null;
  }
}

// ─── Manual Actions ──────────────────────────────────────────────────────────

export async function triggerManualScan(owner: string, repo: string): Promise<{ request_id: string }> {
  return apiFetch<{ request_id: string }>(`/api/scans/dispatch`, {
    method: 'POST',
    body: JSON.stringify({ owner, repo })
  });
}

// ─── Trend Data Processing ────────────────────────────────────────────────────

/**
 * Convert a list of artifacts to trend data points over the last N days.
 * Groups by day and picks the latest scan per day.
 */
export function buildTrendData(
  artifacts: GitHubArtifact[],
  reports: Map<number, ScanReport | null>,
  days = 30,
): TrendPoint[] {
  const now   = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);

  // Build day-keyed map
  const dayMap = new Map<string, TrendPoint>();

  for (const artifact of artifacts) {
    const date = new Date(artifact.created_at);
    if (date < start) continue;

    const dayKey = date.toISOString().slice(0, 10); // YYYY-MM-DD
    const report = reports.get(artifact.id);

    const existing = dayMap.get(dayKey);

    const point: TrendPoint = {
      date:     dayKey,
      total:    report?.summary.total_findings ?? 0,
      critical: report?.summary.critical        ?? 0,
      high:     report?.summary.high            ?? 0,
      medium:   report?.summary.medium          ?? 0,
      low:      report?.summary.low             ?? 0,
    };

    // Keep the highest total per day
    if (!existing || point.total > existing.total) {
      dayMap.set(dayKey, point);
    }
  }

  // Fill missing days with zeros
  const result: TrendPoint[] = [];
  for (let d = 0; d < days; d++) {
    const date = new Date(start);
    date.setDate(date.getDate() + d);
    const key = date.toISOString().slice(0, 10);
    result.push(dayMap.get(key) ?? { date: key, total: 0, critical: 0, high: 0, medium: 0, low: 0 });
  }

  return result;
}

// ─── Validate Auth ───────────────────────────────────────────────────────────

export async function validatePat(): Promise<{ login: string; avatar_url: string }> {
  return apiFetch<{ login: string; avatar_url: string }>('/api/auth/me');
}
