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

Feature status is derived from the spec acceptance criteria — see [`specs/`](specs/) for the full list and
[`.spec-audit-allowlist.json`](.spec-audit-allowlist.json) for ACs that are deliberately pending.

| Feature | Status | Spec |
| --- | --- | --- |
| `POST /api/event` tracking endpoint | Implemented | [01-tracking-api.md](specs/01-tracking-api.md) |
| Cookie-free unique-visitor hashing (daily + hourly session) | Implemented | [01-tracking-api.md](specs/01-tracking-api.md) |
| Referrer / UTM capture | Implemented | [01-tracking-api.md](specs/01-tracking-api.md) |
| Browser / OS / device classification from User-Agent | Implemented | [01-tracking-api.md](specs/01-tracking-api.md) |
| Custom events with key-value props (validation) | Implemented | [01-tracking-api.md](specs/01-tracking-api.md) |
| Stats query API (read side) | Implemented | [01-tracking-api.md](specs/01-tracking-api.md) |
| SvelteKit dashboard | Scaffolded; features pending | [02-dashboard.md](specs/02-dashboard.md) |
| QR code manager | Implemented | [03-qr-codes.md](specs/03-qr-codes.md) |
| Google Auth (single owner) | Implemented | [04-auth.md](specs/04-auth.md) |

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
| Backend | Firebase Cloud Functions v2 (Node 24) |
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
├── pnpm-workspace.yaml # pnpm workspaces root
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js >= 24
- pnpm >= 11 (`corepack enable` then `corepack prepare pnpm@11.5.1 --activate`)
- A Firebase project (Blaze plan required for Cloud Functions)

### 1. Clone and install

```bash
git clone https://github.com/tom4u/toms-stats.git
cd toms-stats
pnpm install
```

### 2. Firebase setup

```bash
pnpm exec firebase login
pnpm exec firebase use toms-stats          # or create: firebase projects:create toms-stats
pnpm exec firebase functions:secrets:set VISITOR_SALT
pnpm exec firebase functions:secrets:set OWNER_UID   # your Firebase user UID (auth)
```

Both secrets are declared in the `tracker` function (`onRequest({ secrets: [...] })`); if
`OWNER_UID` is unset at runtime, every auth-protected `/api/*` route fails closed with `500`.

Enable in Firebase Console:

- Firestore (Native mode)
- Firebase Auth with the Google sign-in provider
- Firebase Hosting
- Cloud Functions

#### Deploy provisioning (one-time, before the first CI deploy)

The first `deploy.yml` run (`deploy --only functions,firestore`) needs the `(default)`
Firestore database to exist and the CI deploy service account to hold a few IAM roles —
otherwise it fails with a cascade of `403`s. Run the following with the
[Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`) installed and
authenticated as a principal with Firestore + IAM-admin rights (`gcloud auth login`), or from
[Cloud Shell](https://shell.cloud.google.com). Derive `PROJECT` and `SA` from your own
environment — never commit concrete values:

```bash
PROJECT="$(gcloud config get-value project)"
# SA = the deploy service account's client_email (from your FIREBASE_SERVICE_ACCOUNT JSON):
#   jq -r .client_email < your-service-account.json
# or pick the Firebase admin SDK account from the project:
SA="$(gcloud iam service-accounts list --project "$PROJECT" --format='value(email)' | grep firebase-adminsdk)"

# (default) Firestore DB must exist — same region as the tracker function (europe-west3);
# enabling the API alone does not create it:
gcloud services enable firestore.googleapis.com --project "$PROJECT"
gcloud firestore databases create --location=europe-west3 --type=firestore-native --project "$PROJECT"

# Deploy-SA roles (the Firebase admin SDK SA already has the functions/auth roles):
#   secretmanager.admin — firebase-tools needs versions.get AND secrets.setIamPolicy,
#   not just secretAccessor.
gcloud secrets add-iam-policy-binding VISITOR_SALT --project "$PROJECT" --member "serviceAccount:$SA" --role roles/secretmanager.admin
gcloud secrets add-iam-policy-binding OWNER_UID    --project "$PROJECT" --member "serviceAccount:$SA" --role roles/secretmanager.admin
gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" --role roles/firebaserules.admin  # rules deploy
gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" --role roles/datastore.owner       # index deploy
```

### 3. Configure the owner UID for Firestore rules

[firestore.rules](firestore.rules) ships with an `__OWNER_UID__` placeholder so the real UID
is never committed to this public repo. The CI deploy (`deploy.yml`) substitutes it from the
`OWNER_UID` **GitHub Actions secret** before `firebase deploy`. Set it once:

```bash
gh secret set OWNER_UID --body "<your-firebase-uid>"
```

The placeholder is fine for this repo's local flows: tracker tests and the API go through the
Admin SDK / Cloud Functions, which bypass Firestore rules. (Note the Firestore emulator *does*
enforce these rules for direct client-SDK access, since `firebase.json` points it at
`firestore.rules` — so if you exercise client-SDK reads against the emulator, substitute a real
UID locally first.) If you deploy manually instead of via CI, replace `__OWNER_UID__` in a local
copy before deploying — do not commit it.

### 4. Start local development

```bash
# Terminal 1: Firebase emulators
pnpm exec firebase emulators:start

# Terminal 2: Dashboard dev server
pnpm --filter @tom4u-stats/dashboard run dev
```

Dashboard runs at `http://localhost:5173`. Emulator UI at `http://localhost:4000`.

---

## Development

### Commands

```bash
pnpm install                                              # install all workspace deps
pnpm test                                                 # run all tests
pnpm build                                                # build all workspaces
pnpm check                                                # type-check all workspaces

# Tracker (Cloud Functions)
pnpm --filter @tom4u-stats/tracker run build              # compile TypeScript → lib/
pnpm --filter @tom4u-stats/tracker run test               # unit + integration tests

# Dashboard
pnpm --filter @tom4u-stats/dashboard run dev              # dev server :5173
pnpm --filter @tom4u-stats/dashboard run storybook        # Storybook :6006
pnpm --filter @tom4u-stats/dashboard run build-storybook  # build Storybook docs
pnpm --filter @tom4u-stats/dashboard run test             # vitest (unit + component + storybook)
pnpm --filter @tom4u-stats/dashboard run test:e2e         # Playwright E2E tests
pnpm --filter @tom4u-stats/dashboard run check            # svelte-check + tsc
pnpm --filter @tom4u-stats/dashboard run lint             # ESLint + Prettier check
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
