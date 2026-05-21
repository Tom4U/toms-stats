import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchSites = vi.fn();
const mockFetchPageviewStats = vi.fn();

vi.mock('$lib/api.js', () => ({
	fetchSites: (...args: unknown[]) => mockFetchSites(...args),
	fetchPageviewStats: (...args: unknown[]) => mockFetchPageviewStats(...args),
	dateRangePreset: () => ({ from: '2024-01-01', to: '2024-01-07' })
}));

const { load } = await import('./+page.js');

describe('/dashboard load', () => {
	beforeEach(() => vi.clearAllMocks());

	it('AC-02-02: returns sites with 7-day stats', async () => {
		const sites = [{ id: 's1', name: 'Site 1', domain: 'site1.com', createdAt: '2024-01-01' }];
		const stats = {
			metric: 'pageviews' as const,
			data: [],
			totals: { pageviews: 42, visitors: 10 }
		};

		mockFetchSites.mockResolvedValueOnce(sites);
		mockFetchPageviewStats.mockResolvedValueOnce(stats);

		const result = await load();

		expect(result.sites).toEqual(sites);
		expect(result.statsBySiteId['s1'].totals.pageviews).toBe(42);
		expect(result.error).toBeNull();
	});

	it('AC-02-07: returns empty sites list when no sites registered', async () => {
		mockFetchSites.mockResolvedValueOnce([]);

		const result = await load();

		expect(result.sites).toHaveLength(0);
		expect(result.error).toBeNull();
	});

	it('AC-02-06: returns error message when API fails', async () => {
		mockFetchSites.mockRejectedValueOnce(new Error('Network error'));

		const result = await load();

		expect(result.error).toBe('Network error');
		expect(result.sites).toHaveLength(0);
	});

	it('AC-02-05: load fn resolves (loading state is managed by the caller; error field null on success)', async () => {
		const sites = [{ id: 's1', name: 'Site 1', domain: 'site1.com', createdAt: '2024-01-01' }];
		const stats = { metric: 'pageviews' as const, data: [], totals: { pageviews: 0, visitors: 0 } };

		mockFetchSites.mockResolvedValueOnce(sites);
		mockFetchPageviewStats.mockResolvedValueOnce(stats);

		// load() promise resolving signals that the loading state ends
		const result = await load();
		expect(result.error).toBeNull();
	});

	it('AC-02-02: falls back to zero stats when per-site stats fetch fails', async () => {
		const sites = [{ id: 's1', name: 'Site 1', domain: 'site1.com', createdAt: '2024-01-01' }];
		mockFetchSites.mockResolvedValueOnce(sites);
		mockFetchPageviewStats.mockRejectedValueOnce(new Error('Stats error'));

		const result = await load();

		expect(result.sites).toHaveLength(1);
		expect(result.statsBySiteId['s1'].totals.pageviews).toBe(0);
	});
});
