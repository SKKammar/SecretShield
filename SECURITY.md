# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅ Yes    |

## Reporting a Vulnerability

SecretShield is a **security tool** — we take vulnerabilities in the tool itself extremely seriously.

### Please DO NOT open a public GitHub issue for security vulnerabilities.

Instead, use one of these private disclosure channels:

### Option 1 — GitHub Private Security Advisory (preferred)

1. Go to [https://github.com/SKKammar/secretshield/security/advisories/new](https://github.com/SKKammar/secretshield/security/advisories/new)
2. Fill in the vulnerability details
3. We will respond within **48 hours**

### Option 2 — Email

Send details to: **santoshkkammar16@gmail.com**

Subject line: `[SECURITY] SecretShield vulnerability report`

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

---

## What to Report

Security issues we want to know about:

- **Secret exposure**: A scenario where `entrypoint.sh` or `report-generator.js` could accidentally log or expose a full secret value (the `match` field must always be redacted)
- **Privilege escalation**: The action running with more permissions than declared in `action.yml`
- **Supply chain issues**: Compromised dependency or Docker base image vulnerability
- **Bypass**: A way to commit secrets that evade both Gitleaks and the file-pattern scanner
- **SSRF / injection**: Any injection vector in the PR comment generation or curl calls

---

## What NOT to Report

- False positives / missed detections in user repos (open a regular issue)
- Feature requests (open a regular issue)
- Gitleaks vulnerabilities — report those to [https://github.com/gitleaks/gitleaks/security](https://github.com/gitleaks/gitleaks/security)

---

## Security Design Notes

- **Match redaction**: `report-generator.js` redacts all secret values — only the first 4 characters are retained, followed by `****`. Full secrets are never written to disk, logs, or PR comments.
- **No external calls**: The scanner makes no outbound network calls except to the GitHub API (for PR comments and artifact upload) using the provided `GITHUB_TOKEN`.
- **Pinned versions**: All tools (Gitleaks v8.18.2, actions/checkout@v4, etc.) are pinned to exact versions to prevent supply-chain attacks.
- **files_removed scope**: Auto-remove on push only removes files detected by the **file-pattern scanner** (entire sensitive files like `.env`, `.pem`). Gitleaks findings (secrets embedded in source files) are flagged but NOT auto-deleted — deleting a source file would break the codebase. Users must remediate those manually.

---

## Disclosure Timeline

1. **Day 0** — Vulnerability reported privately
2. **Day 1–2** — Acknowledgement sent
3. **Day 7** — Patch developed and tested
4. **Day 14** — Patched version released
5. **Day 21** — Public disclosure (CVE filed if applicable)

---

*Thank you for helping keep SecretShield and its users secure.* 🛡️
