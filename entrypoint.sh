#!/bin/bash
set -euo pipefail

echo "🛡️  SecretShield — Starting scan..."

WORKSPACE="${GITHUB_WORKSPACE:-/github/workspace}"
cd "$WORKSPACE"

# ─── Git setup ───────────────────────────────────────────────────────────────
git config --global --add safe.directory "$WORKSPACE"
git config user.name  "secretshield[bot]"
git config user.email "secretshield[bot]@users.noreply.github.com"

# ─── Defaults ────────────────────────────────────────────────────────────────
AUTO_REMOVE="${AUTO_REMOVE:-true}"
FAIL_ON_SECRETS="${FAIL_ON_SECRETS:-true}"
CUSTOM_PATTERNS="${CUSTOM_PATTERNS:-}"
IGNORE_PATHS="${IGNORE_PATHS:-}"
SEVERITY_THRESHOLD="${SEVERITY_THRESHOLD:-HIGH}"
GITHUB_EVENT_NAME="${GITHUB_EVENT_NAME:-push}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-unknown/repo}"
GITHUB_SHA="${GITHUB_SHA:-unknown}"
GITHUB_REF_NAME="${GITHUB_REF_NAME:-unknown}"

REPORT_DIR="/tmp/secretshield"
mkdir -p "$REPORT_DIR"

GITLEAKS_REPORT="$REPORT_DIR/gitleaks-report.json"
FILE_SCANNER_REPORT="$REPORT_DIR/file-scanner-report.json"
FINAL_REPORT="$WORKSPACE/secretshield-report.json"

# ─── Build ignore args ────────────────────────────────────────────────────────
GITLEAKS_IGNORE_ARGS=""
if [ -n "$IGNORE_PATHS" ]; then
  IFS=',' read -ra PATHS <<< "$IGNORE_PATHS"
  for p in "${PATHS[@]}"; do
    p_trimmed="${p// /}"
    GITLEAKS_IGNORE_ARGS="$GITLEAKS_IGNORE_ARGS --ignore-path=$p_trimmed"
  done
fi

# ─── 1. Run Gitleaks ─────────────────────────────────────────────────────────
echo "🔍 Running Gitleaks (JSON format)..."
gitleaks detect \
  --source . \
  --config /action/.gitleaks.toml \
  --redact \
  --report-format json \
  --report-path "$GITLEAKS_REPORT" \
  --exit-code 0 \
  $GITLEAKS_IGNORE_ARGS \
  || true

# Run Gitleaks again for SARIF output if enabled
if [ "${SARIF_UPLOAD:-false}" = "true" ]; then
  echo "📄 Generating SARIF report..."
  gitleaks detect \
    --source . \
    --config /action/.gitleaks.toml \
    --redact \
    --report-format sarif \
    --report-path "$REPORT_DIR/gitleaks.sarif" \
    --exit-code 0 \
    $GITLEAKS_IGNORE_ARGS \
    || true
  echo "sarif_path=$REPORT_DIR/gitleaks.sarif" >> "${GITHUB_OUTPUT:-/dev/null}"
fi

# Ensure file exists even if empty
[ -f "$GITLEAKS_REPORT" ] || echo "[]" > "$GITLEAKS_REPORT"

# ─── 2. Run custom file-pattern scanner ───────────────────────────────────────
echo "🔍 Running custom file-pattern scanner..."
IGNORE_PATHS="$IGNORE_PATHS" CUSTOM_PATTERNS="$CUSTOM_PATTERNS" \
  /action/src/scanner/file-scanner.sh > "$FILE_SCANNER_REPORT"

# ─── 3. Generate unified report ───────────────────────────────────────────────
echo "📊 Generating unified report..."
GITHUB_REPOSITORY="$GITHUB_REPOSITORY" \
GITHUB_SHA="$GITHUB_SHA" \
GITHUB_REF_NAME="$GITHUB_REF_NAME" \
GITHUB_EVENT_NAME="$GITHUB_EVENT_NAME" \
  node /action/src/scanner/report-generator.js \
    "$GITLEAKS_REPORT" \
    "$FILE_SCANNER_REPORT" \
    "$FINAL_REPORT"

# ─── 4. Parse summary ─────────────────────────────────────────────────────────
TOTAL_FINDINGS=$(jq -r '.summary.total_findings' "$FINAL_REPORT")
CRITICAL_COUNT=$(jq -r '.summary.critical'        "$FINAL_REPORT")
HIGH_COUNT=$(jq    -r '.summary.high'             "$FINAL_REPORT")
MEDIUM_COUNT=$(jq  -r '.summary.medium'           "$FINAL_REPORT")
LOW_COUNT=$(jq     -r '.summary.low'              "$FINAL_REPORT")
SCAN_ID=$(jq       -r '.scan_id'                  "$FINAL_REPORT")

