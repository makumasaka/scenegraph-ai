import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { parseSceneJson } from '@diorama/schema';
import { createMcpLiteRuntime } from './mcpLite';

const expectOk = <T>(result: { ok: true; data: T } | { ok: false; error: { message: string } }): T => {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
};

describe('V1 vertical slice workflow', () => {
  it('runs generate -> ingest -> structure -> interactive -> arrange -> export', async () => {
    const assetOutputDir = await mkdtemp(join(tmpdir(), 'diorama-v1-demo-'));
    try {
      const runtime = createMcpLiteRuntime(undefined, {
        generation: {
          assetOutputDir,
          publicUrlBase: '/assets/generated',
        },
      });

      const generated = expectOk(await runtime.generateAsset({
        prompt: 'Generate a modern chair product display scene.',
        provider: 'meshy',
        mode: 'live',
      })).asset;
      expect(generated.localPath).toBeDefined();
      await stat(generated.localPath as string);

      const ingested = expectOk(runtime.ingestAsset({
        kind: 'generated',
        asset: generated,
      }));
      expect(ingested.appliedCommandCount).toBe(2);
      expect(ingested.errors).toEqual([]);

      const structured = expectOk(runtime.structureScene({ preset: 'showroom' }));
      expect(structured.changed).toBe(true);

      const interactive = expectOk(runtime.makeInteractive({ targetRole: 'product' }));
      expect(interactive.changed).toBe(true);

      const arranged = expectOk(runtime.arrangeNodes({
        role: 'product',
        layout: 'line',
        options: { spacing: 1.25, axis: 'x' },
      }));
      expect(arranged.changed).toBe(true);

      const exported = expectOk(runtime.exportR3F({
        mode: 'module',
        componentName: 'GeneratedChairScene',
        behaviorScaffold: 'handlers',
        semanticComponents: true,
      }));
      expect(exported.content).toContain('useGLTF');
      expect(exported.content).toContain('/assets/generated/');
      expect(exported.content).toContain('function Product');
      expect(exported.content).toContain('handleSelect');
      expect(exported.content).toContain('GeneratedChairScene');

      const exportedJson = expectOk(runtime.exportJSON());
      const parsed = parseSceneJson(exportedJson.content);
      expect(parsed).not.toBeNull();
      if (parsed === null) return;
      expect(parsed.assets).toBeDefined();
      expect(Object.keys(parsed.assets ?? {})).toHaveLength(1);
      const stableContent = exported.content.replace(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g,
        '<scene-id>',
      );
      expect(stableContent).toMatchSnapshot();
    } finally {
      await rm(assetOutputDir, { recursive: true, force: true });
    }
  });
});
