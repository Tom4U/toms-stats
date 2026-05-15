#!/usr/bin/env node
// SDD/TDD-Gate: feat/fix commits that touch source files must also stage tests.
// Runs in the commit-msg hook so we can read the commit type from the message.

import { execSync } from 'node:child_process'
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

const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACMR', {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)

const sourcePattern = /^(apps|packages)\/[^/]+\/src\/.+\.(ts|svelte)$/
const testPattern = /\.(test|spec)\.(ts|svelte|js|mjs)$|\/(tests?|spec)\//

const sourceChanged = stagedFiles.filter((file) => sourcePattern.test(file))
const testChanged = stagedFiles.some((file) => testPattern.test(file))

if (sourceChanged.length === 0 || testChanged) {
  process.exit(0)
}

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