if [ "$TOTAL_FINDINGS" -gt 0 ]; then
  SECRETS_FOUND="true"
else
  SECRETS_FOUND="false"
fi

# ─── 5. Set GITHUB_OUTPUT ────────────────────────────────────────────────────
{
  echo "secrets_found=$SECRETS_FOUND"
  echo "total_findings=$TOTAL_FINDINGS"
  echo "report_path=$FINAL_REPORT"
} >> "${GITHUB_OUTPUT:-/dev/null}"

# ─── 6. Write GITHUB_STEP_SUMMARY ────────────────────────────────────────────
write_step_summary() {
  if [ -z "${GITHUB_STEP_SUMMARY:-}" ]; then return; fi
  {
    echo "## 🛡️ SecretShield Scan Summary"
    echo ""
    echo "| Metric | Value |"
    echo "|--------|-------|"
    echo "| Scan ID | \`$SCAN_ID\` |"
    echo "| Total Findings | **$TOTAL_FINDINGS** |"
    echo "| 🔴 CRITICAL | $CRITICAL_COUNT |"
    echo "| 🟠 HIGH | $HIGH_COUNT |"
    echo "| 🟡 MEDIUM | $MEDIUM_COUNT |"
    echo "| 🔵 LOW | $LOW_COUNT |"
    echo "| Event | $GITHUB_EVENT_NAME |"
    echo "| Branch | $GITHUB_REF_NAME |"
    echo "| Commit | \`${GITHUB_SHA:0:8}\` |"
    echo ""
    if [ "$SECRETS_FOUND" = "true" ]; then
      echo "### ⚠️ Findings Detected"
      echo ""
      echo "| Severity | File | Rule | Source |"
      echo "|----------|------|------|--------|"
      jq -r '.findings[] | "| \(.severity) | `\(.file)` | \(.rule) | \(.source) |"' "$FINAL_REPORT"
    else
      echo "### ✅ No secrets detected — repository is clean!"
    fi
  } >> "$GITHUB_STEP_SUMMARY"
}
write_step_summary

# ─── 7. Threshold check function ─────────────────────────────────────────────
should_fail() {
  case "$SEVERITY_THRESHOLD" in
    "CRITICAL") [ "$CRITICAL_COUNT" -gt 0 ] && return 0 ;;
    "HIGH")     ([ "$CRITICAL_COUNT" -gt 0 ] || [ "$HIGH_COUNT" -gt 0 ]) && return 0 ;;
    "MEDIUM")   ([ "$CRITICAL_COUNT" -gt 0 ] || [ "$HIGH_COUNT" -gt 0 ] || [ "$MEDIUM_COUNT" -gt 0 ]) && return 0 ;;
    "LOW")      [ "$TOTAL_FINDINGS" -gt 0 ] && return 0 ;;
  esac
  return 1
}

