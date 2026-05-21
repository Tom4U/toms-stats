import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchSites = vi.fn();

vi.mock('$lib/api.js', () => ({
	fetchSites: (...args: unknown[]) => mockFetchSites(...args)
}));

vi.mock('@sveltejs/kit', () => ({
	error: (status: number, message: string) => {
		throw { status, message };
	}
}));

const { load } = await import('./+page.js');

describe('/dashboard/[siteId] load', () => {
	beforeEach(() => vi.clearAllMocks());

	it('AC-02-03: returns siteId and siteName for a known site', async () => {
		mockFetchSites.mockResolvedValueOnce([
			{ id: 'site-42', name: 'My Blog', domain: 'blog.example.com', createdAt: '2024-01-01' }
		]);

		const result = await load({ params: { siteId: 'site-42' } } as never);

		expect(result).toMatchObject({ siteId: 'site-42', siteName: 'My Blog' });
	});

	it('throws 404 when siteId is not found', async () => {
		mockFetchSites.mockResolvedValueOnce([
			{ id: 'other-site', name: 'Other', domain: 'other.com', createdAt: '2024-01-01' }
		]);

		await expect(load({ params: { siteId: 'unknown' } } as never)).rejects.toMatchObject({
			status: 404
		});
	});
});
