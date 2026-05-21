<script lang="ts">
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { authStore } from '$lib/auth.store.js';
	import { onMount } from 'svelte';

	onMount(() => {
		const user = get(authStore);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- not awaited intentionally; fire-and-forget redirect in onMount
		goto(user ? '/dashboard' : '/login', { replaceState: true });
	});
</script>
