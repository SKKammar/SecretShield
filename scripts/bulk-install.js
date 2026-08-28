#!/usr/bin/env node

/**
 * bulk-install.js
 * 
 * A utility script to automatically install the SecretShield GitHub Actions workflow
 * into multiple repositories in your GitHub account.
 * 
 * Usage:
 *   export GITHUB_TOKEN="ghp_your_personal_access_token"
 *   node scripts/bulk-install.js <github-username>
 */

const fs = require('fs');
const path = require('path');

const token = process.env.GITHUB_TOKEN;
const username = process.argv[2];

if (!token || !username) {
  console.error('Usage: GITHUB_TOKEN=ghp_... node bulk-install.js <username>');
  process.exit(1);
}

const WORKFLOW_PATH = '.github/workflows/secretshield.yml';
const WORKFLOW_CONTENT = `name: SecretShield Scan
on:
  push:
  pull_request:
  repository_dispatch:
    types: [secretshield-scan]

permissions:
  contents: write
  pull-requests: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Run SecretShield
        uses: SKKammar/secretshield@v1.1.0
        with:
          token: \${{ secrets.GITHUB_TOKEN }}
          severity_threshold: "HIGH"
          auto_remove: "true"
          allow_mutation: "true"
          fail_on_secrets: "true"
      - name: Upload scan report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: secretshield-report
          path: secretshield-report.json
`;

const API_BASE = 'https://api.github.com';

async function github(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }
  
  return res.status === 204 ? null : res.json();
}

async function run() {
  console.log(`🔍 Fetching repositories for ${username}...`);
  try {
    // Fetch user's repos (non-forks)
    let repos = await github(`/users/${username}/repos?per_page=100&type=owner`);
    repos = repos.filter(r => !r.fork);
    
    console.log(`Found ${repos.length} original repositories.`);
    
    for (const repo of repos) {
      console.log(`\n🛡️ Processing ${repo.name}...`);
      
      // 1. Check if file already exists to get its SHA (required for updating)
      let fileSha = undefined;
      try {
        const fileInfo = await github(`/repos/${username}/${repo.name}/contents/${WORKFLOW_PATH}`);
        fileSha = fileInfo.sha;
        console.log(`  - Existing workflow found. Will update it.`);
      } catch (e) {
        if (e.message.includes('404')) {
          console.log(`  - No existing workflow. Will create it.`);
        } else {
          console.log(`  - Error checking file: ${e.message}`);
          continue;
        }
      }

      // 2. Create or Update the file
      try {
        await github(`/repos/${username}/${repo.name}/contents/${WORKFLOW_PATH}`, {
          method: 'PUT',
          body: JSON.stringify({
            message: 'ci: install SecretShield security scanner workflow',
            content: Buffer.from(WORKFLOW_CONTENT).toString('base64'),
            sha: fileSha
          })
        });
        console.log(`  ✅ Successfully installed SecretShield in ${repo.name}!`);
      } catch (e) {
        console.error(`  ❌ Failed to install in ${repo.name}: ${e.message}`);
      }
    }
    
    console.log('\n🎉 Bulk installation complete!');
    
  } catch (err) {
    console.error('Fatal error:', err.message);
  }
}

run();
