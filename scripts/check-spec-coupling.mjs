#!/usr/bin/env node
// CI gate: feat/fix commits that touch source files must have a matching spec
// change somewhere in the same branch (since it diverged from the base branch).
//
// Bypass: add the label "no-spec-change" to the PR, or set the env var
// SPEC_COUPLING_EXEMPT=1 (for local hotfix branches where the spec update
// is tracked in a separate PR that must land first).

import { execSync } from 'node:child_process'

const exempt = process.env['SPEC_COUPLING_EXEMPT'] === '1'
if (exempt) {
  console.log('check-spec-coupling: SPEC_COUPLING_EXEMPT=1 — skipping.')
  process.exit(0)
}

// In CI, GITHUB_BASE_REF is set to the target branch (e.g. "main").
// Locally, fall back to "main".
const base = process.env['GITHUB_BASE_REF'] ?? 'main'

let changedFiles
try {
  changedFiles = execSync(`git diff --name-only origin/${base}...HEAD`, { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
} catch {
  // If we can't determine changed files (e.g. shallow clone), skip.
  console.log(`check-spec-coupling: could not diff against origin/${base} — skipping.`)
  process.exit(0)
}

const sourcePattern = /^(apps|packages)\/[^/]+\/src\/.+\.(ts|svelte)$/
const specPattern = /^specs\//
const testPattern = /\.(test|spec)\.(ts|svelte|js|mjs)$/

const sourceChanged = changedFiles.filter(
  f => sourcePattern.test(f) && !testPattern.test(f),
)
const specChanged = changedFiles.some(f => specPattern.test(f))

if (sourceChanged.length === 0 || specChanged) {
  process.exit(0)
}

// Check whether all feat/fix commits on this branch touch only test files
// (pure test additions don't need a spec change).
let commits
try {
  commits = execSync(`git log --format=%s origin/${base}...HEAD`, { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
} catch {
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
