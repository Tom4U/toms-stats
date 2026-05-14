export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown'
export type EventType = 'pageview' | 'custom'

export interface Site {
  id: string
  name: string
  domain: string
  createdAt: string // ISO 8601
}

export interface TrackingEvent {
  id: string
  siteId: string
  type: EventType
  name: string
  url: string
  path: string
  referrer: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  browser: string
  browserVersion: string
  os: string
  device: DeviceType
  country: string
  visitorHash: string
  sessionHash: string
  timestamp: string // ISO 8601
  props: Record<string, string>
}

export interface QrCode {
  id: string
  siteId: string
  name: string
  targetUrl: string
  trackingUrl: string
  createdAt: string // ISO 8601
}

// API payloads

export interface TrackEventPayload {
  siteId: string
  type: EventType
  name?: string
  url: string
  referrer?: string
  props?: Record<string, string>
}

export interface CreateSitePayload {
  name: string
  domain: string
}

export interface CreateQrCodePayload {
  siteId: string
  name: string
  targetUrl: string
}

// Stats API

export type StatMetric =
  | 'pageviews'
  | 'visitors'
  | 'referrers'
  | 'browsers'
  | 'devices'
  | 'os'
  | 'countries'
  | 'customEvents'

export interface StatsQuery {
  siteId: string
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD
  metric: StatMetric
}

export interface DailyPageviews {
  date: string // YYYY-MM-DD
  pageviews: number
  visitors: number
}

export interface PageviewStatsResponse {
  metric: 'pageviews'
  data: DailyPageviews[]
  totals: { pageviews: number; visitors: number }
}

export interface LabelCountItem {
  label: string
  count: number
}

export interface LabelCountResponse {
  metric: Exclude<StatMetric, 'pageviews'>
  data: LabelCountItem[]
}

export type StatsResponse = PageviewStatsResponse | LabelCountResponse
