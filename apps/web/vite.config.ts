import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dioramaDemoExportAssetFallback } from './vite-plugin-diorama-asset-fallback';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const webDir = path.dirname(fileURLToPath(import.meta.url));
const webPublicDir = path.join(webDir, 'public');
const demoExportPublicDir = path.join(repoRoot, 'apps/demo-export/public');

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    dioramaDemoExportAssetFallback({ webPublicDir, demoExportPublicDir }),
    react(),
  ],
  resolve: {
    alias: {
      '@diorama/schema': path.join(repoRoot, 'packages/schema/src'),
      '@diorama/core': path.join(repoRoot, 'packages/core/src'),
      '@diorama/export-r3f': path.join(repoRoot, 'packages/export-r3f/src'),
      '@diorama/r3f-bridge': path.join(repoRoot, 'packages/r3f-bridge/src'),
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
