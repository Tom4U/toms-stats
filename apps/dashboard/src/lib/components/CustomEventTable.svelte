<script lang="ts">
	import type { LabelCountItem } from '@tom4u-stats/shared';

	interface Props {
		data: LabelCountItem[];
	}
	let { data }: Props = $props();

	let expanded = $state<Set<string>>(new Set());

	function toggle(name: string): void {
		expanded = new Set(
			expanded.has(name)
				? [...expanded].filter((n) => n !== name)
				: [...expanded, name]
		);
	}
</script>

<div class="overflow-x-auto rounded-xl border border-gray-200">
	<table class="w-full text-sm">
		<thead class="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
			<tr>
				<th class="px-4 py-2">Event</th>
				<th class="px-4 py-2 text-right">Count</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100">
			{#each data as row (row.label)}
				<tr
					class="cursor-pointer hover:bg-gray-50"
					onclick={() => toggle(row.label)}
					aria-expanded={expanded.has(row.label)}
				>
					<td class="px-4 py-2 font-medium text-gray-700">
						<span class="mr-1 text-gray-400">{expanded.has(row.label) ? '▾' : '▸'}</span>
						{row.label}
					</td>
					<td class="px-4 py-2 text-right text-gray-600">{row.count.toLocaleString()}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
