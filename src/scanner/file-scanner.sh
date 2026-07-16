#!/bin/bash
# SecretShield — Custom file-pattern scanner
# Detects sensitive files by name/pattern and optionally by custom regex content scan
set -euo pipefail

WORKSPACE="${GITHUB_WORKSPACE:-/github/workspace}"
IGNORE_PATHS="${IGNORE_PATHS:-}"
CUSTOM_PATTERNS="${CUSTOM_PATTERNS:-}"

# ─── Build find exclude args from IGNORE_PATHS ───────────────────────────────
build_find_excludes() {
  local excludes=("-not" "-path" "*/.git/*" "-not" "-path" "*/node_modules/*")
  if [ -n "$IGNORE_PATHS" ]; then
    IFS=',' read -ra PATHS <<< "$IGNORE_PATHS"
    for p in "${PATHS[@]}"; do
      p_trimmed="${p// /}"
      excludes+=("-not" "-path" "*/$p_trimmed*")
    done
  fi
  echo "${excludes[@]}"
}

FINDINGS="[]"

# ─── Helper: append a finding ────────────────────────────────────────────────
add_finding() {
  local file="$1"
  local severity="$2"
  local rule="$3"
  local id="$4"

  # Strip leading ./ for cleaner paths
  local clean_file
  clean_file=$(echo "$file" | sed 's|^\./||')

  # Escape for JSON
  local esc_file
  esc_file=$(printf '%s' "$clean_file" | jq -Rs '.')

  local finding
  finding=$(jq -n \
    --arg id       "$id" \
    --arg severity "$severity" \
    --argjson file "$esc_file" \
    --arg rule     "$rule" \
    --arg match    "File: ${clean_file:0:4}****" \
    --arg source   "file-scanner" \
    '{id: $id, severity: $severity, file: $file, line: 1, match: $match, rule: $rule, source: $source}')

  FINDINGS=$(echo "$FINDINGS" | jq ". += [$finding]")
}

# ─── Collect find excludes ────────────────────────────────────────────────────
mapfile -t EXCLUDES < <(build_find_excludes | tr ' ' '\n')

# ─── Scan all files in workspace ─────────────────────────────────────────────
cd "$WORKSPACE"

while IFS= read -r -d '' file; do
  basename_lower=$(basename "$file" | tr '[:upper:]' '[:lower:]')
  dirname_part=$(dirname "$file")

  # Skip .next, dist, build, node_modules explicitly
  case "$dirname_part" in
    */.next/*|*/.next|*/dist/*|*/dist|*/build/*|*/build|*/node_modules/*|*/node_modules) continue ;;
  esac

  matched=false

  # ── .env and .env.* variants ──────────────────────────────────────────────
  if [[ "$basename_lower" == ".env" || "$basename_lower" == .env.* ]]; then
    add_finding "$file" "HIGH" "env-file-detected" "env-file-detected"
    matched=true
  fi

  # ── Private key files ─────────────────────────────────────────────────────
  if [[ "$basename_lower" == *.pem || "$basename_lower" == *.key \
     || "$basename_lower" == id_rsa* || "$basename_lower" == id_dsa* \
     || "$basename_lower" == id_ecdsa* || "$basename_lower" == id_ed25519* ]]; then
    add_finding "$file" "CRITICAL" "private-key-file" "private-key-file"
    matched=true
  fi

  # ── Certificate / keystore files ─────────────────────────────────────────
  if [[ "$basename_lower" == *.p12 || "$basename_lower" == *.pfx ]]; then
    add_finding "$file" "CRITICAL" "keystore-file" "keystore-file"
    matched=true
  fi

  # ── secrets.json / secrets.yaml / secrets.yml ────────────────────────────
  if [[ "$basename_lower" == "secrets.json" || "$basename_lower" == "secrets.yaml" \
     || "$basename_lower" == "secrets.yml" ]]; then
    add_finding "$file" "CRITICAL" "secrets-config-file" "secrets-config-file"
    matched=true
  fi

  # ── credentials.json ─────────────────────────────────────────────────────
  if [[ "$basename_lower" == "credentials.json" ]]; then
    add_finding "$file" "CRITICAL" "credentials-file" "credentials-file"
    matched=true
  fi

  # ── service-account.json ─────────────────────────────────────────────────
  if [[ "$basename_lower" == "service-account.json" ]]; then
    add_finding "$file" "CRITICAL" "service-account-file" "service-account-file"
    matched=true
  fi

  # ── firebase-adminsdk*.json ───────────────────────────────────────────────
  if [[ "$basename_lower" == firebase-adminsdk*.json ]]; then
    add_finding "$file" "CRITICAL" "firebase-adminsdk-file" "firebase-adminsdk-file"
    matched=true
  fi

  # ── google-credentials.json ───────────────────────────────────────────────
  if [[ "$basename_lower" == "google-credentials.json" ]]; then
    add_finding "$file" "CRITICAL" "google-credentials-file" "google-credentials-file"
    matched=true
  fi

done < <(find "$WORKSPACE" -type f "${EXCLUDES[@]}" -print0 2>/dev/null)

# ─── Custom pattern scan (content-based regex) ────────────────────────────────
if [ -n "$CUSTOM_PATTERNS" ]; then
  IFS=',' read -ra PATTERNS <<< "$CUSTOM_PATTERNS"
  for pattern in "${PATTERNS[@]}"; do
    pattern_trimmed="${pattern// /}"
    [ -z "$pattern_trimmed" ] && continue

    while IFS= read -r match_file; do
      # Skip already-matched files for this iteration
      add_finding "$match_file" "HIGH" "custom-pattern" "custom-pattern"
    done < <(grep -rlE "$pattern_trimmed" "$WORKSPACE" \
               --exclude-dir=".git" \
               --exclude-dir="node_modules" \
               --exclude-dir=".next" \
               --exclude-dir="dist" \
               --exclude-dir="build" \
               2>/dev/null || true)
  done
fi

# ─── Output JSON ─────────────────────────────────────────────────────────────
echo "$FINDINGS"
