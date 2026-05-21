<script lang="ts">
	import { dateRangePreset, isoDate } from '$lib/api.js';

	type Preset = 'today' | '7d' | '30d' | '90d' | 'custom';

	interface DateRange {
		from: string;
		to: string;
	}

	interface Props {
		value: DateRange;
		onchange: (range: DateRange) => void;
	}

	let { value, onchange }: Props = $props();

	let selected = $state<Preset>('7d');
	// Seeded lazily in selectPreset('custom') from the current value prop
	let customFrom = $state('');
	let customTo = $state('');

	const presets: { label: string; value: Preset }[] = [
		{ label: 'Today', value: 'today' },
		{ label: 'Last 7d', value: '7d' },
		{ label: 'Last 30d', value: '30d' },
		{ label: 'Last 90d', value: '90d' },
		{ label: 'Custom', value: 'custom' }
	];

	function selectPreset(preset: Preset): void {
		selected = preset;
		if (preset === 'custom') {
			// Seed inputs from the current active range so they're never stale
			customFrom = value.from;
			customTo = value.to;
			return;
		}
		const today = isoDate(new Date());
		const range = preset === 'today' ? { from: today, to: today } : dateRangePreset(preset);
		onchange(range);
	}

	function applyCustom(): void {
		onchange({ from: customFrom, to: customTo });
	}
</script>

<div class="flex flex-wrap items-center gap-2">
	{#each presets as preset (preset.value)}
		<button
			type="button"
			onclick={() => selectPreset(preset.value)}
			class="rounded-md px-3 py-1.5 text-sm font-medium transition {selected === preset.value
				? 'bg-indigo-600 text-white'
				: 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}"
		>
			{preset.label}
		</button>
	{/each}

	{#if selected === 'custom'}
		<div class="flex items-center gap-2">
			<input
				type="date"
				bind:value={customFrom}
				class="rounded-md border border-gray-300 px-2 py-1 text-sm"
				aria-label="From date"
			/>
			<span class="text-gray-400">–</span>
			<input
				type="date"
				bind:value={customTo}
				class="rounded-md border border-gray-300 px-2 py-1 text-sm"
				aria-label="To date"
			/>
			<button
				type="button"
				onclick={applyCustom}
				disabled={!customFrom || !customTo || customTo < customFrom}
				class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
			>
				Apply
			</button>
		</div>
	{/if}
</div>
