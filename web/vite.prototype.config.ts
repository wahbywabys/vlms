import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Clickable prototype (role switcher + three screens). Separate from the
// explorer demo build so docs/site/build.py keeps working unchanged.
// The rubric engine is imported straight from ../api; point its `zod` import
// at this package's copy so the api folder needs no node_modules.
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: { alias: { zod: fileURLToPath(new URL('./node_modules/zod', import.meta.url)) } },
  build: {
    outDir: 'dist-prototype',
    rollupOptions: {
      input: fileURLToPath(new URL('./prototype.html', import.meta.url)),
      output: { entryFileNames: 'assets/app.js', assetFileNames: (i) => ((i.names?.[0] ?? '').endsWith('.css') ? 'assets/app.css' : 'assets/[name][extname]') },
    },
  },
});
