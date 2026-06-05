import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import type { QrCode } from '@tom4u-stats/shared'
import { requireOwner, type TokenVerifier, type OutgoingRes } from './auth.js'

// ---------------------------------------------------------------------------
// /api/qr — POST (create) + GET (list) + DELETE (remove), owner-only.
// No image is generated or stored: the QR PNG is rendered client-side from
// trackingUrl (single source of truth). See specs/03-qr-codes.md.
// ---------------------------------------------------------------------------

interface IncomingReq {
  method: string
  body: unknown
  query: Record<string, unknown>
  headers: Readonly<Record<string, string | string[] | undefined>>
}

const NAME_MAX = 100

// serverTimestamp() resolves to a Timestamp on read-back, but the emulator can
// briefly return null/pending right after add(); fall back to "now".
function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  return new Date().toISOString()
}

function firstQuery(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

// Compose via WHATWG URL so existing query params / fragments on targetUrl are
// preserved and the campaign is correctly encoded (searchParams form-encodes
// spaces as "+").
function buildTrackingUrl(targetUrl: string, name: string): string {
  const url = new URL(targetUrl)
  url.searchParams.set('utm_source', 'qr')
  url.searchParams.set('utm_medium', 'qr')
  url.searchParams.set('utm_campaign', name)
  return url.toString()
}

interface ValidCreate {
  siteId: string
  name: string
  targetUrl: string
}

type CreateResult = { ok: true; payload: ValidCreate } | { ok: false; error: string }

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function validateCreate(body: unknown): CreateResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Request body must be an object' }
  }
  const { siteId, name, targetUrl } = body as Record<string, unknown>
  if (typeof siteId !== 'string' || siteId.trim() === '') {
    return { ok: false, error: 'Field "siteId" is required' }
  }
  if (typeof name !== 'string' || name.trim() === '') {
    return { ok: false, error: 'Field "name" is required' }
  }
  if (name.trim().length > NAME_MAX) {
    return { ok: false, error: `Field "name" must be at most ${NAME_MAX} characters` }
  }
  if (typeof targetUrl !== 'string' || !isHttpsUrl(targetUrl)) {
    return { ok: false, error: 'Field "targetUrl" must be a valid https:// URL' }
  }
  return { ok: true, payload: { siteId: siteId.trim(), name: name.trim(), targetUrl } }
}

export async function handleCreateQrCode(
  req: IncomingReq,
  res: OutgoingRes,
  verifyToken?: TokenVerifier,
): Promise<void> {
  const uid = await requireOwner(req, res, verifyToken)
  if (!uid) return

  const validation = validateCreate(req.body)
  if (!validation.ok) {
    res.status(400).json({ error: validation.error })
    return
  }
  const { siteId, name, targetUrl } = validation.payload

  const db = getFirestore()
  const siteSnap = await db.collection('sites').doc(siteId).get()
  if (!siteSnap.exists) {
    res.status(404).json({ error: `Site "${siteId}" not found` })
    return
  }

  const trackingUrl = buildTrackingUrl(targetUrl, name)
  const docRef = await db.collection('qr_codes').add({
    siteId,
    name,
    targetUrl,
    trackingUrl,
    createdAt: FieldValue.serverTimestamp(),
  })
  const created = await docRef.get()
  const data = created.data() ?? {}
  const qr: QrCode = {
    id: docRef.id,
    siteId,
    name,
    targetUrl,
    trackingUrl,
    createdAt: toIso(data['createdAt']),
  }
  res.status(201).json(qr)
}

export async function handleListQrCodes(
  req: IncomingReq,
  res: OutgoingRes,
  verifyToken?: TokenVerifier,
): Promise<void> {
  const uid = await requireOwner(req, res, verifyToken)
  if (!uid) return

  const siteId = firstQuery(req.query['siteId'])
  if (siteId === '') {
    res.status(400).json({ error: 'Query param "siteId" is required' })
    return
  }

  const db = getFirestore()
  const snap = await db
    .collection('qr_codes')
    .where('siteId', '==', siteId)
    .orderBy('createdAt', 'desc')
    .get()

  const codes: QrCode[] = snap.docs.map(doc => {
    const data = doc.data()
    return {
      id: doc.id,
      siteId: String(data['siteId'] ?? ''),
      name: String(data['name'] ?? ''),
      targetUrl: String(data['targetUrl'] ?? ''),
      trackingUrl: String(data['trackingUrl'] ?? ''),
      createdAt: toIso(data['createdAt']),
    }
  })
  res.status(200).json(codes)
}

export async function handleDeleteQrCode(
  req: IncomingReq,
  res: OutgoingRes,
  qrId: string,
  verifyToken?: TokenVerifier,
): Promise<void> {
  const uid = await requireOwner(req, res, verifyToken)
  if (!uid) return

  const db = getFirestore()
  await db.collection('qr_codes').doc(qrId).delete()
  res.sendStatus(204)
}
