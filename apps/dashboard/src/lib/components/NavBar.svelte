<script lang="ts">
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/auth.store.js';

	const user = authStore;

	async function signOut(): Promise<void> {
		await authStore.signOut();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- goto is awaited; rule false-positive in async event handlers
		await goto('/login');
	}
</script>

<nav class="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
	<a href="/dashboard" class="font-semibold text-gray-800 hover:text-indigo-600">toms-stats</a>
	<div class="flex items-center gap-4">
		{#if $user}
			<span class="text-sm text-gray-500">{$user.email}</span>
		{/if}
		<button
			onclick={signOut}
			class="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
		>
			Sign out
		</button>
	</div>
</nav>
