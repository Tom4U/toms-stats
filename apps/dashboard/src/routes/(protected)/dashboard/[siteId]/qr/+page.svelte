<script lang="ts">
	import { createQrCode, deleteQrCode } from '$lib/api.js';
	import NavBar from '$lib/components/NavBar.svelte';
	import QrCodeCard from '$lib/components/QrCodeCard.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import type { QrCode } from '@tom4u-stats/shared';

	interface Props {
		data: { siteId: string; siteName: string; qrCodes: QrCode[] };
	}
	let { data }: Props = $props();

	const backHref = $derived(`/dashboard/${data.siteId}`);

	// Track mutations separately so $derived can combine load data + local changes.
	let created = $state<QrCode[]>([]);
	let deletedIds = $state<Set<string>>(new Set());
	const qrCodes = $derived([...created, ...data.qrCodes].filter((qr) => !deletedIds.has(qr.id)));

	let name = $state('');
	let targetUrl = $state('');
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	async function handleSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		submitting = true;
		errorMessage = null;
		try {
			const qr = await createQrCode({ siteId: data.siteId, name, targetUrl });
			created = [qr, ...created];
			name = '';
			targetUrl = '';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to create QR code';
		} finally {
			submitting = false;
		}
	}

	async function handleDelete(id: string): Promise<void> {
		try {
			await deleteQrCode(id);
			deletedIds = new Set([...deletedIds, id]);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to delete QR code';
		}
	}
</script>

<div class="min-h-screen bg-gray-50">
	<NavBar />

	<main class="mx-auto max-w-3xl p-6">
		<div class="mb-6">
			<a href={backHref} class="text-sm text-indigo-600 hover:underline"
				>← Back to {data.siteName}</a
			>
			<h1 class="mt-1 text-2xl font-semibold text-gray-800">QR Codes</h1>
		</div>

		<form
			onsubmit={handleSubmit}
			class="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
		>
			<h2 class="mb-4 font-semibold text-gray-700">New QR Code</h2>
			<div class="flex flex-col gap-3">
				<input
					type="text"
					bind:value={name}
					placeholder="Name"
					required
					maxlength="100"
					class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
				/>
				<input
					type="url"
					bind:value={targetUrl}
					placeholder="Target URL (https://…)"
					required
					class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
				/>
				<button
					type="submit"
					disabled={submitting}
					class="self-start rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
				>
					{submitting ? 'Creating…' : 'Create'}
				</button>
			</div>
		</form>

		{#if errorMessage}
			<ErrorBanner message={errorMessage} />
		{/if}

		<div class="flex flex-col gap-4">
			{#each qrCodes as qr (qr.id)}
				<QrCodeCard {qr} ondelete={handleDelete} />
			{/each}
			{#if qrCodes.length === 0}
				<p class="text-sm text-gray-500">No QR codes yet. Create one above.</p>
			{/if}
		</div>
	</main>
</div>
