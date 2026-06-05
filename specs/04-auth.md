# Spec 04 — Authentication & Authorisation

## Status: Active

## Overview

StatsLite uses Firebase Authentication with the Google provider.
There is exactly one authorised owner. All dashboard routes and stats/management API
endpoints require a valid Firebase ID token belonging to the owner's Google account.

The tracking event endpoint (`POST /api/event`) is intentionally **public** — it must
be callable from any website without authentication.

---

## Auth Flow

### Sign-In

1. User navigates to `/login`.
2. Clicks "Sign in with Google".
3. Firebase Auth popup/redirect completes OAuth with Google.
4. Firebase SDK stores the session (IndexedDB / localStorage — managed by Firebase).
5. SvelteKit auth store updates; user is redirected to `/dashboard`.

### Session Persistence

Firebase Auth persists sessions in the browser. The user stays signed in across
tab closures and browser restarts until they explicitly sign out.

### Sign-Out

1. User clicks "Sign out" in the NavBar.
2. `auth.signOut()` is called.
3. Auth store clears; SvelteKit redirects to `/login`.

### API Authorisation

For every protected API call the client:

1. Calls `auth.currentUser.getIdToken()` to get a fresh (or cached) ID token.
2. Sends the token as `Authorization: Bearer <token>` header.

Cloud Functions verify the token with `admin.auth().verifyIdToken(token)` and check
that the decoded UID matches the configured owner UID.

---

## Owner UID Configuration

The owner's Firebase UID is provided to the `tracker` function as a Firebase Functions
**v2 secret**:

```text
OWNER_UID = "<firebase-uid-from-console>"
```

Set via: `npx firebase functions:secrets:set OWNER_UID`

A v2 secret is only injected into `process.env` if the function **declares** it in its
`onRequest({ secrets: [...] })` options. The `tracker` function therefore declares every
secret it needs (`VISITOR_SALT`, `OWNER_UID`); omitting the declaration means the secret is
unset at runtime and every auth-protected route fails closed with `500` (see AC-08).

Any request whose token UID ≠ `OWNER_UID` receives `403 Forbidden`. If `OWNER_UID` is unset,
the route fails closed with `500` rather than authorising an arbitrary signed-in account.

---

## Firestore Security Rules

Firestore rules enforce the same constraint at the database layer:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Only the owner can read/write anything
    match /{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == '__OWNER_UID__';
    }
  }
}
```

`firestore.rules` is committed with the `__OWNER_UID__` placeholder so the real UID is never
checked into this public repo. The CI deploy (`deploy.yml`) substitutes it from the
`OWNER_UID` GitHub Actions secret (same value as the Functions secret) before
`firebase deploy --only functions,firestore`; the deploy fails closed if the secret is unset
or the placeholder is missing (see AC-09). Locally the placeholder is left as-is: tracker tests
and the API use the Admin SDK / Cloud Functions, which bypass rules. (The Firestore emulator
*does* enforce these rules for direct client-SDK access — `firebase.json` points it at
`firestore.rules` — so client-SDK reads against the emulator need a real UID substituted first.)

---

## Route Protection (SvelteKit)

A SvelteKit layout server load function (`+layout.server.ts`) checks auth state
on every protected route group. If not authenticated, it issues a `redirect(302, '/login')`.

```text
src/
  routes/
    (protected)/         ← route group requiring auth
      +layout.server.ts  ← auth guard
      dashboard/
        ...
    login/
      +page.svelte       ← public
```

---

## Acceptance Criteria

### AC-01: Unauthenticated dashboard access is blocked

**Given** a user with no Firebase session
**When** they navigate to `/dashboard`
**Then** they are redirected to `/login`.

### AC-02: Protected API rejects missing token

**Given** a request to any auth-protected `/api/*` route (`/api/stats`, `/api/sites`) with no
`Authorization` header
**Then** the function returns `401 Unauthorized`.

### AC-03: Protected API rejects non-owner token

**Given** a valid Firebase ID token for a UID that is not the `OWNER_UID`
**When** used on any auth-protected `/api/*` route
**Then** the function returns `403 Forbidden`.

### AC-04: Protected API accepts owner token

**Given** a valid Firebase ID token for the `OWNER_UID`
**When** used on any auth-protected `/api/*` route
**Then** the function returns a `2xx` success with data.

### AC-05: Sign-out clears session

**Given** an authenticated user who clicks "Sign out"
**When** `auth.signOut()` resolves
**Then** `auth.currentUser` is `null` and the user is on `/login`.

### AC-06: Tracking endpoint is public

**Given** a POST to `/api/event` with no Authorization header
**When** the payload is otherwise valid
**Then** the function returns `204` (not `401`).

### AC-07: Token refresh is transparent

**Given** the user has been on the dashboard for more than 1 hour
**When** they interact with the dashboard
**Then** `getIdToken(true)` is called automatically and the API call succeeds.

### AC-08: tracker declares the secrets it reads at runtime

**Given** the deployed `tracker` function reads `OWNER_UID` (auth) and `VISITOR_SALT`
(visitor hashing) from `process.env`
**When** the function is defined via `onRequest`
**Then** its options declare those names in `secrets: [...]`, so Firebase injects the v2
secrets into `process.env` at runtime. (Without the declaration the secrets are unset and
every auth-protected route returns `500` — the production symptom this AC guards against.)

### AC-09: Firestore rules get the owner UID at deploy time, not from the repo

**Given** `firestore.rules` is committed with an `__OWNER_UID__` placeholder (no real UID in
the public repo)
**When** `deploy.yml` runs on a push to `main`
**Then** it substitutes `__OWNER_UID__` with the `OWNER_UID` GitHub Actions secret and deploys
`--only functions,firestore`; the job fails closed if the secret is empty or the placeholder
is absent, so the placeholder is never deployed as a literal rule.
