# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-07-16
### Added
- Docker-based GitHub Action with Gitleaks v8.18.2 (pinned)
- Custom file-pattern scanner (14 sensitive file types)
- 6 custom Gitleaks rules: supabase-service-role-key, supabase-url,
  generic-api-key-assignment, generic-password-assignment,
  database-connection-string, private-key-header
- Structured JSON scan report with redacted match field
- Auto-remove sensitive files on direct push with ⚠️ warning commit
- PR comment with findings table and 4-step fix guide
- Configurable severity threshold (LOW / MEDIUM / HIGH / CRITICAL)
- GITHUB_STEP_SUMMARY integration
- Next.js 15 companion dashboard (reads GitHub Artifacts API)
- Vercel one-click deploy for dashboard
