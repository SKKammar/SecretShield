#!/bin/bash
set -e

echo "Starting SecretShield Scanner..."

WORKSPACE=${GITHUB_WORKSPACE:-/github/workspace}
cd "$WORKSPACE"

# Set up git for auto-remove
git config --global --add safe.directory "$WORKSPACE"
git config user.name "secretshield[bot]"
git config user.email "secretshield[bot]@users.noreply.github.com"

# 1. Run Gitleaks
echo "Running Gitleaks..."
gitleaks detect --source . -v --redact --report-path /tmp/gitleaks-report.json --exit-code 0 || true

# 2. Run file-scanner.sh
echo "Running custom file scanner..."
/action/src/scanner/file-scanner.sh > /tmp/file-scanner-report.json

# 3. Merge results
echo "Generating unified report..."
node /action/src/scanner/report-generator.js /tmp/gitleaks-report.json /tmp/file-scanner-report.json "$WORKSPACE/secretshield-report.json"

# Parse summary for outputs
SECRETS_FOUND=$(jq -r '.summary.total_findings > 0' "$WORKSPACE/secretshield-report.json")
TOTAL_FINDINGS=$(jq -r '.summary.total_findings' "$WORKSPACE/secretshield-report.json")
CRITICAL_COUNT=$(jq -r '.summary.critical' "$WORKSPACE/secretshield-report.json")
HIGH_COUNT=$(jq -r '.summary.high' "$WORKSPACE/secretshield-report.json")
MEDIUM_COUNT=$(jq -r '.summary.medium' "$WORKSPACE/secretshield-report.json")
LOW_COUNT=$(jq -r '.summary.low' "$WORKSPACE/secretshield-report.json")

# Set outputs
echo "secrets_found=$SECRETS_FOUND" >> $GITHUB_OUTPUT
echo "total_findings=$TOTAL_FINDINGS" >> $GITHUB_OUTPUT
echo "report_path=$WORKSPACE/secretshield-report.json" >> $GITHUB_OUTPUT

# Define a function to check failure threshold
should_fail() {
    case "$SEVERITY_THRESHOLD" in
        "CRITICAL") [ "$CRITICAL_COUNT" -gt 0 ] && return 0 ;;
        "HIGH") [ "$CRITICAL_COUNT" -gt 0 ] || [ "$HIGH_COUNT" -gt 0 ] && return 0 ;;
        "MEDIUM") [ "$CRITICAL_COUNT" -gt 0 ] || [ "$HIGH_COUNT" -gt 0 ] || [ "$MEDIUM_COUNT" -gt 0 ] && return 0 ;;
        "LOW") [ "$TOTAL_FINDINGS" -gt 0 ] && return 0 ;;
    esac
    return 1
}

# 4. Handle PR vs Push
if [ "$GITHUB_EVENT_NAME" = "pull_request" ]; then
    echo "Processing Pull Request..."
    if [ "$SECRETS_FOUND" = "true" ]; then
        PR_NUMBER=$(jq --raw-output .pull_request.number "$GITHUB_EVENT_PATH")
        REPO_NAME=$GITHUB_REPOSITORY
        
        COMMENT_BODY="🚨 **SecretShield detected $TOTAL_FINDINGS secrets in this PR!**\n\nPlease remove them before merging. Check the workflow artifact for a detailed report."
        
        # Post comment to PR
        if [ -n "$GITHUB_TOKEN" ]; then
            curl -s -H "Authorization: token $GITHUB_TOKEN" -X POST \
                -d "{\"body\": \"$COMMENT_BODY\"}" \
                "https://api.github.com/repos/$REPO_NAME/issues/$PR_NUMBER/comments"
        fi
        
        if [ "$FAIL_ON_SECRETS" = "true" ] && should_fail; then
            echo "Secrets found and fail_on_secrets is true. Failing the build."
            exit 1
        fi
    fi
elif [ "$GITHUB_EVENT_NAME" = "push" ]; then
    echo "Processing Push..."
    if [ "$SECRETS_FOUND" = "true" ] && [ "$AUTO_REMOVE" = "true" ]; then
        echo "Auto-removing sensitive files..."
        
        FILES_TO_REMOVE=$(jq -r '.summary.files_removed[]' "$WORKSPACE/secretshield-report.json")
        if [ -n "$FILES_TO_REMOVE" ]; then
            for file in $FILES_TO_REMOVE; do
                if [ -f "$file" ]; then
                    git rm "$file"
                fi
            done
            git commit -m "chore: remove sensitive files [skip ci]"
            git push
        fi
    fi
    
    if [ "$SECRETS_FOUND" = "true" ] && [ "$FAIL_ON_SECRETS" = "true" ] && should_fail; then
        echo "Secrets found and fail_on_secrets is true. Failing the build."
        exit 1
    fi
fi

echo "Scan complete."
exit 0
