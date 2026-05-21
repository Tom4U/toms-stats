import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Control authStore value by mutating the mock's subscriber
// ---------------------------------------------------------------------------
let authStateCallback: ((u: unknown) => void) | null = null;

vi.mock('firebase/auth', () => ({
	getAuth: vi.fn(() => ({ currentUser: null })),
	GoogleAuthProvider: vi.fn(),
	onAuthStateChanged: vi.fn((_auth, cb: (u: unknown) => void) => {
		authStateCallback = cb;
		cb(null); // default: signed out
		return () => undefined;
	}),
	signOut: vi.fn(() => Promise.resolve())
}));

vi.mock('$lib/firebase-client.js', () => ({
	auth: { currentUser: null },
	googleProvider: {}
}));

vi.mock('@sveltejs/kit', () => ({
	redirect: (code: number, location: string) => {
		// Mirror SvelteKit: throw an object so callers catch it
		throw { status: code, location };
	}
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
const { load } = await import('./+layout.js');

describe('(protected) layout load', () => {
	beforeEach(() => vi.clearAllMocks());

	it('AC-02-01 / AC-04-01: redirects to /login when user is not authenticated', async () => {
		// authStateCallback was called with null (signed out) at import time
		let thrown: unknown;
		try {
			await load();
		} catch (e) {
			thrown = e;
		}
		expect(thrown).toMatchObject({ status: 302, location: '/login' });
	});

	it('AC-04-01: does not redirect when user is authenticated', async () => {
		// Push a user into the store before calling load
		authStateCallback?.({ uid: 'owner-uid-test', email: 'owner@example.com' });

		await expect(load()).resolves.not.toThrow();
	});
});
