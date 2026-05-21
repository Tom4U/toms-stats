<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ErrorBanner from './ErrorBanner.svelte';

	const { Story } = defineMeta({
		title: 'Components/ErrorBanner',
		component: ErrorBanner,
		args: { message: 'Something went wrong. Please try again.' }
	});
</script>

<Story name="Default" />
<Story name="Network error" args={{ message: 'Network error: unable to reach the server.' }} />
