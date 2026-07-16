'use strict';

/**
 * SecretShield — Unified Report Generator
 *
 * Merges Gitleaks JSON output and file-scanner JSON output into a single
 * structured report conforming to the SecretShield JSON schema.
 *
 * SECURITY: The "match" field is always redacted — only first 4 chars + "****"
 * are written. Full secret values are NEVER logged.
 *
 * Uses Node.js built-ins only — no npm dependencies required.
 */

const fs     = require('fs');
const crypto = require('crypto');
const path   = require('path');

// ─── Severity mapping by rule ID keywords ─────────────────────────────────────
const SEVERITY_MAP = [
  // CRITICAL patterns
  { keywords: ['private-key', 'private_key', 'privatekey', 'database-connection', 'db-conn',
               'supabase-service-role', 'service-role', 'service_role',
               'service-account', 'firebase-adminsdk', 'secrets-config',
               'credentials-file', 'keystore'],
    severity: 'CRITICAL' },
  // HIGH patterns
  { keywords: ['api-key', 'api_key', 'apikey', 'access-key', 'access_key',
               'secret-key', 'secret_key', 'auth-token', 'env-file',
               'password', 'passwd', 'generic-api', 'generic-password',
               'aws', 'gcp', 'azure', 'token'],
    severity: 'HIGH' },
  // MEDIUM patterns
  { keywords: ['supabase-url', 'endpoint', 'webhook', 'url', 'connection'],
    severity: 'MEDIUM' },
];

/**
 * Resolve severity from a rule ID or tags array.
 * Falls back to defaultSeverity if no keyword matches.
 */
function resolveSeverity(ruleId, tags, defaultSeverity) {
  const ruleIdLower = (ruleId || '').toLowerCase();
  const tagString   = (tags || []).join(' ').toLowerCase();
  const combined    = `${ruleIdLower} ${tagString}`;

  for (const { keywords, severity } of SEVERITY_MAP) {
    if (keywords.some(k => combined.includes(k))) {
      return severity;
    }
  }
  return defaultSeverity || 'HIGH';
}

/**
 * Redact a secret match: keep first 4 chars, replace the rest with ****.
 * If match is null/undefined/"", return "<redacted>".
 */
function redactMatch(rawMatch) {
  if (!rawMatch || typeof rawMatch !== 'string' || rawMatch.trim() === '') {
    return '<redacted>';
  }
  const stripped = rawMatch.trim();
  if (stripped.length <= 4) return '****';
  return stripped.slice(0, 4) + '****';
}

/**
 * Parse Gitleaks v8 JSON output (array of finding objects).
 * Returns normalized findings array.
 */
function processGitleaksData(data) {
  if (!Array.isArray(data)) return [];
  const findings    = [];
  const filesSet    = new Set();
  const severityMap = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

  for (const item of data) {
    // Gitleaks v8 fields: RuleID, Description, StartLine, EndLine, Match, Secret, File, Tags
    const ruleId   = item.RuleID   || item.ruleID   || item.rule_id   || 'unknown-rule';
    const tags     = item.Tags     || item.tags     || [];
    const rawMatch = item.Match    || item.match    || item.Secret || item.secret || '';
    const filePath = item.File     || item.file     || '';
    const line     = item.StartLine || item.startLine || item.Line || 0;

    // Gitleaks may report severity in Tags
    let defaultSev = 'HIGH';
    if (Array.isArray(tags)) {
      const sevTag = tags.find(t => ['critical','high','medium','low'].includes(String(t).toLowerCase()));
      if (sevTag) defaultSev = String(sevTag).toUpperCase();
    }

    const severity = resolveSeverity(ruleId, tags, defaultSev);
    const finding = {
      id:       ruleId,
      severity,
      file:     filePath,
      line:     Number(line) || 0,
      match:    redactMatch(rawMatch),
      rule:     item.Description || item.description || ruleId,
      source:   'gitleaks',
    };

    findings.push(finding);
    if (filePath) filesSet.add(filePath);

    if (severity in severityMap) severityMap[severity]++;
    else severityMap['HIGH']++;
  }

  return { findings, filesSet, severityMap };
}

/**
 * Parse file-scanner JSON output (array of finding objects).
 * Returns normalized findings array.
 */
function processFileScannerData(data) {
  if (!Array.isArray(data)) return [];
  const findings    = [];
  const filesSet    = new Set();
  const severityMap = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

  for (const item of data) {
    const ruleId   = item.id       || item.rule || 'file-scanner';
    const rawMatch = item.match    || `File: ${item.file || ''}`;
    const severity = item.severity || resolveSeverity(ruleId, [], 'HIGH');

    const finding = {
      id:       ruleId,
      severity: severity.toUpperCase(),
      file:     item.file || '',
      line:     item.line || 1,
      match:    redactMatch(rawMatch),
      rule:     item.rule || ruleId,
      source:   'file-scanner',
    };

    findings.push(finding);
    if (item.file) filesSet.add(item.file);

    const sev = finding.severity;
    if (sev in severityMap) severityMap[sev]++;
    else severityMap['HIGH']++;
  }

  return { findings, filesSet, severityMap };
}

/**
 * Read and parse a JSON file. Returns parsed value or fallback on error.
 */
function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) return fallback;
    return JSON.parse(content);
  } catch (err) {
    console.error(`[SecretShield] Warning: could not parse ${filePath}: ${err.message}`);
    return fallback;
  }
}

/**
 * Main entry point — merge Gitleaks + file-scanner output into unified report.
 */
function generateReport(gitleaksPath, fileScannerPath, outputPath) {
  const gitleaksData    = readJsonFile(gitleaksPath, []);
  const fileScannerData = readJsonFile(fileScannerPath, []);

  const gl  = processGitleaksData(gitleaksData);
  const fsc = processFileScannerData(fileScannerData);

  const allFindings = [...gl.findings, ...fsc.findings];
  const allFiles    = new Set([...gl.filesSet, ...fsc.filesSet]);

  // Merge severity counts
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of allFindings) {
    if (f.severity in counts) counts[f.severity]++;
    else counts['HIGH']++;
  }

  const report = {
    scan_id:      crypto.randomUUID(),
    timestamp:    new Date().toISOString(),
    repo:         process.env.GITHUB_REPOSITORY  || 'unknown/repo',
    commit:       process.env.GITHUB_SHA         || 'unknown',
    branch:       process.env.GITHUB_REF_NAME    || 'unknown',
    triggered_by: (process.env.GITHUB_EVENT_NAME || 'manual') === 'pull_request'
                    ? 'pull_request' : 'push',
    summary: {
      total_findings: allFindings.length,
      critical:       counts.CRITICAL,
      high:           counts.HIGH,
      medium:         counts.MEDIUM,
      low:            counts.LOW,
      files_removed:  Array.from(allFiles),
    },
    findings: allFindings,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`[SecretShield] Report written to ${outputPath}`);
  console.log(`[SecretShield] Total findings: ${allFindings.length} (CRITICAL: ${counts.CRITICAL}, HIGH: ${counts.HIGH}, MEDIUM: ${counts.MEDIUM}, LOW: ${counts.LOW})`);
}

// ─── CLI entrypoint ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: node report-generator.js <gitleaks-json> <file-scanner-json> <output-json>');
  process.exit(1);
}

generateReport(args[0], args[1], args[2]);
