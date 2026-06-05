import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchSites = vi.fn();
const mockListQrCodes = vi.fn();

vi.mock('$lib/api.js', () => ({
	fetchSites: (...args: unknown[]) => mockFetchSites(...args),
	listQrCodes: (...args: unknown[]) => mockListQrCodes(...args)
}));

vi.mock('@sveltejs/kit', () => ({
	error: (status: number, message: string) => {
		throw { status, message };
	}
}));

const { load } = await import('./+page.js');

const SITE = {
	id: 'site-42',
	name: 'My Blog',
	domain: 'blog.example.com',
	createdAt: '2024-01-01'
};
const QR_CODES = [
	{
		id: 'qr-1',
		siteId: 'site-42',
		name: 'Flyer',
		targetUrl: 'https://blog.example.com',
		trackingUrl: 'https://blog.example.com/?utm_source=qr&utm_medium=qr&utm_campaign=Flyer',
		createdAt: '2024-03-15T10:00:00Z'
	}
];

describe('/dashboard/[siteId]/qr load', () => {
	beforeEach(() => vi.clearAllMocks());

	it('AC-03-06: returns siteId, siteName and qrCodes for a known site', async () => {
		mockFetchSites.mockResolvedValueOnce([SITE]);
		mockListQrCodes.mockResolvedValueOnce(QR_CODES);

		const result = await load({ params: { siteId: 'site-42' } } as never);

		const data = result as { siteId: string; siteName: string; qrCodes: unknown[] };
		expect(data).toMatchObject({ siteId: 'site-42', siteName: 'My Blog' });
		expect(data.qrCodes).toEqual(QR_CODES);
		expect(mockListQrCodes).toHaveBeenCalledWith('site-42');
	});

	it('throws 404 when siteId is not found', async () => {
		mockFetchSites.mockResolvedValueOnce([SITE]);

		await expect(load({ params: { siteId: 'unknown' } } as never)).rejects.toMatchObject({
			status: 404
		});
	});
});
