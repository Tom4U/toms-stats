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

All `/api/*` routes are served by a **single Cloud Function named `tracker`** (matching the
`firebase.json` Hosting rewrite `/api/** → tracker`). The function dispatches to the correct
handler based on the request method and path. Unknown paths return `404`; a known path with
an unsupported method returns `405`.

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

Auth-protected. Creates a new site entry. `name` and `domain` are required, non-empty, and
stored trimmed. `domain` must be a bare host (no scheme, path/slash, or internal whitespace;
`example.com`, `sub.example.com`, `localhost`, optionally with `:port`).

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

### AC-10: Non-POST request → 405

**Given** a request with method `GET` (or any non-`POST`) to `/api/event`
**When** the function runs
**Then** it returns HTTP 405 with a descriptive `error` field.

### AC-11: Empty siteId → 400

**Given** a POST with `siteId: ""` (empty string)
**When** the function validates the payload
**Then** it returns HTTP 400 with a descriptive `error` field.

### AC-12: Invalid event type → 400

**Given** a POST with `type: "invalid"` (not `"pageview"` or `"custom"`)
**When** the function validates the payload
**Then** it returns HTTP 400 with a descriptive `error` field.

### AC-13: Malformed URL → 400

**Given** a POST with `url: "not-a-url"` (not parseable as a URL)
**When** the function validates the payload
**Then** it returns HTTP 400 with a descriptive `error` field.

### AC-14: Custom event requires name → 400

**Given** a POST with `type: "custom"` and no `name` field
**When** the function validates the payload
**Then** it returns HTTP 400 with a descriptive `error` field.

### AC-15: Custom event stored correctly

**Given** a valid POST with `type: "custom"`, `name: "signup_click"`, and `props: { plan: "pro" }`
**When** the function executes
**Then** the event document has `type: "custom"`, `name: "signup_click"`, and `props: { plan: "pro" }`.

### AC-16: Props exceed key limit → 400

**Given** a POST with `props` containing 11 keys
**When** the function validates the payload
**Then** it returns HTTP 400 with a descriptive `error` field.

### AC-17: Prop key too long → 400

**Given** a POST with a `props` key of 101 characters
**When** the function validates the payload
**Then** it returns HTTP 400 with a descriptive `error` field.

### AC-18: Prop value too long → 400

**Given** a POST with a `props` value of 101 characters
**When** the function validates the payload
**Then** it returns HTTP 400 with a descriptive `error` field.

### AC-19: sessionHash is consistent within the same hour and differs across hours

**Given** two requests from the same IP + User-Agent within the same clock hour
**When** both are processed
**Then** both event documents have identical `sessionHash` values.

**Given** two requests from the same IP + User-Agent in different clock hours
**When** both are processed
**Then** the event documents have different `sessionHash` values.

### AC-20: Mobile User-Agent → device = 'mobile'

**Given** a POST with a mobile browser User-Agent
**When** the function processes the request
**Then** the event document has `device: "mobile"`.

### AC-21: Tablet User-Agent → device = 'tablet'

**Given** a POST with a tablet browser User-Agent
**When** the function processes the request
**Then** the event document has `device: "tablet"`.

### AC-22: Firefox User-Agent → browser = 'Firefox'

**Given** a POST with a Firefox browser User-Agent
**When** the function processes the request
**Then** the event document has `browser: "Firefox"`.

### AC-23: macOS User-Agent → os = 'macOS'

**Given** a POST with a macOS browser User-Agent
**When** the function processes the request
**Then** the event document has `os: "macOS"`.

### AC-24: IP from req.ip when X-Forwarded-For is absent

**Given** a POST with no `X-Forwarded-For` header but a known `req.ip`
**When** the function processes the request
**Then** the visitorHash matches the hash computed from `req.ip`
(i.e., two identical requests both using `req.ip` produce the same hash).

### AC-25: Non-http/https URL scheme → 400

