import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { createEmptyScene, applyCommand } from '@diorama/core';
import { parseSceneFromR3fSyncModule } from '@diorama/export-r3f';
import {
  DioramaBridgeRuntime,
  resolveWorkspaceRelativePath,
} from './diorama-bridge-runtime';

let projectRoot = '';
const sourceRel = 'fixtures/bridge-import-test.glb';

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

describe('DioramaBridgeRuntime importAsset and sync', () => {
  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'diorama-bridge-'));
    await mkdir(resolve(projectRoot, 'fixtures'), { recursive: true });
    await writeFile(resolve(projectRoot, sourceRel), createTestGlb());
  });

  afterEach(async () => {
    if (projectRoot) await rm(projectRoot, { recursive: true, force: true });
    projectRoot = '';
  });

  it('imports a project GLB through validated commands with shallow hierarchy', async () => {
    const runtime = new DioramaBridgeRuntime(createEmptyScene('Import Test'), {
      projectRoot,
    });

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
      uri: '/assets/diorama/bridge-import-test.glb',
    });
    expect(result.data.scene.nodes['asset-bridge-import-test-node']?.semantics?.role).toBe('decor');
    expect(result.data.scene.assets?.['asset-bridge-import-test']?.kind).toBe('glb');
  });

  it('rejects workspace paths outside the project root', async () => {
    expect(resolveWorkspaceRelativePath('../secret.glb', projectRoot).ok).toBe(false);

    const runtime = new DioramaBridgeRuntime(createEmptyScene('Import Test'), {
      projectRoot,
    });
    const result = await runtime.callTool('register_asset', {
      workspaceRelativePath: '../secret.glb',
      importMode: 'shallow',
    });
    expect(result.ok).toBe(false);
  });

  it('writes deterministic generated R3F sync modules from runtime commands', async () => {
    const scene = createEmptyScene('Sync Test');
    const runtime = new DioramaBridgeRuntime(scene, { projectRoot });
    const node = {
      ...Object.values(scene.nodes)[0]!,
      id: 'box',
      name: 'Box',
      type: 'mesh' as const,
    };

    await runtime.callTool('apply_command', {
      command: { type: 'ADD_NODE', parentId: scene.rootId, node },
    });
    const transformed = await runtime.callTool('update_transform', {
      nodeId: 'box',
      patch: { position: [1, 2, 3] },
    });

    expect(transformed.ok).toBe(true);
    const generatedPath = runtime.getProjectInfo().generatedModulePath;
    const code = await readFile(generatedPath, 'utf8');
    const parsed = parseSceneFromR3fSyncModule(code);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.scene.nodes.box?.transform.position).toEqual([1, 2, 3]);
  });

  it('loads code edits from the generated scene block through sync_code parsing', async () => {
    const scene = createEmptyScene('Sync Test');
    const runtime = new DioramaBridgeRuntime(scene, { projectRoot });
    const rootId = scene.rootId;
    const nextScene = applyCommand(scene, {
      type: 'UPDATE_TRANSFORM',
      nodeId: rootId,
      patch: { position: [4, 5, 6] },
    });

    const exported = await runtime.callTool('export_r3f', {});
    expect(exported.ok).toBe(true);
    const generatedPath = runtime.getProjectInfo().generatedModulePath;
    let code = await readFile(generatedPath, 'utf8');
    code = code.replace(
      '"position": [\n            0,\n            0,\n            0\n          ]',
      '"position": [\n            4,\n            5,\n            6\n          ]',
    );
    await writeFile(generatedPath, code, 'utf8');

    const synced = await runtime.callTool('sync_code', { direction: 'fromCode' });
    expect(synced.ok).toBe(true);
    const current = await runtime.callTool('get_scene', {});
    expect(current).toEqual({ ok: true, data: { scene: nextScene } });
  });
});
