<script lang="ts">
	import NavBar from '$lib/components/NavBar.svelte';
	import SiteCard from '$lib/components/SiteCard.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import type { DashboardData } from './+page.js';

	interface Props {
		data: DashboardData;
	}
	let { data }: Props = $props();
</script>

<div class="min-h-screen bg-gray-50">
	<NavBar />

	<main class="mx-auto max-w-5xl p-6">
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-2xl font-semibold text-gray-800">Sites</h1>
			<a
				href="/sites/new"
				class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
			>
				Add site
			</a>
		</div>

		{#if data.error}
			<ErrorBanner message={data.error} />
		{:else if data.sites.length === 0}
			<div class="rounded-xl border border-dashed border-gray-300 p-12 text-center">
				<p class="text-gray-500">No sites yet.</p>
				<a
					href="/sites/new"
					class="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline"
					>Add your first site →</a
				>
			</div>
		{:else}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.sites as site (site.id)}
					<SiteCard
						{site}
						pageviews={data.statsBySiteId[site.id]?.totals.pageviews ?? 0}
						visitors={data.statsBySiteId[site.id]?.totals.visitors ?? 0}
					/>
				{/each}
			</div>
		{/if}
	</main>
</div>
