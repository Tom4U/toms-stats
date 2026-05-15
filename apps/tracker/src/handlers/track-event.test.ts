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
})
