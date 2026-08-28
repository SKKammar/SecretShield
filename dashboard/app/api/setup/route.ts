import { type NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';

const GITHUB_API_BASE = 'https://api.github.com';

const WORKFLOW_CONTENT = `name: SecretShield Scan

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  repository_dispatch:
    types: [secretshield-scan]

permissions:
  contents: write      # required for auto-remove on push
  pull-requests: write # required to post PR comments

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: true

      - name: Run SecretShield
        uses: SKKammar/secretshield@v1.1.0
        with:
          token: \${{ secrets.GITHUB_TOKEN }}
          severity_threshold: "HIGH"
          auto_remove: "true"
          fail_on_secrets: "true"

      - name: Upload scan report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: secretshield-report
          path: secretshield-report.json
`;

const encodedContent = Buffer.from(WORKFLOW_CONTENT).toString('base64');

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { owner, repo } = await request.json();
    if (!owner || !repo) {
      return NextResponse.json({ error: 'Missing owner or repo' }, { status: 400 });
    }

    const path = `/repos/${owner}/${repo}/contents/.github/workflows/secretshield.yml`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    // Check if the file exists
    const checkRes = await fetch(`${GITHUB_API_BASE}${path}`, { headers });
    let sha = null;
    
    if (checkRes.ok) {
      const fileData = await checkRes.json();
      sha = fileData.sha;
    } else if (checkRes.status !== 404) {
      const errorData = await checkRes.json().catch(() => ({}));
      console.error(`Error checking file for ${owner}/${repo}:`, errorData);
      return NextResponse.json({ error: 'GitHub API error checking file' }, { status: checkRes.status });
    }

    // Create or update the file
    const body: any = {
      message: 'ci: add SecretShield workflow',
      content: encodedContent,
    };
    if (sha) {
      body.sha = sha;
    }

    const updateRes = await fetch(`${GITHUB_API_BASE}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!updateRes.ok) {
      const errorData = await updateRes.json().catch(() => ({}));
      console.error(`Error updating file for ${owner}/${repo}:`, errorData);
      return NextResponse.json({ error: 'GitHub API error updating file' }, { status: updateRes.status });
    }

    return NextResponse.json({ success: true, updated: !!sha });
  } catch (err) {
    console.error('Setup endpoint error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
