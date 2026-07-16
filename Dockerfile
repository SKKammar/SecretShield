FROM ubuntu:22.04

# Prevent interactive prompts during apt-get
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    jq \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 LTS (pinned)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && node --version \
    && npm --version

# Install Gitleaks v8.18.2 (pinned — do NOT change this version)
RUN curl -sSL \
    "https://github.com/gitleaks/gitleaks/releases/download/v8.18.2/gitleaks_8.18.2_linux_x64.tar.gz" \
    | tar -xz -C /usr/local/bin gitleaks \
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
