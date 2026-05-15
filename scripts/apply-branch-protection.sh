#!/usr/bin/env bash
# Apply branch protection to `main` from .github/branch-protection.json.
#
# Pre-requisites:
#   - gh CLI authenticated with repo-admin scope (only repo admins can PUT protection)
#   - jq installed (for reading the local config file)
#   - For each required check listed in branch-protection.json, at least one run
#     must have been reported on one of the recent commits on `main`
#     (GitHub rejects required-check names it has not yet seen)
#
# Run from repository root:
#   bash scripts/apply-branch-protection.sh

set -euo pipefail

CONFIG_FILE=".github/branch-protection.json"
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
BRANCH="main"
COMMITS_TO_INSPECT=20

if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: $CONFIG_FILE not found. Run from repository root." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq required (used to read $CONFIG_FILE)." >&2
  exit 1
fi

echo "Applying branch protection to ${REPO}@${BRANCH}…"
echo ""

# Build the set of check names reported on the last N commits of `main`.
# Includes both the modern Checks API and the legacy Commit Statuses API,
# since external integrations (SonarCloud, Codecov, etc.) post via statuses.
echo "Scanning the last $COMMITS_TO_INSPECT commit(s) of '$BRANCH' for known check names…"
recent_shas=$(gh api "repos/${REPO}/commits?sha=${BRANCH}&per_page=${COMMITS_TO_INSPECT}" --jq '.[].sha')

known_checks=$(
  for sha in $recent_shas; do
    gh api "repos/${REPO}/commits/${sha}/check-runs?per_page=100" --jq '.check_runs[].name' 2>/dev/null || true
    gh api "repos/${REPO}/commits/${sha}/status" --jq '.statuses[].context' 2>/dev/null || true
  done | sort -u
)

contexts=$(jq -r '.required_status_checks.contexts[]' "$CONFIG_FILE")
missing=()
while IFS= read -r ctx; do
  if ! grep -Fxq "$ctx" <<<"$known_checks"; then
    missing+=("$ctx")
  fi
done <<<"$contexts"

if [ ${#missing[@]} -gt 0 ]; then
  echo ""
  echo "WARNING: the following required checks have not been seen in the last"
  echo "${COMMITS_TO_INSPECT} commit(s) of '${BRANCH}':"
  for c in "${missing[@]}"; do echo "  - $c"; done
  echo ""
  echo "GitHub will reject unknown check names. Merge the PRs that introduce"
  echo "them first (so the workflows run on main), then re-run this script."
  exit 2
fi

echo "All required checks have run on '$BRANCH' in the recent history. Applying…"
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/${REPO}/branches/${BRANCH}/protection" \
  --input "$CONFIG_FILE"

echo ""
echo "Done. Verify with:"
echo "  gh api repos/${REPO}/branches/${BRANCH}/protection"
