<script lang="ts">
	import { fetchStats, dateRangePreset } from '$lib/api.js';
	import NavBar from '$lib/components/NavBar.svelte';
	import DateRangePicker from '$lib/components/DateRangePicker.svelte';
	import MetricTabs from '$lib/components/MetricTabs.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import StatsTable from '$lib/components/StatsTable.svelte';
	import CustomEventTable from '$lib/components/CustomEventTable.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import type {
		StatMetric,
		StatsResponse,
		PageviewStatsResponse,
		LabelCountResponse
	} from '@tom4u-stats/shared';

	interface Props {
		data: { siteId: string; siteName: string };
	}
	let { data }: Props = $props();

	const defaultRange = dateRangePreset('7d');
	let dateRange = $state(defaultRange);
	let activeMetric = $state<StatMetric>('pageviews');
	let stats = $state<StatsResponse | null>(null);
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	async function loadStats(
		siteId: string,
		from: string,
		to: string,
		metric: StatMetric
	): Promise<void> {
		loading = true;
		errorMessage = null;
		try {
			stats = await fetchStats({ siteId, from, to, metric });
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to load stats';
			stats = null;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadStats(data.siteId, dateRange.from, dateRange.to, activeMetric);
	});

	function onDateChange(range: { from: string; to: string }): void {
		dateRange = range;
	}

	function onMetricChange(metric: StatMetric): void {
		activeMetric = metric;
	}

	const pageviewStats = $derived(
		stats?.metric === 'pageviews' ? (stats as PageviewStatsResponse) : null
	);
	const labelStats = $derived(
		stats && stats.metric !== 'pageviews' ? (stats as LabelCountResponse) : null
	);
	const hasData = $derived(
		(pageviewStats?.totals.pageviews ?? 0) > 0 || (labelStats?.data.length ?? 0) > 0
	);
</script>

<div class="min-h-screen bg-gray-50">
	<NavBar />

	<main class="mx-auto max-w-6xl p-6">
		<div class="mb-4">
			<a href="/dashboard" class="text-sm text-indigo-600 hover:underline">← Back to sites</a>
			<h1 class="mt-1 text-2xl font-semibold text-gray-800">{data.siteName}</h1>
		</div>

		<div class="mb-4">
			<DateRangePicker value={dateRange} onchange={onDateChange} />
		</div>

		<MetricTabs selected={activeMetric} onchange={onMetricChange} />

		<div class="mt-6">
			{#if loading}
				<LoadingSpinner />
			{:else if errorMessage}
				<ErrorBanner message={errorMessage} />
			{:else if !hasData}
				<div class="rounded-xl border border-dashed border-gray-300 p-12 text-center">
					<p class="font-medium text-gray-600">No data yet</p>
					<p class="mt-2 text-sm text-gray-500">
						Start tracking by adding the snippet to your site:
					</p>
					<pre
						class="mx-auto mt-4 max-w-lg overflow-x-auto rounded-lg bg-gray-100 p-4 text-left text-xs text-gray-700">&lt;script src="/snippet.js" data-site-id="{data.siteId}"&gt;&lt;/script&gt;</pre>
				</div>
			{:else if activeMetric === 'pageviews' && pageviewStats}
				<div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
					<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
						<p class="text-3xl font-bold text-gray-800">
							{pageviewStats.totals.pageviews.toLocaleString()}
						</p>
						<p class="text-sm text-gray-500">Pageviews</p>
					</div>
					<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
						<p class="text-3xl font-bold text-gray-800">
							{pageviewStats.totals.visitors.toLocaleString()}
						</p>
						<p class="text-sm text-gray-500">Visitors</p>
					</div>
				</div>

				<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
					<LineChart data={pageviewStats.data} />
				</div>
			{:else if activeMetric === 'customEvents' && labelStats}
				<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
					<CustomEventTable data={labelStats.data} />
				</div>
			{:else if labelStats}
				<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
					<BarChart data={labelStats.data} />
					<div class="mt-4">
						<StatsTable data={labelStats.data} />
					</div>
				</div>
			{/if}
		</div>
	</main>
</div>
