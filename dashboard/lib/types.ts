/**
 * SecretShield Dashboard — Shared TypeScript Types
 * Conforms exactly to the SecretShield JSON report schema.
 */

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TriggerType = 'push' | 'pull_request';
export type FindingSource = 'gitleaks' | 'file-scanner';

export interface Finding {
  id: string;
  severity: Severity;
  file: string;
  line: number;
  match: string;
  rule: string;
  source: FindingSource;
}

export interface ScanSummary {
  total_findings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  files_removed: string[];
}

export interface ScanReport {
  scan_id: string;
  timestamp: string;
  repo: string;
  commit: string;
  branch: string;
  triggered_by: TriggerType;
  summary: ScanSummary;
  findings: Finding[];
}

/** GitHub Actions workflow artifact metadata */
export interface GitHubArtifact {
  id: number;
  node_id: string;
  name: string;
  size_in_bytes: number;
  url: string;
  archive_download_url: string;
  expired: boolean;
  created_at: string;
  expires_at: string;
  updated_at: string;
  workflow_run: {
    id: number;
    repository_id: number;
    head_repository_id: number;
    head_branch: string;
    head_sha: string;
  } | null;
}

export interface GitHubArtifactsResponse {
  total_count: number;
  artifacts: GitHubArtifact[];
}

/** Enriched scan record combining artifact metadata + parsed report */
export interface ScanRecord {
  artifact: GitHubArtifact;
  report: ScanReport | null;
  error?: string;
}

/** Repository search result */
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  updated_at: string;
  stargazers_count: number;
}

export interface GitHubRepoSearchResponse {
  total_count: number;
  items: GitHubRepo[];
}

/** Trend data point for charts */
export interface TrendPoint {
  date: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}
