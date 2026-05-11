import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { createAgentRuntime } from '@diorama/agent-interface';
import { createNode, type Scene } from '@diorama/core';
import { ingestAssetWithHierarchy } from '@diorama/ingestion';

type AgentResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

const expectOk = <T>(result: AgentResult<T>, step: string): T => {
  if (result.ok) return result.data;
  throw new Error(`${step} failed: ${result.error.code} ${result.error.message}`);
};

const usage = 'Usage: npm run ingest:glb -- path/to/model.glb';

const sanitizeStem = (stem: string): string => {
  const sanitized = stem
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized.length > 0 ? sanitized : 'asset';
};

const safeFileNameFor = (sourcePath: string): { fileName: string; slug: string; format: 'glb' | 'gltf' } => {
  const fileName = basename(sourcePath);
  const rawExt = extname(fileName);
  const ext = rawExt.toLowerCase();
  if (ext !== '.glb' && ext !== '.gltf') {
    throw new Error(`Expected a .glb or .gltf file. ${usage}`);
  }

  const rawStem = rawExt.length > 0 ? fileName.slice(0, -rawExt.length) : fileName;
  const stem = sanitizeStem(rawStem);
  return {
    fileName: `${stem}${ext}`,
    slug: stem.toLowerCase(),
    format: ext === '.gltf' ? 'gltf' : 'glb',
  };
};

const samePath = (left: string, right: string): boolean =>
  resolve(left).toLowerCase() === resolve(right).toLowerCase();

const copyFileIfDifferent = async (sourcePath: string, targetPath: string): Promise<void> => {
  if (samePath(sourcePath, targetPath)) return;
  await copyFile(sourcePath, targetPath);
};

const importedScene = (): Scene => {
  const root = createNode({
    id: 'root',
    name: 'Imported GLB Scene',
    type: 'root',
  });

  return {
    rootId: root.id,
    selection: null,
    nodes: { [root.id]: root },
  };
};

const run = async (): Promise<void> => {
  const sourceArg = process.argv[2];
  if (!sourceArg) throw new Error(usage);

  const sourcePath = resolve(sourceArg);
  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isFile()) throw new Error(`Not a file: ${sourcePath}`);

  const { fileName, slug, format } = safeFileNameFor(sourcePath);
  const publicUri = `/assets/imports/${fileName}`;
  const workspaceAssetPath = `apps/web/public/assets/imports/${fileName}`;
  const webAssetPath = resolve('apps/web/public/assets/imports', fileName);
  const demoAssetPath = resolve('apps/demo-export/public/assets/imports', fileName);
  const webScenePath = resolve('apps/web/public/scenes/imported-glb.scene.json');
  const demoScenePath = resolve('apps/demo-export/public/scene.generated.json');
  const generatedTargetPath = resolve('apps/demo-export/src/generated/DioramaScene.generated.tsx');

  await mkdir(dirname(webAssetPath), { recursive: true });
  await mkdir(dirname(demoAssetPath), { recursive: true });
  await mkdir(dirname(webScenePath), { recursive: true });
  await mkdir(dirname(generatedTargetPath), { recursive: true });

  await copyFileIfDifferent(sourcePath, webAssetPath);
  await copyFileIfDifferent(sourcePath, demoAssetPath);

  const runtime = createAgentRuntime(importedScene());

  const ingestion = await ingestAssetWithHierarchy(
    {
      localPath: workspaceAssetPath,
      format,
      id: `asset-${slug}`,
      uri: publicUri,
      provider: 'mock',
      metadata: {
        importedFrom: workspaceAssetPath,
      },
    },
    {
      parentId: 'root',
      nodeId: `asset-${slug}-node`,
      nodeName: `${sanitizeStem(slug)} Product`,
      includeHierarchy: true,
    },
  );

  const ingested = expectOk(
    runtime.applyCommandBatch(ingestion.commands, { source: 'agent' }),
    'applyCommandBatch(ingestAsset)',
  );
  if (ingested.errors.length > 0) {
    throw new Error(`ingestAsset returned ${ingested.errors.length} command error(s)`);
  }
  for (const warning of ingestion.warnings) console.warn(warning);

  expectOk(runtime.structureScene({ preset: 'showroom' }), 'structureScene');
  expectOk(runtime.makeInteractive({ targetRole: 'product' }), 'makeInteractive');

  const json = expectOk(runtime.exportJSON(), 'exportJSON').content;
  const r3f = expectOk(
    runtime.exportR3F({
      mode: 'module',
      componentName: 'DioramaScene',
      semanticComponents: true,
      behaviorScaffold: 'handlers',
      includeStudioLights: true,
    }),
    'exportR3F',
  ).content;

  await writeFile(webScenePath, json, 'utf8');
  await writeFile(demoScenePath, json, 'utf8');
  await writeFile(generatedTargetPath, r3f, 'utf8');

  console.log(`Copied GLB for Diorama canvas: ${webAssetPath}`);
  console.log(`Copied GLB for R3F preview: ${demoAssetPath}`);
  console.log(`Wrote importable Diorama scene: ${webScenePath}`);
  console.log(`Wrote R3F preview scene JSON: ${demoScenePath}`);
  console.log(`Wrote R3F component: ${generatedTargetPath}`);
  console.log(`Asset URI in scenegraph: ${publicUri}`);
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
