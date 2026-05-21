#!/usr/bin/env node
// SDD/TDD-Gate: feat/fix commits that touch source files must also stage tests.
// Additionally: if existing test lines are modified (not just added), the commit
// message must carry a "Test-Change-Reason: <text>" trailer explaining why.
// Gate 3 (strict split, opt-in via STATS_STRICT_TEST_SPLIT=1): a commit may not
// simultaneously modify existing test lines AND non-test source files.
// Runs in the commit-msg hook so we can read the commit type from the message.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const msgFile = process.argv[2]

if (!msgFile) {
  console.error('check-test-coupling: missing commit-msg file path')
  process.exit(1)
}

const message = readFileSync(msgFile, 'utf8').trim()
const firstLine = message.split('\n')[0]
const typeMatch = /^([a-z]+)(?:\([^)]+\))?!?:/.exec(firstLine)
const type = typeMatch ? typeMatch[1] : ''

const exemptTypes = new Set([
  'chore',
  'docs',
  'refactor',
  'style',
  'ci',
  'build',
  'test',
  'revert',
  'perf',
])

if (exemptTypes.has(type)) {
  process.exit(0)
}

const stagedFiles = execFileSync(
  'git',
  ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean)

const sourcePattern = /^(apps|packages)\/[^/]+\/src\/.+\.(ts|svelte)$/
const testPattern = /\.(test|spec)\.(ts|svelte|js|mjs)$|\/(tests?|spec)\//

const sourceChanged = stagedFiles.filter((file) => sourcePattern.test(file))
const testChanged = stagedFiles.some((file) => testPattern.test(file))

// Gate 1: feat/fix touching source must include at least one test file.
if (sourceChanged.length > 0 && !testChanged) {
  console.error('')
  console.error('SDD/TDD-Gate: feat/fix commits require accompanying test changes.')
  console.error('')
  console.error('Source files staged without matching tests:')
  for (const file of sourceChanged) {
    console.error(`  - ${file}`)
  }
  console.error('')
  console.error('Options:')
  console.error('  1. Add tests covering the change (preferred — TDD).')
  console.error('  2. Re-author commit as chore/refactor/docs if no behavior change.')
  console.error('')
  process.exit(1)
}

if (!testChanged) {
  process.exit(0)
}

// Compute deletions per staged test file (numstat: <added>\t<deleted>\t<file>).
const testFiles = stagedFiles.filter((file) => testPattern.test(file))
const numstat = execFileSync(
  'git',
  ['diff', '--cached', '--numstat', '--', ...testFiles],
  { encoding: 'utf8' },
)

const hasModifiedTestLines = numstat
  .split('\n')
  .filter(Boolean)
  .some((line) => {
    const parts = line.split('\t')
    const deleted = Number.parseInt(parts[1] ?? '0', 10)
    return deleted > 0
  })

if (!hasModifiedTestLines) {
  process.exit(0)
}

// Gate 3 (opt-in): block commits that mix modified tests with non-test source changes.
// Set STATS_STRICT_TEST_SPLIT=1 to activate. Remove the guard once the team has adapted.
const strictSplit = process.env['STATS_STRICT_TEST_SPLIT'] === '1'
const nonTestSourceChanged = sourceChanged.filter((file) => !testPattern.test(file))

if (strictSplit && nonTestSourceChanged.length > 0) {
  console.error('')
  console.error('Test-split gate (strict): modified test lines and source changes must be in separate commits.')
  console.error('')
  console.error('Non-test source files staged alongside modified tests:')
  for (const file of nonTestSourceChanged) {
    console.error(`  - ${file}`)
  }
  console.error('')
  console.error('Split into two commits:')
  console.error('  1. refactor(test): <reason>  — modified tests only (no source changes)')
  console.error('  2. feat: <feature>            — source changes with new/added tests only')
  console.error('')
  console.error('Or disable strict mode: unset STATS_STRICT_TEST_SPLIT and use Gate 2 (trailer).')
  console.error('')
  process.exit(1)
}

// Gate 2: existing test lines modified without strict split — require a trailer.
const hasTrailer = /^Test-Change-Reason: .+/m.test(message)

if (hasTrailer) {
  process.exit(0)
}

console.error('')
console.error('Test-immutability gate: existing test lines were modified.')
console.error('')
console.error('Tests may only change when the corresponding spec also changed, or when')
console.error('there is a documented domain reason. Add a trailer to your commit message:')
console.error('')
console.error('  Test-Change-Reason: <why these existing tests had to change>')
console.error('')
console.error('Examples:')
console.error('  Test-Change-Reason: spec AC-04-03 changed — owner-UID check added')
console.error('  Test-Change-Reason: refactor(test) split into separate commit; token sentinel renamed')
console.error('')
console.error('Alternatively, split into two commits:')
console.error('  1. refactor(test): <reason>  — test changes only, no source changes')
console.error('  2. feat: <feature>            — source changes with new/added tests only')
console.error('')
process.exit(1)
