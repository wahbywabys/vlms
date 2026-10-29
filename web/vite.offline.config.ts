import { mergeConfig } from 'vite';
import base from './vite.prototype.config';
// Single-file offline demo: every imported asset becomes a data: URI.
export default mergeConfig(base, { build: { outDir: 'dist-offline', assetsInlineLimit: 100_000_000 } });
