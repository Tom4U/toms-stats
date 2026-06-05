import { describe, it, expect, vi, beforeEach } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { QrCode } from '@tom4u-stats/shared';
import Page from './+page.svelte';

// ---------------------------------------------------------------------------
// Break the firebase-client dependency chain (NavBar → auth.store → firebase).
// ---------------------------------------------------------------------------
vi.mock('firebase/auth', () => ({
	getAuth: vi.fn(() => ({})),
	GoogleAuthProvider: vi.fn(),
	onAuthStateChanged: vi.fn((_auth: unknown, cb: (u: null) => void) => {
		cb(null);
		return () => undefined;
	}),
	signInWithPopup: vi.fn(),
	signOut: vi.fn()
}));

vi.mock('$lib/firebase-client.js', () => ({
	auth: {},
	googleProvider: {}
}));

// ---------------------------------------------------------------------------
// Mock API so tests never hit a real network.
// ---------------------------------------------------------------------------
const mockCreateQrCode = vi.fn();
const mockDeleteQrCode = vi.fn();

vi.mock('$lib/api.js', () => ({
	createQrCode: (...args: unknown[]) => mockCreateQrCode(...args),
	deleteQrCode: (...args: unknown[]) => mockDeleteQrCode(...args)
}));

const SITE_ID = 'site-42';
const EXISTING_QR: QrCode = {
	id: 'qr-existing',
	siteId: SITE_ID,
	name: 'Existing Flyer',
	targetUrl: 'https://blog.example.com',
	trackingUrl: 'https://blog.example.com/?utm_source=qr&utm_medium=qr&utm_campaign=Existing+Flyer',
	createdAt: '2024-03-01T00:00:00Z'
};
const NEW_QR: QrCode = {
	id: 'qr-new',
	siteId: SITE_ID,
	name: 'Summer Sale',
	targetUrl: 'https://shop.example.com',
	trackingUrl: 'https://shop.example.com/?utm_source=qr&utm_medium=qr&utm_campaign=Summer+Sale',
	createdAt: '2024-03-15T10:00:00Z'
};

const PAGE_DATA = { siteId: SITE_ID, siteName: 'My Blog', qrCodes: [EXISTING_QR] };

describe('AC-03-07 — QR page: create-flow adds card without page reload', () => {
	beforeEach(() => vi.clearAllMocks());

	it('submitting the form prepends a new QrCodeCard with a rendered QR image', async () => {
		mockCreateQrCode.mockResolvedValueOnce(NEW_QR);
		render(Page, { props: { data: PAGE_DATA } });

		// Fill the creation form.
		await page.getByPlaceholder('Name').fill('Summer Sale');
		await page.getByPlaceholder('Target URL (https://…)').fill('https://shop.example.com');
		await page.getByRole('button', { name: 'Create' }).click();

		// The new card heading should appear without a page reload.
		await expect.element(page.getByRole('heading', { name: 'Summer Sale' })).toBeVisible();

		// The QR image inside that card must have a data URL src (rendered client-side).
		const img = page.getByRole('img', { name: /QR code for Summer Sale/i });
		await expect
			.element(img)
			.toHaveAttribute('src', expect.stringContaining('data:image/png;base64,'));
	});
});
