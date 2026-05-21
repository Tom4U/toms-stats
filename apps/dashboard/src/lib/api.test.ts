import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock auth so getIdToken returns a fixed token
// ---------------------------------------------------------------------------
vi.mock('$lib/auth.store.js', () => ({
	getIdToken: vi.fn(() => Promise.resolve('test-token'))
}));

// ---------------------------------------------------------------------------
// Stub global fetch
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

// Import after mocks
const { fetchSites, createSite, fetchStats, dateRangePreset, isoDate } = await import('./api.js');

describe('dateRangePreset', () => {
	it('returns correct span for 7d', () => {
		const { from, to } = dateRangePreset('7d');
		const diff = (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
		expect(diff).toBe(6);
	});

	it('returns correct span for 30d', () => {
		const { from, to } = dateRangePreset('30d');
		const diff = (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
		expect(diff).toBe(29);
	});

	it('returns correct span for 90d', () => {
		const { from, to } = dateRangePreset('90d');
		const diff = (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
		expect(diff).toBe(89);
	});
});

describe('isoDate', () => {
	it('returns YYYY-MM-DD format', () => {
		expect(isoDate(new Date('2024-06-15T12:00:00Z'))).toBe('2024-06-15');
	});
});

describe('fetchSites', () => {
	beforeEach(() => vi.clearAllMocks());

	it('AC-02-02: calls /api/sites with auth header', async () => {
		const sites = [{ id: 'site-1', name: 'Blog', domain: 'example.com', createdAt: '2024-01-01' }];
		mockFetch.mockResolvedValueOnce(jsonResponse(sites));

		const result = await fetchSites();

		expect(mockFetch).toHaveBeenCalledWith(
			'/api/sites',
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Bearer test-token' })
			})
		);
		expect(result).toEqual(sites);
	});

	it('AC-02-06: throws on non-ok response', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response('', { status: 500, statusText: 'Internal Server Error' })
		);
		await expect(fetchSites()).rejects.toThrow('API error 500');
	});
});

describe('createSite', () => {
	beforeEach(() => vi.clearAllMocks());

	it('posts to /api/sites with correct payload', async () => {
		const site = { id: 'new-id', name: 'My Site', domain: 'mysite.com', createdAt: '2024-01-01' };
		mockFetch.mockResolvedValueOnce(jsonResponse(site));

		const result = await createSite({ name: 'My Site', domain: 'mysite.com' });

		expect(mockFetch).toHaveBeenCalledWith(
			'/api/sites',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ name: 'My Site', domain: 'mysite.com' })
			})
		);
		expect(result).toEqual(site);
	});
});

describe('fetchStats', () => {
	beforeEach(() => vi.clearAllMocks());

	it('AC-02-03: calls /api/stats with correct query params', async () => {
		const statsResponse = { metric: 'pageviews', data: [], totals: { pageviews: 0, visitors: 0 } };
		mockFetch.mockResolvedValueOnce(jsonResponse(statsResponse));

		await fetchStats({
			siteId: 'site-1',
			from: '2024-01-01',
			to: '2024-01-07',
			metric: 'pageviews'
		});

		const call = mockFetch.mock.calls[0][0] as string;
		expect(call).toContain('/api/stats');
		expect(call).toContain('siteId=site-1');
		expect(call).toContain('from=2024-01-01');
		expect(call).toContain('metric=pageviews');
	});

	it('AC-02-04: refetch happens with updated date range', async () => {
		const statsResponse = { metric: 'pageviews', data: [], totals: { pageviews: 0, visitors: 0 } };
		mockFetch
			.mockResolvedValueOnce(jsonResponse(statsResponse))
			.mockResolvedValueOnce(jsonResponse(statsResponse));

		await fetchStats({ siteId: 's1', from: '2024-01-01', to: '2024-01-07', metric: 'pageviews' });
		await fetchStats({ siteId: 's1', from: '2024-01-01', to: '2024-01-31', metric: 'pageviews' });

		const firstCall = mockFetch.mock.calls[0][0] as string;
		const secondCall = mockFetch.mock.calls[1][0] as string;
		expect(firstCall).toContain('to=2024-01-07');
		expect(secondCall).toContain('to=2024-01-31');
	});
});