**Given** a POST with a `url` whose scheme is not `http` or `https` (e.g. `ftp://example.com/page`)
**When** the function validates the payload
**Then** it returns HTTP 400 with a descriptive `error` field.

### AC-26: Missing VISITOR_SALT → 500

**Given** the `VISITOR_SALT` environment variable is empty or not set
**When** the function receives any POST request
**Then** it returns HTTP 500 with a descriptive `error` field
(fail-fast: without a real salt, the privacy guarantee of AC-02/03/04 cannot be upheld).

### AC-27: Unknown IP → unique per-request visitorHash

**Given** two POST requests where neither `X-Forwarded-For` nor `req.ip` can be determined
**When** both requests are processed
**Then** the two event documents have **different** `visitorHash` values
(a random per-request token is mixed in so unknown-IP visitors do not share a single identity).

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

### AC-28: Router dispatches POST /api/event to the track-event handler

**Given** a valid `POST /api/event` request routed through the `tracker` function
**When** the router runs
**Then** the track-event handler is invoked and the response is HTTP 204.

### AC-29: Router dispatches GET /api/stats to the stats handler

**Given** a `GET /api/stats` request with valid owner authentication routed through `tracker`
**When** the router runs
**Then** the stats handler is invoked and the response is HTTP 200.

### AC-30: Unknown path → 404

**Given** a request to a path not in the dispatch table (e.g. `GET /api/unknown`)
**When** the router runs
**Then** it returns HTTP 404.

### AC-31: Known path, wrong method → 405

**Given** a request to a known path with an unsupported method (e.g. `DELETE /api/event`)
**When** the router runs
**Then** it returns HTTP 405.

### AC-32: GET /api/sites requires auth

**Given** a `GET /api/sites` request with a missing or malformed `Authorization` header,
an invalid Bearer token, or a token whose uid is not the owner
**When** the function runs
**Then** it returns HTTP 401 for the missing/malformed header and invalid token cases, and
HTTP 403 when the token belongs to a non-owner uid.

### AC-33: GET /api/sites returns all registered sites

**Given** registered site documents in the `sites` collection and a valid owner token
**When** `GET /api/sites` is called
**Then** it returns HTTP 200 with a JSON array of `Site` objects, each shaped
`{ id, name, domain, createdAt }` with `createdAt` an ISO-8601 string, ordered by
`createdAt` ascending.

### AC-34: POST /api/sites requires auth

**Given** a `POST /api/sites` request with a missing or malformed `Authorization` header,
an invalid Bearer token, or a non-owner uid
**When** the function runs
**Then** it returns HTTP 401 for the missing/malformed header and invalid token cases, and
HTTP 403 when the token belongs to a non-owner uid.

### AC-35: POST /api/sites creates a site

**Given** a valid owner token and a body `{ "name": "...", "domain": "..." }`
**When** `POST /api/sites` is called
**Then** exactly one new document is created in the `sites` collection with a
server-generated id and `createdAt`, and the response is HTTP 201 with the created `Site`.

### AC-36: POST /api/sites with invalid payload → 400

**Given** a valid owner token and a body missing `name` or `domain`, or with either as an
empty string
**When** `POST /api/sites` is called
**Then** it returns HTTP 400 with a descriptive `error` field and creates no document.

### AC-37: Non-GET/POST method on /api/sites → 405

**Given** a request to `/api/sites` with a method other than `GET` or `POST` (e.g. `PUT`)
**When** the router runs
**Then** it returns HTTP 405.

### AC-38: POST /api/sites with malformed domain → 400

**Given** a valid owner token and a body whose `domain` is not a bare host — it contains a
URL scheme (`http://`), a path or slash (`/`), or any internal whitespace
**When** `POST /api/sites` is called
**Then** it returns HTTP 400 with a descriptive `error` field and creates no document.
A bare host (`example.com`, `sub.example.com`, `localhost`, optionally with a `:port`) is
accepted.
