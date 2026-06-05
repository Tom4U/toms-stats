import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import type { Site } from '@tom4u-stats/shared'
import { requireOwner, type TokenVerifier, type OutgoingRes } from './auth.js'

// ---------------------------------------------------------------------------
// /api/sites — GET (list) + POST (create), owner-only.
// ---------------------------------------------------------------------------

interface IncomingReq {
  method: string
  body: unknown
  headers: Readonly<Record<string, string | string[] | undefined>>
}

// serverTimestamp() resolves to a Timestamp on read-back, but the emulator can
// briefly return null/pending right after add(); fall back to "now".
function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  return new Date().toISOString()
}

interface CreateSiteResult {
  ok: boolean
  name: string
  domain: string
  error: string
}

// Bare host only: no scheme, no path/slash, no internal whitespace. Allows
// dotted hostnames and `localhost`, optionally with a `:port`.
function isBareHost(domain: string): boolean {
  if (/\s/.test(domain) || domain.includes('/')) return false
  return /^[a-z0-9.-]+(:\d+)?$/i.test(domain)
}

function validateCreateBody(body: unknown): CreateSiteResult {
  const fail = (error: string): CreateSiteResult => ({ ok: false, name: '', domain: '', error })
  if (typeof body !== 'object' || body === null) return fail('Request body must be an object')
  const { name, domain } = body as Record<string, unknown>
  if (typeof name !== 'string' || name.trim() === '') return fail('Field "name" is required')
  if (typeof domain !== 'string' || domain.trim() === '') return fail('Field "domain" is required')
  const trimmedDomain = domain.trim()
  if (!isBareHost(trimmedDomain)) {
    return fail('Field "domain" must be a bare host (no scheme, path, or whitespace)')
  }
  // Persist trimmed values so stored name/domain stay canonical (no leading/
  // trailing whitespace → no near-duplicate sites, consistent display).
  return { ok: true, name: name.trim(), domain: trimmedDomain, error: '' }
}

export async function handleGetSites(
  req: IncomingReq,
  res: OutgoingRes,
  verifyToken?: TokenVerifier,
): Promise<void> {
  const uid = await requireOwner(req, res, verifyToken)
  if (!uid) return

  const db = getFirestore()
  const snap = await db.collection('sites').orderBy('createdAt', 'asc').get()
  const sites: Site[] = snap.docs.map(doc => {
    const data = doc.data()
    return {
      id: doc.id,
      name: String(data['name'] ?? ''),
      domain: String(data['domain'] ?? ''),
      createdAt: toIso(data['createdAt']),
    }
  })
  res.status(200).json(sites)
}

export async function handleCreateSite(
  req: IncomingReq,
  res: OutgoingRes,
  verifyToken?: TokenVerifier,
): Promise<void> {
  const uid = await requireOwner(req, res, verifyToken)
  if (!uid) return

  const validation = validateCreateBody(req.body)
  if (!validation.ok) {
    res.status(400).json({ error: validation.error })
    return
  }

  const db = getFirestore()
  const docRef = await db.collection('sites').add({
    name: validation.name,
    domain: validation.domain,
    createdAt: FieldValue.serverTimestamp(),
  })
  const created = await docRef.get()
  const data = created.data() ?? {}
  const site: Site = {
    id: docRef.id,
    name: validation.name,
    domain: validation.domain,
    createdAt: toIso(data['createdAt']),
  }
  res.status(201).json(site)
}
