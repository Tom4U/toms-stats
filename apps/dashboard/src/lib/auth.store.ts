import { writable } from 'svelte/store';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, googleProvider } from './firebase-client.js';

function createAuthStore() {
	const { subscribe, set } = writable<User | null>(null);

	onAuthStateChanged(auth, (user) => set(user));

	return {
		subscribe,
		signOut: (): Promise<void> => firebaseSignOut(auth)
	};
}

export const authStore = createAuthStore();

/** AC-04-02 — initiates Google OAuth popup; resolves once Firebase has the session. */
export async function signInWithGoogle(): Promise<void> {
	await signInWithPopup(auth, googleProvider);
}

/** Returns a fresh (or cached) ID token for the current user, or null if signed out. */
export async function getIdToken(): Promise<string | null> {
	return auth.currentUser?.getIdToken() ?? null;
}
