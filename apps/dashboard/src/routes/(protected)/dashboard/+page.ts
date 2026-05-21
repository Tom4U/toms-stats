import { fetchPageviewStats, fetchSites, dateRangePreset } from '$lib/api.js';
import type { PageviewStatsResponse, Site } from '@tom4u-stats/shared';

export interface DashboardData {
	sites: Site[];
	statsBySiteId: Record<string, PageviewStatsResponse>;
	error: string | null;
}

export async function load(): Promise<DashboardData> {
	try {
		const sites = await fetchSites();
		const { from, to } = dateRangePreset('7d');

		const statsResults = await Promise.allSettled(
			sites.map((site) => fetchPageviewStats(site.id, from, to))
		);

		const statsBySiteId: Record<string, PageviewStatsResponse> = {};
		sites.forEach((site, i) => {
			const result = statsResults[i];
			statsBySiteId[site.id] =
				result.status === 'fulfilled'
					? result.value
					: { metric: 'pageviews', data: [], totals: { pageviews: 0, visitors: 0 } };
		});

		return { sites, statsBySiteId, error: null };
	} catch (err) {
		return {
			sites: [],
			statsBySiteId: {},
			error: err instanceof Error ? err.message : 'Failed to load sites'
		};
	}
}
