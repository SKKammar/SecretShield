FROM node:20-bookworm-slim@sha256:d8bd6c8afc107be6f59df048bb0195e2f7b8801d0a52f9b882eb7272847a98eb

# Prevent interactive prompts during apt-get
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies needed by the runtime
# git: required for gitleaks --no-git fallback, checkout, and auto-removal
# jq: required for parsing JSON reports
# curl: required for PR comments
# ca-certificates: required for curl to talk to GitHub API safely
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    jq \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Gitleaks v8.18.2 with checksum verification
ENV GITLEAKS_VERSION=8.18.2
ENV GITLEAKS_CHECKSUM=6298c9235dfc9278c14b28afd9b7fa4e6f4a289cb1974bd27949fc1e9122bdee
RUN curl -sSL -o gitleaks.tar.gz "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
    && echo "${GITLEAKS_CHECKSUM}  gitleaks.tar.gz" | sha256sum -c - \
    && tar -xz -C /usr/local/bin gitleaks -f gitleaks.tar.gz \
    && rm gitleaks.tar.gz \
    && gitleaks version

# Create action working directory
RUN mkdir -p /action/src/scanner

# Copy Gitleaks configuration (must be at /action/.gitleaks.toml)
COPY .gitleaks.toml /action/.gitleaks.toml

# Copy scanner source files
COPY src/scanner/file-scanner.sh     /action/src/scanner/file-scanner.sh
COPY src/scanner/report-generator.js /action/src/scanner/report-generator.js

# Copy and set up entrypoint
COPY entrypoint.sh /action/entrypoint.sh
RUN chmod +x /action/entrypoint.sh \
    && chmod +x /action/src/scanner/file-scanner.sh

ENTRYPOINT ["/action/entrypoint.sh"]
