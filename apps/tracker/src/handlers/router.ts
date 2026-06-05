import { onRequest } from 'firebase-functions/v2/https'
import { handleTrackEvent } from './track-event.js'
import { handleGetStats } from './get-stats.js'
import { handleGetSites, handleCreateSite } from './sites.js'
import { handleCreateQrCode, handleListQrCodes, handleDeleteQrCode } from './qr.js'
import { type TokenVerifier } from './auth.js'

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

function methodNotAllowed(res: OutgoingRes): void {
  res.status(405).json({ error: 'Method not allowed' })
}

async function routeEvent(req: RouterReq, res: OutgoingRes): Promise<void> {
  if (req.method !== 'POST') { methodNotAllowed(res); return }
  await handleTrackEvent(req, res)
}

async function routeStats(req: RouterReq, res: OutgoingRes, verifyToken?: TokenVerifier): Promise<void> {
  if (req.method !== 'GET') { methodNotAllowed(res); return }
  // defaultVerifyToken is module-private in get-stats; let the handler apply
  // its own default when no verifier is injected.
  if (verifyToken) {
    await handleGetStats(req, res, verifyToken)
  } else {
    await handleGetStats(req, res)
  }
}

async function routeSites(req: RouterReq, res: OutgoingRes, verifyToken?: TokenVerifier): Promise<void> {
  if (req.method === 'GET') { await handleGetSites(req, res, verifyToken); return }
  if (req.method === 'POST') { await handleCreateSite(req, res, verifyToken); return }
  methodNotAllowed(res)
}

async function routeQr(req: RouterReq, res: OutgoingRes, verifyToken?: TokenVerifier): Promise<void> {
  if (req.method === 'POST') { await handleCreateQrCode(req, res, verifyToken); return }
  if (req.method === 'GET') { await handleListQrCodes(req, res, verifyToken); return }
  methodNotAllowed(res)
}

export async function routeRequest(
  req: RouterReq,
  res: OutgoingRes,
  verifyToken?: TokenVerifier,
): Promise<void> {
  const path = normalizePath(req.path)

  if (path === '/api/event') { await routeEvent(req, res); return }
  if (path === '/api/stats') { await routeStats(req, res, verifyToken); return }
  if (path === '/api/sites') { await routeSites(req, res, verifyToken); return }
  if (path === '/api/qr') { await routeQr(req, res, verifyToken); return }

  // The dispatcher owns path parsing; handlers receive a plain qrId value, so
  // their IncomingReq interfaces stay free of framework-specific route params.
  const qrIdMatch = /^\/api\/qr\/([^/]+)$/.exec(path)
  if (qrIdMatch) {
    if (req.method === 'DELETE') {
      await handleDeleteQrCode(req, res, qrIdMatch[1] ?? '', verifyToken)
      return
    }
    methodNotAllowed(res)
    return
  }

  res.status(404).json({ error: 'Not found' })
}

// v2 secrets must be declared here or Firebase will not inject them into
// process.env at runtime — get-stats/sites read OWNER_UID, track-event reads
// VISITOR_SALT. Missing declaration → fail-closed 500 on every protected route.
const TRACKER_SECRETS = ['VISITOR_SALT', 'OWNER_UID'] as const

export const tracker = onRequest(
  { region: TRACKER_REGION, secrets: [...TRACKER_SECRETS] },
  (req, res) => routeRequest(req, res),
)
