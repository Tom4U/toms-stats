#!/usr/bin/env node
// Spec ↔ Test linkage audit.
//
// Reports:
//   - Orphaned ACs   = declared in a spec, no matching test  → fails the script (exit 1)
//                       unless listed in .spec-audit-allowlist.json (acknowledged pending work)
//   - Orphaned tests = referenced in a test, no matching AC  → warns only (exit 0)
//
// Canonical AC format: AC-<spec-prefix>-<NN>
// Legacy AC format:    AC-<NN>  — resolved via legacyMapping below.
//
// Allowlist: .spec-audit-allowlist.json (top-level array of canonical AC IDs).
// Entries should be removed as specs get implementations.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const SPEC_DIR = join(ROOT, 'specs')
const ALLOWLIST_FILE = join(ROOT, '.spec-audit-allowlist.json')
const TEST_DIRS = ['apps/tracker', 'apps/dashboard', 'packages/shared']

// Legacy AC-NN (no spec prefix) found in these directories belongs to the listed spec.
const legacyMapping = new Map([['apps/tracker', '01-tracking-api.md']])

function walkDir(dir, predicate) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...walkDir(full, predicate))
    else if (predicate(full)) out.push(full)
  }
  return out
}

function parseSpecAcs() {
  const acsBySpec = new Map()
  const files = readdirSync(SPEC_DIR).filter((f) => /^\d{2}-.+\.md$/.test(f))
  for (const file of files) {
    const prefix = /^(\d{2})-/.exec(file)[1]
    const content = readFileSync(join(SPEC_DIR, file), 'utf8')
    const ids = new Set()
    for (const m of content.matchAll(/\bAC-(\d{2})(?:-(\d{2}))?\b/g)) {
      const canonical = m[2] ? `AC-${m[1]}-${m[2]}` : `AC-${prefix}-${m[1]}`
      ids.add(canonical)
    }
    if (ids.size > 0) acsBySpec.set(file, ids)
  }
  return acsBySpec
}

function parseTestRefs() {
  const refs = new Map()
  for (const td of TEST_DIRS) {
    const fullDir = join(ROOT, td)
    const testFiles = walkDir(fullDir, (f) => /\.(test|spec)\.(ts|svelte|js|mjs)$/.test(f))
    const legacySpec = legacyMapping.get(td)
    const legacyPrefix = legacySpec ? /^(\d{2})-/.exec(legacySpec)[1] : null
    for (const file of testFiles) {
      const content = readFileSync(file, 'utf8')
      for (const m of content.matchAll(/\bAC-(\d{2})(?:-(\d{2}))?\b/g)) {
        let canonical
        if (m[2]) {
          canonical = `AC-${m[1]}-${m[2]}`
        } else if (legacyPrefix) {
          canonical = `AC-${legacyPrefix}-${m[1]}`
        } else {
          continue
        }
        if (!refs.has(canonical)) refs.set(canonical, new Set())
        refs.get(canonical).add(file)
      }
    }
  }
  return refs
}

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_FILE)) return new Set()
  const parsed = JSON.parse(readFileSync(ALLOWLIST_FILE, 'utf8'))
  if (!Array.isArray(parsed)) {
    throw new Error('.spec-audit-allowlist.json must be a JSON array of canonical AC IDs')
  }
  return new Set(parsed)
}

const acsBySpec = parseSpecAcs()
const testRefs = parseTestRefs()
const allowlist = loadAllowlist()

const allSpecIds = new Set()
for (const ids of acsBySpec.values()) for (const id of ids) allSpecIds.add(id)
const allTestIds = new Set(testRefs.keys())

const allOrphanedAcs = [...allSpecIds].filter((id) => !allTestIds.has(id)).sort()
const unallowlistedOrphans = allOrphanedAcs.filter((id) => !allowlist.has(id))
const staleAllowlistEntries = [...allowlist].filter((id) => !allOrphanedAcs.includes(id)).sort()
const orphanedTests = [...allTestIds].filter((id) => !allSpecIds.has(id)).sort()

console.log(`Spec ACs declared:        ${allSpecIds.size}`)
console.log(`Test references:          ${allTestIds.size}`)
console.log(`Acknowledged orphans:     ${allowlist.size} (in .spec-audit-allowlist.json)`)
console.log(`Unacknowledged orphans:   ${unallowlistedOrphans.length}`)
console.log('')

if (unallowlistedOrphans.length > 0) {
  console.error('ERROR — Orphaned ACs (declared in spec, no matching test, not in allowlist):')
  for (const id of unallowlistedOrphans) console.error(`  - ${id}`)
  console.error('')
  console.error('Either add a test referencing the AC, or — if the work is deliberately pending —')
  console.error('add the AC to .spec-audit-allowlist.json with reviewer approval.')
  console.error('')
}

if (staleAllowlistEntries.length > 0) {
  console.error('ERROR — Stale allowlist entries (AC no longer orphaned or no longer in any spec):')
  for (const id of staleAllowlistEntries) console.error(`  - ${id}`)
  console.error('')
  console.error('Remove these entries from .spec-audit-allowlist.json.')
  console.error('')
}

if (orphanedTests.length > 0) {
  console.warn('WARN — Orphaned test references (test mentions ID, spec does not):')
  for (const id of orphanedTests) {
    console.warn(`  - ${id}`)
    for (const file of testRefs.get(id)) console.warn(`      ${file}`)
  }
  console.warn('')
}

if (unallowlistedOrphans.length === 0 && staleAllowlistEntries.length === 0) {
  console.log('OK: every AC is covered by a test or explicitly allowlisted.')
  process.exit(0)
}

process.exit(1)
