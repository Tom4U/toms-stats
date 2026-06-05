import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { Site } from '@tom4u-stats/shared'
import { handleGetSites, handleCreateSite } from './sites.js'
import {
  mockVerifyToken,
  ownerAuthHeader,
  nonOwnerAuthHeader,
  invalidAuthHeader,
} from '../test-helpers/auth-mock.js'

if (getApps().length === 0) {
  initializeApp({ projectId: 'toms-stats' })
}
const db = getFirestore()

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

class MockResponse {
  statusCode = 200
  body: unknown = undefined

  status(code: number): this {
    this.statusCode = code
    return this
  }
  json(data: unknown): void {
    this.body = data
  }
  send(data?: unknown): void {
    this.body = data
  }
  sendStatus(code: number): void {
    this.statusCode = code
  }
}

function makeReq(overrides?: {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}): { method: string; body: unknown; headers: Record<string, string> } {
  return {
    method: overrides?.method ?? 'GET',
    body: overrides?.body ?? {},
    headers: overrides?.headers ?? {},
  }
}

// ---------------------------------------------------------------------------
// Fixtures — sites suite owns its own docs (prefix-scoped) so it never
// pollutes the get-stats / router fixtures.
// ---------------------------------------------------------------------------

const PREFIX = 'sites-test-'

