<script lang="ts">
	import type { StatMetric } from '@tom4u-stats/shared';

	interface Tab {
		value: StatMetric;
		label: string;
	}

	interface Props {
		selected: StatMetric;
		onchange: (metric: StatMetric) => void;
	}

	let { selected, onchange }: Props = $props();

	const tabs: Tab[] = [
		{ value: 'pageviews', label: 'Overview' },
		{ value: 'referrers', label: 'Referrers' },
		{ value: 'browsers', label: 'Browsers' },
		{ value: 'devices', label: 'Devices' },
		{ value: 'os', label: 'OS' },
		{ value: 'countries', label: 'Countries' },
		{ value: 'customEvents', label: 'Custom Events' }
	];
</script>

<div class="flex gap-1 overflow-x-auto border-b border-gray-200 pb-0" role="tablist">
	{#each tabs as tab (tab.value)}
		<button
			role="tab"
			aria-selected={selected === tab.value}
			onclick={() => onchange(tab.value)}
			class="whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition {selected ===
			tab.value
				? 'border-indigo-600 text-indigo-600'
				: 'border-transparent text-gray-500 hover:text-gray-700'}"
		>
			{tab.label}
		</button>
	{/each}
</div>
