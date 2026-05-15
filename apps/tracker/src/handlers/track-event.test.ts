import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { handleTrackEvent } from './track-event.js'

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
  ip?: string
}): { method: string; body: unknown; headers: Record<string, string>; ip: string } {
  return {
    method: overrides?.method ?? 'POST',
    body: overrides?.body ?? {},
    headers: overrides?.headers ?? {},
    ip: overrides?.ip ?? '127.0.0.1',
  }
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const SITE_ID = 'test-site-001'
// RFC 5737 TEST-NET — safe, never routes to real hosts
const TEST_IP = '203.0.113.42'
const TEST_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const DAY_A = new Date('2024-03-15T10:00:00Z')
const DAY_B = new Date('2024-03-16T10:00:00Z')

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('handleTrackEvent', () => {
  beforeAll(async () => {
    await db.collection('sites').doc(SITE_ID).set({
      name: 'Test Site',
      domain: 'test.example.com',
      createdAt: new Date(),
    })
  })

  afterAll(async () => {
    for (const app of getApps()) await deleteApp(app)
  })

  beforeEach(async () => {
    const snap = await db.collection('events').get()
    if (snap.size > 0) {
      const batch = db.batch()
      snap.docs.forEach(doc => batch.delete(doc.ref))
      await batch.commit()
    }
  })

  // -------------------------------------------------------------------------
  // AC-01: Pageview stored with correct fields
  // -------------------------------------------------------------------------
  it('AC-01: stores pageview document with all required fields', async () => {
    const req = makeReq({
      body: {
        siteId: SITE_ID,
        type: 'pageview',
        url: 'http://test.example.com/about?utm_source=newsletter&utm_medium=email',
        referrer: 'https://google.com',
        name: null,
        props: {},
      },
      headers: { 'x-forwarded-for': TEST_IP, 'user-agent': TEST_UA },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res, DAY_A)

    expect(res.statusCode).toBe(204)

    const snap = await db.collection('events').get()
    expect(snap.size).toBe(1)

    const data = snap.docs[0]!.data()
    expect(data['siteId']).toBe(SITE_ID)
    expect(data['type']).toBe('pageview')
    expect(data['name']).toBe('pageview')
    expect(data['path']).toBe('/about')
    expect(data['utmSource']).toBe('newsletter')
    expect(data['utmMedium']).toBe('email')
    expect(data['referrer']).toBe('https://google.com')
    expect(data['browser']).toBeTruthy()
    expect(data['browserVersion']).toBeTruthy()
    expect(data['os']).toBeTruthy()
    expect(['desktop', 'mobile', 'tablet', 'unknown']).toContain(data['device'])
    expect(data['country']).toBe('XX')
    expect(data['visitorHash']).toBeTruthy()
    expect(data['sessionHash']).toBeTruthy()
    expect(data['timestamp']).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // AC-02: No raw IP address in Firestore
  // -------------------------------------------------------------------------
  it('AC-02: does not write raw IP address to Firestore', async () => {
    const req = makeReq({
      body: { siteId: SITE_ID, type: 'pageview', url: 'http://test.example.com/' },
      headers: { 'x-forwarded-for': TEST_IP, 'user-agent': TEST_UA },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res, DAY_A)

    const snap = await db.collection('events').get()
    const data = snap.docs[0]!.data()

    expect(data['ip']).toBeUndefined()
    expect(data['ipAddress']).toBeUndefined()

    const stringValues = Object.values(data).filter((v): v is string => typeof v === 'string')
    expect(stringValues).not.toContain(TEST_IP)
  })

  // -------------------------------------------------------------------------
  // AC-03: Same visitor, same day → same visitorHash
  // -------------------------------------------------------------------------
  it('AC-03: same IP + UA on same day produces identical visitorHash', async () => {
    const body = { siteId: SITE_ID, type: 'pageview', url: 'http://test.example.com/' }
    const headers = { 'x-forwarded-for': TEST_IP, 'user-agent': TEST_UA }

    await handleTrackEvent(makeReq({ body, headers }), new MockResponse(), DAY_A)
    await handleTrackEvent(makeReq({ body, headers }), new MockResponse(), DAY_A)

    const snap = await db.collection('events').get()
    expect(snap.size).toBe(2)

    const hashes = snap.docs.map(d => d.data()['visitorHash'] as string)
    expect(hashes[0]).toBe(hashes[1])
  })

  // -------------------------------------------------------------------------
  // AC-04: Same visitor, different day → different visitorHash
  // -------------------------------------------------------------------------
  it('AC-04: same IP + UA on different days produces different visitorHash', async () => {
    const body = { siteId: SITE_ID, type: 'pageview', url: 'http://test.example.com/' }
    const headers = { 'x-forwarded-for': TEST_IP, 'user-agent': TEST_UA }

    await handleTrackEvent(makeReq({ body, headers }), new MockResponse(), DAY_A)
    await handleTrackEvent(makeReq({ body, headers }), new MockResponse(), DAY_B)

    const snap = await db.collection('events').get()
    const hashes = snap.docs.map(d => d.data()['visitorHash'] as string)
    expect(hashes[0]).not.toBe(hashes[1])
  })

  // -------------------------------------------------------------------------
  // AC-05: Unknown siteId → 404
  // -------------------------------------------------------------------------
  it('AC-05: unknown siteId returns 404', async () => {
    const req = makeReq({
      body: { siteId: 'nonexistent-site-xyz', type: 'pageview', url: 'http://test.example.com/' },
      headers: { 'user-agent': TEST_UA },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res)

    expect(res.statusCode).toBe(404)
  })

  // -------------------------------------------------------------------------
  // AC-06: Missing required field → 400 with descriptive error
  // -------------------------------------------------------------------------
  it('AC-06: missing url returns 400 with error field', async () => {
    const req = makeReq({
      body: { siteId: SITE_ID, type: 'pageview' },
      headers: { 'user-agent': TEST_UA },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // AC-10: Non-POST request → 405
  // -------------------------------------------------------------------------
  it('AC-10: non-POST request returns 405 with error field', async () => {
    const req = makeReq({
      method: 'GET',
      body: { siteId: SITE_ID, type: 'pageview', url: 'http://test.example.com/' },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res)

    expect(res.statusCode).toBe(405)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // AC-11: Empty siteId → 400
  // -------------------------------------------------------------------------
  it('AC-11: empty siteId returns 400 with error field', async () => {
    const req = makeReq({
      body: { siteId: '', type: 'pageview', url: 'http://test.example.com/' },
      headers: { 'user-agent': TEST_UA },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // AC-12: Invalid event type → 400
  // -------------------------------------------------------------------------
  it('AC-12: invalid type returns 400 with error field', async () => {
    const req = makeReq({
      body: { siteId: SITE_ID, type: 'invalid', url: 'http://test.example.com/' },
      headers: { 'user-agent': TEST_UA },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // AC-13: Malformed URL → 400
  // -------------------------------------------------------------------------
  it('AC-13: malformed url returns 400 with error field', async () => {
    const req = makeReq({
      body: { siteId: SITE_ID, type: 'pageview', url: 'not-a-url' },
      headers: { 'user-agent': TEST_UA },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // AC-14: Custom event without name → 400
  // -------------------------------------------------------------------------
  it('AC-14: custom event without name returns 400 with error field', async () => {
    const req = makeReq({
      body: { siteId: SITE_ID, type: 'custom', url: 'http://test.example.com/' },
      headers: { 'user-agent': TEST_UA },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // AC-15: Custom event stored correctly
  // -------------------------------------------------------------------------
  it('AC-15: custom event stores type, name, and props correctly', async () => {
    const req = makeReq({
      body: {
        siteId: SITE_ID,
        type: 'custom',
        name: 'signup_click',
        url: 'http://test.example.com/pricing',
        props: { plan: 'pro' },
      },
      headers: { 'x-forwarded-for': TEST_IP, 'user-agent': TEST_UA },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res, DAY_A)

    expect(res.statusCode).toBe(204)
    const snap = await db.collection('events').get()
    expect(snap.size).toBe(1)
    const data = snap.docs[0]!.data()
    expect(data['type']).toBe('custom')
    expect(data['name']).toBe('signup_click')
    expect(data['props']).toEqual({ plan: 'pro' })
  })

  // -------------------------------------------------------------------------
  // AC-16: Props exceed key limit → 400
  // -------------------------------------------------------------------------
  it('AC-16: props with 11 keys returns 400 with error field', async () => {
    const props = Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => [`key${i}`, 'value']),
    )
    const req = makeReq({
      body: { siteId: SITE_ID, type: 'pageview', url: 'http://test.example.com/', props },
      headers: { 'user-agent': TEST_UA },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // AC-17: Prop key too long → 400
  // -------------------------------------------------------------------------
  it('AC-17: props key exceeding 100 characters returns 400', async () => {
    const req = makeReq({
      body: {
        siteId: SITE_ID,
        type: 'pageview',
        url: 'http://test.example.com/',
        props: { ['k'.repeat(101)]: 'value' },
      },
      headers: { 'user-agent': TEST_UA },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // AC-18: Prop value too long → 400
  // -------------------------------------------------------------------------
  it('AC-18: props value exceeding 100 characters returns 400', async () => {
    const req = makeReq({
      body: {
        siteId: SITE_ID,
        type: 'pageview',
        url: 'http://test.example.com/',
        props: { key: 'v'.repeat(101) },
      },
      headers: { 'user-agent': TEST_UA },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // AC-19: sessionHash consistent within hour, different across hours
  // -------------------------------------------------------------------------
  it('AC-19: same IP + UA in same hour produces identical sessionHash', async () => {
    const body = { siteId: SITE_ID, type: 'pageview', url: 'http://test.example.com/' }
    const headers = { 'x-forwarded-for': TEST_IP, 'user-agent': TEST_UA }
    const HOUR_A_SAME = new Date('2024-03-15T10:30:00Z') // same 10:xx hour as DAY_A

    await handleTrackEvent(makeReq({ body, headers }), new MockResponse(), DAY_A)
    await handleTrackEvent(makeReq({ body, headers }), new MockResponse(), HOUR_A_SAME)

    const snap = await db.collection('events').get()
    expect(snap.size).toBe(2)
    const hashes = snap.docs.map(d => d.data()['sessionHash'] as string)
    expect(hashes[0]).toBe(hashes[1])
  })

  it('AC-19: same IP + UA in different hours produces different sessionHash', async () => {
    const body = { siteId: SITE_ID, type: 'pageview', url: 'http://test.example.com/' }
    const headers = { 'x-forwarded-for': TEST_IP, 'user-agent': TEST_UA }
    const NEXT_HOUR = new Date('2024-03-15T11:00:00Z')

    await handleTrackEvent(makeReq({ body, headers }), new MockResponse(), DAY_A)
    await handleTrackEvent(makeReq({ body, headers }), new MockResponse(), NEXT_HOUR)

    const snap = await db.collection('events').get()
    const hashes = snap.docs.map(d => d.data()['sessionHash'] as string)
    expect(hashes[0]).not.toBe(hashes[1])
  })

  // -------------------------------------------------------------------------
  // AC-20: Mobile User-Agent → device = 'mobile'
  // -------------------------------------------------------------------------
  it('AC-20: mobile User-Agent produces device "mobile"', async () => {
    const mobileUa =
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36'
    const req = makeReq({
      body: { siteId: SITE_ID, type: 'pageview', url: 'http://test.example.com/' },
      headers: { 'x-forwarded-for': TEST_IP, 'user-agent': mobileUa },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res, DAY_A)

    const snap = await db.collection('events').get()
    expect(snap.docs[0]!.data()['device']).toBe('mobile')
  })

  // -------------------------------------------------------------------------
  // AC-21: Tablet User-Agent → device = 'tablet'
  // -------------------------------------------------------------------------
  it('AC-21: tablet User-Agent produces device "tablet"', async () => {
    const tabletUa =
      'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    const req = makeReq({
      body: { siteId: SITE_ID, type: 'pageview', url: 'http://test.example.com/' },
      headers: { 'x-forwarded-for': TEST_IP, 'user-agent': tabletUa },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res, DAY_A)

    const snap = await db.collection('events').get()
    expect(snap.docs[0]!.data()['device']).toBe('tablet')
  })

  // -------------------------------------------------------------------------
  // AC-22: Firefox User-Agent → browser = 'Firefox'
  // -------------------------------------------------------------------------
  it('AC-22: Firefox User-Agent produces browser "Firefox"', async () => {
    const firefoxUa =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0'
    const req = makeReq({
      body: { siteId: SITE_ID, type: 'pageview', url: 'http://test.example.com/' },
      headers: { 'x-forwarded-for': TEST_IP, 'user-agent': firefoxUa },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res, DAY_A)

    const snap = await db.collection('events').get()
    expect(snap.docs[0]!.data()['browser']).toBe('Firefox')
  })

  // -------------------------------------------------------------------------
  // AC-23: macOS User-Agent → os = 'macOS'
  // -------------------------------------------------------------------------
  it('AC-23: macOS User-Agent produces os "macOS"', async () => {
    const macosUa =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    const req = makeReq({
      body: { siteId: SITE_ID, type: 'pageview', url: 'http://test.example.com/' },
      headers: { 'x-forwarded-for': TEST_IP, 'user-agent': macosUa },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res, DAY_A)

    const snap = await db.collection('events').get()
    expect(snap.docs[0]!.data()['os']).toBe('macOS')
  })

  // -------------------------------------------------------------------------
  // AC-24: req.ip used when X-Forwarded-For header is absent
  // -------------------------------------------------------------------------
  it('AC-24: same req.ip on same day produces identical visitorHash without X-Forwarded-For', async () => {
    const body = { siteId: SITE_ID, type: 'pageview', url: 'http://test.example.com/' }

    await handleTrackEvent(
      makeReq({ body, headers: { 'user-agent': TEST_UA }, ip: TEST_IP }),
      new MockResponse(),
      DAY_A,
    )
    await handleTrackEvent(
      makeReq({ body, headers: { 'user-agent': TEST_UA }, ip: TEST_IP }),
      new MockResponse(),
      DAY_A,
    )

    const snap = await db.collection('events').get()
    expect(snap.size).toBe(2)
    const hashes = snap.docs.map(d => d.data()['visitorHash'] as string)
    expect(hashes[0]).toBe(hashes[1])
  })

  // -------------------------------------------------------------------------
  // AC-25: Non-http/https URL scheme → 400
  // -------------------------------------------------------------------------
  it('AC-25: ftp URL scheme returns 400 with error field', async () => {
    const req = makeReq({
      body: { siteId: SITE_ID, type: 'pageview', url: 'ftp://test.example.com/page' },
      headers: { 'user-agent': TEST_UA },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // AC-26: Missing VISITOR_SALT → 500
  // -------------------------------------------------------------------------
  it('AC-26: empty salt returns 500 with error field', async () => {
    const req = makeReq({
      body: { siteId: SITE_ID, type: 'pageview', url: 'http://test.example.com/' },
      headers: { 'user-agent': TEST_UA },
    })
    const res = new MockResponse()

    await handleTrackEvent(req, res, new Date(), '')

    expect(res.statusCode).toBe(500)
    expect((res.body as { error: string }).error).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // AC-27: Unknown IP → unique per-request visitorHash
  // -------------------------------------------------------------------------
  it('AC-27: two requests with no determinable IP produce different visitorHashes', async () => {
    const body = { siteId: SITE_ID, type: 'pageview', url: 'http://test.example.com/' }
    const noIpReq = {
      method: 'POST' as const,
      body,
      headers: { 'user-agent': TEST_UA } as Record<string, string>,
    }

    await handleTrackEvent(noIpReq, new MockResponse(), DAY_A)
    await handleTrackEvent(noIpReq, new MockResponse(), DAY_A)

    const snap = await db.collection('events').get()
    expect(snap.size).toBe(2)
    const hashes = snap.docs.map(d => d.data()['visitorHash'] as string)
    expect(hashes[0]).not.toBe(hashes[1])
  })
})