# ─── 8. Handle PR ─────────────────────────────────────────────────────────────
post_pr_comment() {
  local pr_number
  pr_number=$(jq --raw-output '.pull_request.number' "${GITHUB_EVENT_PATH:-/dev/null}" 2>/dev/null || echo "")
  [ -z "$pr_number" ] || [ "$pr_number" = "null" ] && return

  # Build findings table rows
  local findings_table
  findings_table=$(jq -r '.findings[] | "| \(.severity) | `\(.file)` | L\(.line) | \(.rule) | \(.match) | \(.source) |"' "$FINAL_REPORT")

  local comment_body
  comment_body=$(cat <<EOF
## 🚨 SecretShield — Secrets Detected

SecretShield found **$TOTAL_FINDINGS** secret(s) / sensitive file(s) in this pull request.

| Metric | Count |
|--------|-------|
| 🔴 CRITICAL | $CRITICAL_COUNT |
| 🟠 HIGH | $HIGH_COUNT |
| 🟡 MEDIUM | $MEDIUM_COUNT |
| 🔵 LOW | $LOW_COUNT |

### Findings

| Severity | File | Line | Rule | Match (redacted) | Source |
|----------|------|------|------|-----------------|--------|
$findings_table

### 🔧 How to Fix

1. **Remove the secrets** from the files listed above and commit the changes.
2. **Rotate all exposed credentials immediately** — treat every detected secret as compromised, even in a private repo.
3. **Purge git history** using [git-filter-repo](https://github.com/newren/git-filter-repo) to remove secrets from previous commits:
   \`\`\`bash
   pip install git-filter-repo
   git filter-repo --path <secret-file> --invert-paths
   \`\`\`
4. **Add sensitive paths to \`.gitignore\`** to prevent future accidental commits:
   \`\`\`bash
   echo ".env" >> .gitignore
   echo "*.pem" >> .gitignore
   \`\`\`

> **Full report**: Download the \`secretshield-report\` artifact from the Actions run for the complete JSON report.

---
*🛡️ SecretShield — Scan ID: \`$SCAN_ID\`*
EOF
)

  # Escape for JSON
  local escaped_body
  escaped_body=$(echo "$comment_body" | jq -Rs .)

  curl -s \
    -H "Authorization: token ${GITHUB_TOKEN:-}" \
    -H "Content-Type: application/json" \
    -X POST \
    -d "{\"body\": $escaped_body}" \
    "https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${pr_number}/comments" \
    > /dev/null

  echo "💬 PR comment posted."
}

# ─── 9. Auto-remove (push only) ───────────────────────────────────────────────
auto_remove_files() {
  local files_to_remove
  files_to_remove=$(jq -r '.summary.files_removed[]' "$FINAL_REPORT" 2>/dev/null || true)
  [ -z "$files_to_remove" ] && return

  local removed_any=false
  while IFS= read -r filepath; do
    if [ -f "$WORKSPACE/$filepath" ]; then
      git -C "$WORKSPACE" rm --force "$filepath" 2>/dev/null || git -C "$WORKSPACE" rm --cached "$filepath" 2>/dev/null || true
      # Append to .gitignore
      echo "$filepath" >> "$WORKSPACE/.gitignore"
      echo "  🗑️  Removed: $filepath"
      removed_any=true
    fi
  done <<< "$files_to_remove"

  if [ "$removed_any" = "true" ]; then
    # Deduplicate .gitignore
    sort -u "$WORKSPACE/.gitignore" -o "$WORKSPACE/.gitignore"
    git -C "$WORKSPACE" add .gitignore

    git -C "$WORKSPACE" commit -m \
      "⚠️ chore(secretshield): remove sensitive files [skip ci]

SecretShield automatically removed $TOTAL_FINDINGS detected secret(s).

WARNING: Secrets may still exist in git history. You MUST:
1. Rotate all exposed credentials immediately.
2. Use git-filter-repo to purge history: https://github.com/newren/git-filter-repo
3. Force-push the cleaned history.

Scan ID: $SCAN_ID"

    git -C "$WORKSPACE" push \
      "https://x-access-token:${GITHUB_TOKEN:-}@github.com/${GITHUB_REPOSITORY}.git" \
      HEAD:"$GITHUB_REF_NAME" \
      || echo "⚠️  Push failed — ensure the token has contents:write permission."

    echo "✅ Auto-remove commit pushed."
  fi
}

# ─── 10. Dispatch by event type ───────────────────────────────────────────────
if [ "$GITHUB_EVENT_NAME" = "pull_request" ]; then
  echo "📋 Event: pull_request"
  if [ "$SECRETS_FOUND" = "true" ]; then
    post_pr_comment
    if [ "$FAIL_ON_SECRETS" = "true" ] && should_fail; then
      echo "❌ Failing build: secrets found at or above threshold ($SEVERITY_THRESHOLD)."
      exit 1
    fi
  else
    echo "✅ No secrets detected in PR."
  fi

elif [ "$GITHUB_EVENT_NAME" = "push" ]; then
  echo "📋 Event: push"
  if [ "$SECRETS_FOUND" = "true" ] && [ "$AUTO_REMOVE" = "true" ]; then
    echo "🗑️  Auto-removing sensitive files..."
    auto_remove_files
  fi
  if [ "$SECRETS_FOUND" = "true" ] && [ "$FAIL_ON_SECRETS" = "true" ] && should_fail; then
    echo "❌ Failing build: secrets found at or above threshold ($SEVERITY_THRESHOLD)."
    exit 1
  fi

else
  echo "📋 Event: $GITHUB_EVENT_NAME (no special handling)"
fi

echo ""
echo "🛡️  SecretShield scan complete."
echo "   Total findings: $TOTAL_FINDINGS (CRITICAL: $CRITICAL_COUNT | HIGH: $HIGH_COUNT | MEDIUM: $MEDIUM_COUNT | LOW: $LOW_COUNT)"
echo "   Report: $FINAL_REPORT"
exit 0
