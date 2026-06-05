<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LoadingSpinner from './LoadingSpinner.svelte';

	const { Story } = defineMeta({
		title: 'Components/LoadingSpinner',
		component: LoadingSpinner,
		parameters: { layout: 'centered' }
	});
</script>

<Story name="Default" />
