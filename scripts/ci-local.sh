#!/usr/bin/env bash
# Same checks as .github/workflows/ci.yml — run before merging to main.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> backend: lint"
(cd "$REPO_ROOT/backend" && npm run lint)

echo "==> backend: tests"
(cd "$REPO_ROOT/backend" && npm test -- --testPathIgnorePatterns=test/scrapers --passWithNoTests)

echo "==> frontend: lint"
(cd "$REPO_ROOT/frontend" && npm run lint)

echo "==> frontend: typecheck"
(cd "$REPO_ROOT/frontend" && npm run check)

echo "==> all checks passed"
