import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      setupFiles: [path.join(dirname, 'src/test/setup.ts')],
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      environment: 'jsdom',
    },
  }),
);
