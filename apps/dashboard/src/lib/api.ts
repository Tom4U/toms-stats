import { getIdToken } from './auth.store.js';
import type {
	CreateSitePayload,
	PageviewStatsResponse,
	Site,
	StatsQuery,
	StatsResponse
} from '@tom4u-stats/shared';

async function authHeaders(): Promise<HeadersInit> {
	const token = await getIdToken();
	if (!token) throw new Error('Not authenticated');
	return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(path, init);
	if (!res.ok) {
		throw new Error(`API error ${res.status}: ${res.statusText}`);
	}
	return res.json() as Promise<T>;
}

export async function fetchSites(): Promise<Site[]> {
	const headers = await authHeaders();
	return apiFetch<Site[]>('/api/sites', { headers });
}

export async function createSite(payload: CreateSitePayload): Promise<Site> {
	const headers = await authHeaders();
	return apiFetch<Site>('/api/sites', { method: 'POST', headers, body: JSON.stringify(payload) });
}

export async function fetchStats(query: StatsQuery): Promise<StatsResponse> {
	const headers = await authHeaders();
	const params = new URLSearchParams({
		siteId: query.siteId,
		from: query.from,
		to: query.to,
		metric: query.metric
	});
	return apiFetch<StatsResponse>(`/api/stats?${params}`, { headers });
}

export async function fetchPageviewStats(
	siteId: string,
	from: string,
	to: string
): Promise<PageviewStatsResponse> {
	const res = await fetchStats({ siteId, from, to, metric: 'pageviews' });
	return res as PageviewStatsResponse;
}

export function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

export function dateRangePreset(preset: '7d' | '30d' | '90d'): { from: string; to: string } {
	const to = new Date();
	const from = new Date(to);
	const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
	from.setDate(from.getDate() - (days - 1));
	return { from: isoDate(from), to: isoDate(to) };
}
