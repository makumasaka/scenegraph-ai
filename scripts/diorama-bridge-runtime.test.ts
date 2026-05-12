import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { createEmptyScene } from '@diorama/core';
import {
  DioramaBridgeRuntime,
  resolveWorkspaceRelativePath,
} from './diorama-bridge-runtime';

const sourceRel = '.diorama/test-assets/bridge-import-test.glb';
const sourceAbs = resolve(sourceRel);
const webImportAbs = resolve('apps/web/public/assets/imports/bridge-import-test.glb');
const demoImportAbs = resolve('apps/demo-export/public/assets/imports/bridge-import-test.glb');

const createTestGlb = (): Buffer => {
  const gltf = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'Fixture Root', children: [1], translation: [0, 1, 0] },
      { name: 'Fixture Mesh', mesh: 0 },
    ],
    meshes: [{}],
  };
  const json = Buffer.from(JSON.stringify(gltf), 'utf8');
  const padding = Buffer.alloc((4 - (json.byteLength % 4)) % 4, 0x20);
  const jsonChunk = Buffer.concat([json, padding]);
  const totalLength = 12 + 8 + jsonChunk.byteLength;
  const buffer = Buffer.alloc(totalLength);
  buffer.writeUInt32LE(0x46546c67, 0);
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(totalLength, 8);
  buffer.writeUInt32LE(jsonChunk.byteLength, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  jsonChunk.copy(buffer, 20);
  return buffer;
};

describe('DioramaBridgeRuntime importAsset', () => {
  beforeEach(async () => {
    await mkdir(resolve('.diorama/test-assets'), { recursive: true });
    await writeFile(sourceAbs, createTestGlb());
  });

  afterEach(async () => {
    await rm(resolve('.diorama/test-assets'), { recursive: true, force: true });
    await rm(webImportAbs, { force: true });
    await rm(demoImportAbs, { force: true });
  });

  it('imports a workspace GLB through validated commands with shallow hierarchy', async () => {
    const runtime = new DioramaBridgeRuntime(createEmptyScene('Import Test'));

    const result = await runtime.importAsset({
      source: { kind: 'workspacePath', path: sourceRel },
      importMode: 'shallow',
      semanticRole: 'decor',
      dryRun: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.assetId).toBe('asset-bridge-import-test');
    expect(result.data.commands.map((command) => command.type)).toEqual([
      'REGISTER_ASSET',
      'ADD_NODE',
      'ADD_NODE',
      'ADD_NODE',
      'SET_NODE_SEMANTICS',
    ]);
    expect(result.data.importedNodeIds).toEqual([
      'asset-bridge-import-test-node',
      'asset-bridge-import-test-node-gltf-0-fixture-root',
      'asset-bridge-import-test-node-gltf-1-fixture-mesh',
    ]);
    expect(result.data.hierarchySummary?.nodeCount).toBe(2);
    expect(result.data.scene.nodes['asset-bridge-import-test-node']?.assetRef).toEqual({
      kind: 'uri',
      uri: '/assets/imports/bridge-import-test.glb',
    });
    expect(result.data.scene.nodes['asset-bridge-import-test-node']?.semantics?.role).toBe('decor');
    expect(result.data.scene.assets?.['asset-bridge-import-test']?.kind).toBe('glb');
  });

  it('rejects workspace paths outside the Diorama workspace', async () => {
    expect(resolveWorkspaceRelativePath('../secret.glb').ok).toBe(false);

    const runtime = new DioramaBridgeRuntime(createEmptyScene('Import Test'));
    const result = await runtime.callTool('import_glb_asset', {
      workspaceRelativePath: '../secret.glb',
      importMode: 'shallow',
    });
    expect(result.ok).toBe(false);
  });
});
