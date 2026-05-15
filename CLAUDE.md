# toms-stats — Claude Code Guide

## Project

Personal, self-hosted web analytics platform (similar to Plausible Analytics).
Tracks page views, unique visitors, referrers, browser/device/OS, and custom events
for the owner's own sites and apps. Includes a QR-code manager for trackable links.
Single owner, low traffic (target: <10k events/day). Not a SaaS product.
Open source under GPL-3.0, published on GitHub (`tom4u/toms-stats`) and npm (`@tom4u-stats`).

## Architecture

```text
Owned Sites/Apps  →  tracking snippet (JS)
                         │
                         ▼ POST /api/event
              Firebase Cloud Functions (tracker)
                         │ write (no raw IPs)
                         ▼
                      Firestore
                         │ read (authenticated)
                         ▼
              Firebase Cloud Functions (stats API)
                         │
                         ▼
                  SvelteKit Dashboard  ←  Firebase Auth (Google)
                         │
                  Firebase Hosting
```

## Workspace Layout

```text
toms-stats/
├── CLAUDE.md
├── .claude/settings.json
├── .github/                         # GitHub Actions, templates, docs
│   ├── workflows/
│   │   ├── ci.yml                   # CI on feature branches and PRs
│   │   ├── deploy.yml               # Firebase deploy on main
│   │   ├── storybook-pages.yml      # Storybook → GitHub Pages
│   │   └── npm-publish.yml          # Publish @tom4u-stats/shared on tags
│   ├── CONTRIBUTING.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
├── specs/                           # Spec Driven Development — source of truth
│   ├── 00-overview.md
│   ├── 01-tracking-api.md
│   ├── 02-dashboard.md
│   ├── 03-qr-codes.md
│   └── 04-auth.md
├── apps/
│   ├── tracker/                     # Firebase Cloud Functions (TypeScript)
│   └── dashboard/                   # SvelteKit + Tailwind CSS + Storybook
├── packages/
│   └── shared/                      # @tom4u-stats/shared — shared TypeScript types
├── firebase.json
├── .firebaserc
├── firestore.rules
├── firestore.indexes.json
├── LICENSE
├── README.md
└── package.json                     # npm workspaces root
```

## Tech Stack

| Layer        | Technology                               |
|--------------|------------------------------------------|
| Language     | TypeScript 6 (strict, no `any`)          |
| Backend      | Firebase Cloud Functions v2 (Node 24)    |
| Database     | Firestore                                |
| Auth         | Firebase Auth — Google provider          |
| Frontend     | SvelteKit 2 + Tailwind CSS 4             |
| Testing      | Vitest 4 + Firebase Local Emulator Suite |
| E2E          | Playwright                               |
| Components   | Storybook 10 (Component Driven Design)   |
| QR Codes     | `qrcode` npm package                     |
| GeoIP        | MaxMind GeoLite2 (optional, local DB)    |
| CI/CD        | GitHub Actions                           |
| Hosting      | Firebase Hosting + GitHub Pages (docs)   |

## Development Principles

### Spec Driven Development (SDD)

- A feature does not exist until it has a spec in `specs/`.
- The spec defines acceptance criteria that map directly to tests.
- Before writing any implementation file, verify the spec exists and is complete.
- Changing a feature means updating the spec first.

**AC-ID format**: `AC-<spec-prefix>-<NN>` where `<spec-prefix>` is the two-digit prefix of the spec
filename and `<NN>` is the local AC number within that spec.

- `AC-01-03` — third AC in `specs/01-tracking-api.md`
- `AC-02-05` — fifth AC in `specs/02-dashboard.md`

Each AC is rendered in the spec as a heading with a bold ID, and test descriptions reference the AC-ID:

```ts
it('AC-01-03 — returns 404 for unknown siteId', () => { ... })
```

Legacy tests using the bare `AC-NN` format (no spec prefix) are accepted during migration — the
spec-audit script (CI) treats them as belonging to the spec mapped by file location
(e.g. `apps/tracker/**` → `01-tracking-api.md`). New tests must use the prefixed format.

### Test Driven Development (TDD)

1. Write a failing test that captures the acceptance criterion.
2. Write the minimum code to make it pass.
3. Refactor if needed (tests stay green).

Test categories:

- **Unit**: pure functions and data transformations — no Firebase dependency.
- **Integration**: Cloud Functions endpoints — run against the Firebase Emulator Suite only.
- **Component**: Svelte components in a real browser via Vitest + Playwright.
- **Storybook**: story interactions and a11y checks run via `@storybook/addon-vitest`.
- **E2E** (Playwright): critical dashboard paths.

