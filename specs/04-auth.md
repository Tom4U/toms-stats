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

The owner's Firebase UID is set as a Firebase Functions environment variable:

```text
OWNER_UID = "<firebase-uid-from-console>"
```

Set via: `npx firebase functions:config:set app.owner_uid="UID_HERE"` (legacy)
or via Firebase Functions secrets (v2): `npx firebase functions:secrets:set OWNER_UID`

Any request whose token UID ≠ `OWNER_UID` receives `403 Forbidden`.

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
                         && request.auth.uid == '<OWNER_UID>';
    }
  }
}
```

In production, replace `<OWNER_UID>` with the actual UID.
For the emulator, any authenticated user is allowed (emulator ignores rules by default).

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

### AC-02: Stats API rejects missing token

**Given** a GET to `/api/stats` with no `Authorization` header
**Then** the function returns `401 Unauthorized`.

### AC-03: Stats API rejects non-owner token

**Given** a valid Firebase ID token for a UID that is not the `OWNER_UID`
**When** used in a GET to `/api/stats`
**Then** the function returns `403 Forbidden`.

### AC-04: Stats API accepts owner token

**Given** a valid Firebase ID token for the `OWNER_UID`
**When** used in a GET to `/api/stats`
**Then** the function returns `200` with data.

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
