import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Firebase so tests run without a real Firebase project
// ---------------------------------------------------------------------------
vi.mock('firebase/auth', () => ({
	getAuth: vi.fn(() => ({ currentUser: null })),
	GoogleAuthProvider: vi.fn(),
	onAuthStateChanged: vi.fn((_auth, cb: (u: unknown) => void) => {
		cb(null);
		return () => undefined;
	}),
	signInWithPopup: vi.fn(() => Promise.resolve({ user: { uid: 'owner-uid-test' } })),
	signOut: vi.fn(() => Promise.resolve())
}));

vi.mock('$lib/firebase-client.js', () => ({
	auth: { currentUser: null },
	googleProvider: {}
}));

// ---------------------------------------------------------------------------
// Import after mocks are registered
// ---------------------------------------------------------------------------
const { authStore, getIdToken, signInWithGoogle } = await import('./auth.store.js');

// ---------------------------------------------------------------------------
// AC-04-05: sign-out clears session
// ---------------------------------------------------------------------------
describe('authStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('AC-04-02: signInWithGoogle invokes firebase signInWithPopup with the Google provider', async () => {
		const { signInWithPopup } = await import('firebase/auth');
		await signInWithGoogle();
		expect(signInWithPopup).toHaveBeenCalledOnce();
	});

	it('AC-04-05: signOut calls firebase signOut', async () => {
		const { signOut } = await import('firebase/auth');
		await authStore.signOut();
		expect(signOut).toHaveBeenCalledOnce();
	});

	it('AC-04-07: getIdToken returns null when no current user', async () => {
		const token = await getIdToken();
		expect(token).toBeNull();
	});
});
