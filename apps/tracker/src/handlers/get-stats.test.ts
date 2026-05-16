import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { handleGetStats } from './get-stats.js'

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
  query?: Record<string, string>
  headers?: Record<string, string>
}): { method: string; query: Record<string, string>; headers: Record<string, string> } {
  return {
    method: overrides?.method ?? 'GET',
    query: overrides?.query ?? {},
    headers: overrides?.headers ?? {},
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SITE_ID = 'stats-test-site-001'
const DATE = '2024-03-15'
const VALID_QUERY = { siteId: SITE_ID, from: DATE, to: DATE, metric: 'pageviews' }

async function seedEvent(overrides: Record<string, unknown> = {}): Promise<void> {
  await db.collection('events').add({
    siteId: SITE_ID,
    type: 'pageview',
    name: 'pageview',
    url: 'http://test.example.com/',
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
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('handleGetStats', () => {
  beforeAll(async () => {
    await db.collection('sites').doc(SITE_ID).set({
      name: 'Stats Test Site',
      domain: 'stats-test.example.com',
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

  // -------------------------------------------------------------------------
  // AC-01-07: Stats endpoint requires auth
  // -------------------------------------------------------------------------
  it('AC-01-07: returns 401 when Authorization header is missing', async () => {
    const req = makeReq({ query: VALID_QUERY })
    const res = new MockResponse()

    await handleGetStats(req, res)

    expect(res.statusCode).toBe(401)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  it('AC-01-07: returns 401 when Authorization header has wrong format', async () => {
    const req = makeReq({
      query: VALID_QUERY,
      headers: { authorization: 'Basic sometoken' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res)

    expect(res.statusCode).toBe(401)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  it('AC-01-07: returns 401 when Bearer token is invalid', async () => {
    const req = makeReq({
      query: VALID_QUERY,
      headers: { authorization: 'Bearer not-a-valid-token' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res)

    expect(res.statusCode).toBe(401)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // AC-01-08 / AC-01-09: Stats return correct counts (skip token verification
  // in test mode via dependency injection — verified token is passed as truthy
  // uid via the injected verifier)
  // -------------------------------------------------------------------------
  it('AC-01-08: returns correct pageview count for the queried date range', async () => {
    // Seed 5 pageviews on DATE, all with the same visitorHash (same visitor)
    for (let i = 0; i < 5; i++) {
      await seedEvent({ visitorHash: 'hash-single', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:0${i}:00Z`)) })
    }

    const req = makeReq({
      query: { siteId: SITE_ID, from: DATE, to: DATE, metric: 'pageviews' },
      headers: { authorization: 'Bearer __test_uid__' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
    const body = res.body as { metric: string; data: unknown[]; totals: { pageviews: number; visitors: number } }
    expect(body.metric).toBe('pageviews')
    expect(body.totals.pageviews).toBe(5)
  })

  it('AC-01-09: unique visitor count uses distinct visitorHash values', async () => {
    // 5 events, 3 distinct visitorHashes
    await seedEvent({ visitorHash: 'hash-a', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:00:00Z`)) })
    await seedEvent({ visitorHash: 'hash-a', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:01:00Z`)) })
    await seedEvent({ visitorHash: 'hash-b', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:02:00Z`)) })
    await seedEvent({ visitorHash: 'hash-b', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:03:00Z`)) })
    await seedEvent({ visitorHash: 'hash-c', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:04:00Z`)) })

    const req = makeReq({
      query: { siteId: SITE_ID, from: DATE, to: DATE, metric: 'pageviews' },
      headers: { authorization: 'Bearer __test_uid__' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
    const body = res.body as { totals: { pageviews: number; visitors: number } }
    expect(body.totals.pageviews).toBe(5)
    expect(body.totals.visitors).toBe(3)
  })

  // -------------------------------------------------------------------------
  // Parameter validation
  // -------------------------------------------------------------------------
  it('returns 400 when siteId is missing', async () => {
    const req = makeReq({
      query: { from: DATE, to: DATE, metric: 'pageviews' },
      headers: { authorization: 'Bearer __test_uid__' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  it('returns 404 when siteId does not exist', async () => {
    const req = makeReq({
      query: { siteId: 'nonexistent-site-xyz', from: DATE, to: DATE, metric: 'pageviews' },
      headers: { authorization: 'Bearer __test_uid__' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when date range exceeds 366 days', async () => {
    const req = makeReq({
      query: { siteId: SITE_ID, from: '2024-01-01', to: '2025-01-03', metric: 'pageviews' },
      headers: { authorization: 'Bearer __test_uid__' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  it('returns 400 when metric is invalid', async () => {
    const req = makeReq({
      query: { siteId: SITE_ID, from: DATE, to: DATE, metric: 'invalid' },
      headers: { authorization: 'Bearer __test_uid__' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Injected verifier — bypasses real Firebase Auth in test mode
// ---------------------------------------------------------------------------
async function mockVerifyToken(token: string): Promise<string | null> {
  if (token === '__test_uid__') return 'test-user'
  return null
}
