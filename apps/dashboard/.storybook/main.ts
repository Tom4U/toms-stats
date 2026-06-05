import type { StorybookConfig } from '@storybook/sveltekit';
import { withoutVitePlugins } from '@storybook/builder-vite';

import { dirname } from 'path';

import { fileURLToPath } from 'url';

function getAbsolutePath(value: string) {
	return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
const config: StorybookConfig = {
	stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|ts|svelte)'],
	addons: [
		getAbsolutePath('@storybook/addon-svelte-csf'),
		getAbsolutePath('@chromatic-com/storybook'),
		getAbsolutePath('@storybook/addon-vitest'),
		getAbsolutePath('@storybook/addon-a11y'),
		getAbsolutePath('@storybook/addon-docs'),
		getAbsolutePath('@storybook/addon-mcp')
	],
	framework: getAbsolutePath('@storybook/sveltekit'),
	// pnpm resolves framework to an absolute path containing `@storybook+sveltekit` (+ not /),
	// which breaks @storybook/svelte-vite's SvelteKit detection check. Strip the conflicting
	// plugins before svelte-vite sees them so the guard is never triggered.
	async viteFinal(config) {
		return {
			...config,
			plugins: await withoutVitePlugins(config.plugins ?? [], [
				'vite-plugin-svelte-kit',
				'vite-plugin-sveltekit-setup'
			])
		};
	}
};
export default config;
