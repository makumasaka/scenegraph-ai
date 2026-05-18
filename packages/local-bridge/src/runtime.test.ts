import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { createEmptyScene, applyCommand, type Command } from '@dioramai/core';
import { parseSceneFromR3fSyncModule } from '@dioramai/export-r3f';
import {
  DioramaiBridgeRuntime,
  doctorDioramaiProject,
  initializeDioramaiProject,
  resolveWorkspaceRelativePath,
  startDioramaiBridgeServer,
} from './runtime';

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

const waitFor = async (predicate: () => Promise<boolean>, timeoutMs = 1500): Promise<boolean> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  return false;
};

describe('Dioramai project onboarding', () => {
  let initRoot = '';

  afterEach(async () => {
    if (initRoot) await rm(initRoot, { recursive: true, force: true });
    initRoot = '';
  });

  it('scaffolds a minimal Vite/R3F project in an empty folder', async () => {
    initRoot = await mkdtemp(join(tmpdir(), 'dioramai-init-'));

    const result = await initializeDioramaiProject(initRoot, {
      template: 'vite-r3f',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.configPath.endsWith('dioramai.config.json')).toBe(true);
    expect(result.data.generatedModule.endsWith('src\\generated\\DioramaiScene.generated.tsx') ||
      result.data.generatedModule.endsWith('src/generated/DioramaiScene.generated.tsx')).toBe(true);
    expect(result.data.wroteFiles).toEqual(expect.arrayContaining([
      'package.json',
      'index.html',
      'src/main.tsx',
      'src/App.tsx',
      'src/DioramaiApp.tsx',
      'src/generated/DioramaiScene.generated.tsx',
      'src/generated/dioramai.scene.json',
      '.cursor/rules/dioramai.mdc',
    ]));

    const wrapper = await readFile(resolve(initRoot, 'src/DioramaiApp.tsx'), 'utf8');
    expect(wrapper).toContain("import { DioramaiScene } from './generated/DioramaiScene.generated';");
    const generated = await readFile(resolve(initRoot, 'src/generated/DioramaiScene.generated.tsx'), 'utf8');
    expect(generated).not.toContain(initRoot);
    expect(parseSceneFromR3fSyncModule(generated).ok).toBe(true);
  });

  it('refuses to scaffold a non-empty folder without --force', async () => {
    initRoot = await mkdtemp(join(tmpdir(), 'dioramai-init-nonempty-'));
    await writeFile(resolve(initRoot, 'README.md'), 'keep me', 'utf8');

    const result = await initializeDioramaiProject(initRoot, {
      template: 'vite-r3f',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PROJECT_NOT_EMPTY');
    expect(await readFile(resolve(initRoot, 'README.md'), 'utf8')).toBe('keep me');
  });

  it('reports a fresh scaffold as doctor-ready with only non-blocking warnings', async () => {
    initRoot = await mkdtemp(join(tmpdir(), 'dioramai-doctor-'));
    const initialized = await initializeDioramaiProject(initRoot, {
      template: 'vite-r3f',
    });
    expect(initialized.ok).toBe(true);

    const doctor = await doctorDioramaiProject(initRoot, { port: 9 });

    expect(doctor.ok).toBe(true);
    if (!doctor.ok) return;
    expect(doctor.data.ok).toBe(true);
    expect(doctor.data.items.filter((item) => item.status === 'fail')).toEqual([]);
    expect(doctor.data.items.map((item) => item.label)).toEqual(expect.arrayContaining([
      'package.json',
      'React/R3F dependencies',
      'dioramai.config.json',
      'Generated scene parses',
      'App wiring',
    ]));
  });

  it('reports clear doctor failures for missing project essentials', async () => {
    initRoot = await mkdtemp(join(tmpdir(), 'dioramai-doctor-missing-'));

    const doctor = await doctorDioramaiProject(initRoot, { port: 9 });

    expect(doctor.ok).toBe(true);
    if (!doctor.ok) return;
    expect(doctor.data.ok).toBe(false);
    const failedLabels = doctor.data.items
      .filter((item) => item.status === 'fail')
      .map((item) => item.label);
    expect(failedLabels).toEqual(expect.arrayContaining([
      'package.json',
      'dioramai.config.json',
      'Asset directory',
      'Generated scene module',
    ]));
  });
});

describe('DioramaiBridgeRuntime importAsset and sync', () => {
  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'dioramai-bridge-'));
    await mkdir(resolve(projectRoot, 'fixtures'), { recursive: true });
    await writeFile(resolve(projectRoot, sourceRel), createTestGlb());
  });

  afterEach(async () => {
    if (projectRoot) await rm(projectRoot, { recursive: true, force: true });
    projectRoot = '';
  });

  it('imports a project GLB through validated commands with shallow hierarchy', async () => {
    const runtime = new DioramaiBridgeRuntime(createEmptyScene('Import Test'), {
      projectRoot,
    });

    const result = await runtime.callTool('import_glb_asset', {
      path: sourceRel,
      name: 'Fixture Chair',
      importMode: 'shallow',
      semanticRole: 'decor',
      dryRun: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.assetId).toBe('asset-bridge-import-test');
    expect(result.data.commands.map((command: Command) => command.type)).toEqual([
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
      uri: '/assets/models/bridge-import-test.glb',
    });
    expect(result.data.scene.nodes['asset-bridge-import-test-node']?.name).toBe('Fixture Chair');
    expect(result.data.scene.nodes['asset-bridge-import-test-node']?.semantics?.role).toBe('decor');
    expect(result.data.scene.assets?.['asset-bridge-import-test']?.kind).toBe('glb');
    expect(result.data.scene.assets?.['asset-bridge-import-test']?.source).toBe('manual');
  });

  it('loads dioramai.config.json and reports project status', async () => {
    await writeFile(resolve(projectRoot, 'dioramai.config.json'), JSON.stringify({
      projectRoot: '.',
      assetDir: 'public/assets/models',
      generatedSceneFile: 'src/generated/DioramaiScene.generated.tsx',
      publicAssetBase: '/assets/models',
      sceneJsonFile: 'src/generated/dioramai.scene.json',
    }, null, 2));

    const runtime = new DioramaiBridgeRuntime(createEmptyScene('Config Test'), {
      projectRoot,
    });

    const status = await runtime.callTool('get_project_status', {});
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    expect(status.data.configFound).toBe(true);
    expect(status.data.assetDirExists).toBe(false);
    expect(status.data.generatedFileExists).toBe(false);
    expect(status.data.currentSceneLoaded).toBe(true);
    expect(status.data.publicAssetBase).toBe('/assets/models');
  });

  it('rejects workspace paths outside the project root', async () => {
    expect(resolveWorkspaceRelativePath('../secret.glb', projectRoot).ok).toBe(false);

    const runtime = new DioramaiBridgeRuntime(createEmptyScene('Import Test'), {
      projectRoot,
    });
    const result = await runtime.callTool('register_asset', {
      workspaceRelativePath: '../secret.glb',
      importMode: 'shallow',
    });
    expect(result.ok).toBe(false);
  });

  it('maps public asset URLs only into the configured project asset dir', () => {
    const runtime = new DioramaiBridgeRuntime(createEmptyScene('Asset Route Test'), {
      projectRoot,
    });

    expect(runtime.resolvePublicAssetPath('/assets/models/chair.glb').ok).toBe(true);
    expect(runtime.resolvePublicAssetPath('/assets/other/chair.glb').ok).toBe(false);
    expect(runtime.resolvePublicAssetPath('/assets/models/../secret.glb').ok).toBe(false);
    expect(runtime.resolvePublicAssetPath('/assets/models/chair.exe').ok).toBe(false);
  });

  it('writes deterministic generated R3F sync modules from runtime commands', async () => {
    const scene = createEmptyScene('Sync Test');
    const runtime = new DioramaiBridgeRuntime(scene, { projectRoot });
    const node = {
      ...Object.values(scene.nodes)[0]!,
      id: 'box',
      name: 'Box',
      type: 'mesh' as const,
    };

    const loaded = await runtime.callTool('load_scene', {
      scene: applyCommand(scene, { type: 'ADD_NODE', parentId: scene.rootId, node }),
    });
    expect(loaded.ok).toBe(true);
    const transformed = await runtime.callTool('update_transform', {
      nodeId: 'box',
      patch: { position: [1, 2, 3] },
    });

    expect(transformed.ok).toBe(true);
    const generatedPath = runtime.getProjectInfo().generatedModulePath;
    const code = await readFile(generatedPath, 'utf8');
    expect(code).not.toContain(projectRoot);
    expect(code).not.toContain(projectRoot.replace(/\\/g, '\\\\'));
    const parsed = parseSceneFromR3fSyncModule(code);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.scene.nodes.box?.transform.position).toEqual([1, 2, 3]);

    const sceneJson = await readFile(runtime.getProjectInfo().sessionPath, 'utf8');
    expect(sceneJson).not.toContain(projectRoot);
    const secondWrite = await runtime.callTool('write_scene_to_file', {});
    expect(secondWrite.ok).toBe(true);
    if (secondWrite.ok) {
      expect((secondWrite.data as { bytesChanged: boolean }).bytesChanged).toBe(false);
    }
  });

  it('loads code edits from the generated scene block through sync_code parsing', async () => {
    const scene = createEmptyScene('Sync Test');
    const runtime = new DioramaiBridgeRuntime(scene, { projectRoot });
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

    const synced = await runtime.callTool('reload_scene_from_file', {});
    expect(synced.ok).toBe(true);
    const current = await runtime.callTool('get_scene', {});
    expect(current).toEqual({ ok: true, data: { scene: nextScene } });
  });

  it('watches generated module edits without suppressing real user changes after Dioramai writes', async () => {
    const scene = createEmptyScene('Watch Sync Test');
    const runtime = new DioramaiBridgeRuntime(scene, {
      projectRoot,
      watchCode: true,
      codeWatchDebounceMs: 10,
    });
    try {
      const rootId = scene.rootId;
      const exported = await runtime.callTool('write_scene_to_file', {});
      expect(exported.ok).toBe(true);

      let code = await readFile(runtime.getProjectInfo().generatedModulePath, 'utf8');
      code = code.replace(
        '"position": [\n            0,\n            0,\n            0\n          ]',
        '"position": [\n            8,\n            0,\n            0\n          ]',
      );
      await writeFile(runtime.getProjectInfo().generatedModulePath, code, 'utf8');

      const reloaded = await waitFor(async () => {
        const current = await runtime.callTool('get_scene', {});
        return current.ok && current.data.scene.nodes[rootId]?.transform.position[0] === 8;
      });
      expect(reloaded).toBe(true);
    } finally {
      runtime.close();
    }
  });

  it('rejects invalid scene JSON when reloading from file fallback', async () => {
    const runtime = new DioramaiBridgeRuntime(createEmptyScene('Invalid Reload'), { projectRoot });
    await mkdir(resolve(projectRoot, 'src/generated'), { recursive: true });
    await writeFile(runtime.getProjectInfo().sessionPath, '{"format":"dioramai-scene","version":2,"data":{}}', 'utf8');

    const result = await runtime.callTool('reload_scene_from_file', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('SCENE_BLOCK_INVALID');
  });

  it('rejects unsafe generic bridge tools over the HTTP tool route', async () => {
    const started = await startDioramaiBridgeServer(0, {
      projectRoot,
      pairingToken: 'test-token',
    });
    try {
      const response = await fetch(`http://127.0.0.1:${started.port}/tools/apply_command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: { type: 'SET_SELECTION', nodeId: null } }),
      });
      const payload = await response.json() as { ok: boolean; error?: { code: string } };
      expect(response.status).toBe(404);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe('NOT_FOUND');
    } finally {
      await started.close();
    }
  });

  it('requires a pairing token for browser-origin bridge requests', async () => {
    const started = await startDioramaiBridgeServer(0, {
      projectRoot,
      pairingToken: 'test-token',
    });
    try {
      const rejected = await fetch(`http://127.0.0.1:${started.port}/scene`, {
        headers: { Origin: 'https://example.com' },
      });
      expect(rejected.status).toBe(403);

      const accepted = await fetch(`http://127.0.0.1:${started.port}/scene?token=test-token`, {
        headers: { Origin: 'https://example.com' },
      });
      expect(accepted.status).toBe(200);
    } finally {
      await started.close();
    }
  });
});
