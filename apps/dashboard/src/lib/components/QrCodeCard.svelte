<script lang="ts">
	import QRCode from 'qrcode';
	import type { QrCode as QrCodeType } from '@tom4u-stats/shared';

	interface Props {
		qr: QrCodeType;
		ondelete?: (id: string) => void;
	}
	let { qr, ondelete }: Props = $props();

	// The PNG is rendered client-side from trackingUrl (single source of truth);
	// no image is stored or transferred by the API. See specs/03-qr-codes.md.
	const QR_SIZE = 400;
	let imageUrl = $state('');
	let copied = $state(false);

	// WHY $effect: QRCode.toDataURL is async I/O — $derived.by does not support
	// async, so $effect is the correct pattern for Promise-based side effects.
	$effect(() => {
		const url = qr.trackingUrl;
		QRCode.toDataURL(url, { width: QR_SIZE }).then((dataUrl) => {
			imageUrl = dataUrl;
		});
	});

	async function copyTrackingUrl(): Promise<void> {
		await navigator.clipboard.writeText(qr.trackingUrl);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	function download(): void {
		const link = document.createElement('a');
		link.href = imageUrl;
		link.download = `${qr.name}.png`;
		link.click();
	}

	function remove(): void {
		if (confirm(`Delete QR code "${qr.name}"?`)) ondelete?.(qr.id);
	}
</script>

<div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
	<h2 class="font-semibold text-gray-800">{qr.name}</h2>
	<a
		href={qr.targetUrl}
		target="_blank"
		rel="noopener noreferrer"
		class="mt-0.5 block truncate text-sm text-indigo-600 hover:underline"
	>
		{qr.targetUrl}
	</a>

	<div class="mt-2 flex items-center gap-2">
		<span class="truncate text-xs text-gray-500" title={qr.trackingUrl}>{qr.trackingUrl}</span>
		<button
			type="button"
			onclick={copyTrackingUrl}
			class="shrink-0 rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
		>
			{copied ? 'Copied' : 'Copy'}
		</button>
	</div>

	{#if imageUrl}
		<img src={imageUrl} alt="QR code for {qr.name}" class="mt-4 h-40 w-40" />
	{/if}

	<div class="mt-4 flex gap-2">
		<button
			type="button"
			onclick={download}
			disabled={!imageUrl}
			class="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
		>
			Download PNG
		</button>
		<button
			type="button"
			onclick={remove}
			class="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
		>
			Delete
		</button>
	</div>
</div>
