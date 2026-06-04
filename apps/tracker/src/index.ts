import { initializeApp, getApps } from 'firebase-admin/app'

if (getApps().length === 0) initializeApp()

// Cloud Function entry point.
// All /api/* routes are served by a single `tracker` router that dispatches to
// per-route handlers by method + path. See specs/01-tracking-api.md.
export { tracker } from './handlers/router.js'
