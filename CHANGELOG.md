# Changelog

All notable changes to SecretShield are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2024-07-16

### Added
- **Gitleaks v8.18.2** integration (pinned) for comprehensive secret detection
- **Custom file-pattern scanner** covering 14 sensitive file types:
  `.env`, `.env.*`, `.pem`, `.key`, `.p12`, `.pfx`, `id_rsa*`, `id_dsa*`,
  `id_ecdsa*`, `id_ed25519*`, `secrets.json/yaml/yml`, `credentials.json`,
  `service-account.json`, `firebase-adminsdk*.json`, `google-credentials.json`
- **6 custom Gitleaks rules**: Supabase service_role key (CRITICAL),
  Supabase URL (MEDIUM), generic API key assignment (HIGH),
  generic password assignment (HIGH), database connection strings (CRITICAL),
  PEM private key headers (CRITICAL)
- **Severity threshold filtering**: `LOW | MEDIUM | HIGH | CRITICAL`
- **Auto-remove on push**: git-rm sensitive files, update `.gitignore`,
  commit with ⚠️ warning message
- **Rich PR comments** with findings table and 4-step "How to Fix" guide
- **`GITHUB_STEP_SUMMARY`** integration for inline scan summary
- **Structured JSON report** (`secretshield-report.json`) uploaded as workflow artifact
- **Match redaction**: only first 4 characters shown, rest replaced with `****`
- **Custom patterns**: extend detection via `custom_patterns` input
- **Ignore paths**: skip directories via `ignore_paths` input
- **`GITHUB_OUTPUT`** wiring: `secrets_found`, `total_findings`, `report_path`
- **Next.js 15 dashboard**: visualize scan history across repos via GitHub Artifacts API
  - Overview page with repo search and PAT authentication
  - Per-repo history with trend chart (Recharts LineChart, 30 days)
  - Severity breakdown (Recharts PieChart)
  - Single scan detail view with raw JSON download
- **CI workflow**: validates Action against clean/dirty test fixtures
- **Release workflow**: auto-publishes floating major tag on `v*.*.*` push

### Security
- Secrets are never logged in full — match redaction enforced at report generation
- Allowlist covers test fixtures, build artifacts, and common placeholder values

[1.0.0]: https://github.com/SKKammar/secretshield/releases/tag/v1.0.0
