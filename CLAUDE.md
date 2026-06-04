# toms-stats — Claude Code Guide

Personal, self-hosted, **cookie-free** web analytics for the owner's own sites. Tracks
pageviews, unique visitors, referrers, browser/device/OS, custom events; includes a QR-code
manager. Single owner, <10k events/day, not SaaS. GPL-3.0, GitHub `tom4u/toms-stats`,
npm `@tom4u-stats`.

Generic conventions (Conventional Commits, latest-versions, linters, SDD/TDD enforcement,
NOSONAR policy, backlog labels, docs-freshness, PR/CI/release workflow) live in the global
rules + the `pr-lifecycle` / `ci-watch` / `release-flow` skills. This file is **only** the
project-specific delta.

## Hard project rules

- **Never** store raw IP addresses in Firestore. IP is used only for GeoIP country + the
  daily visitor hash, never written.
- **Never** set cookies in the tracking snippet (no GDPR banner required).
- **No `any`**, no `// eslint-disable`. Exported functions have explicit return types.
- **SDD then TDD**: no implementation file without a complete spec in `specs/`; no code
  before a failing test. Tests use the **local emulators only** — never live Firestore/Auth.
- **Tests are immutable** — existing tests may only be modified when (a) the corresponding
  spec changed in the same PR, or (b) the PR body's "Test changes" section gives a documented
  domain reason. Modifying tests to make them pass is forbidden. Adding new tests is always allowed.
- No features outside current spec scope. Changing a feature = update its spec first.
- Every PR references its AC (e.g. `Closes AC-01-03`).
- File soft limit ~200 lines. No abstraction before the third use case. Comments = WHY only.

## Architecture

```text
site → JS snippet → POST /api/event → CF tracker (no raw IP) → Firestore →
CF stats API (auth) → SvelteKit dashboard (Firebase Auth/Google) → Firebase Hosting
```

## Stack

TypeScript 6 strict · Firebase Cloud Functions v2 (Node 24) · Firestore · Firebase Auth
(Google) · SvelteKit 2 + Tailwind 4 · Vitest 4 + Firebase Emulator Suite · Playwright ·
Storybook 10 · `qrcode` · MaxMind GeoLite2 (optional) · GitHub Actions · Firebase Hosting +
GitHub Pages.

## Layout

`apps/tracker` (CF, TS) · `apps/dashboard` (SvelteKit+Tailwind+Storybook) ·
`packages/shared` (`@tom4u-stats/shared` types) · `specs/00..04` (SDD source of truth) ·
`.github/workflows/` (ci, deploy, storybook-pages, npm-publish) ·
root npm-workspaces `package.json` · `firestore.rules` · `firestore.indexes.json`.

## SDD / AC-IDs

`AC-<spec-prefix>-<NN>` — prefix = spec filename's two-digit prefix
(`AC-01-03` = 3rd AC in `specs/01-tracking-api.md`). Test descriptions reference it:
`it('AC-01-03 — returns 404 for unknown siteId', …)`. Bare `AC-NN` legacy form accepted
during migration (mapped by file location); new tests use the prefixed form.
`.spec-audit-allowlist.json` lists pending ACs — each must have an open `spec-pending` issue;
shrink it as ACs gain tests.

Test categories: Unit (pure, no Firebase) · Integration (CF endpoints, emulator only) ·
Component (Svelte via Vitest+Playwright) · Storybook (`@storybook/addon-vitest` a11y) ·
E2E (Playwright critical paths). CDD: reusable UI starts as a `src/**/*.stories.svelte`
story before page wiring.

## Commands

```bash
npm install | npm test | npm run build | npm run check     # root, all workspaces
npx firebase emulators:start                                # required for integration tests
npx firebase emulators:exec "npm test"
npm -w apps/tracker run build|test|test:watch
npm -w apps/dashboard run dev|build|test:unit|test:e2e|check|lint|format
npm -w apps/dashboard run storybook|build-storybook
```

Pre-commit hooks: `husky` (via root `prepare`), `lint-staged` (ESLint+markdownlint),
`commitlint` (commit-msg), `scripts/check-test-coupling.mjs` (blocks feat/fix touching
`apps/*/src` or `packages/*/src` without staged tests; exempt: chore/docs/refactor/style/
ci/build/test/perf/revert).

## Privacy hash

`visitorHash = SHA-256(IP + UserAgent + YYYY-MM-DD + SERVER_SALT)` — same visitor, same
calendar day → same hash. IP never persisted.

## Firestore collections

`sites` (registered sites) · `events` (tracking events) · `qr_codes` (QR defs).
Full schema → `specs/01-tracking-api.md`.

## Secrets / env

| Var | Where | Purpose |
|---|---|---|
| `VISITOR_SALT` | Functions secret | daily visitor hash salt |
| `GEOIP_DB_PATH` | Functions config | MaxMind GeoLite2 path (optional) |
| `FIREBASE_SERVICE_ACCOUNT` | GH secret (deploy.yml) | Firebase Console → Service accounts → JSON |
| `SONAR_TOKEN` | GH secret (ci.yml) | SonarCloud → Account → Security → Tokens |

`npm-publish.yml` uses npm Trusted Publishing (OIDC, no secret).
One-time Firebase setup: `firebase login` → `projects:create toms-stats` → `use toms-stats`
→ Console enable Firestore(Native)/Auth(Google)/Hosting/Functions(Blaze) →
`firebase functions:secrets:set VISITOR_SALT`.

## Release-Flow

Versions are managed via [release-please](https://github.com/googleapis/release-please).
**No manual version bumps** — release-please owns all `version` fields.
Bump logic lives in the global `release-flow` skill; project-specific details:

- Tags per component: `shared-v*`, `tracker-v*`, `dashboard-v*`, `toms-stats-v*` (umbrella, root `package.json`)
- `npm-publish.yml` fires on `shared-v*` tags → publishes `@tom4u-stats/shared` via npm Trusted Publishing (OIDC)
- `deploy.yml` fires on push to `main` (paths-ignore: `**.md`, `specs/**`, `LICENSE`) → Firebase deploy

## Naming

Files kebab-case · Types PascalCase · Functions camelCase · Firestore snake_case ·
tests `*.test.ts` · stories `*.stories.svelte`.
