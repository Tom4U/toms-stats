import type { TokenVerifier } from '../handlers/get-stats.js'

// Token values for use in get-stats tests. The mock verifier below maps each
// token directly to a uid — so the token string IS the uid.
// OWNER_TOKEN mirrors process.env.OWNER_UID set in vitest.setup.ts so both
// stay in sync without duplicating the literal value.
export const OWNER_TOKEN = process.env['OWNER_UID'] ?? 'owner-uid-test'
export const NON_OWNER_TOKEN = 'some-other-user'
// Sentinel rejected by the mock verifier — simulates a cryptographically invalid
// Firebase ID token without relying on the real Auth service.
export const INVALID_TOKEN = '__invalid__'

export const mockVerifyToken: TokenVerifier = async (token) => {
  if (token === INVALID_TOKEN) return null
  return token
}

export function ownerAuthHeader(): Record<string, string> {
  return { authorization: `Bearer ${OWNER_TOKEN}` }
}

export function nonOwnerAuthHeader(): Record<string, string> {
  return { authorization: `Bearer ${NON_OWNER_TOKEN}` }
}

export function invalidAuthHeader(): Record<string, string> {
  return { authorization: `Bearer ${INVALID_TOKEN}` }
}
