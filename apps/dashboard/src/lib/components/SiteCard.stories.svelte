<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SiteCard from './SiteCard.svelte';

	const { Story } = defineMeta({
		title: 'Components/SiteCard',
		component: SiteCard,
		args: {
			site: { id: 'site-1', name: 'My Blog', domain: 'example.com', createdAt: '2024-01-01T00:00:00Z' },
			pageviews: 1234,
			visitors: 567
		}
	});
</script>

<Story name="Default" />
<Story name="No data" args={{ pageviews: 0, visitors: 0 }} />
