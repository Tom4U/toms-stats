# Spec 02 — Dashboard

## Status: Draft

## Overview

The dashboard is a SvelteKit single-page application served from Firebase Hosting.
It is the only interface for the owner to view analytics and manage sites and QR codes.
Access is restricted to the authenticated Google account via Firebase Auth.

---

## Routes

| Route                    | Description                                |
|--------------------------|--------------------------------------------|
| `/`                      | Redirect to `/dashboard` or `/login`       |
| `/login`                 | Google sign-in page                        |
| `/dashboard`             | Default view: site list with quick stats   |
| `/dashboard/[siteId]`    | Full analytics for a site                  |
| `/dashboard/[siteId]/qr` | QR code manager for a site                 |
| `/sites/new`             | Register a new site                        |

All routes except `/login` require an authenticated session. Unauthenticated requests
are redirected to `/login`.

---

## Pages

### `/login`

- Displays a "Sign in with Google" button.
- On success, redirects to `/dashboard`.
- Shows an error message if sign-in fails.

### `/dashboard`

**Purpose:** Overview of all registered sites.

**Displays:**

- List of sites with: name, domain, total pageviews last 7 days, unique visitors last 7 days.
- "Add site" button → navigates to `/sites/new`.
- Click on a site → navigates to `/dashboard/[siteId]`.

**State:**

- Fetches site list from `/api/sites`.
- For each site, fetches 7-day summary from `/api/stats`.

### `/dashboard/[siteId]`

**Purpose:** Full analytics view for one site.

**Layout:**

- Date range picker (presets: Today, Last 7d, Last 30d, Last 90d, Custom).
- Metric tabs: Overview | Referrers | Browsers | Devices | OS | Countries | Custom Events.
- Top bar: total pageviews, unique visitors, bounce rate placeholder (future), avg. session length placeholder (future).

**Overview tab:**

- Line chart: pageviews and visitors per day over the selected range.
- Top pages table: path, pageviews, visitors.

**Referrers tab:**

- Table: referrer domain, count, percentage of total.
- Shows `direct` when referrer is empty.

**Browsers / OS / Devices / Countries tabs:**

- Horizontal bar chart + table: label, count, percentage.

**Custom Events tab:**

- Table: event name, count.
- Expandable rows showing `props` key-value distribution.

### `/dashboard/[siteId]/qr`

See [03-qr-codes.md](03-qr-codes.md).

### `/sites/new`

- Form: site name (text), domain (text).
- Validates: name non-empty, domain is a valid hostname.
- On submit: POST `/api/sites`, redirect to `/dashboard/[newSiteId]`.

---

## Components

| Component            | Responsibility                                        |
|----------------------|-------------------------------------------------------|
| `DateRangePicker`    | Emits `{ from, to }` ISO date strings                 |
| `MetricTabs`         | Tab bar for metric selection                          |
| `LineChart`          | Renders pageviews/visitors time series (Chart.js)     |
| `BarChart`           | Horizontal bar chart for distributions                |
| `StatsTable`         | Generic label/count/percent table                     |
| `SiteCard`           | Site summary card on the dashboard overview           |
| `TopPagesTable`      | Path, pageviews, visitors                             |
| `CustomEventTable`   | Event name, count, expandable props                   |
| `QrCodeCard`         | QR code image + metadata + download button            |
| `NavBar`             | Top navigation, user avatar, sign-out                 |
| `LoadingSpinner`     | Shown while data is fetching                          |
| `ErrorBanner`        | Shown when an API call fails                          |

---

## State Management

- Auth state is managed via the Firebase Auth SDK (reactive store).
- Page data is fetched on mount using SvelteKit `load` functions.
- No global state library needed at this scale — SvelteKit stores are sufficient.
- All API calls include the Firebase ID token from `auth.currentUser.getIdToken()`.

---

## Acceptance Criteria

### AC-01: Unauthenticated redirect

**Given** an unauthenticated user navigates to `/dashboard`
**Then** they are redirected to `/login`.

### AC-02: Site list loads

**Given** an authenticated user on `/dashboard`
**When** the page loads
**Then** all registered sites appear with name, domain, and 7-day pageview count.

### AC-03: Analytics page loads for a site

**Given** an authenticated user on `/dashboard/[siteId]`
**When** the page loads with the default "Last 7 days" range
**Then** the line chart is rendered with one data point per day, and the totals bar shows pageviews and visitors.

### AC-04: Date range changes trigger refetch

**Given** the user is on the analytics page
**When** they select "Last 30 days" from the date range picker
**Then** the API is called with `from` and `to` updated accordingly, and the chart re-renders.

### AC-05: Loading state shown during fetch

**Given** an API call is in flight
**Then** `LoadingSpinner` is visible and the chart area is not rendered.

### AC-06: Error state shown on API failure

**Given** the stats API returns a 5xx error
**Then** `ErrorBanner` is visible with a human-readable message.

### AC-07: Empty state

**Given** a site has no events
**Then** the dashboard shows a "No data yet" message and the tracking snippet instructions.

### AC-08: Sign out

**Given** the user clicks "Sign out" in the NavBar
**Then** they are signed out of Firebase Auth and redirected to `/login`.
