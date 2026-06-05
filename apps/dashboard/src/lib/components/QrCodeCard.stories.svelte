<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import QrCodeCard from './QrCodeCard.svelte';

	const { Story } = defineMeta({
		title: 'Components/QrCodeCard',
		component: QrCodeCard,
		args: {
			qr: {
				id: 'qr-1',
				siteId: 'site-1',
				name: 'Summer Sale',
				targetUrl: 'https://shop.example.com',
				trackingUrl:
					'https://shop.example.com/?utm_source=qr&utm_medium=qr&utm_campaign=Summer+Sale',
				createdAt: '2024-03-15T10:00:00Z'
			}
		}
	});
</script>

<Story name="Default" />
<Story
	name="Long name and URL"
	args={{
		qr: {
			id: 'qr-2',
			siteId: 'site-1',
			name: 'Very Long Campaign Name That Should Truncate Nicely In The Card Layout',
			targetUrl: 'https://shop.example.com/very/long/path/to/landing/page',
			trackingUrl:
				'https://shop.example.com/very/long/path/to/landing/page?utm_source=qr&utm_medium=qr&utm_campaign=Very+Long+Campaign+Name+That+Should+Truncate+Nicely+In+The+Card+Layout',
			createdAt: '2024-03-15T10:00:00Z'
		}
	}}
/>
