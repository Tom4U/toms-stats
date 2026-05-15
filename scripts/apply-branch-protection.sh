#!/usr/bin/env bash
# Apply branch protection to `main` from .github/branch-protection.json.
#
# Pre-requisites:
#   - gh CLI authenticated with repo-admin scope
#   - All required status checks must have run on `main` at least once
#     (GitHub rejects required-check names it has not yet seen)
#
# Run from repository root:
#   scripts/apply-branch-protection.sh

set -euo pipefail

CONFIG_FILE=".github/branch-protection.json"
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
BRANCH="main"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: $CONFIG_FILE not found. Run from repository root." >&2
  exit 1
fi

echo "Applying branch protection to ${REPO}@${BRANCH}…"
echo ""

# Verify each required check has run on the branch at least once.
contexts=$(jq -r '.required_status_checks.contexts[]' "$CONFIG_FILE")
missing=()
known_checks=$(gh api "repos/${REPO}/commits/${BRANCH}/check-runs?per_page=100" --jq '.check_runs[].name' | sort -u)

while IFS= read -r ctx; do
  if ! grep -Fxq "$ctx" <<<"$known_checks"; then
    missing+=("$ctx")
  fi
done <<<"$contexts"

if [ ${#missing[@]} -gt 0 ]; then
  echo "WARNING: the following required checks have not yet run on ${BRANCH}:"
  for c in "${missing[@]}"; do echo "  - $c"; done
  echo ""
  echo "GitHub will reject these as required-check names. Merge the PRs that"
  echo "introduce them first, then re-run this script."
  exit 2
fi

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/${REPO}/branches/${BRANCH}/protection" \
  --input "$CONFIG_FILE"

echo ""
echo "Done. Verify with:"
echo "  gh api repos/${REPO}/branches/${BRANCH}/protection"
