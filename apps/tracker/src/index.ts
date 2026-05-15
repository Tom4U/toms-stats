import { initializeApp, getApps } from 'firebase-admin/app'

if (getApps().length === 0) initializeApp()

// Cloud Function entry point.
// Each handler is implemented in its own file, spec-first, test-first.
// See specs/01-tracking-api.md for the full contract.
export { trackEvent } from './handlers/track-event.js'
