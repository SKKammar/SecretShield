const fs = require('fs');
const https = require('https');

// Ensure the user provides a token
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error("Error: GITHUB_TOKEN environment variable is not set.");
  console.error("Usage: GITHUB_TOKEN=your_token node add-workflow-to-all.js");
  process.exit(1);
}

// GitHub API configuration
const API_BASE = 'https://api.github.com';
const HEADERS = {
  'Authorization': `token ${GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'Node.js-Script'
};

// The workflow content to add
const WORKFLOW_CONTENT = `name: SecretShield Scan

on:
  push:
  pull_request:
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
        uses: SKKammar/secretshield@main
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

const encodedContent = Buffer.from(WORKFLOW_CONTENT).toString('base64');

// Helper to make API requests
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: HEADERS,
    };

    const req = https.request(API_BASE + path, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data ? JSON.parse(data) : null);
          } else {
            reject(new Error(`API Error ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function addWorkflowToRepo(repo) {
  const path = '/repos/' + repo.full_name + '/contents/.github/workflows/secretshield.yml';
  
  try {
    // Check if file already exists
    let sha = null;
    try {
      const fileInfo = await request('GET', path);
      sha = fileInfo.sha;
      console.log(`[${repo.full_name}] Workflow already exists. Updating...`);
    } catch (err) {
      if (!err.message.includes('404')) {
        throw err;
      }
      console.log(`[${repo.full_name}] Workflow does not exist. Creating...`);
    }

    // Create or update the file
    const body = {
      message: 'ci: add SecretShield workflow',
      content: encodedContent,
    };
    if (sha) body.sha = sha;

    await request('PUT', path, body);
    console.log(`✅ [${repo.full_name}] Successfully added/updated workflow.`);
  } catch (err) {
    console.error(`❌ [${repo.full_name}] Failed:`, err.message);
  }
}

async function main() {
  console.log("Fetching repositories...");
  try {
    // Note: This fetches up to 100 repositories the user owns. 
    // For users with more than 100 repos, pagination handling would be needed.
    const repos = await request('GET', '/user/repos?type=owner&per_page=100');
    console.log(`Found ${repos.length} repositories.`);
    
    for (const repo of repos) {
      // Skip archived repos
      if (repo.archived) {
        console.log(`⏭️  Skipping [${repo.full_name}] (archived)`);
        continue;
      }
      
      await addWorkflowToRepo(repo);
      
      // Delay to avoid hitting API rate limits too quickly
      await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log("Finished processing repositories!");
  } catch (err) {
    console.error("Failed to fetch repositories:", err.message);
  }
}

main();
