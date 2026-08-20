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
    return '[REDACTED]';
  }
  const stripped = rawMatch.trim();
  const hash = crypto.createHash('sha256').update(stripped).digest('hex').substring(0, 8);
  return `[REDACTED:${hash}]`;
}

/**
 * Parse Gitleaks v8 JSON output (array of finding objects).
 * Returns normalized findings array.
 *
 * IMPORTANT: Gitleaks detects secrets EMBEDDED INSIDE source files (e.g. a hardcoded
 * AWS key in config.js). These files are NOT added to `removableFiles` because
 * auto-deleting a source file would break the codebase. Users must remediate these
 * manually by removing the secret value, then rotating credentials.
 *
 * Only the file-pattern scanner (whole sensitive files like .env, .pem) populates
 * `removableFiles` for auto-removal.
 */
function processGitleaksData(data) {
  if (!Array.isArray(data)) return [];
  const findings    = [];
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
    // NOTE: gitleaks files are NOT added to removableFiles — see function docstring above.

    if (severity in severityMap) severityMap[severity]++;
    else severityMap['HIGH']++;
  }

  return { findings, severityMap };
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
 *
 * `files_removed` contains ONLY files flagged by the file-pattern scanner
 * (whole sensitive files: .env, .pem, service-account.json, etc.).
 * Gitleaks findings are NEVER auto-removed — the user must edit the file to
 * remove the embedded secret, then rotate the exposed credential.
 */
function generateReport(gitleaksPath, fileScannerPath, outputPath) {
  const gitleaksData    = readJsonFile(gitleaksPath, []);
  const fileScannerData = readJsonFile(fileScannerPath, []);

  const gl  = processGitleaksData(gitleaksData);
  const fsc = processFileScannerData(fileScannerData);

  const allFindings = [...gl.findings, ...fsc.findings];

  // Only file-scanner files are candidates for auto-removal.
  // Gitleaks findings (hardcoded secrets inside source files) must be fixed manually.
  const removableFiles = Array.from(fsc.filesSet);

  // Deduplicate findings
  const uniqueFindings = [];
  const seen = new Set();
  for (const f of allFindings) {
    const fingerprint = `${f.file}|${f.line}|${f.match}`;
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      uniqueFindings.push(f);
    }
  }

  // Merge severity counts
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of uniqueFindings) {
    if (f.severity in counts) counts[f.severity]++;
    else counts['HIGH']++;
  }

  const report = {
    schema_version: 1,
    scan_id:      crypto.randomUUID(),
    request_id:   process.env.REQUEST_ID || undefined,
    timestamp:    new Date().toISOString(),
    repo:         process.env.GITHUB_REPOSITORY  || 'unknown/repo',
    commit:       process.env.GITHUB_SHA         || 'unknown',
    branch:       process.env.GITHUB_REF_NAME    || 'unknown',
    scan_scope:   process.env.SCAN_SCOPE         || 'all',
    triggered_by: (process.env.GITHUB_EVENT_NAME || 'manual') === 'pull_request'
                    ? 'pull_request' : 'push',
    summary: {
      total_findings: uniqueFindings.length,
      critical:       counts.CRITICAL,
      high:           counts.HIGH,
      medium:         counts.MEDIUM,
      low:            counts.LOW,
      files_removed:  removableFiles,
    },
    findings: uniqueFindings,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

  // Generate unified SARIF
  generateSarif(uniqueFindings, path.join(path.dirname(outputPath), 'secretshield.sarif'));

  console.log(`[SecretShield] Report written to ${outputPath}`);
  console.log(`[SecretShield] Removable files (file-scanner): ${removableFiles.length}`);
  console.log(`[SecretShield] Total findings: ${uniqueFindings.length} (CRITICAL: ${counts.CRITICAL}, HIGH: ${counts.HIGH}, MEDIUM: ${counts.MEDIUM}, LOW: ${counts.LOW})`);
}

function generateSarif(findings, sarifPath) {
  const sarif = {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "SecretShield",
            informationUri: "https://github.com/SKKammar/SecretShield",
            rules: findings.map(f => ({
              id: f.id,
              shortDescription: { text: f.rule },
              properties: {
                "security-severity": f.severity === 'CRITICAL' ? "9.0" : f.severity === 'HIGH' ? "7.0" : f.severity === 'MEDIUM' ? "4.0" : "2.0"
              }
            })).filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i)
          }
        },
        results: findings.map(f => ({
          ruleId: f.id,
          level: f.severity === 'CRITICAL' || f.severity === 'HIGH' ? "error" : "warning",
          message: { text: `Secret detected: ${f.rule} ${f.match}` },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: f.file },
                region: { startLine: f.line || 1 }
              }
            }
          ],
          partialFingerprints: {
            primaryLocationLineHash: crypto.createHash('sha256').update(`${f.file}:${f.line}:${f.id}`).digest('hex')
          }
        }))
      }
    ]
  };
  fs.writeFileSync(sarifPath, JSON.stringify(sarif, null, 2), 'utf8');
}

// ─── CLI entrypoint ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: node report-generator.js <gitleaks-json> <file-scanner-json> <output-json>');
  process.exit(1);
}

generateReport(args[0], args[1], args[2]);
