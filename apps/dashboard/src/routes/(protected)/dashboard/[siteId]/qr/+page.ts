import { fetchSites, listQrCodes } from '$lib/api.js';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types.js';

export const load: PageLoad = async ({ params }) => {
	const sites = await fetchSites();
	const site = sites.find((s) => s.id === params.siteId);
	if (!site) throw error(404, 'Site not found');
	const qrCodes = await listQrCodes(site.id);
	return { siteId: site.id, siteName: site.name, qrCodes };
};
