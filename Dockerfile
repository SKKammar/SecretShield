FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl git jq nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Install Gitleaks (pin a specific version for reproducibility)
RUN curl -sSL https://github.com/gitleaks/gitleaks/releases/download/v8.18.2/gitleaks_8.18.2_linux_x64.tar.gz \
    | tar -xz -C /usr/local/bin gitleaks

# Copy Action source
COPY src/ /action/src/
COPY entrypoint.sh /action/entrypoint.sh
RUN chmod +x /action/entrypoint.sh

ENTRYPOINT ["/action/entrypoint.sh"]
