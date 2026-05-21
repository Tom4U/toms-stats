<script lang="ts">
	import type { LabelCountItem } from '@tom4u-stats/shared';

	interface Props {
		data: LabelCountItem[];
	}
	let { data }: Props = $props();

	let expanded = $state<Set<string>>(new Set());

	function toggle(name: string): void {
		expanded = new Set(
			expanded.has(name) ? [...expanded].filter((n) => n !== name) : [...expanded, name]
		);
	}
</script>

<div class="overflow-x-auto rounded-xl border border-gray-200">
	<table class="w-full text-sm">
		<thead class="bg-gray-50 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
			<tr>
				<th class="px-4 py-2">Event</th>
				<th class="px-4 py-2 text-right">Count</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100">
			{#each data as row (row.label)}
				<tr class="hover:bg-gray-50">
					<td class="px-4 py-2 font-medium text-gray-700">
						<button
							type="button"
							class="flex items-center gap-1 text-left"
							aria-expanded={expanded.has(row.label)}
							onclick={() => toggle(row.label)}
						>
							<span class="text-gray-400" aria-hidden="true"
								>{expanded.has(row.label) ? '▾' : '▸'}</span
							>
							{row.label}
						</button>
					</td>
					<td class="px-4 py-2 text-right text-gray-600">{row.count.toLocaleString()}</td>
				</tr>
				{#if expanded.has(row.label)}
					<tr class="bg-gray-50">
						<td colspan="2" class="px-6 py-2 text-xs text-gray-400 italic">
							Per-props breakdown requires a dedicated API endpoint (not yet available).
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</div>
