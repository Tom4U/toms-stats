import { createHash, randomUUID } from 'node:crypto'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import type { DeviceType, EventType } from '@tom4u-stats/shared'

// ---------------------------------------------------------------------------
// Minimal HTTP interfaces — satisfied by firebase-functions Request/Response
// and by the test MockResponse/makeReq objects.
// ---------------------------------------------------------------------------

interface IncomingReq {
  method: string
  body: unknown
  headers: Readonly<Record<string, string | string[] | undefined>>
  ip?: string
}

interface OutgoingRes {
  status(code: number): OutgoingRes
  json(data: unknown): void
  send(data?: unknown): void
  sendStatus(code: number): void
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

export function computeVisitorHash(ip: string, ua: string, salt: string, now: Date): string {
  const day = now.toISOString().slice(0, 10) // YYYY-MM-DD

  return sha256(ip + ua + day + salt)
}

export function computeSessionHash(ip: string, ua: string, salt: string, now: Date): string {
  const hour = now.toISOString().slice(0, 13) // YYYY-MM-DDTHH

  return sha256(ip + ua + hour + salt)
}

// ---------------------------------------------------------------------------
// UA parsing
// ---------------------------------------------------------------------------

interface ParsedUA {
  browser: string
  browserVersion: string
  os: string
  device: DeviceType
}

export function parseUserAgent(ua: string): ParsedUA {
  // Device — tablet must be checked before mobile
  let device: DeviceType = 'desktop'

  if (/tablet|ipad/i.test(ua))
    device = 'tablet'
  else if (/mobile|android|iphone|ipod|windows phone/i.test(ua))
    device = 'mobile'
  else if (!/mozilla|chrome|safari|firefox|edge|opera/i.test(ua))
    device = 'unknown'

  // OS
  let os = 'Unknown'
  if (/android/i.test(ua)) os = 'Android'
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS'
  else if (/windows/i.test(ua)) os = 'Windows'
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS'
  else if (/linux/i.test(ua)) os = 'Linux'

  // Browser — Edge and Opera must be checked before Chrome/Safari
  let browser = 'Unknown'
  let browserVersion = ''

  const matchers: Array<[RegExp, string]> = [
    [/Edg(?:e|)\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Version\/(\d+)(?:\.\d+)*\sSafari/, 'Safari'],
  ]

  for (const matcher of matchers) {
    const m = matcher[0].exec(ua)

    if (m) {
      browser = matcher[1]
      browserVersion = m[1] ?? ''
      break
    }
  }

  return { browser, browserVersion, os, device }
}

// ---------------------------------------------------------------------------
// URL extraction
// ---------------------------------------------------------------------------

interface UrlParts {
  path: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
}

function extractUrlParts(rawUrl: string): UrlParts {
  const parsed = new URL(rawUrl)
  const p = parsed.searchParams

  return {
    path: parsed.pathname,
    utmSource: p.get('utm_source') ?? '',
    utmMedium: p.get('utm_medium') ?? '',
    utmCampaign: p.get('utm_campaign') ?? '',
  }
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

function firstHeaderValue(value: string | string[] | undefined): string {
  if (!value) return ''

  return Array.isArray(value) ? (value[0] ?? '') : value
}

function getClientIp(req: IncomingReq): string {
  const fwd = firstHeaderValue(req.headers['x-forwarded-for'])

  if (fwd) return fwd.split(',')[0].trim()

  // When no IP is determinable, mix in a random token so each anonymous
  // request gets a unique hash instead of all aliasing to a single identity.
  return req.ip ?? randomUUID()
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface ValidPayload {
  siteId: string
  type: EventType
  url: string
  name: string
  referrer: string
  props: Record<string, string>
}

type ValidationResult = { ok: true; payload: ValidPayload } | { ok: false; error: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isEventType(v: unknown): v is EventType {
  return v === 'pageview' || v === 'custom'
}

type PropsResult = { ok: true; value: Record<string, string> } | { ok: false; error: string }

function validateProps(raw: unknown): PropsResult {
  if (!isRecord(raw))
    return { ok: false, error: 'props must be an object' }

  const entries = Object.entries(raw)

  if (entries.length > 10)
    return { ok: false, error: 'props must have at most 10 keys' }

  const result: Record<string, string> = {}

  for (const entry of entries) {
    const k = entry[0]
    const v = entry[1]

    if (k.length > 100)
      return { ok: false, error: 'prop key exceeds 100 characters' }

    if (typeof v !== 'string' || v.length > 100) {
      return { ok: false, error: `prop value for "${k}" must be a string of at most 100 characters` }
    }

    result[k] = v
  }

  return { ok: true, value: result }
}

function validateBody(body: unknown): ValidationResult {
  if (!isRecord(body)) {
    return { ok: false, error: 'Request body must be a JSON object' }
  }

  const { siteId, type, url, name, referrer, props } = body

  if (typeof siteId !== 'string' || siteId === '') {
    return { ok: false, error: 'siteId is required' }
  }

  if (!isEventType(type)) {
    return { ok: false, error: 'type must be "pageview" or "custom"' }
  }

  if (typeof url !== 'string' || url === '') {
    return { ok: false, error: 'url is required' }
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(url)
  } catch {
    return { ok: false, error: 'url must be a valid URL' }
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { ok: false, error: 'url must use http or https scheme' }
  }

  let resolvedName = 'pageview'

  if (type !== 'pageview') {
    if (typeof name !== 'string' || name === '') {
      return { ok: false, error: 'name is required for custom events' }
    }

    resolvedName = name
  }

  let resolvedProps: Record<string, string> = {}

  if (props != null) {
    const propsResult = validateProps(props)

    if (!propsResult.ok) return { ok: false, error: propsResult.error }

    resolvedProps = propsResult.value
  }

  return {
    ok: true,
    payload: {
      siteId,
      type,
      url,
      name: resolvedName,
      referrer: typeof referrer === 'string' ? referrer : '',
      props: resolvedProps,
    },
  }
}

// ---------------------------------------------------------------------------
// Handler — exported for direct unit-testing with injected `now`
// ---------------------------------------------------------------------------

export async function handleTrackEvent(
  req: IncomingReq,
  res: OutgoingRes,
  now: Date = new Date(),
  salt: string = process.env['VISITOR_SALT'] ?? '',
): Promise<void> {
  if (!salt) {
    res.status(500).json({ error: 'Server misconfiguration: VISITOR_SALT is not set' })

    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })

    return
  }

  const validation = validateBody(req.body)

  if (!validation.ok) {
    res.status(400).json({ error: validation.error })

    return
  }

  const { siteId, type, name, url, referrer, props } = validation.payload
  const db = getFirestore()
  const siteSnap = await db.collection('sites').doc(siteId).get()

  if (!siteSnap.exists) {
    res.status(404).json({ error: `Site "${siteId}" not found` })

    return
  }

  const ip = getClientIp(req)
  const ua = firstHeaderValue(req.headers['user-agent'])

  const visitorHash = computeVisitorHash(ip, ua, salt, now)
  const sessionHash = computeSessionHash(ip, ua, salt, now)
  const { browser, browserVersion, os, device } = parseUserAgent(ua)
  const { path, utmSource, utmMedium, utmCampaign } = extractUrlParts(url)

  await db.collection('events').add({
    siteId,
    type,
    name,
    url,
    path,
    referrer,
    utmSource,
    utmMedium,
    utmCampaign,
    browser,
    browserVersion,
    os,
    device,
    country: 'XX', // GeoIP optional — 'XX' until implemented
    visitorHash,
    sessionHash,
    timestamp: FieldValue.serverTimestamp(),
    props,
  })

  res.sendStatus(204)
}
