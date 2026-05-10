import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { createGeneratorAdapter } from './adapter';

const tmpRoots: string[] = [];

const createTmp = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'diorama-generation-'));
  tmpRoots.push(dir);
  return dir;
};

afterEach(async () => {
  while (tmpRoots.length > 0) {
    const dir = tmpRoots.pop();
    if (!dir) continue;
    await rm(dir, { recursive: true, force: true });
  }
});

describe('DefaultGeneratorAdapter', () => {
  it('writes deterministic mock GLB output and returns local+public refs', async () => {
    const outDir = await createTmp();
    const adapter = createGeneratorAdapter({
      assetOutputDir: outDir,
      publicUrlBase: '/assets/generated',
    });

    const generated = await adapter.generateAsset({
      prompt: 'Generate a modern chair product display scene',
      provider: 'mock',
      mode: 'mock',
    });

    expect(generated.provider).toBe('mock');
    expect(generated.format).toBe('glb');
    expect(generated.localPath?.startsWith(outDir)).toBe(true);
    expect(generated.uri?.startsWith('/assets/generated/')).toBe(true);

    const bytes = await readFile(generated.localPath as string);
    expect(bytes.byteLength).toBeGreaterThan(20);
    expect(bytes.subarray(0, 4).toString('utf8')).toBe('glTF');
  });

  it('reuses prompt cache and existing file path', async () => {
    const outDir = await createTmp();
    const adapter = createGeneratorAdapter({
      assetOutputDir: outDir,
      publicUrlBase: '/assets/generated',
    });

    const first = await adapter.generateAsset({
      prompt: 'chair',
      provider: 'mock',
      mode: 'mock',
    });
    const second = await adapter.generateAsset({
      prompt: 'chair',
      provider: 'mock',
      mode: 'mock',
    });

    expect(second.localPath).toBe(first.localPath);
    expect(second.id).toBe(first.id);
  });

  it('falls back to mock when live meshy mode has no API key', async () => {
    const oldKey = process.env.MESHY_API_KEY;
    try {
      delete process.env.MESHY_API_KEY;
      const outDir = await createTmp();
      const adapter = createGeneratorAdapter({ assetOutputDir: outDir });

      const generated = await adapter.generateAsset({
        prompt: 'modern chair',
        provider: 'meshy',
        mode: 'live',
      });

      expect(generated.provider).toBe('mock');
      expect(generated.metadata?.fallbackReason).toBeDefined();
    } finally {
      if (oldKey === undefined) {
        delete process.env.MESHY_API_KEY;
      } else {
        process.env.MESHY_API_KEY = oldKey;
      }
    }
  });
});
