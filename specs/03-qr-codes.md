# Spec 03 — QR Code Manager

## Status: Draft

## Overview

The QR code manager allows the owner to generate QR codes that link to any URL.
Each QR code embeds UTM tracking parameters so that scans appear as a named traffic
source in the analytics dashboard, separate from organic web visits.

---

## Firestore Schema

### Collection: `qr_codes`

```text
/qr_codes/{qrId}
```

| Field         | Type      | Required | Notes                                      |
|---------------|-----------|----------|--------------------------------------------|
| `siteId`      | string    | yes      | The site this QR code belongs to           |
| `name`        | string    | yes      | Human label, e.g. "Flyer Campaign Q2 2024" |
| `targetUrl`   | string    | yes      | The final destination URL                  |
| `trackingUrl` | string    | yes      | `targetUrl` + UTM params appended          |
| `createdAt`   | Timestamp | yes      | Server timestamp                           |

UTM parameters appended to `trackingUrl`:

| UTM Param       | Value                                 |
|-----------------|---------------------------------------|
| `utm_source`    | `qr`                                  |
| `utm_medium`    | `qr`                                  |
| `utm_campaign`  | URL-encoded `name`                    |

---

## API Endpoints

### POST `/api/qr` — Create QR Code

Auth-protected.

#### Request

```json
{
  "siteId": "abc123",
  "name": "Flyer Campaign Q2",
  "targetUrl": "https://example.com/landing"
}
```

#### Validation

| Field      | Rule                              |
|------------|-----------------------------------|
| siteId     | non-empty, site must exist        |
| name       | non-empty, max 100 chars          |
| targetUrl  | valid `https://` URL              |

**Response `201 Created`**

```json
{
  "id": "qr_xyz",
  "siteId": "abc123",
  "name": "Flyer Campaign Q2",
  "targetUrl": "https://example.com/landing",
  "trackingUrl": "https://example.com/landing?utm_source=qr&utm_medium=qr&utm_campaign=Flyer+Campaign+Q2",
  "createdAt": "2024-03-15T10:00:00Z"
}
```

The response carries no image. The QR code is rendered client-side from `trackingUrl`
using the `qrcode` library (400×400 px), so `trackingUrl` is the single source of truth
and no PNG is persisted or transferred over the API.

### GET `/api/qr?siteId=abc123` — List QR Codes

Auth-protected. Returns all QR codes for a site, ordered by `createdAt` descending.

```json
[
  {
    "id": "qr_xyz",
    "siteId": "abc123",
    "name": "Flyer Campaign Q2",
    "targetUrl": "https://example.com/landing",
    "trackingUrl": "https://example.com/landing?utm_source=qr&...",
    "createdAt": "2024-03-15T10:00:00Z"
  }
]
```

Note: no image is returned by any endpoint. The client renders the QR code from
`trackingUrl` using the `qrcode` library in the browser.

### DELETE `/api/qr/:qrId` — Delete QR Code

Auth-protected. Deletes the QR code document. Returns `204 No Content`.

---

## Dashboard UI (`/dashboard/[siteId]/qr`)

### Layout

- "New QR Code" button → opens a creation form (inline or modal).
- List of existing QR codes as cards.

### Creation Form

Fields:

- Name (text input, required)
- Target URL (URL input, required)

On submit:

1. POST `/api/qr`
2. Show success state with the QR code image and a download button.
3. Append the new card to the list.

### QR Code Card

Displays:

- Name
- Target URL (truncated, links out)
- Tracking URL (truncated, copy-to-clipboard button)
- QR code image (rendered client-side from `trackingUrl`)
- "Download PNG" button
- "Delete" button (with confirmation)

### Download

Clicking "Download PNG" saves `{name}.png` to the user's downloads folder.
The image is generated client-side at 400×400 px using the `qrcode` npm package.

---

## Acceptance Criteria

### AC-01: QR code created with correct tracking URL

**Given** a POST to `/api/qr` with `name: "Summer Sale"` and `targetUrl: "https://shop.example.com"`
**When** the function creates the QR code
**Then** `trackingUrl` equals `"https://shop.example.com/?utm_source=qr&utm_medium=qr&utm_campaign=Summer+Sale"`.

(The tracking URL is composed with the WHATWG `URL`/`searchParams` API so existing query
parameters and fragments on `targetUrl` are preserved; `searchParams` form-encodes spaces as `+`.)

### AC-02: QR code image encodes the tracking URL

**Given** a QR code rendered in the dashboard
**When** the client generates the PNG from `trackingUrl` via the `qrcode` library and the QR data is read
**Then** the encoded string equals the `trackingUrl`.

### AC-03: Invalid targetUrl → 400

**Given** a POST with `targetUrl: "not-a-url"`
**When** the function validates
**Then** it returns HTTP 400.

### AC-04: QR code scans tracked as referrer

**Given** a user scans the QR code and visits the tracking URL
**When** the tracking snippet fires a pageview
**Then** the event has `utmSource: "qr"` and `utmCampaign: "<name>"`.

### AC-05: Delete removes the document

**Given** a DELETE `/api/qr/:qrId`
**When** the function runs
**Then** the document no longer exists in Firestore, and the endpoint returns 204.

### AC-06: List does not include imageBase64

**Given** existing QR codes in Firestore
**When** GET `/api/qr?siteId=X` is called
**Then** no item in the response array contains an `imageBase64` field.

### AC-07: UI shows QR code image after creation

**Given** the user submits the creation form with valid inputs
**When** the API call succeeds
**Then** the QR code image is visible in the UI without a page reload.
