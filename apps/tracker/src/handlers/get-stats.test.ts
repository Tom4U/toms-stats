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
      headers: { authorization: 'Bearer __invalid__' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res)

    expect(res.statusCode).toBe(401)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // AC-04-03: Non-owner token → 403
  // AC-04-04: Owner token → 200
  // -------------------------------------------------------------------------
  it('AC-04-03: returns 403 when token belongs to a non-owner uid', async () => {
    const req = makeReq({
      query: VALID_QUERY,
      headers: { authorization: 'Bearer some-other-user' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(403)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  it('AC-04-04: returns 200 when token belongs to the owner uid', async () => {
    const req = makeReq({
      query: VALID_QUERY,
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
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
      headers: { authorization: 'Bearer owner-uid-test' },
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
      headers: { authorization: 'Bearer owner-uid-test' },
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
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  it('returns 404 when siteId does not exist', async () => {
    const req = makeReq({
      query: { siteId: 'nonexistent-site-xyz', from: DATE, to: DATE, metric: 'pageviews' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when date range exceeds 366 days', async () => {
    const req = makeReq({
      query: { siteId: SITE_ID, from: '2024-01-01', to: '2025-01-03', metric: 'pageviews' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  it('returns 400 when metric is invalid', async () => {
    const req = makeReq({
      query: { siteId: SITE_ID, from: DATE, to: DATE, metric: 'invalid' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  it('returns 400 when from date is malformed', async () => {
    const req = makeReq({
      query: { siteId: SITE_ID, from: 'not-a-date', to: DATE, metric: 'pageviews' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  it('returns 400 when to is before from', async () => {
    const req = makeReq({
      query: { siteId: SITE_ID, from: '2024-03-20', to: '2024-03-10', metric: 'pageviews' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // Label-count metrics (browsers, os, devices, countries, referrers, visitors,
  // customEvents) — covers buildLabelCountResponse branches
  // -------------------------------------------------------------------------
  it('returns browser distribution for metric=browsers', async () => {
    await seedEvent({ browser: 'Chrome', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:00:00Z`)) })
    await seedEvent({ browser: 'Firefox', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:01:00Z`)) })
    await seedEvent({ browser: 'Chrome', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:02:00Z`)) })

    const req = makeReq({
      query: { siteId: SITE_ID, from: DATE, to: DATE, metric: 'browsers' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
    const body = res.body as { metric: string; data: Array<{ label: string; count: number }> }
    expect(body.metric).toBe('browsers')
    const chrome = body.data.find(d => d.label === 'Chrome')
    expect(chrome?.count).toBe(2)
  })

  it('returns OS distribution for metric=os', async () => {
    await seedEvent({ os: 'Windows', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:00:00Z`)) })
    await seedEvent({ os: 'macOS', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:01:00Z`)) })

    const req = makeReq({
      query: { siteId: SITE_ID, from: DATE, to: DATE, metric: 'os' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
    const body = res.body as { metric: string; data: Array<{ label: string; count: number }> }
    expect(body.metric).toBe('os')
    expect(body.data.length).toBeGreaterThan(0)
  })

  it('returns device distribution for metric=devices', async () => {
    await seedEvent({ device: 'desktop', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:00:00Z`)) })
    await seedEvent({ device: 'mobile', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:01:00Z`)) })

    const req = makeReq({
      query: { siteId: SITE_ID, from: DATE, to: DATE, metric: 'devices' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
    const body = res.body as { metric: string; data: Array<{ label: string; count: number }> }
    expect(body.metric).toBe('devices')
    expect(body.data.length).toBeGreaterThan(0)
  })

  it('returns country distribution for metric=countries', async () => {
    await seedEvent({ country: 'DE', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:00:00Z`)) })
    await seedEvent({ country: 'US', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:01:00Z`)) })

    const req = makeReq({
      query: { siteId: SITE_ID, from: DATE, to: DATE, metric: 'countries' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
    const body = res.body as { metric: string; data: Array<{ label: string; count: number }> }
    expect(body.metric).toBe('countries')
    expect(body.data.length).toBeGreaterThan(0)
  })

  it('returns referrer distribution with "direct" for empty referrer (metric=referrers)', async () => {
    await seedEvent({ referrer: '', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:00:00Z`)) })
    await seedEvent({ referrer: 'https://google.com/search', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:01:00Z`)) })

    const req = makeReq({
      query: { siteId: SITE_ID, from: DATE, to: DATE, metric: 'referrers' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
    const body = res.body as { metric: string; data: Array<{ label: string; count: number }> }
    expect(body.metric).toBe('referrers')
    const direct = body.data.find(d => d.label === 'direct')
    expect(direct?.count).toBe(1)
    const google = body.data.find(d => d.label === 'google.com')
    expect(google?.count).toBe(1)
  })

  it('returns visitor distribution for metric=visitors', async () => {
    await seedEvent({ visitorHash: 'v-a', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:00:00Z`)) })
    await seedEvent({ visitorHash: 'v-a', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:01:00Z`)) })
    await seedEvent({ visitorHash: 'v-b', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:02:00Z`)) })

    const req = makeReq({
      query: { siteId: SITE_ID, from: DATE, to: DATE, metric: 'visitors' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
    const body = res.body as { metric: string; data: Array<{ label: string; count: number }> }
    expect(body.metric).toBe('visitors')
    expect(body.data.find(d => d.label === 'v-a')?.count).toBe(2)
    expect(body.data.find(d => d.label === 'v-b')?.count).toBe(1)
  })

  it('returns custom event distribution for metric=customEvents', async () => {
    await seedEvent({
      type: 'custom',
      name: 'signup_click',
      timestamp: Timestamp.fromDate(new Date(`${DATE}T10:00:00Z`)),
    })
    await seedEvent({
      type: 'custom',
      name: 'signup_click',
      timestamp: Timestamp.fromDate(new Date(`${DATE}T10:01:00Z`)),
    })
    await seedEvent({
      type: 'pageview',
      name: 'pageview',
      timestamp: Timestamp.fromDate(new Date(`${DATE}T10:02:00Z`)),
    })

    const req = makeReq({
      query: { siteId: SITE_ID, from: DATE, to: DATE, metric: 'customEvents' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
    const body = res.body as { metric: string; data: Array<{ label: string; count: number }> }
    expect(body.metric).toBe('customEvents')
    expect(body.data.find(d => d.label === 'signup_click')?.count).toBe(2)
  })

  it('returns empty data when no events exist in range', async () => {
    const req = makeReq({
      query: { siteId: SITE_ID, from: DATE, to: DATE, metric: 'pageviews' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
    const body = res.body as { totals: { pageviews: number; visitors: number } }
    expect(body.totals.pageviews).toBe(0)
    expect(body.totals.visitors).toBe(0)
  })

  // -------------------------------------------------------------------------
  // Copilot-review fixes: 405, malformed referrer, invalid calendar date
  // -------------------------------------------------------------------------
  it('returns 405 for non-GET requests', async () => {
    const req = makeReq({ method: 'POST', query: VALID_QUERY, headers: { authorization: 'Bearer owner-uid-test' } })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(405)
  })

  it('falls back to "direct" for a malformed referrer URL', async () => {
    await seedEvent({ referrer: 'not-a-url', timestamp: Timestamp.fromDate(new Date(`${DATE}T10:00:00Z`)) })

    const req = makeReq({
      query: { siteId: SITE_ID, from: DATE, to: DATE, metric: 'referrers' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
    const body = res.body as { data: Array<{ label: string; count: number }> }
    expect(body.data.find(d => d.label === 'direct')?.count).toBe(1)
  })

  it('returns 400 for a from date that passes regex but is not a valid calendar date', async () => {
    const req = makeReq({
      query: { siteId: SITE_ID, from: '2024-13-40', to: DATE, metric: 'pageviews' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toMatch(/from must be a date/)
  })

  it('correctly counts pageviews seeded with a plain JS Date timestamp', async () => {
    // Seeds via a JS Date object (not Timestamp.fromDate) to exercise the
    // `instanceof Date` branch in toIsoDate
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
      visitorHash: 'hash-js-date',
      sessionHash: 'session-js-date',
      timestamp: new Date(`${DATE}T12:00:00Z`),
      props: {},
    })

    const req = makeReq({
      query: { siteId: SITE_ID, from: DATE, to: DATE, metric: 'pageviews' },
      headers: { authorization: 'Bearer owner-uid-test' },
    })
    const res = new MockResponse()

    await handleGetStats(req, res, mockVerifyToken)

    expect(res.statusCode).toBe(200)
    const body = res.body as { totals: { pageviews: number; visitors: number } }
    expect(body.totals.pageviews).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Injected verifier — bypasses real Firebase Auth in test mode
// The token string encodes the uid directly so tests can control who is "logged in".
// ---------------------------------------------------------------------------
async function mockVerifyToken(token: string): Promise<string | null> {
  if (token === '__invalid__') return null
  return token // token IS the uid in test mode
}
