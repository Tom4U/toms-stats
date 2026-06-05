import { describe, it, expect } from 'vitest'
import { tracker } from './router.js'

// ---------------------------------------------------------------------------
// AC-04-08: the deployed tracker function must declare the v2 secrets it reads
// from process.env, or Firebase never injects them and every auth-protected
// route fails closed with 500 in production.
// ---------------------------------------------------------------------------

interface SecretEnvVar {
  key: string
}
interface EndpointShape {
  secretEnvironmentVariables?: SecretEnvVar[]
}

describe('tracker secret declaration', () => {
  it('AC-04-08: declares OWNER_UID and VISITOR_SALT as secrets', () => {
    const endpoint = (tracker as unknown as { __endpoint?: EndpointShape }).__endpoint
    const declared = (endpoint?.secretEnvironmentVariables ?? []).map(s => s.key)
    expect(declared).toContain('OWNER_UID')
    expect(declared).toContain('VISITOR_SALT')
  })
})
