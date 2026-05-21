<script lang="ts">
	import { goto } from '$app/navigation';
	import { createSite } from '$lib/api.js';
	import NavBar from '$lib/components/NavBar.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';

	let name = $state('');
	let domain = $state('');
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	function isValidHostname(value: string): boolean {
		return /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(value);
	}

	async function submit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		errorMessage = null;

		if (!name.trim()) {
			errorMessage = 'Site name is required.';
			return;
		}
		if (!isValidHostname(domain)) {
			errorMessage = 'Domain must be a valid hostname (e.g. example.com).';
			return;
		}

		submitting = true;
		try {
			const site = await createSite({ name: name.trim(), domain: domain.trim() });
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- goto is awaited; rule false-positive in async event handlers
			await goto(`/dashboard/${site.id}`);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to create site.';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="min-h-screen bg-gray-50">
	<NavBar />

	<main class="mx-auto max-w-lg p-6">
		<div class="mb-6">
			<a href="/dashboard" class="text-sm text-indigo-600 hover:underline">← Back to sites</a>
			<h1 class="mt-1 text-2xl font-semibold text-gray-800">Register a new site</h1>
		</div>

		{#if errorMessage}
			<div class="mb-4">
				<ErrorBanner message={errorMessage} />
			</div>
		{/if}

		<form onsubmit={submit} class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
			<div>
				<label for="site-name" class="block text-sm font-medium text-gray-700 mb-1">Site name</label>
				<input
					id="site-name"
					type="text"
					bind:value={name}
					placeholder="My Blog"
					required
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				/>
			</div>

			<div>
				<label for="site-domain" class="block text-sm font-medium text-gray-700 mb-1">Domain</label>
				<input
					id="site-domain"
					type="text"
					bind:value={domain}
					placeholder="example.com"
					required
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				/>
				<p class="mt-1 text-xs text-gray-500">Without protocol, e.g. example.com</p>
			</div>

			<button
				type="submit"
				disabled={submitting}
				class="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
			>
				{submitting ? 'Creating…' : 'Create site'}
			</button>
		</form>
	</main>
</div>
