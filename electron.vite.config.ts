import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

export default defineConfig({
	main: {
		build: {
			rollupOptions: {
				input: resolve(__dirname, 'app/main/index.ts'),
			},
		},
	},
	preload: {
		build: {
			rollupOptions: {
				input: resolve(__dirname, 'app/preload/index.ts'),
			},
		},
	},
	renderer: {
		root: 'renderer',
		build: {
			rollupOptions: {
				input: resolve(__dirname, 'renderer/index.html'),
			},
		},
		resolve: {
			alias: {
				'@': resolve(__dirname, 'renderer/src'),
			},
		},
		plugins: [react()],
	},
});
