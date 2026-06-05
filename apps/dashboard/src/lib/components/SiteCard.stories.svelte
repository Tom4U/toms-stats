<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SiteCard from './SiteCard.svelte';

	const { Story } = defineMeta({
		title: 'Components/SiteCard',
		component: SiteCard,
		parameters: {
			layout: 'padded'
		},
		args: {
			site: {
				id: 'site-1',
				name: 'My Blog',
				domain: 'example.com',
				createdAt: '2024-01-01T00:00:00Z'
			},
			pageviews: 1234,
			visitors: 567
		}
	});
</script>

<!-- Typical active site -->
<Story name="Default" />

<!-- New site with no data yet -->
<Story name="No data" args={{ pageviews: 0, visitors: 0 }} />

<!-- High-traffic site — verifies large number formatting -->
<Story
	name="High traffic"
	args={{
		site: {
			id: 'site-2',
			name: 'Tech News',
			domain: 'technews.io',
			createdAt: '2023-06-01T00:00:00Z'
		},
		pageviews: 1284930,
		visitors: 348210
	}}
/>

<!-- Long name and domain — verifies layout doesn't break -->
<Story
	name="Long name"
	args={{
		site: {
			id: 'site-3',
			name: 'My Very Long Named Personal Photography And Travel Blog',
			domain: 'my-very-long-domain-name.photography.example.com',
			createdAt: '2024-03-01T00:00:00Z'
		},
		pageviews: 42,
		visitors: 18
	}}
/>
