#!/usr/bin/env bash
# Apply branch protection to `main` from .github/branch-protection.json.
#
# Pre-requisites:
#   - gh CLI authenticated with repo-admin scope (only repo admins can PUT protection)
#
# GitHub accepts any string in required_status_checks.contexts at PUT time —
# unknown names will not cause the API call to fail. They surface as failed
# required checks at merge time on the first PR after protection takes effect.
#
# Run from repository root:
#   bash scripts/apply-branch-protection.sh

set -euo pipefail

CONFIG_FILE=".github/branch-protection.json"
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
BRANCH="main"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: $CONFIG_FILE not found. Run from repository root." >&2
  exit 1
fi

echo "Applying branch protection to ${REPO}@${BRANCH}…"

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/${REPO}/branches/${BRANCH}/protection" \
  --input "$CONFIG_FILE" > /dev/null

echo "Done."
echo ""
echo "Verify with:"
echo "  gh api repos/${REPO}/branches/${BRANCH}/protection"
