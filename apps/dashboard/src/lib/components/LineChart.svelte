<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { DailyPageviews } from '@tom4u-stats/shared';
	import type { Chart as ChartType } from 'chart.js';

	interface Props {
		data: DailyPageviews[];
	}
	let { data }: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: ChartType | null = null;

	function buildDatasets(rows: DailyPageviews[]): {
		labels: string[];
		pageviews: number[];
		visitors: number[];
	} {
		return {
			labels: rows.map((r) => r.date),
			pageviews: rows.map((r) => r.pageviews),
			visitors: rows.map((r) => r.visitors)
		};
	}

	onMount(async () => {
		const { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip, Filler } =
			await import('chart.js');

		Chart.register(
			LineController,
			LineElement,
			PointElement,
			LinearScale,
			CategoryScale,
			Legend,
			Tooltip,
			Filler
		);

		const { labels, pageviews, visitors } = buildDatasets(data);

		chart = new Chart(canvas, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: 'Pageviews',
						data: pageviews,
						borderColor: '#6366f1',
						backgroundColor: 'rgba(99,102,241,0.08)',
						fill: true,
						tension: 0.3,
						pointRadius: 3
					},
					{
						label: 'Visitors',
						data: visitors,
						borderColor: '#10b981',
						backgroundColor: 'rgba(16,185,129,0.08)',
						fill: true,
						tension: 0.3,
						pointRadius: 3
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: { legend: { position: 'top' } },
				scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
			}
		});
	});

	$effect(() => {
		if (!chart) return;
		const { labels, pageviews, visitors } = buildDatasets(data);
		chart.data.labels = labels;
		chart.data.datasets[0].data = pageviews;
		chart.data.datasets[1].data = visitors;
		chart.update();
	});

	onDestroy(() => chart?.destroy());
</script>

<div class="relative h-64">
	<canvas bind:this={canvas}></canvas>
</div>
