#!/bin/bash
# A simple scanner for sensitive file patterns

FILES=$(find . -type f -not -path "*/\.git/*" -not -path "*/node_modules/*")
FINDINGS="[]"

# Helper to append finding
add_finding() {
  local file=$1
  local severity=$2
  local rule=$3
  
  # Escape string for JSON
  local esc_file=$(echo "$file" | sed 's/"/\\"/g' | sed 's/^\.\///')
  
  local finding="{\"file\":\"$esc_file\", \"severity\":\"$severity\", \"rule\":\"$rule\"}"
  FINDINGS=$(echo "$FINDINGS" | jq ". += [$finding]")
}

for file in $FILES; do
  basename=$(basename "$file")
  
  if [[ "$basename" == ".env" || "$basename" == .env.* ]]; then
    add_finding "$file" "HIGH" "env-file-detected"
  elif [[ "$basename" == *.pem || "$basename" == *.key || "$basename" == id_rsa* ]]; then
    add_finding "$file" "CRITICAL" "private-key-file"
  fi
done

echo "$FINDINGS"
