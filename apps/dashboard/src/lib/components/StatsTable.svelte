<script lang="ts">
	import type { LabelCountItem } from '@tom4u-stats/shared';

	interface Props {
		data: LabelCountItem[];
		labelHeader?: string;
	}
	let { data, labelHeader = 'Label' }: Props = $props();

	const total = $derived(data.reduce((sum, r) => sum + r.count, 0));
</script>

<div class="overflow-x-auto rounded-xl border border-gray-200">
	<table class="w-full text-sm">
		<thead class="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
			<tr>
				<th class="px-4 py-2">{labelHeader}</th>
				<th class="px-4 py-2 text-right">Count</th>
				<th class="px-4 py-2 text-right">%</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100">
			{#each data as row (row.label)}
				<tr class="hover:bg-gray-50">
					<td class="px-4 py-2 font-medium text-gray-700">{row.label}</td>
					<td class="px-4 py-2 text-right text-gray-600">{row.count.toLocaleString()}</td>
					<td class="px-4 py-2 text-right text-gray-500">
						{total > 0 ? ((row.count / total) * 100).toFixed(1) : '0.0'}%
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
