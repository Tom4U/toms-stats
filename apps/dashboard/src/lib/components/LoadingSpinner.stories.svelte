<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LoadingSpinner from './LoadingSpinner.svelte';

	const { Story } = defineMeta({
		title: 'Components/LoadingSpinner',
		component: LoadingSpinner
	});
</script>

<Story name="Default" />
