import type { Preview } from '@storybook/sveltekit';
import '../src/routes/layout.css';

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i
			}
		},
		a11y: {
			config: {
				rules: [
					{
						// Color contrast is checked globally; disable per-story to avoid noise in dev
						id: 'color-contrast',
						enabled: false
					}
				]
			}
		}
	},
	tags: ['autodocs']
};

export default preview;
