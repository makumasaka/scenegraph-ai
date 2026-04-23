import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@diorama/schema': path.join(repoRoot, 'packages/schema/src'),
      '@diorama/core': path.join(repoRoot, 'packages/core/src'),
      '@diorama/export-r3f': path.join(repoRoot, 'packages/export-r3f/src'),
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
