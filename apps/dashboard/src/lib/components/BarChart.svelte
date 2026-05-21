<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { LabelCountItem } from '@tom4u-stats/shared';
	import type { Chart as ChartType } from 'chart.js';

	interface Props {
		data: LabelCountItem[];
	}
	let { data }: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: ChartType | null = null;

	function buildData(rows: LabelCountItem[]): { labels: string[]; counts: number[] } {
		return { labels: rows.map((r) => r.label), counts: rows.map((r) => r.count) };
	}

	onMount(async () => {
		const { Chart, BarController, BarElement, LinearScale, CategoryScale, Tooltip } =
			await import('chart.js');

		Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip);

		const { labels, counts } = buildData(data);

		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels,
				datasets: [
					{
						data: counts,
						backgroundColor: '#6366f1',
						borderRadius: 4
					}
				]
			},
			options: {
				indexAxis: 'y',
				responsive: true,
				maintainAspectRatio: false,
				plugins: { legend: { display: false } },
				scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
			}
		});
	});

	$effect(() => {
		if (!chart) return;
		const { labels, counts } = buildData(data);
		chart.data.labels = labels;
		chart.data.datasets[0].data = counts;
		chart.update();
	});

	onDestroy(() => chart?.destroy());
</script>

<div class="relative" style="height: {Math.max(data.length * 36, 120)}px">
	<canvas bind:this={canvas}></canvas>
</div>
