# Spec 01 — Tracking API

## Status: Draft

## Overview

The Tracking API is a set of Firebase Cloud Functions (HTTP) that receive tracking events
from the browser snippet, anonymise visitor data, and persist it to Firestore.
A separate group of authenticated endpoints serves aggregated statistics to the dashboard.

---

## Firestore Data Model

### Collection: `sites`

```text
/sites/{siteId}
```

| Field       | Type      | Required | Notes                        |
|-------------|-----------|----------|------------------------------|
| `name`      | string    | yes      | Human-readable name          |
| `domain`    | string    | yes      | e.g. `example.com`           |
| `createdAt` | Timestamp | yes      | Server timestamp             |

### Collection: `events`

```text
/events/{eventId}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `siteId`         | string                          | yes      | Reference to `/sites/{siteId}`                |
| `type`           | `'pageview'` \| `'custom'`      | yes      |                                               |
| `name`           | string                          | yes      | `'pageview'` or custom event name             |
| `url`            | string                          | yes      | Full URL including query string               |
| `path`           | string                          | yes      | URL path only (derived from `url`)            |
| `referrer`       | string                          | no       | Empty string if none                          |
| `utmSource`      | string                          | no       | Extracted from URL query params               |
| `utmMedium`      | string                          | no       |                                               |
| `utmCampaign`    | string                          | no       |                                               |
| `browser`        | string                          | yes      | e.g. `Chrome`                                 |
| `browserVersion` | string                          | yes      | e.g. `124`                                    |
| `os`             | string                          | yes      | e.g. `Windows`, `macOS`, `Android`            |
| `device`         | `'desktop'\|'mobile'\|'tablet'\|'unknown'` | yes |                                    |
| `country`        | string                          | yes      | ISO 3166-1 alpha-2 or `'XX'` if unknown       |
| `visitorHash`    | string                          | yes      | SHA-256(IP+UA+date+SALT) — daily rolling      |
| `sessionHash`    | string                          | yes      | SHA-256(IP+UA+hour+SALT) — hourly rolling     |
| `timestamp`      | Timestamp                       | yes      | Server timestamp                              |
| `props`          | `Record<string, string>`        | no       | Custom event properties                       |

**Privacy invariant:** No raw IP address is ever written to Firestore.

### Collection: `qr_codes`

See [03-qr-codes.md](03-qr-codes.md).

---

## Endpoints

### POST `/api/event` — Track Event

Receives a tracking event from the browser snippet. No authentication required.

#### Request

```http
POST /api/event
Content-Type: application/json
User-Agent: <browser UA>
```

```json
{
  "siteId": "abc123",
  "type": "pageview",
  "url": "https://example.com/about?utm_source=newsletter",
  "referrer": "https://google.com",
  "name": null,
  "props": {}
}
```

For custom events, `name` is required and `type` is `"custom"`:

```json
{
  "siteId": "abc123",
  "type": "custom",
  "name": "signup_button_click",
  "url": "https://example.com/pricing",
  "referrer": "",
  "props": { "plan": "pro" }
}
```

#### Validation Rules

| Field    | Rule                                                         |
|----------|--------------------------------------------------------------|
| siteId   | non-empty string, site must exist in Firestore               |
| type     | one of `pageview`, `custom`                                  |
| url      | valid URL (https only in production, http allowed in tests)  |
| name     | required if type is `custom`; ignored for `pageview`         |
| props    | max 10 keys, keys and values max 100 chars each              |

#### Response

- `204 No Content` — event accepted
- `400 Bad Request` — validation failure, JSON body `{ "error": "..." }`
- `404 Not Found` — siteId does not exist
- `405 Method Not Allowed` — non-POST request

#### Side effects

1. Extract IP from `X-Forwarded-For` (first address) or `req.ip`.
2. Derive country via GeoIP lookup (returns `'XX'` if DB not available).
3. Compute `visitorHash = sha256(ip + ua + isoDate + VISITOR_SALT)`.
4. Compute `sessionHash = sha256(ip + ua + isoHour + VISITOR_SALT)`.
5. Parse User-Agent → `browser`, `browserVersion`, `os`, `device`.
6. Extract `path` and UTM params from `url`.
7. Write one document to `/events/{auto-id}`.
8. **Do not store the IP.**

---

### GET `/api/stats` — Get Aggregated Statistics

Returns pre-aggregated stats for a site over a date range.
Requires a valid Firebase ID token in the `Authorization` header.

#### Request

```http
GET /api/stats?siteId=abc123&from=2024-01-01&to=2024-01-31&metric=pageviews
Authorization: Bearer <Firebase ID token>
```

#### Query Parameters

| Param | Required | Values |
| --- | --- | --- |
| siteId   | yes      | valid site ID                                               |
| from     | yes      | ISO date `YYYY-MM-DD`                                       |
| to       | yes      | ISO date `YYYY-MM-DD`, must be >= `from`, max 366 days span |
| metric   | yes      | `pageviews`, `visitors`, `referrers`, `browsers`, `devices`, `os`, `countries`, `customEvents` |

**Response: `metric=pageviews`**

```json
{
  "metric": "pageviews",
  "data": [
    { "date": "2024-01-01", "pageviews": 42, "visitors": 31 },
    { "date": "2024-01-02", "pageviews": 55, "visitors": 40 }
  ],
  "totals": { "pageviews": 97, "visitors": 71 }
}
```

**Response: `metric=referrers`**

```json
{
  "metric": "referrers",
  "data": [
    { "referrer": "google.com", "count": 28 },
    { "referrer": "direct", "count": 15 }
  ]
}
```

**Response: `metric=browsers` / `os` / `devices` / `countries`**

```json
{
  "metric": "browsers",
  "data": [
    { "label": "Chrome", "count": 60 },
    { "label": "Firefox", "count": 12 }
  ]
}
```

#### Error Responses

- `400` — invalid params
- `401` — missing or invalid ID token
- `404` — siteId not found

---

### POST `/api/sites` — Register a Site

Auth-protected. Creates a new site entry.

```json
{ "name": "My Blog", "domain": "myblog.example.com" }
```

Returns `201 Created` with `{ "id": "abc123", "name": "...", "domain": "..." }`.

---

### GET `/api/sites` — List Sites

Auth-protected. Returns all registered sites.

```json
[
  { "id": "abc123", "name": "My Blog", "domain": "myblog.example.com", "createdAt": "2024-01-01T00:00:00Z" }
]
```

---

## Acceptance Criteria

### AC-01: Pageview stored correctly

**Given** a valid POST to `/api/event` with `type: "pageview"`
**When** the function executes
**Then** exactly one document exists in `/events/` with the correct `siteId`, `type`, `path`,
`browser`, `os`, `device`, `country`, `visitorHash`, `sessionHash`, and no `ip` field.

### AC-02: No IP in Firestore

**Given** any POST to `/api/event`
**When** the function executes
**Then** no event document in Firestore contains a field named `ip` or `ipAddress` or any raw IP string.

### AC-03: Same visitor same day → same visitorHash

**Given** two requests from the same IP + User-Agent on the same calendar day
**When** both are processed
**Then** both event documents have identical `visitorHash` values.

### AC-04: Different day → different visitorHash

**Given** two requests from the same IP + User-Agent on different calendar days
**When** both are processed
**Then** the event documents have different `visitorHash` values.

### AC-05: Invalid siteId → 404

**Given** a POST with an unregistered `siteId`
**When** the function validates the payload
**Then** it returns HTTP 404.

### AC-06: Missing required field → 400

**Given** a POST with `url` missing
**When** the function validates the payload
**Then** it returns HTTP 400 with a descriptive `error` field.

### AC-07: Stats endpoint requires auth

**Given** a GET to `/api/stats` without an Authorization header
**When** the function runs
**Then** it returns HTTP 401.

### AC-08: Stats return correct pageview count

**Given** 5 pageview events for siteId `X` on `2024-03-15` in the emulator
**When** GET `/api/stats?siteId=X&from=2024-03-15&to=2024-03-15&metric=pageviews` is called with a valid token
**Then** the response contains `totals.pageviews = 5`.

### AC-09: Unique visitor count is based on distinct visitorHash values

**Given** 5 events with 3 distinct `visitorHash` values for the same siteId and date
**When** the stats endpoint is queried with `metric=pageviews`
**Then** `totals.visitors = 3`.