Tests MUST use the local emulators. Never call real Firestore or Firebase Auth in tests.

### Component Driven Design (CDD)

- Every reusable UI component starts as a Storybook story before being wired into a page.
- Stories document props, states, and accessibility requirements.
- Stories live in `src/**/*.stories.svelte`.

### Clean Code

- One function, one responsibility.
- Exported functions have explicit return types.
- No `any`. No `// eslint-disable`.
- File length soft limit: ~200 lines — split if longer.
- No abstractions before the third use case.
- Comments only for non-obvious WHY (hidden constraints, workarounds) — never WHAT.

### Conventional Commits & Pre-commit Hooks

- All commits use the [Conventional Commits](https://www.conventionalcommits.org/) format.
- `commitlint` enforces the format via the `commit-msg` hook.
- `husky` installs hooks via the `prepare` script in root `package.json`.
- `lint-staged` runs ESLint and markdownlint on staged files (pre-commit).
- `scripts/check-test-coupling.mjs` blocks `feat:`/`fix:` commits that touch `apps/*/src` or
  `packages/*/src` without staging accompanying tests. Exempt types: `chore`, `docs`, `refactor`,
  `style`, `ci`, `build`, `test`, `perf`, `revert`.

### Git / GitHub Flow

- Branch from `main`: `feat/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`. Use `wip/<name>`
  for backup pushes that should not auto-open a PR.
- First push → open a **draft PR** immediately (`gh pr create --draft`).
- Subsequent pushes that add `feat:`/`fix:` content → update PR description
  (`gh pr edit --body ...`). Lint/refactor pushes do not require updates.
- Mark ready when complete (`gh pr ready <nr>`); CI must be green before merge.
- After every push, wait for all CI workflow runs to complete before continuing.
- Every PR references the spec acceptance criterion it fulfils (e.g. `Closes AC-01-03`).
- No direct pushes to `main`.
- Version bumps are owned by release-please — **do not** edit `version` fields manually.

## Commands

### Root

```bash
npm install               # install all workspace dependencies
npm test                  # run tests in all workspaces
npm run build             # build all workspaces
npm run check             # type-check all workspaces
```

### Firebase Emulators (required for integration tests)

```bash
npx firebase emulators:start                    # start all emulators
npx firebase emulators:exec "npm test"          # run tests inside emulator session
```

### Tracker (apps/tracker)

```bash
npm -w apps/tracker run build                   # compile TypeScript → lib/
npm -w apps/tracker run test                    # vitest (requires emulators)
npm -w apps/tracker run test:watch              # vitest watch mode
```

### Dashboard (apps/dashboard)

```bash
npm -w apps/dashboard run dev                   # SvelteKit dev server :5173
npm -w apps/dashboard run build                 # production build
npm -w apps/dashboard run test:unit             # vitest (unit + component + storybook)
npm -w apps/dashboard run test:e2e              # Playwright E2E
npm -w apps/dashboard run check                 # svelte-check + tsc
npm -w apps/dashboard run lint                  # ESLint + Prettier check
npm -w apps/dashboard run format                # auto-format with Prettier
```

### Storybook

```bash
npm -w apps/dashboard run storybook             # dev server :6006
npm -w apps/dashboard run build-storybook       # static build → storybook-static/
```

### Git (GitHub Flow)

```bash
git switch main && git pull                     # always start from latest main
git switch -c feat/<name>                       # cut a feature branch
git push -u origin feat/<name>                  # push and track remote
gh pr create --draft --fill                     # open draft PR (GitHub CLI)
gh pr edit <nr> --body "..."                    # update PR description after feat/fix push
gh pr ready <nr>                                # mark ready when complete
```

## Versioning & Releases

This monorepo uses [release-please](https://github.com/googleapis/release-please) to drive
Semantic Versioning from Conventional Commits.

| File | Purpose |
|------|---------|
| `release-please-config.json` | Per-component configuration (which packages, changelog sections, bootstrap SHA) |
| `.release-please-manifest.json` | Current version per component — release-please reads and updates this |
| `.github/workflows/release-please.yml` | Runs on every push to `main` |
| `CHANGELOG.md` (per package + root) | Populated by release-please |

On every push to `main`, release-please scans new conventional commits and opens (or updates) a
Release PR per component. Merging a Release PR creates the per-component git tag (e.g.
`shared-v0.2.0`, `tracker-v0.1.0`) and triggers downstream workflows. `npm-publish.yml` fires on
`shared-v*` tags to publish `@tom4u-stats/shared` to npm.

**Manual version bumps are forbidden.** Use commit types to drive versions:

- `feat:` → minor bump
- `fix:` → patch bump
- `feat!:` / `fix!:` / `BREAKING CHANGE:` footer → major bump
- `chore:` / `docs:` / `refactor:` / `style:` / `ci:` / `build:` / `test:` → no bump

Root `package.json` is included as the monorepo release anchor — its version drives the umbrella tag.

## Firebase Setup

Initialize the Firebase project once:

```bash
npx firebase login
npx firebase projects:create toms-stats
npx firebase use toms-stats
```

Enable in Firebase Console:

- Firestore (Native mode)
- Firebase Auth → Google sign-in provider
- Firebase Hosting
- Cloud Functions (Blaze plan required for Functions)

Set secrets:

```bash
npx firebase functions:secrets:set VISITOR_SALT
```

## Privacy & Cookie-Less Tracking

The tracking snippet sets **no cookies**. Unique visitor identification:

```text
visitorHash = SHA-256(IP + UserAgent + YYYY-MM-DD + SERVER_SALT)
```

- IP is used only to derive country (GeoIP) and the daily hash.
- IP is **never written to Firestore**.
- Same formula → same hash for the same visitor on the same calendar day.
- No cookie banner required under GDPR/ePrivacy Directive.

## Firestore Collections

| Collection  | Purpose                          |
|-------------|----------------------------------|
| `sites`     | Registered sites/apps            |
| `events`    | Tracking events (pageviews etc.) |
| `qr_codes`  | QR code definitions              |

Full schema → [specs/01-tracking-api.md](specs/01-tracking-api.md)

## Environment Variables / Secrets

| Variable       | Where            | Purpose                                |
|----------------|------------------|----------------------------------------|
| `VISITOR_SALT` | Functions secret | Salt for daily visitor hash            |
| `GEOIP_DB_PATH`| Functions config | Path to MaxMind GeoLite2 DB (optional) |

## Naming Conventions

| Artifact           | Convention           | Example                   |
|--------------------|----------------------|---------------------------|
| Files              | kebab-case           | `track-event.ts`          |
| Types / Interfaces | PascalCase           | `TrackingEvent`           |
| Functions          | camelCase            | `hashVisitor()`           |
| Firestore names    | snake_case           | `qr_codes`                |
| Test files         | `*.test.ts`          | `track-event.test.ts`     |
| Story files        | `*.stories.svelte`   | `Button.stories.svelte`   |

## GitHub Actions Secrets Required

| Secret                    | Used in           | How to obtain                                    |
|---------------------------|-------------------|--------------------------------------------------|
| `FIREBASE_SERVICE_ACCOUNT`| deploy.yml        | Firebase Console → Service accounts → JSON key   |
| `SONAR_TOKEN`             | ci.yml            | SonarCloud → My Account → Security → Tokens      |

`npm-publish.yml` uses npm Trusted Publishing (OIDC, no secret required) — configure the
`@tom4u-stats/shared` package on npmjs.com to trust this repository via GitHub Actions.

## NOSONAR Inventory

Suppressions are inline with a justification — no bare `// NOSONAR`, no UI-only "Mark Safe".

| Location | Rule (Sonar) | Justification |
|----------|--------------|---------------|
| `apps/tracker/src/emulator.global-setup.ts` `spawn('taskkill', …)` | PATH-resolution security hotspot | Test-setup only, Windows process-tree cleanup, no user input |
| `apps/tracker/src/emulator.global-setup.ts` `spawn('cmd.exe', …)` | PATH-resolution security hotspot | Test-only emulator launch, all args hardcoded |
| `apps/tracker/src/emulator.global-setup.ts` `spawn('npx', …)` (Unix) | PATH-resolution security hotspot | Test-only emulator launch, all args hardcoded |

When adding a new suppression, append a row to this table and use `// NOSONAR: <reason>` at the call site.

## Rules

- Do **not** store raw IP addresses in Firestore.
- Do **not** set cookies in the tracking snippet.
- Do **not** use `any` in TypeScript.
- Do **not** write implementation code before the spec exists.
- Do **not** write implementation code before the test exists (TDD).
- Do **not** call live Firebase services in tests — use emulators.
- Do **not** add features outside the current spec scope.
- Do **not** push directly to `main` — always use a PR.
- Do **not** edit `version` fields in any `package.json` — release-please owns versions.
- Do **not** bypass git hooks with `--no-verify` — fix the issue or use the correct commit type.
- Do **not** add `// NOSONAR` without a justification text after the colon.
