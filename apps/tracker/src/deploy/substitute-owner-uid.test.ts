import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
// @ts-expect-error — plain .mjs deploy script, no type declarations
import { substituteOwnerUid } from '../../../../scripts/substitute-owner-uid.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const RULES_PATH = join(ROOT, 'firestore.rules')

// ---------------------------------------------------------------------------
// AC-04-09: Firestore rules get the owner UID at deploy time, not from the repo.
// The committed rules carry an __OWNER_UID__ placeholder; deploy substitutes it
// from the OWNER_UID secret and fails closed on misconfiguration.
// ---------------------------------------------------------------------------

describe('substituteOwnerUid (deploy-time OWNER_UID injection)', () => {
  it('AC-04-09: committed firestore.rules still carries the placeholder, not a real UID', () => {
    const rules = readFileSync(RULES_PATH, 'utf8')
    expect(rules).toContain('__OWNER_UID__')
  })

  it('AC-04-09: replaces every placeholder occurrence with the owner UID', () => {
    const out = substituteOwnerUid("uid == '__OWNER_UID__'; // __OWNER_UID__", 'uid-123')
    expect(out).toBe("uid == 'uid-123'; // uid-123")
    expect(out).not.toContain('__OWNER_UID__')
  })

  it('AC-04-09: trims surrounding whitespace from the UID', () => {
    expect(substituteOwnerUid("'__OWNER_UID__'", '  uid-123\n')).toBe("'uid-123'")
  })

  it('AC-04-09: fails closed when the UID is empty', () => {
    expect(() => substituteOwnerUid("'__OWNER_UID__'", '')).toThrow(/not set/i)
    expect(() => substituteOwnerUid("'__OWNER_UID__'", '   ')).toThrow(/not set/i)
    expect(() => substituteOwnerUid("'__OWNER_UID__'", undefined)).toThrow(/not set/i)
  })

  it('AC-04-09: fails closed when the placeholder is missing (rules drifted)', () => {
    expect(() => substituteOwnerUid("uid == 'hardcoded'", 'uid-123')).toThrow(/placeholder missing/i)
  })

  it('AC-04-09: the real firestore.rules substitutes cleanly with a sample UID', () => {
    const rules = readFileSync(RULES_PATH, 'utf8')
    const out = substituteOwnerUid(rules, 'sample-owner-uid')
    expect(out).toContain('sample-owner-uid')
    expect(out).not.toContain('__OWNER_UID__')
  })
})
