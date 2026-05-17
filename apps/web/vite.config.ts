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
      '@dioramai/schema': path.join(repoRoot, 'packages/schema/src'),
      '@dioramai/core': path.join(repoRoot, 'packages/core/src'),
      '@dioramai/export-r3f': path.join(repoRoot, 'packages/export-r3f/src'),
      '@dioramai/r3f-bridge': path.join(repoRoot, 'packages/r3f-bridge/src'),
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
