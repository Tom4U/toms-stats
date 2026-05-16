import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import type {
  StatMetric,
  PageviewStatsResponse,
  LabelCountResponse,
  DailyPageviews,
  LabelCountItem,
} from '@tom4u-stats/shared'

// ---------------------------------------------------------------------------
// Minimal HTTP interfaces
// ---------------------------------------------------------------------------

type HeaderValue = string | string[] | undefined

interface IncomingReq {
  method: string
  query: Record<string, unknown>
  headers: Readonly<Record<string, HeaderValue>>
}

interface OutgoingRes {
  status(code: number): OutgoingRes
  json(data: unknown): void
  send(data?: unknown): void
  sendStatus(code: number): void
}

// ---------------------------------------------------------------------------
// Token verification — injectable for tests
// ---------------------------------------------------------------------------

export type TokenVerifier = (token: string) => Promise<string | null>

async function defaultVerifyToken(token: string): Promise<string | null> {
  try {
    const decoded = await getAuth().verifyIdToken(token)
    return decoded.uid /* v8 ignore next — success path requires a live Firebase project; tests inject a mock verifier */
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_METRICS = new Set<string>([
  'pageviews', 'visitors', 'referrers', 'browsers', 'devices', 'os', 'countries', 'customEvents',
])

function firstString(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

function firstHeaderValue(value: HeaderValue): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function daysBetween(from: string, to: string): number {
  const msPerDay = 86_400_000
  return (new Date(to).getTime() - new Date(from).getTime()) / msPerDay
}

function dateRange(from: string, to: string): string[] {
  const dates: string[] = []
  const current = new Date(from)
  const end = new Date(to)
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return dates
}

function toIsoDate(ts: unknown): string {
  if (ts instanceof Timestamp) return ts.toDate().toISOString().slice(0, 10)
  /* v8 ignore next 2 — Firestore always returns Timestamp; Date/empty fallbacks guard against raw writes in integration tests */
  if (ts instanceof Date) return ts.toISOString().slice(0, 10)
  return ''
}

// ---------------------------------------------------------------------------
// Query parameter validation
// ---------------------------------------------------------------------------

interface ValidParams {
  siteId: string
  from: string
  to: string
  metric: StatMetric
}

type ParamResult = { ok: true; params: ValidParams } | { ok: false; error: string }

function validateParams(query: Record<string, unknown>): ParamResult {
  const siteId = firstString(query['siteId'])
  const from = firstString(query['from'])
  const to = firstString(query['to'])
  const metric = firstString(query['metric'])

  if (!siteId) return { ok: false, error: 'siteId is required' }
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return { ok: false, error: 'from must be a date in YYYY-MM-DD format' }
  if (!to || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { ok: false, error: 'to must be a date in YYYY-MM-DD format' }
  if (to < from) return { ok: false, error: 'to must be >= from' }
  if (daysBetween(from, to) > 366) return { ok: false, error: 'date range must not exceed 366 days' }
  if (!VALID_METRICS.has(metric)) return { ok: false, error: `metric must be one of: ${[...VALID_METRICS].join(', ')}` }

  return { ok: true, params: { siteId, from, to, metric: metric as StatMetric } }
}

// ---------------------------------------------------------------------------
// Aggregation logic
// ---------------------------------------------------------------------------

interface EventDoc {
  siteId: string
  type: string
  name: string
  path: string
  referrer: string
  browser: string
  os: string
  device: string
  country: string
  visitorHash: string
  timestamp: unknown
  props: Record<string, string>
}

function buildPageviewsResponse(
  events: EventDoc[],
  dates: string[],
): PageviewStatsResponse {
  const byDate = new Map<string, { pageviews: number; visitors: Set<string> }>()
  for (const d of dates) byDate.set(d, { pageviews: 0, visitors: new Set() })

  for (const ev of events) {
    if (ev.type !== 'pageview') continue
    const date = toIsoDate(ev.timestamp)
    const entry = byDate.get(date)
    if (entry) {
      entry.pageviews++
      entry.visitors.add(ev.visitorHash)
    }
  }

  const data: DailyPageviews[] = dates.map(date => {
    const entry = byDate.get(date)
    return { date, pageviews: entry?.pageviews ?? 0, visitors: entry?.visitors.size ?? 0 }
  })

  const totals = data.reduce(
    (acc, d) => {
      acc.pageviews += d.pageviews
      acc.visitors += d.visitors
      return acc
    },
    { pageviews: 0, visitors: 0 },
  )

  // Unique visitor total must be computed across all events, not summed per day
  const allVisitors = new Set(events.filter(e => e.type === 'pageview').map(e => e.visitorHash))
  totals.visitors = allVisitors.size

  return { metric: 'pageviews', data, totals }
}

function buildLabelCountResponse(
  metric: Exclude<StatMetric, 'pageviews'>,
  events: EventDoc[],
): LabelCountResponse {
  const counts = new Map<string, number>()

  for (const ev of events) {
    let label: string

    switch (metric) {
      case 'visitors':
        // visitors as a standalone metric: one entry per distinct visitorHash
        label = ev.visitorHash
        break
      case 'referrers':
        label = ev.referrer ? new URL(ev.referrer).hostname : 'direct'
        break
      case 'browsers':
        label = ev.browser
        break
      case 'os':
        label = ev.os
        break
      case 'devices':
        label = ev.device
        break
      case 'countries':
        label = ev.country
        break
      case 'customEvents':
        if (ev.type !== 'custom') continue
        label = ev.name
        break
      default:
        continue /* v8 ignore next — exhaustive guard; TypeScript StatMetric union is fully handled above */
    }

    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  const data: LabelCountItem[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }))

  return { metric, data }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleGetStats(
  req: IncomingReq,
  res: OutgoingRes,
  verifyToken: TokenVerifier = defaultVerifyToken,
): Promise<void> {
  // Auth
  const authHeader = firstHeaderValue(req.headers['authorization'])
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }
  const token = authHeader.slice(7)
  const uid = await verifyToken(token)
  if (!uid) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  // Params
  const paramResult = validateParams(req.query)
  if (!paramResult.ok) {
    res.status(400).json({ error: paramResult.error })
    return
  }
  const { siteId, from, to, metric } = paramResult.params

  // Site existence
  const db = getFirestore()
  const siteSnap = await db.collection('sites').doc(siteId).get()
  if (!siteSnap.exists) {
    res.status(404).json({ error: `Site "${siteId}" not found` })
    return
  }

  // Fetch events in range
  const fromTs = Timestamp.fromDate(new Date(`${from}T00:00:00Z`))
  const toTs = Timestamp.fromDate(new Date(`${to}T23:59:59.999Z`))

  const snap = await db
    .collection('events')
    .where('siteId', '==', siteId)
    .where('timestamp', '>=', fromTs)
    .where('timestamp', '<=', toTs)
    .get()

  const events = snap.docs.map(doc => doc.data() as EventDoc)
  const dates = dateRange(from, to)

  if (metric === 'pageviews') {
    res.status(200).json(buildPageviewsResponse(events, dates))
  } else {
    res.status(200).json(buildLabelCountResponse(metric, events))
  }
}

// ---------------------------------------------------------------------------
// Firebase Cloud Function export
// ---------------------------------------------------------------------------

export const getStats = onRequest((req, res) => handleGetStats(req, res))
