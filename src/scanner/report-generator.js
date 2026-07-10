const fs = require('fs');
const crypto = require('crypto');

function generateReport(gitleaksPath, fileScannerPath, outputPath) {
  let gitleaksData = [];
  if (fs.existsSync(gitleaksPath)) {
    try {
      const content = fs.readFileSync(gitleaksPath, 'utf8');
      if (content.trim()) gitleaksData = JSON.parse(content);
    } catch (e) {
      console.error('Error parsing gitleaks report:', e);
    }
  }

  let fileScannerData = [];
  if (fs.existsSync(fileScannerPath)) {
    try {
      const content = fs.readFileSync(fileScannerPath, 'utf8');
      if (content.trim()) fileScannerData = JSON.parse(content);
    } catch (e) {
      console.error('Error parsing file scanner report:', e);
    }
  }

  const findings = [];
  const filesRemoved = new Set();
  
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  // Process Gitleaks data
  for (const item of gitleaksData) {
    const finding = {
      id: crypto.randomUUID(),
      severity: 'HIGH', // Gitleaks doesn't output severity by default, defaulting to HIGH
      file: item.File,
      line: item.StartLine,
      match: item.Match,
      rule: item.RuleID,
      source: 'gitleaks'
    };
    
    // Simple heuristic for severity if not provided
    if (item.RuleID.toLowerCase().includes('key') || item.RuleID.toLowerCase().includes('token')) {
        finding.severity = 'CRITICAL';
    }

    findings.push(finding);
    filesRemoved.add(item.File);

    if (finding.severity === 'CRITICAL') criticalCount++;
    else if (finding.severity === 'HIGH') highCount++;
    else if (finding.severity === 'MEDIUM') mediumCount++;
    else if (finding.severity === 'LOW') lowCount++;
  }

  // Process file scanner data
  for (const item of fileScannerData) {
    const finding = {
      id: crypto.randomUUID(),
      severity: item.severity || 'HIGH',
      file: item.file,
      line: 1, // file level finding
      match: `File detected: ${item.file}`,
      rule: item.rule,
      source: 'file-scanner'
    };
    
    findings.push(finding);
    filesRemoved.add(item.file);

    if (finding.severity === 'CRITICAL') criticalCount++;
    else if (finding.severity === 'HIGH') highCount++;
    else if (finding.severity === 'MEDIUM') mediumCount++;
    else if (finding.severity === 'LOW') lowCount++;
  }

  const report = {
    scan_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    repo: process.env.GITHUB_REPOSITORY || 'unknown/repo',
    commit: process.env.GITHUB_SHA || 'unknown',
    branch: process.env.GITHUB_REF_NAME || 'unknown',
    triggered_by: process.env.GITHUB_EVENT_NAME || 'manual',
    summary: {
      total_findings: findings.length,
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
      files_removed: Array.from(filesRemoved)
    },
    findings: findings
  };

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`Unified report generated at ${outputPath}`);
}

const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: node report-generator.js <gitleaks-json> <file-scanner-json> <output-json>');
  process.exit(1);
}

generateReport(args[0], args[1], args[2]);
