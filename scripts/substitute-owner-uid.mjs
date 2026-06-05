#!/usr/bin/env node
// Substitute the __OWNER_UID__ placeholder in firestore.rules with the real
// owner UID (from the OWNER_UID env var, set in CI from a GitHub secret) so the
// real UID is never committed to this public repo. See specs/04-auth.md AC-09.
//
// Fail-closed: refuses to write if the UID is empty or the placeholder is
// absent, so a misconfigured deploy never ships the literal placeholder as a
// Firestore rule.

import { readFileSync, writeFileSync } from 'node:fs'

const PLACEHOLDER = '__OWNER_UID__'

/**
 * @param {string} rules  contents of firestore.rules
 * @param {string|undefined} ownerUid
 * @returns {string} rules with the placeholder replaced
 * @throws if ownerUid is empty or the placeholder is missing
 */
export function substituteOwnerUid(rules, ownerUid) {
  if (!ownerUid || ownerUid.trim() === '') {
    throw new Error('OWNER_UID is not set — refusing to deploy rules with the placeholder')
  }
  if (!rules.includes(PLACEHOLDER)) {
    throw new Error(`${PLACEHOLDER} placeholder missing from firestore.rules`)
  }
  return rules.split(PLACEHOLDER).join(ownerUid.trim())
}

/* v8 ignore start — CLI entry, exercised in CI not unit tests */
function main() {
  const file = process.argv[2] ?? 'firestore.rules'
  const result = substituteOwnerUid(readFileSync(file, 'utf8'), process.env['OWNER_UID'])
  writeFileSync(file, result)
  console.log(`Substituted ${PLACEHOLDER} in ${file}`)
}

const invokedDirectly = process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
if (invokedDirectly) {
  try {
    main()
  } catch (err) {
    console.error(`::error::${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}
/* v8 ignore stop */
