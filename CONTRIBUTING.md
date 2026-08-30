## Adding a Detection Rule
- Where: src/scanner/.gitleaks.toml under [[rules]]
- Required fields: id, description, regex, tags, severity
- Test: add a matching fake secret to tests/fixtures/dirty-repo/
- Verify: run `act push` and confirm exit 1

## Adding a Sensitive File Pattern
- Where: src/scanner/file-scanner.sh
- Format: Add an `if` block checking `$basename_lower` and call `add_finding`
- Test: add a file matching the pattern to tests/fixtures/dirty-repo/

## Running Tests Locally
Prerequisites: Docker, act (https://github.com/nektos/act)

  # Test clean repo — expect exit 0
  act push --job scan-clean

  # Test dirty repo — expect exit 1
  act push --job scan-dirty

## Submitting a PR
- SecretShield scans its own PRs — your PR will be scanned automatically
- Do not commit real secrets in test fixtures — use the fake formats
  already established in tests/fixtures/dirty-repo/
- Update CHANGELOG.md under [Unreleased] with your change

## Reporting a Vulnerability in SecretShield
Use GitHub's private disclosure:
github.com/SKKammar/SecretShield/security/advisories/new
