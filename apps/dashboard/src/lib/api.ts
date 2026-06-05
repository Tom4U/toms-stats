import { getIdToken } from './auth.store.js';
import type {
	CreateQrCodePayload,
	CreateSitePayload,
	PageviewStatsResponse,
	QrCode,
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
		const body = await res.json().catch(() => null);
		const message = (body as { error?: string } | null)?.error ?? res.statusText;
		throw new Error(`API error ${res.status}: ${message}`);
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

export async function listQrCodes(siteId: string): Promise<QrCode[]> {
	const headers = await authHeaders();
	const params = new URLSearchParams({ siteId });
	return apiFetch<QrCode[]>(`/api/qr?${params}`, { headers });
}

export async function createQrCode(payload: CreateQrCodePayload): Promise<QrCode> {
	const headers = await authHeaders();
	return apiFetch<QrCode>('/api/qr', { method: 'POST', headers, body: JSON.stringify(payload) });
}

export async function deleteQrCode(qrId: string): Promise<void> {
	const headers = await authHeaders();
	// DELETE returns 204 with no body, so we can't go through apiFetch (it parses JSON).
	const res = await fetch(`/api/qr/${qrId}`, { method: 'DELETE', headers });
	if (!res.ok) {
		const body = await res.json().catch(() => null);
		const message = (body as { error?: string } | null)?.error ?? res.statusText;
		throw new Error(`API error ${res.status}: ${message}`);
	}
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
