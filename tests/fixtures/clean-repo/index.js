// Clean repository — no secrets here
// SecretShield should pass with exit 0

const greeting = (name) => {
  return `Hello, ${name}! This repository is clean.`;
};

const config = {
  appName: 'my-clean-app',
  version: '1.0.0',
  // API keys loaded from environment variables — never hardcoded
  apiUrl: process.env.API_URL || 'http://localhost:3000',
};

module.exports = { greeting, config };
