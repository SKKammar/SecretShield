## SecretShield 🔐

Scans every push and PR for secrets, `.env` files, and sensitive credentials. Auto-removes on push, blocks merge on PR.

### Quick Start

Create a workflow file in your repository (e.g., `.github/workflows/secretshield.yml`):

```yaml
name: SecretShield Scan

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run SecretShield
        uses: SKKammar/SecretShield@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          severity_threshold: "HIGH"
          auto_remove: "true"
          fail_on_secrets: "true"
```

### Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `token` | GitHub token for PR comments and artifact upload | `${{ github.token }}` |
| `auto_remove` | Auto-delete sensitive files on direct push | `"true"` |
| `fail_on_secrets` | Fail the job if secrets are found (blocks PR merge) | `"true"` |
| `custom_patterns` | Comma-separated extra regex patterns to scan for | `""` |
| `ignore_paths` | Comma-separated paths to skip (e.g. tests/,docs/) | `""` |
| `severity_threshold` | Minimum severity to fail on: LOW, MEDIUM, HIGH, CRITICAL | `"HIGH"` |

### Outputs

| Output | Description |
|--------|-------------|
| `secrets_found` | `true/false` — whether any secrets were detected |
| `report_path` | Path to the JSON scan report artifact |
| `total_findings` | Total number of findings across all rules |

### How It Works

SecretShield utilizes Gitleaks under the hood, wrapped in a Docker container alongside a custom file pattern scanner. 
- On **Push**: It can automatically delete matching files and push a remediation commit.
- On **Pull Request**: It will post a comment summarizing findings and fail the CI build to block the merge if the threshold is met.

### Dashboard

A companion Next.js Dashboard is available to visualize your scan history across repositories! It fetches workflow artifacts directly from the GitHub API.

### Severity Levels

- **CRITICAL**: Private keys, high-value tokens.
- **HIGH**: Generic API tokens, `.env` files.
- **MEDIUM**: Suspicious endpoints or non-critical credentials.
- **LOW**: Informational findings.

### Custom Patterns

You can pass a comma-separated list of regex patterns via the `custom_patterns` input to extend the built-in rules.

### FAQ

**Why did my PR build fail?**
SecretShield found credentials! Check the PR comment or the workflow artifact for details.
