# Spec 00 — System Overview

## Status: Approved

## Purpose

StatsLite is a personal, self-hosted web analytics platform. The owner embeds a small
JavaScript tracking snippet on their sites and apps. Events are collected by a Firebase
Cloud Functions API, stored in Firestore, and displayed on a SvelteKit dashboard.

## Goals

1. Track page views and unique visitors per site without cookies.
2. Show traffic sources (referrer / UTM parameters).
3. Show browser, OS, and device-type distributions.
4. Support custom events with optional key-value properties.
5. Provide a QR-code manager: generate a trackable QR code image for any URL.
6. Single owner — one Google account has full read/write access to the dashboard.
7. No cookie banner required (cookie-less, GDPR-compatible design).

## Non-Goals

- Multi-tenant support (other users managing their own sites).
- Real-time streaming / WebSocket push.
- High-traffic / high-availability infrastructure.
- Mobile app.
- Email reports.

## Bounded Scope

Expected load: < 10 000 events per day across all tracked sites combined.
No rate-limiting or sharding required at this scale.
Firestore free tier (1 GB storage, 50k reads/day, 20k writes/day) covers this.

## System Components

| Component          | Technology                  | Responsibility                                   |
|--------------------|-----------------------------|--------------------------------------------------|
| Tracking snippet   | Vanilla JS (< 2 KB)         | Fires events from the browser to the API         |
| Tracker API        | Firebase Cloud Functions v2 | Receives events, anonymises, writes to Firestore |
| Stats API          | Firebase Cloud Functions v2 | Reads aggregated stats (auth-protected)          |
| Dashboard          | SvelteKit + Tailwind        | Visualises stats, manages sites and QR codes     |
| Database           | Firestore                   | Stores events, sites, QR codes                   |
| Auth               | Firebase Auth (Google)      | Protects dashboard and stats API                 |
| Hosting            | Firebase Hosting            | Serves the dashboard SPA                         |

## Data Flow

### Tracking Flow

```text
User Browser
  │  loads page with <script src="https://stats.example.com/tracker.js">
  │
  ▼
Tracking Snippet
  │  POST https://europe-west3-[project].cloudfunctions.net/api/event
  │  Body: { siteId, type, url, referrer?, name?, props? }
  │  (no cookies, no fingerprinting on client side)
  │
  ▼
Cloud Function: trackEvent
  │  1. Validate payload
  │  2. Extract IP from X-Forwarded-For header
  │  3. Look up country via GeoIP (IP discarded after)
  │  4. Compute visitorHash = SHA-256(IP + UA + date + SALT)
  │  5. Compute sessionHash = SHA-256(IP + UA + hour + SALT)
  │  6. Parse UA string → browser, os, device
  │  7. Write event document to Firestore
  │  8. Return HTTP 204
```

### Dashboard Flow

```text
Owner opens dashboard
  │  Authenticates with Google via Firebase Auth
  │
  ▼
SvelteKit page fetches stats
  │  GET /api/stats?siteId=X&from=Y&to=Z&metric=M
  │  Authorization: Bearer <Firebase ID token>
  │
  ▼
Cloud Function: getStats
  │  Verifies ID token
  │  Queries Firestore
  │  Returns aggregated JSON
```

### QR Code Flow

```text
Owner creates QR code in dashboard
  │  POST /api/qr  { siteId, name, targetUrl, utmSource? }
  │
  ▼
Cloud Function: createQrCode
  │  Builds trackingUrl with utm_source=qr&utm_medium=qr&utm_campaign={name}
  │  Generates QR image (PNG, base64)
  │  Stores QR code document in Firestore
  │  Returns { id, trackingUrl, imageBase64 }
```

## Deployment Environments

| Environment | Firebase Project           | Notes                            |
|-------------|----------------------------|----------------------------------|
| Local dev   | Firebase Emulators         | All services emulated locally    |
| Production  | toms-stats                 | Real Firebase project            |

## Related Specs

- [01-tracking-api.md](01-tracking-api.md) — Tracker API endpoints and Firestore schema
- [02-dashboard.md](02-dashboard.md) — Dashboard routes, components, data display
- [03-qr-codes.md](03-qr-codes.md) — QR code creation and tracking
- [04-auth.md](04-auth.md) — Authentication and authorisation
