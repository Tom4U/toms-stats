#!/usr/bin/env node
// CI gate: feat/fix commits that touch source files must have a matching spec
// change somewhere in the same branch (since it diverged from the base branch).
//
// Bypass: add the label "no-spec-change" to the PR, or set the env var
// SPEC_COUPLING_EXEMPT=1 (for local hotfix branches where the spec update
// is tracked in a separate PR that must land first).

import { execFileSync } from 'node:child_process'

const exempt = process.env['SPEC_COUPLING_EXEMPT'] === '1'
if (exempt) {
  console.log('check-spec-coupling: SPEC_COUPLING_EXEMPT=1 — skipping.')
  process.exit(0)
}

// In CI, GITHUB_BASE_REF is set to the target branch (e.g. "main").
// Locally, fall back to "main".
const base = process.env['GITHUB_BASE_REF'] ?? 'main'

// Reject branch names that aren't valid git refs to avoid command injection.
if (!/^[\w./-]+$/.test(base)) {
  console.error(`check-spec-coupling: invalid base ref "${base}" — aborting.`)
  process.exit(1)
}

const isCI = Boolean(process.env['CI'])

let changedFiles
try {
  changedFiles = execFileSync(
    'git',
    ['diff', '--name-only', `origin/${base}...HEAD`],
    { encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean)
} catch {
  if (isCI) {
    // In CI the base ref must be fetchable — fail hard so the gate can't be
    // silently bypassed by a misconfigured checkout (e.g. missing fetch-depth: 0).
    console.error(
      `check-spec-coupling: could not diff against origin/${base}.` +
      ' Ensure fetch-depth: 0 in the checkout step.',
    )
    process.exit(1)
  }
  console.log(`check-spec-coupling: could not diff against origin/${base} — skipping locally.`)
  process.exit(0)
}

const sourcePattern = /^(apps|packages)\/[^/]+\/src\/.+\.(ts|svelte)$/
const specPattern = /^specs\//
// Matches both filename suffixes (*.test.ts) and test directories (/tests?/, /spec/).
const testPattern = /\.(test|spec)\.(ts|svelte|js|mjs)$|\/(tests?|spec)\//

const sourceChanged = changedFiles.filter(
  f => sourcePattern.test(f) && !testPattern.test(f),
)
const specChanged = changedFiles.some(f => specPattern.test(f))

if (sourceChanged.length === 0 || specChanged) {
  process.exit(0)
}

// Check whether the branch contains any feat/fix commits.
// Pure test-only additions or chore/refactor branches don't need a spec change.
let commits
try {
  commits = execFileSync(
    'git',
    ['log', '--format=%s', `origin/${base}...HEAD`],
    { encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean)
} catch {
  if (isCI) {
    process.exit(1)
  }
  process.exit(0)
}

const featFixPattern = /^(feat|fix)(\([^)]+\))?!?:/
const hasFeatFix = commits.some(msg => featFixPattern.test(msg))

if (!hasFeatFix) {
  process.exit(0)
}

console.error('')
console.error('Spec-coupling gate: feat/fix commits that touch source files require a spec change.')
console.error('')
console.error('Source files changed without a matching update in specs/:')
for (const f of sourceChanged) {
  console.error(`  - ${f}`)
}
console.error('')
console.error('Options:')
console.error('  1. Update the relevant spec in specs/ as part of this branch (preferred — SDD).')
console.error('  2. Add the PR label "no-spec-change" if the spec was updated in a prior PR.')
console.error('  3. Set SPEC_COUPLING_EXEMPT=1 locally to bypass (document reason in PR body).')
console.error('')
process.exit(1)