async function clearTestSites(): Promise<void> {
  const snap = await db.collection('sites').get()
  const batch = db.batch()
  let n = 0
  snap.docs.forEach(doc => {
    const name = doc.data()['name']
    if (typeof name === 'string' && name.startsWith(PREFIX)) {
      batch.delete(doc.ref)
      n++
    }
  })
  if (n > 0) await batch.commit()
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('handleGetSites / handleCreateSite', () => {
  afterAll(async () => {
    await clearTestSites()
    for (const app of getApps()) await deleteApp(app)
  })

  beforeEach(async () => {
    await clearTestSites()
  })

  // -------------------------------------------------------------------------
  // AC-01-32 / AC-01-34: auth
  // -------------------------------------------------------------------------
  it('AC-01-32: GET returns 401 when Authorization header is missing', async () => {
    const res = new MockResponse()
    await handleGetSites(makeReq(), res, mockVerifyToken)
    expect(res.statusCode).toBe(401)
  })

  it('AC-01-32: GET returns 401 when Bearer token is invalid', async () => {
    const res = new MockResponse()
    await handleGetSites(makeReq({ headers: invalidAuthHeader() }), res, mockVerifyToken)
    expect(res.statusCode).toBe(401)
  })

  it('AC-01-32: GET returns 403 for a non-owner uid', async () => {
    const res = new MockResponse()
    await handleGetSites(makeReq({ headers: nonOwnerAuthHeader() }), res, mockVerifyToken)
    expect(res.statusCode).toBe(403)
  })

  it('AC-01-34: POST returns 401 when Authorization header is missing', async () => {
    const res = new MockResponse()
    await handleCreateSite(
      makeReq({ method: 'POST', body: { name: `${PREFIX}a`, domain: 'a.example.com' } }),
      res,
      mockVerifyToken,
    )
    expect(res.statusCode).toBe(401)
  })

  it('AC-01-34: POST returns 403 for a non-owner uid', async () => {
    const res = new MockResponse()
    await handleCreateSite(
      makeReq({
        method: 'POST',
        body: { name: `${PREFIX}a`, domain: 'a.example.com' },
        headers: nonOwnerAuthHeader(),
      }),
      res,
      mockVerifyToken,
    )
    expect(res.statusCode).toBe(403)
  })

  // -------------------------------------------------------------------------
  // AC-01-33: GET lists all sites, ordered by createdAt asc
  // -------------------------------------------------------------------------
  it('AC-01-33: GET returns all registered sites as ISO-dated Site objects', async () => {
    await db.collection('sites').add({
      name: `${PREFIX}older`,
      domain: 'older.example.com',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    })
    await db.collection('sites').add({
      name: `${PREFIX}newer`,
      domain: 'newer.example.com',
      createdAt: new Date('2024-06-01T00:00:00Z'),
    })

    const res = new MockResponse()
    await handleGetSites(makeReq({ headers: ownerAuthHeader() }), res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
    const all = res.body as Site[]
    const mine = all.filter(s => s.name.startsWith(PREFIX))
    expect(mine).toHaveLength(2)
    // Ordered by createdAt ascending
    expect(mine[0]?.name).toBe(`${PREFIX}older`)
    expect(mine[1]?.name).toBe(`${PREFIX}newer`)
    const first = mine[0]
    expect(first).toBeDefined()
    expect(first?.id).toBeTruthy()
    expect(first?.domain).toBe('older.example.com')
    expect(typeof first?.createdAt).toBe('string')
    expect(Number.isNaN(Date.parse(first?.createdAt ?? ''))).toBe(false)
  })

  // -------------------------------------------------------------------------
  // AC-01-35: POST creates a site → 201
  // -------------------------------------------------------------------------
  it('AC-01-35: POST creates exactly one site and returns 201 with the Site', async () => {
    const res = new MockResponse()
    await handleCreateSite(
      makeReq({
        method: 'POST',
        body: { name: `${PREFIX}created`, domain: 'created.example.com' },
        headers: ownerAuthHeader(),
      }),
      res,
      mockVerifyToken,
    )

    expect(res.statusCode).toBe(201)
    const site = res.body as Site
    expect(site.id).toBeTruthy()
    expect(site.name).toBe(`${PREFIX}created`)
    expect(site.domain).toBe('created.example.com')
    expect(Number.isNaN(Date.parse(site.createdAt))).toBe(false)

    const snap = await db
      .collection('sites')
      .where('name', '==', `${PREFIX}created`)
      .get()
    expect(snap.size).toBe(1)
  })

  // -------------------------------------------------------------------------
  // AC-01-36: invalid payload → 400
  // -------------------------------------------------------------------------
  it('AC-01-36: POST with empty name returns 400 and creates nothing', async () => {
    const res = new MockResponse()
    await handleCreateSite(
      makeReq({
        method: 'POST',
        body: { name: '', domain: 'x.example.com' },
        headers: ownerAuthHeader(),
      }),
      res,
      mockVerifyToken,
    )
    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  it('AC-01-36: POST with missing domain returns 400', async () => {
    const res = new MockResponse()
    await handleCreateSite(
      makeReq({
        method: 'POST',
        body: { name: `${PREFIX}nodomain` },
        headers: ownerAuthHeader(),
      }),
      res,
      mockVerifyToken,
    )
    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // AC-01-38: malformed domain → 400
  // -------------------------------------------------------------------------
  it.each([
    ['scheme', 'http://example.com'],
    ['path', 'example.com/path'],
    ['inner whitespace', 'exa mple.com'],
  ])('AC-01-38: POST with malformed domain (%s) returns 400', async (_label, domain) => {
    const res = new MockResponse()
    await handleCreateSite(
      makeReq({
        method: 'POST',
        body: { name: `${PREFIX}bad`, domain },
        headers: ownerAuthHeader(),
      }),
      res,
      mockVerifyToken,
    )
    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
    const snap = await db.collection('sites').where('name', '==', `${PREFIX}bad`).get()
    expect(snap.size).toBe(0)
  })

  it.each([['example.com'], ['sub.example.com'], ['localhost'], ['localhost:3000']])(
    'AC-01-38: POST accepts a bare host (%s) → 201',
    async domain => {
      const res = new MockResponse()
      await handleCreateSite(
        makeReq({
          method: 'POST',
          body: { name: `${PREFIX}ok`, domain },
          headers: ownerAuthHeader(),
        }),
        res,
        mockVerifyToken,
      )
      expect(res.statusCode).toBe(201)
    },
  )
})
