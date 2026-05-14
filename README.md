# toms-stats

> Cookie-free, self-hosted web analytics for personal sites and apps.

[![CI](https://github.com/tom4u/toms-stats/actions/workflows/ci.yml/badge.svg)](https://github.com/tom4u/toms-stats/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Tom4U_toms-stats&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Tom4U_toms-stats)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![npm](https://img.shields.io/npm/v/@tom4u-stats/shared)](https://www.npmjs.com/org/tom4u)

---

## What is toms-stats?

toms-stats is a lightweight, privacy-first analytics platform that tracks page views, visitors, referrers,
and custom events for your own websites and apps, without cookies and without requiring a consent banner.

**Key properties:**

- Tracking without cookies, so no GDPR consent banner is required
- Visitor identity is derived from a daily-rotating hash; raw IP addresses are never stored
- Single-owner dashboard with Google sign-in access
- Self-hosted on Firebase (Firestore, Cloud Functions, and Hosting), compatible with the free Spark tier
- Built-in QR code manager that generates trackable links and records scan counts

---

## Features

| Feature | Status |
| --- | --- |
| Page view tracking | Planned |
| Unique visitor counting (cookie-free) | Planned |
| Referrer / UTM tracking | Planned |
| Browser / OS / device breakdown | Planned |
| Custom events | Planned |
| QR code manager | Planned |
| Google Auth (single owner) | Planned |
| SvelteKit dashboard | Planned |

---

## Architecture

```text
Your Sites/Apps  →  <script src="tracker.js">
                           │
                           ▼  POST /api/event
              Firebase Cloud Functions (tracker)
                           │  write (no raw IPs)
                           ▼
                        Firestore
                           │  read (owner only)
                           ▼
              Firebase Cloud Functions (stats API)
                           │
                           ▼
                  SvelteKit Dashboard  ←  Firebase Auth (Google)
                           │
                    Firebase Hosting
```

---

## Privacy

Visitor identification uses a server-side daily hash and sets no cookies:

```text
visitorHash = SHA-256(IP + UserAgent + YYYY-MM-DD + SERVER_SALT)
```

- The IP address is used only to derive the visitor hash and the country (GeoIP).
- The IP is **never written to Firestore**.
- The same visitor on the same calendar day produces the same hash.
- No cookie banner is required under the GDPR/ePrivacy Directive.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Language | TypeScript 6 (strict, no `any`) |
| Backend | Firebase Cloud Functions v2 (Node 20) |
| Database | Firestore |
| Auth | Firebase Auth (Google) |
| Frontend | SvelteKit 2 + Tailwind CSS 4 |
| Testing | Vitest 4 + Firebase Local Emulator Suite |
| E2E | Playwright |
| Components | Storybook 10 (Component Driven Design) |
| QR Codes | `qrcode` npm package |
| GeoIP | MaxMind GeoLite2 (optional) |

---

## Monorepo Layout

```text
toms-stats/
├── apps/
│   ├── tracker/        # Firebase Cloud Functions (tracking & stats API)
│   └── dashboard/      # SvelteKit dashboard
├── packages/
│   └── shared/         # @tom4u-stats/shared (TypeScript types, published to npm)
├── specs/              # Spec Driven Development (source of truth)
├── firebase.json
├── firestore.rules
└── package.json        # npm workspaces root
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project (Blaze plan required for Cloud Functions)

### 1. Clone and install

```bash
git clone https://github.com/tom4u/toms-stats.git
cd toms-stats
npm install
```

### 2. Firebase setup

```bash
npx firebase login
npx firebase use toms-stats          # or create: firebase projects:create toms-stats
npx firebase functions:secrets:set VISITOR_SALT
```

Enable in Firebase Console:

- Firestore (Native mode)
- Firebase Auth with the Google sign-in provider
- Firebase Hosting
- Cloud Functions

### 3. Update Firestore security rules

Replace `OWNER_UID` in [firestore.rules](firestore.rules) with your actual Firebase user UID.

### 4. Start local development

```bash
# Terminal 1: Firebase emulators
npx firebase emulators:start

# Terminal 2: Dashboard dev server
npm -w apps/dashboard run dev
```

Dashboard runs at `http://localhost:5173`. Emulator UI at `http://localhost:4000`.

---

## Development

### Commands

```bash
npm install                               # install all workspace deps
npm test                                  # run all tests
npm run build                             # build all workspaces
npm run check                             # type-check all workspaces

# Tracker (Cloud Functions)
npm -w apps/tracker run build             # compile TypeScript → lib/
npm -w apps/tracker run test              # unit + integration tests

# Dashboard
npm -w apps/dashboard run dev             # dev server :5173
npm -w apps/dashboard run storybook       # Storybook :6006
npm -w apps/dashboard run build-storybook # build Storybook docs
npm -w apps/dashboard run test            # vitest (unit + component + storybook)
npm -w apps/dashboard run test:e2e        # Playwright E2E tests
npm -w apps/dashboard run check           # svelte-check + tsc
npm -w apps/dashboard run lint            # ESLint + Prettier check
```

### Development Principles

This project follows **Spec Driven Development** and **Test Driven Development**:

1. Feature starts with a spec in `specs/`
2. Tests are written against the acceptance criteria (failing)
3. Implementation makes the tests pass
4. Refactor if needed — tests stay green

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for the full workflow.

---

## npm Packages

The shared type definitions are published to npm under the `@tom4u-stats` organisation:

| Package                                              | Description                                                    |
|------------------------------------------------------|----------------------------------------------------------------|
| [`@tom4u-stats/shared`](packages/shared)             | TypeScript types shared across tracker and dashboard           |

---

## Documentation

- **Component library (Storybook):** [tom4u.github.io/toms-stats](https://tom4u.github.io/toms-stats)
- **Developer docs:** [GitHub Wiki](https://github.com/tom4u/toms-stats/wiki)
- **Specs:** [specs/](specs/)

---

## Contributing

See [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md). This is a personal project; issues and PRs are welcome,
though the scope is intentionally narrow and does not include SaaS features.

---

## License

[GNU General Public License v3.0](LICENSE) © 2026 Tom Ohms
