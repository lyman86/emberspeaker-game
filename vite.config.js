import { defineConfig } from 'vite';
export default defineConfig({ base: './', server: { host: true, open: true }, build: { chunkSizeWarningLimit: 1500, rollupOptions: { input: { main: 'index.html' } } } });
