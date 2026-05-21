<script lang="ts">
	import type { Site } from '@tom4u-stats/shared';

	interface Props {
		site: Site;
		pageviews: number;
		visitors: number;
	}
	let { site, pageviews, visitors }: Props = $props();
</script>

<a
	href="/dashboard/{site.id}"
	class="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
>
	<div class="flex items-start justify-between">
		<div>
			<h2 class="font-semibold text-gray-800">{site.name}</h2>
			<p class="mt-0.5 text-sm text-gray-500">{site.domain}</p>
		</div>
	</div>
	<div class="mt-4 flex gap-6">
		<div>
			<p class="text-2xl font-bold text-gray-800">{pageviews.toLocaleString()}</p>
			<p class="text-xs text-gray-500">Pageviews (7d)</p>
		</div>
		<div>
			<p class="text-2xl font-bold text-gray-800">{visitors.toLocaleString()}</p>
			<p class="text-xs text-gray-500">Visitors (7d)</p>
		</div>
	</div>
</a>
