import { getAuth } from 'firebase-admin/auth'

// ---------------------------------------------------------------------------
// Shared auth: Bearer → verifyToken → OWNER_UID, fail-closed.
// Single owner of TokenVerifier/defaultVerifyToken for all /api/* handlers.
// ---------------------------------------------------------------------------

type HeaderValue = string | string[] | undefined

export interface OutgoingRes {
  status(code: number): OutgoingRes
  json(data: unknown): void
  send(data?: unknown): void
  sendStatus(code: number): void
}

interface AuthedReq {
  headers: Readonly<Record<string, HeaderValue>>
}

export type TokenVerifier = (token: string) => Promise<string | null>

export async function defaultVerifyToken(token: string): Promise<string | null> {
  try {
    const decoded = await getAuth().verifyIdToken(token)
    return decoded.uid /* v8 ignore next — success path requires a live Firebase project; tests inject a mock verifier */
  } catch {
    return null
  }
}

function firstHeaderValue(value: HeaderValue): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

/**
 * Resolves the request to the owner uid. On any failure, writes the error
 * response and returns null — callers do `if (!uid) return`.
 */
export async function requireOwner(
  req: AuthedReq,
  res: OutgoingRes,
  verifyToken: TokenVerifier = defaultVerifyToken,
): Promise<string | null> {
  const authHeader = firstHeaderValue(req.headers['authorization'])
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return null
  }
  const token = authHeader.slice(7)
  const uid = await verifyToken(token)
  if (!uid) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return null
  }
  // Fail-closed: a missing OWNER_UID would otherwise leave protected endpoints
  // open to any authenticated Google account.
  const ownerUid = process.env['OWNER_UID']
  if (!ownerUid) {
    console.error('OWNER_UID env var is not set — refusing to serve protected route')
    res.status(500).json({ error: 'Server misconfiguration' })
    return null
  }
  if (uid !== ownerUid) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }
  return uid
}
