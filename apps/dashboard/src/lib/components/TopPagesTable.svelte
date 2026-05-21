<script lang="ts">
	interface PageRow {
		path: string;
		pageviews: number;
		visitors: number;
	}

	interface Props {
		data: PageRow[];
	}
	let { data }: Props = $props();
</script>

<div class="overflow-x-auto rounded-xl border border-gray-200">
	<table class="w-full text-sm">
		<thead class="bg-gray-50 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
			<tr>
				<th class="px-4 py-2">Page</th>
				<th class="px-4 py-2 text-right">Pageviews</th>
				<th class="px-4 py-2 text-right">Visitors</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100">
			{#each data as row (row.path)}
				<tr class="hover:bg-gray-50">
					<td class="px-4 py-2 font-medium text-gray-700">{row.path}</td>
					<td class="px-4 py-2 text-right text-gray-600">{row.pageviews.toLocaleString()}</td>
					<td class="px-4 py-2 text-right text-gray-500">{row.visitors.toLocaleString()}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
