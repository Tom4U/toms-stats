import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { QrCode } from '@tom4u-stats/shared'
import { handleCreateQrCode, handleListQrCodes, handleDeleteQrCode } from './qr.js'
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
  query?: Record<string, unknown>
  headers?: Record<string, string>
}): {
  method: string
  body: unknown
  query: Record<string, unknown>
  headers: Record<string, string>
} {
  return {
    method: overrides?.method ?? 'GET',
    body: overrides?.body ?? {},
    query: overrides?.query ?? {},
    headers: overrides?.headers ?? {},
  }
}

// ---------------------------------------------------------------------------
// Fixtures — QR suite owns its own site + qr_codes docs (siteId-scoped) so it
// never pollutes the get-stats / sites / router fixtures.
// ---------------------------------------------------------------------------

const SITE_ID = 'qr-test-site-001'

async function clearTestQrCodes(): Promise<void> {
  const snap = await db.collection('qr_codes').where('siteId', '==', SITE_ID).get()
  if (snap.size === 0) return
  const batch = db.batch()
  snap.docs.forEach(doc => batch.delete(doc.ref))
  await batch.commit()
}

function createBody(overrides?: Partial<{ siteId: string; name: string; targetUrl: string }>): {
  siteId: string
  name: string
  targetUrl: string
} {
  return {
    siteId: overrides?.siteId ?? SITE_ID,
    name: overrides?.name ?? 'Summer Sale',
    targetUrl: overrides?.targetUrl ?? 'https://shop.example.com',
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('handleCreateQrCode / handleListQrCodes / handleDeleteQrCode', () => {
  beforeAll(async () => {
    await db.collection('sites').doc(SITE_ID).set({
      name: 'qr-test-site',
      domain: 'shop.example.com',
      createdAt: new Date(),
    })
  })

  afterAll(async () => {
    await clearTestQrCodes()
    await db.collection('sites').doc(SITE_ID).delete()
    for (const app of getApps()) await deleteApp(app)
  })

  beforeEach(async () => {
    await clearTestQrCodes()
  })

  // -------------------------------------------------------------------------
  // Auth — all three routes are owner-only via requireOwner
  // -------------------------------------------------------------------------
  it('AC-03-01 — POST returns 401 when Authorization header is missing', async () => {
    const res = new MockResponse()
    await handleCreateQrCode(makeReq({ method: 'POST', body: createBody() }), res, mockVerifyToken)
    expect(res.statusCode).toBe(401)
  })

  it('AC-03-01 — POST returns 401 when Bearer token is invalid', async () => {
    const res = new MockResponse()
    await handleCreateQrCode(
      makeReq({ method: 'POST', body: createBody(), headers: invalidAuthHeader() }),
      res,
      mockVerifyToken,
    )
    expect(res.statusCode).toBe(401)
  })

  it('AC-03-01 — POST returns 403 for a non-owner uid', async () => {
    const res = new MockResponse()
    await handleCreateQrCode(
      makeReq({ method: 'POST', body: createBody(), headers: nonOwnerAuthHeader() }),
      res,
      mockVerifyToken,
    )
    expect(res.statusCode).toBe(403)
  })

  it('AC-03-06 — GET returns 401 when Authorization header is missing', async () => {
    const res = new MockResponse()
    await handleListQrCodes(makeReq({ query: { siteId: SITE_ID } }), res, mockVerifyToken)
    expect(res.statusCode).toBe(401)
  })

  it('AC-03-05 — DELETE returns 403 for a non-owner uid', async () => {
    const res = new MockResponse()
    await handleDeleteQrCode(
      makeReq({ method: 'DELETE', headers: nonOwnerAuthHeader() }),
      res,
      'some-id',
      mockVerifyToken,
    )
    expect(res.statusCode).toBe(403)
  })

  // -------------------------------------------------------------------------
  // AC-03-01 — tracking URL composition (spaces → %20, via URL/searchParams)
  // -------------------------------------------------------------------------
  it('AC-03-01 — builds trackingUrl with qr UTM params and form-encoded campaign', async () => {
    const res = new MockResponse()
    await handleCreateQrCode(
      makeReq({ method: 'POST', body: createBody(), headers: ownerAuthHeader() }),
      res,
      mockVerifyToken,
    )

    expect(res.statusCode).toBe(201)
    const qr = res.body as QrCode
    expect(qr.trackingUrl).toBe(
      'https://shop.example.com/?utm_source=qr&utm_medium=qr&utm_campaign=Summer+Sale',
    )
  })

  it('AC-03-01 — preserves an existing query string on targetUrl', async () => {
    const res = new MockResponse()
    await handleCreateQrCode(
      makeReq({
        method: 'POST',
        body: createBody({ name: 'Flyer', targetUrl: 'https://shop.example.com/p?a=1' }),
        headers: ownerAuthHeader(),
      }),
      res,
      mockVerifyToken,
    )

    expect(res.statusCode).toBe(201)
    const qr = res.body as QrCode
    expect(qr.trackingUrl).toBe(
      'https://shop.example.com/p?a=1&utm_source=qr&utm_medium=qr&utm_campaign=Flyer',
    )
  })

  it('AC-03-01 — preserves a fragment on targetUrl (utm before #)', async () => {
    const res = new MockResponse()
    await handleCreateQrCode(
      makeReq({
        method: 'POST',
        body: createBody({ name: 'Frag', targetUrl: 'https://shop.example.com/p#sec' }),
        headers: ownerAuthHeader(),
      }),
      res,
      mockVerifyToken,
    )

    expect(res.statusCode).toBe(201)
    const qr = res.body as QrCode
    expect(qr.trackingUrl).toBe(
      'https://shop.example.com/p?utm_source=qr&utm_medium=qr&utm_campaign=Frag#sec',
    )
  })

  // -------------------------------------------------------------------------
  // AC-03-03 — invalid targetUrl → 400
  // -------------------------------------------------------------------------
  it('AC-03-03 — returns 400 for a non-URL targetUrl', async () => {
    const res = new MockResponse()
    await handleCreateQrCode(
      makeReq({
        method: 'POST',
        body: createBody({ targetUrl: 'not-a-url' }),
        headers: ownerAuthHeader(),
      }),
      res,
      mockVerifyToken,
    )
    expect(res.statusCode).toBe(400)
  })

  it('AC-03-03 — returns 400 for a non-https targetUrl', async () => {
    const res = new MockResponse()
    await handleCreateQrCode(
      makeReq({
        method: 'POST',
        body: createBody({ targetUrl: 'http://shop.example.com' }),
        headers: ownerAuthHeader(),
      }),
      res,
      mockVerifyToken,
    )
    expect(res.statusCode).toBe(400)
  })

  // -------------------------------------------------------------------------
  // Validation: siteId, name bounds, site existence
  // -------------------------------------------------------------------------
  it('AC-03-01 — returns 400 when siteId is empty', async () => {
    const res = new MockResponse()
    await handleCreateQrCode(
      makeReq({
        method: 'POST',
        body: createBody({ siteId: '' }),
        headers: ownerAuthHeader(),
      }),
      res,
      mockVerifyToken,
    )
    expect(res.statusCode).toBe(400)
  })

  it('AC-03-01 — returns 404 when the site does not exist', async () => {
    const res = new MockResponse()
    await handleCreateQrCode(
      makeReq({
        method: 'POST',
        body: createBody({ siteId: 'does-not-exist' }),
        headers: ownerAuthHeader(),
      }),
      res,
      mockVerifyToken,
    )
    expect(res.statusCode).toBe(404)
  })

  it('AC-03-01 — returns 400 when name is empty', async () => {
    const res = new MockResponse()
    await handleCreateQrCode(
      makeReq({
        method: 'POST',
        body: createBody({ name: '' }),
        headers: ownerAuthHeader(),
      }),
      res,
      mockVerifyToken,
    )
    expect(res.statusCode).toBe(400)
  })

  it('AC-03-01 — returns 400 when name exceeds 100 chars', async () => {
    const res = new MockResponse()
    await handleCreateQrCode(
      makeReq({
        method: 'POST',
        body: createBody({ name: 'x'.repeat(101) }),
        headers: ownerAuthHeader(),
      }),
      res,
      mockVerifyToken,
    )
    expect(res.statusCode).toBe(400)
  })

  // -------------------------------------------------------------------------
  // AC-03-01 — create response contract: QrCode, no image
  // -------------------------------------------------------------------------
  it('AC-03-01 — 201 response is a QrCode with no imageBase64 field', async () => {
    const res = new MockResponse()
    await handleCreateQrCode(
      makeReq({ method: 'POST', body: createBody(), headers: ownerAuthHeader() }),
      res,
      mockVerifyToken,
    )

    expect(res.statusCode).toBe(201)
    const qr = res.body as Record<string, unknown>
    expect(qr['id']).toBeTruthy()
    expect(qr['siteId']).toBe(SITE_ID)
    expect(qr['name']).toBe('Summer Sale')
    expect(qr['targetUrl']).toBe('https://shop.example.com')
    expect(Number.isNaN(Date.parse(String(qr['createdAt'])))).toBe(false)
    expect('imageBase64' in qr).toBe(false)

    const snap = await db.collection('qr_codes').where('siteId', '==', SITE_ID).get()
    expect(snap.size).toBe(1)
    expect('imageBase64' in (snap.docs[0]?.data() ?? {})).toBe(false)
  })

  // -------------------------------------------------------------------------
  // AC-03-06 — list ordered by createdAt desc, never includes imageBase64
  // -------------------------------------------------------------------------
  it('AC-03-06 — GET lists QR codes newest-first without imageBase64', async () => {
    await db.collection('qr_codes').add({
      siteId: SITE_ID,
      name: 'older',
      targetUrl: 'https://shop.example.com',
      trackingUrl: 'https://shop.example.com/?utm_source=qr&utm_medium=qr&utm_campaign=older',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    })
    await db.collection('qr_codes').add({
      siteId: SITE_ID,
      name: 'newer',
      targetUrl: 'https://shop.example.com',
      trackingUrl: 'https://shop.example.com/?utm_source=qr&utm_medium=qr&utm_campaign=newer',
      createdAt: new Date('2024-06-01T00:00:00Z'),
    })

    const res = new MockResponse()
    await handleListQrCodes(
      makeReq({ query: { siteId: SITE_ID }, headers: ownerAuthHeader() }),
      res,
      mockVerifyToken,
    )

    expect(res.statusCode).toBe(200)
    const list = res.body as QrCode[]
    expect(list).toHaveLength(2)
    expect(list[0]?.name).toBe('newer')
    expect(list[1]?.name).toBe('older')
    for (const item of list) {
      expect('imageBase64' in (item as unknown as Record<string, unknown>)).toBe(false)
      expect(typeof item.createdAt).toBe('string')
    }
  })

  // -------------------------------------------------------------------------
  // AC-03-05 — delete removes the document, returns 204
  // -------------------------------------------------------------------------
  it('AC-03-05 — DELETE removes the document and returns 204', async () => {
    const docRef = await db.collection('qr_codes').add({
      siteId: SITE_ID,
      name: 'to-delete',
      targetUrl: 'https://shop.example.com',
      trackingUrl: 'https://shop.example.com/?utm_source=qr&utm_medium=qr&utm_campaign=to-delete',
      createdAt: new Date(),
    })

    const res = new MockResponse()
    await handleDeleteQrCode(
      makeReq({ method: 'DELETE', headers: ownerAuthHeader() }),
      res,
      docRef.id,
      mockVerifyToken,
    )

    expect(res.statusCode).toBe(204)
    const after = await docRef.get()
    expect(after.exists).toBe(false)
  })
})
