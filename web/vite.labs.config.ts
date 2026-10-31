import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Standalone 3D & VR labs for every WABYS programme, built as one file
// (every asset inlined) so it opens offline from a phone or a USB stick.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-labs',
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      input: fileURLToPath(new URL('./labs.html', import.meta.url)),
      output: { entryFileNames: 'assets/app.js', assetFileNames: (i) => ((i.names?.[0] ?? '').endsWith('.css') ? 'assets/app.css' : 'assets/[name][extname]') },
    },
  },
});
