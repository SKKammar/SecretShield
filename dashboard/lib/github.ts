/**
 * SecretShield Dashboard — GitHub API Client
 *
 * Reads scan reports via GitHub Artifacts REST API.
 * Auth: GitHub PAT with read:actions scope stored in localStorage.
 * No backend, no database — purely client-side API calls.
 */

import type {
  GitHubArtifact,
  GitHubArtifactsResponse,
  GitHubRepoSearchResponse,
  GitHubRepo,
  ScanReport,
  TrendPoint,
} from './types';

const GITHUB_API_BASE = 'https://api.github.com';
const PAT_STORAGE_KEY = 'secretshield_github_pat';
const ARTIFACT_NAME   = 'secretshield-report';

// ─── PAT Management ──────────────────────────────────────────────────────────

export function getPat(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PAT_STORAGE_KEY);
}

export function setPat(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PAT_STORAGE_KEY, token.trim());
}

export function clearPat(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PAT_STORAGE_KEY);
}

export function hasPat(): boolean {
  return Boolean(getPat());
}

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

async function githubFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const pat = getPat();
  if (!pat) throw new GitHubAuthError('No GitHub PAT configured.');

  const res = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });

  if (res.status === 401) throw new GitHubAuthError('Invalid or expired PAT. Please update your token.');
  if (res.status === 403) throw new GitHubAuthError('Insufficient PAT scopes. Ensure read:actions is granted.');
  if (res.status === 404) throw new GitHubNotFoundError(`Resource not found: ${path}`);
  if (!res.ok) throw new GitHubApiError(`GitHub API error ${res.status}: ${res.statusText}`, res.status);

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
  const data = await githubFetch<GitHubRepoSearchResponse>(
    `/search/repositories?q=${encoded}&sort=updated&per_page=10`
  );
  return data.items;
}

export async function getUserRepos(): Promise<GitHubRepo[]> {
  const data = await githubFetch<GitHubRepo[]>(
    `/user/repos?sort=updated&per_page=30&type=all`
  );
  return data;
}

// ─── Artifacts API ────────────────────────────────────────────────────────────

export async function listScanArtifacts(
  owner: string,
  repo: string,
  perPage = 30,
  page = 1,
): Promise<GitHubArtifactsResponse> {
  return githubFetch<GitHubArtifactsResponse>(
    `/repos/${owner}/${repo}/actions/artifacts?name=${ARTIFACT_NAME}&per_page=${perPage}&page=${page}`
  );
}

/** Fetch and parse a scan report from a GitHub artifact download URL. */
export async function fetchScanReport(
  owner: string,
  repo: string,
  artifactId: number,
): Promise<ScanReport | null> {
  // We proxy through our Next.js API route to avoid CORS issues
  try {
    const res = await fetch(
      `/api/scans?owner=${owner}&repo=${repo}&artifact_id=${artifactId}`
    );
    if (!res.ok) return null;
    const data = await res.json() as ScanReport;
    return data;
  } catch {
    return null;
  }
}

// ─── Manual Actions ──────────────────────────────────────────────────────────

export async function triggerManualScan(owner: string, repo: string): Promise<void> {
  await githubFetch(`/repos/${owner}/${repo}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({
      event_type: 'secretshield-scan'
    })
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

// ─── Validate PAT by calling /user ───────────────────────────────────────────

export async function validatePat(): Promise<{ login: string; avatar_url: string }> {
  const user = await githubFetch<{ login: string; avatar_url: string }>('/user');
  return user;
}
