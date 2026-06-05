import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { routeRequest } from './router.js'
import { mockVerifyToken, ownerAuthHeader } from '../test-helpers/auth-mock.js'

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
  path?: string
  body?: unknown
  query?: Record<string, unknown>
  headers?: Record<string, string>
  ip?: string
}): {
  method: string
  path: string
  body: unknown
  query: Record<string, unknown>
  headers: Record<string, string>
  ip: string
} {
  return {
    method: overrides?.method ?? 'GET',
    path: overrides?.path ?? '/api/event',
    body: overrides?.body ?? {},
    query: overrides?.query ?? {},
    headers: overrides?.headers ?? {},
    ip: overrides?.ip ?? '127.0.0.1',
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SITE_ID = 'router-test-site-001'
const DATE = '2024-03-15'

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('routeRequest', () => {
  beforeAll(async () => {
    await db.collection('sites').doc(SITE_ID).set({
      name: 'Router Test Site',
      domain: 'router-test.example.com',
      createdAt: new Date(),
    })
  })

  afterAll(async () => {
    for (const app of getApps()) await deleteApp(app)
  })

  beforeEach(async () => {
    const snap = await db.collection('events').where('siteId', '==', SITE_ID).get()
    if (snap.size > 0) {
      const batch = db.batch()
      snap.docs.forEach(doc => batch.delete(doc.ref))
      await batch.commit()
    }
  })

  it('AC-28 — dispatches POST /api/event to the track-event handler (204)', async () => {
    const req = makeReq({
      method: 'POST',
      path: '/api/event',
      body: {
        siteId: SITE_ID,
        type: 'pageview',
        url: 'http://router-test.example.com/',
        referrer: '',
        name: null,
        props: {},
      },
      headers: { 'user-agent': 'Mozilla/5.0' },
    })
    const res = new MockResponse()

    await routeRequest(req, res)

    expect(res.statusCode).toBe(204)
    const snap = await db.collection('events').where('siteId', '==', SITE_ID).get()
    expect(snap.size).toBe(1)
  })

  it('AC-29 — dispatches GET /api/stats to the stats handler (200)', async () => {
    await db.collection('events').add({
      siteId: SITE_ID,
      type: 'pageview',
      name: 'pageview',
      url: 'http://router-test.example.com/',
      path: '/',
      referrer: '',
      utmSource: '',
      utmMedium: '',
      utmCampaign: '',
      browser: 'Chrome',
      browserVersion: '124',
      os: 'Windows',
      device: 'desktop',
      country: 'XX',
      visitorHash: 'hash-a',
      sessionHash: 'session-a',
      timestamp: FieldValue.serverTimestamp(),
      props: {},
    })

    const req = makeReq({
      method: 'GET',
      path: '/api/stats',
      query: { siteId: SITE_ID, from: DATE, to: DATE, metric: 'pageviews' },
      headers: ownerAuthHeader(),
    })
    const res = new MockResponse()

    await routeRequest(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
  })

  it('AC-30 — returns 404 for an unknown path', async () => {
    const req = makeReq({ method: 'GET', path: '/api/unknown' })
    const res = new MockResponse()

    await routeRequest(req, res)

    expect(res.statusCode).toBe(404)
  })

  it('AC-31 — returns 405 for a known path with an unsupported method', async () => {
    const req = makeReq({ method: 'DELETE', path: '/api/event' })
    const res = new MockResponse()

    await routeRequest(req, res)

    expect(res.statusCode).toBe(405)
  })

  it('AC-01-33 — dispatches GET /api/sites to the list handler (200)', async () => {
    const req = makeReq({ method: 'GET', path: '/api/sites', headers: ownerAuthHeader() })
    const res = new MockResponse()

    await routeRequest(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('AC-01-35 — dispatches POST /api/sites to the create handler (201)', async () => {
    const req = makeReq({
      method: 'POST',
      path: '/api/sites',
      body: { name: 'Router Created', domain: 'router-created.example.com' },
      headers: ownerAuthHeader(),
    })
    const res = new MockResponse()

    await routeRequest(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(201)
    const created = res.body as { id: string }
    await db.collection('sites').doc(created.id).delete()
  })

  it('AC-01-37 — returns 405 for /api/sites with an unsupported method', async () => {
    const req = makeReq({ method: 'PUT', path: '/api/sites', headers: ownerAuthHeader() })
    const res = new MockResponse()

    await routeRequest(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(405)
  })
})
