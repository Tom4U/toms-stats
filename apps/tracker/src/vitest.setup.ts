// Configure Firebase emulators before any test runs.
// Start emulators with: npx firebase emulators:start
process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080'
process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9099'
process.env['GCLOUD_PROJECT'] = 'toms-stats'
process.env['VISITOR_SALT'] = 'test-salt-do-not-use-in-production'
