'use client';

import { CopyBlock } from './CopyBlock';

export function EmptyState() {
  const codeSnippet = `# .github/workflows/secretshield.yml
on:
  push:
  pull_request:
  repository_dispatch:
    types: [secretshield-scan]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: SKKammar/secretshield@v1.1.0
        with:
          token: \${{ secrets.GITHUB_TOKEN }}
          fail_on_secrets: "false"
          auto_remove: "false"
      - name: Upload scan report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: secretshield-report
          path: secretshield-report.json`;

  return (
    <div className="text-left mt-8 max-w-lg">
      <p className="font-mono text-[13px] text-muted mb-6 lowercase">
        no scans found for this repository
      </p>
      
      <p className="font-mono text-[13px] text-muted mb-4 lowercase">
        to get started, add SecretShield to your workflow:
      </p>

      <div className="mb-6">
        <CopyBlock code={codeSnippet} />
      </div>

      <a
        href="https://github.com/SKKammar/secretshield#readme"
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs text-muted hover:text-primary hover:underline underline-offset-4 flex items-center transition-colors"
      >
        ↗ view full setup guide
      </a>
    </div>
  );
}
