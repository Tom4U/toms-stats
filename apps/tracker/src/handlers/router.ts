import { onRequest } from 'firebase-functions/v2/https'
import { handleTrackEvent } from './track-event.js'
import { handleGetStats, type TokenVerifier } from './get-stats.js'

// ---------------------------------------------------------------------------
// Single entry point for all /api/* routes (see specs/01-tracking-api.md).
// firebase.json rewrites /api/** to this `tracker` function, which dispatches
// to the correct handler by method + path.
// ---------------------------------------------------------------------------

const TRACKER_REGION = 'europe-west3' as const

// Superset request shape: structurally compatible with both handlers'
// narrower IncomingReq interfaces (track-event needs body/ip, stats needs query).
interface RouterReq {
  method: string
  path: string
  body: unknown
  query: Record<string, unknown>
  headers: Readonly<Record<string, string | string[] | undefined>>
  ip?: string
}

interface OutgoingRes {
  status(code: number): OutgoingRes
  json(data: unknown): void
  send(data?: unknown): void
  sendStatus(code: number): void
}

function normalizePath(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

export async function routeRequest(
  req: RouterReq,
  res: OutgoingRes,
  verifyToken?: TokenVerifier,
): Promise<void> {
  const path = normalizePath(req.path)

  if (path === '/api/event') {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    await handleTrackEvent(req, res)
    return
  }

  if (path === '/api/stats') {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    // defaultVerifyToken is module-private in get-stats; let the handler apply
    // its own default when no verifier is injected.
    if (verifyToken) {
      await handleGetStats(req, res, verifyToken)
    } else {
      await handleGetStats(req, res)
    }
    return
  }

  res.status(404).json({ error: 'Not found' })
}

export const tracker = onRequest({ region: TRACKER_REGION }, (req, res) => routeRequest(req, res))
