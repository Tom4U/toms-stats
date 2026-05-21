import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

type RequiredEnvVar =
	| 'VITE_FIREBASE_API_KEY'
	| 'VITE_FIREBASE_AUTH_DOMAIN'
	| 'VITE_FIREBASE_PROJECT_ID'
	| 'VITE_FIREBASE_STORAGE_BUCKET'
	| 'VITE_FIREBASE_MESSAGING_SENDER_ID'
	| 'VITE_FIREBASE_APP_ID';

function readEnv(name: RequiredEnvVar): string {
	const value = import.meta.env[name];
	if (typeof value !== 'string' || value.length === 0) {
		// Fail loudly at startup rather than letting Firebase throw a less actionable error later.
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

const firebaseConfig = {
	apiKey: readEnv('VITE_FIREBASE_API_KEY'),
	authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
	projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
	storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
	messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
	appId: readEnv('VITE_FIREBASE_APP_ID')
};

export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
