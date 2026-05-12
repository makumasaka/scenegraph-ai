import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgentRuntime, type AgentRuntime } from '@diorama/agent-interface';
import { getStarterScene, type Command, type Scene, type SemanticRole } from '@diorama/core';
import { ingestAssetWithHierarchy, type IngestAssetInput, type IngestionResult } from '@diorama/ingestion';
import { parseSceneJson, serializeScene } from '@diorama/schema';

export const DEFAULT_BRIDGE_PORT = 7777;

type AgentResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; issues?: unknown } };

type BridgeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; issues?: unknown } };

type JsonRecord = Record<string, unknown>;

type SceneEvent = {
  type: 'scene';
  scene: Scene;
  command?: Command;
  summary?: unknown;
  source: 'bridge' | 'mcp' | 'web';
};

export type ImportAssetSource =
  | { kind: 'workspacePath'; path: string }
  | { kind: 'uploadedFile'; name: string; data: Buffer };

export type ImportAssetInput = {
  source: ImportAssetSource;
  importMode?: 'single' | 'shallow';
  semanticRole?: SemanticRole;
  parentId?: string;
  dryRun?: boolean;
};

export type ImportAssetResult = {
  assetId: string;
  commands: Command[];
  warnings: string[];
  sceneSummary: {
    nodeCount: number;
    assetCount: number;
    rootChildCount: number;
  };
  importedNodeIds: string[];
  hierarchySummary?: {
    nodeCount: number;
    rootNodeIds: string[];
  };
  scene: Scene;
  changed: boolean;
  dryRun: boolean;
  errors: unknown[];
  appliedCommandCount: number;
};

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

const repoPath = (...parts: string[]): string => resolve(REPO_ROOT, ...parts);

const SESSION_PATH = repoPath('.diorama/session.scene.json');
const WEB_IMPORTED_SCENE_PATH = repoPath('apps/web/public/scenes/imported-glb.scene.json');
const WEB_LIVE_SCENE_PATH = repoPath('apps/web/public/scenes/bridge-session.scene.json');
const DEMO_SCENE_PATH = repoPath('apps/demo-export/public/scene.generated.json');
const GENERATED_R3F_PATH = repoPath('apps/demo-export/src/generated/DioramaScene.generated.tsx');
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const SEMANTIC_ROLES = new Set<SemanticRole>([
  'product',
  'display',
  'seating',
  'lighting',
  'light',
  'environment',
  'navigation',
  'decor',
  'container',
  'unknown',
]);

const ok = <T>(data: T): BridgeResult<T> => ({ ok: true, data });

const fail = (code: string, message: string, issues?: unknown): BridgeResult<never> => ({
  ok: false,
  error: {
    code,
    message,
    ...(issues !== undefined ? { issues } : {}),
  },
});

const unwrap = <T>(result: AgentResult<T>, step: string): BridgeResult<T> =>
  result.ok ? ok(result.data) : fail(result.error.code, `${step}: ${result.error.message}`, result.error.issues);

const jsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type AssetProvider = 'meshy' | 'tripo' | 'luma' | 'mock';

const assetProviderFromValue = (value: unknown): AssetProvider | undefined =>
  value === 'meshy' || value === 'tripo' || value === 'luma' || value === 'mock'
    ? value
    : undefined;

const assetFormatFromValue = (value: unknown): 'glb' | 'gltf' | undefined =>
  value === 'glb' || value === 'gltf' ? value : undefined;

const finiteNumberFromValue = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const semanticRoleFromValue = (value: unknown): SemanticRole | undefined =>
  typeof value === 'string' && SEMANTIC_ROLES.has(value as SemanticRole)
    ? value as SemanticRole
    : undefined;

const importModeFromValue = (value: unknown): ImportAssetInput['importMode'] | undefined =>
  value === 'single' || value === 'shallow' ? value : undefined;

const isPathInside = (targetPath: string, rootPath: string): boolean => {
  const rel = relative(rootPath, targetPath);
  return rel === '' || (!rel.startsWith('..') && !resolve(rel).startsWith('..'));
};

export const resolveWorkspaceRelativePath = (workspaceRelativePath: string): BridgeResult<string> => {
  if (workspaceRelativePath.trim().length === 0 || workspaceRelativePath.includes('\0')) {
    return fail('VALIDATION_ERROR', 'workspaceRelativePath must be a non-empty workspace-relative path.');
  }
  if (/^[a-zA-Z]:[\\/]/.test(workspaceRelativePath) || workspaceRelativePath.startsWith('/') || workspaceRelativePath.startsWith('\\')) {
    return fail('VALIDATION_ERROR', 'workspaceRelativePath must be relative to the Diorama workspace.');
  }
  const absolutePath = resolve(REPO_ROOT, workspaceRelativePath);
  if (!isPathInside(absolutePath, REPO_ROOT)) {
    return fail('VALIDATION_ERROR', 'workspaceRelativePath must stay inside the Diorama workspace.');
  }
  return ok(absolutePath);
};

const readRequestBuffer = async (
  req: IncomingMessage,
  maxBytes = MAX_UPLOAD_BYTES,
): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) throw new Error(`Request body exceeds ${maxBytes} bytes.`);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
};

const readJson = async (req: IncomingMessage): Promise<unknown> => {
  const raw = (await readRequestBuffer(req)).toString('utf8').trim();
  if (raw.length === 0) return {};
  return JSON.parse(raw) as unknown;
};

const writeJson = (res: ServerResponse, statusCode: number, value: unknown): void => {
  res.writeHead(statusCode, jsonHeaders);
  res.end(JSON.stringify(value));
};

const sendSse = (res: ServerResponse, event: SceneEvent): void => {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
};

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
    throw new Error('Expected a .glb or .gltf file.');
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
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
};

const writeFileIfDifferent = async (targetPath: string, data: Buffer): Promise<void> => {
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, data);
};

const uniqueRecordId = <T>(
  baseId: string,
  record: Record<string, T> | undefined,
): string => {
  if (record?.[baseId] === undefined) return baseId;
  let suffix = 2;
  let candidate = `${baseId}-${suffix}`;
  while (record[candidate] !== undefined) {
    suffix += 1;
    candidate = `${baseId}-${suffix}`;
  }
  return candidate;
};

const commandNodeIds = (commands: Command[]): string[] =>
  commands
    .filter((command): command is Extract<Command, { type: 'ADD_NODE' }> => command.type === 'ADD_NODE')
    .map((command) => command.node.id);

const commandAssetId = (commands: Command[]): string | undefined =>
  commands.find((command): command is Extract<Command, { type: 'REGISTER_ASSET' }> =>
    command.type === 'REGISTER_ASSET',
  )?.asset.id;

const sceneSummary = (scene: Scene): ImportAssetResult['sceneSummary'] => ({
  nodeCount: Object.keys(scene.nodes).length,
  assetCount: Object.keys(scene.assets ?? {}).length,
  rootChildCount: scene.nodes[scene.rootId]?.children.length ?? 0,
});

const loadSceneFromFile = async (path: string): Promise<Scene | null> => {
  try {
    const text = await readFile(path, 'utf8');
    return parseSceneJson(text);
  } catch {
    return null;
  }
};

export const loadInitialBridgeScene = async (): Promise<Scene> =>
  (await loadSceneFromFile(SESSION_PATH)) ??
  (await loadSceneFromFile(WEB_IMPORTED_SCENE_PATH)) ??
  getStarterScene('default');

export class DioramaBridgeRuntime {
  private runtime: AgentRuntime;
  private clients = new Set<ServerResponse>();

  constructor(initialScene: Scene) {
    this.runtime = createAgentRuntime(initialScene, {
      generation: {
        assetOutputDir: repoPath('apps/web/public/assets/generated'),
        publicUrlBase: '/assets/generated',
        defaultMode: 'mock',
      },
    });
  }

  addClient(res: ServerResponse): void {
    this.clients.add(res);
    const scene = this.getSceneResult();
    if (scene.ok) {
      sendSse(res, {
        type: 'scene',
        scene: scene.data.scene,
        source: 'bridge',
      });
    }
    res.on('close', () => this.clients.delete(res));
  }

  private getSceneResult(): BridgeResult<{ scene: Scene }> {
    return unwrap(this.runtime.getScene(), 'get_scene');
  }

  private async persistScene(scene: Scene): Promise<void> {
    const json = serializeScene(scene);
    await mkdir(dirname(SESSION_PATH), { recursive: true });
    await mkdir(dirname(WEB_LIVE_SCENE_PATH), { recursive: true });
    await writeFile(SESSION_PATH, json, 'utf8');
    await writeFile(WEB_LIVE_SCENE_PATH, json, 'utf8');
  }

  private async publishScene(source: SceneEvent['source'], command?: Command, summary?: unknown): Promise<void> {
    const scene = this.getSceneResult();
    if (!scene.ok) return;
    await this.persistScene(scene.data.scene);
    const event: SceneEvent = {
      type: 'scene',
      scene: scene.data.scene,
      source,
      ...(command !== undefined ? { command } : {}),
      ...(summary !== undefined ? { summary } : {}),
    };
    for (const client of this.clients) sendSse(client, event);
  }

  async callTool(name: string, input: unknown, source: SceneEvent['source'] = 'mcp'): Promise<BridgeResult<unknown>> {
    try {
      switch (name) {
        case 'health':
          return ok({ status: 'ok' });
        case 'get_scene':
          return this.getSceneResult();
        case 'get_semantic_groups':
          return unwrap(this.runtime.getSemanticGroups(), name);
        case 'get_behaviors':
          return unwrap(this.runtime.getBehaviors(), name);
        case 'get_action_log':
          return unwrap(this.runtime.getActionLog(), name);
        case 'apply_command':
          return this.applyCommand(input, source);
        case 'apply_command_batch':
          return this.applyCommandBatch(input, source);
        case 'load_scene':
          return this.loadScene(input, source);
        case 'structure_scene':
          return this.structureScene(input, source);
        case 'make_interactive':
          return this.makeInteractive(input, source);
        case 'arrange_nodes':
          return this.arrangeNodes(input, source);
        case 'generate_asset':
          return this.generateAsset(input);
        case 'generate_and_ingest_asset':
          return this.generateAndIngestAsset(input, source);
        case 'import_glb_asset':
          return this.importGlbAssetTool(input, source);
        case 'ingest_asset':
          return this.ingestAsset(input, source);
        case 'ingest_local_asset':
          return this.ingestLocalAsset(input, source);
        case 'export_json':
          return this.exportJson(input);
        case 'export_r3f':
          return this.exportR3f(input);
        default:
          return fail('TOOL_NOT_FOUND', `Unknown Diorama bridge tool: ${name}`);
      }
    } catch (error) {
      return fail('BRIDGE_ERROR', error instanceof Error ? error.message : String(error));
    }
  }

  private async applyCommand(input: unknown, source: SceneEvent['source']): Promise<BridgeResult<unknown>> {
    const payload = isRecord(input) && 'command' in input ? input.command : input;
    const dryRun = isRecord(input) && input.dryRun === true;
    const result = unwrap(this.runtime.applyCommand(payload, { dryRun, source: source === 'web' ? 'user' : 'agent' }), 'apply_command');
    if (!result.ok) return result;
    if (!dryRun && result.data.changed) {
      await this.publishScene(source, isRecord(payload) && typeof payload.type === 'string' ? payload as Command : undefined, result.data.summary);
    }
    return result;
  }

  private async applyCommandBatch(input: unknown, source: SceneEvent['source']): Promise<BridgeResult<unknown>> {
    const payload = isRecord(input) && Array.isArray(input.commands) ? input.commands : input;
    const dryRun = isRecord(input) && input.dryRun === true;
    const result = unwrap(
      this.runtime.applyCommandBatch(payload, { dryRun, source: source === 'web' ? 'user' : 'agent' }),
      'apply_command_batch',
    );
    if (!result.ok) return result;
    if (!dryRun && result.data.changed) await this.publishScene(source);
    return result;
  }

  private async applyIngestionPlan(
    ingestion: IngestionResult,
    input: unknown,
    source: SceneEvent['source'],
    step: string,
  ): Promise<BridgeResult<unknown>> {
    const dryRun = isRecord(input) && input.dryRun === true;
    const result = unwrap(
      this.runtime.applyCommandBatch(ingestion.commands, { dryRun, source: source === 'web' ? 'user' : 'agent' }),
      step,
    );
    if (!result.ok) return result;
    if (!dryRun && result.data.changed) await this.publishScene(source);
    return ok({
      ...result.data,
      warnings: [...result.data.warnings, ...ingestion.warnings],
      ...(ingestion.assets !== undefined ? { assets: ingestion.assets } : {}),
    });
  }

  private async loadScene(input: unknown, source: SceneEvent['source']): Promise<BridgeResult<unknown>> {
    const scene =
      isRecord(input) && typeof input.json === 'string'
        ? parseSceneJson(input.json)
        : isRecord(input) && isRecord(input.scene)
          ? input.scene as Scene
          : null;
    if (scene === null) return fail('PARSE_ERROR', 'load_scene requires { json } or { scene }.');
    const dryRun = isRecord(input) && input.dryRun === true;
    const result = unwrap(
      this.runtime.applyCommand({ type: 'REPLACE_SCENE', scene }, { dryRun, source: source === 'web' ? 'user' : 'agent' }),
      'load_scene',
    );
    if (!result.ok) return result;
    if (!dryRun) await this.publishScene(source, { type: 'REPLACE_SCENE', scene });
    return result;
  }

  private async structureScene(input: unknown, source: SceneEvent['source']): Promise<BridgeResult<unknown>> {
    const dryRun = isRecord(input) && input.dryRun === true;
    const result = unwrap(this.runtime.structureScene(input), 'structure_scene');
    if (!result.ok) return result;
    if (!dryRun && result.data.changed) await this.publishScene(source, { type: 'STRUCTURE_SCENE', preset: 'showroom' }, result.data.summary);
    return result;
  }

  private async makeInteractive(input: unknown, source: SceneEvent['source']): Promise<BridgeResult<unknown>> {
    const dryRun = isRecord(input) && input.dryRun === true;
    const result = unwrap(this.runtime.makeInteractive(input), 'make_interactive');
    if (!result.ok) return result;
    if (!dryRun && result.data.changed) {
      const targetRole = isRecord(input) && typeof input.targetRole === 'string' ? input.targetRole : undefined;
      await this.publishScene(source, { type: 'MAKE_INTERACTIVE', ...(targetRole ? { targetRole } : {}) } as Command, result.data.summary);
    }
    return result;
  }

  private async arrangeNodes(input: unknown, source: SceneEvent['source']): Promise<BridgeResult<unknown>> {
    const dryRun = isRecord(input) && input.dryRun === true;
    const result = unwrap(this.runtime.arrangeNodes(input), 'arrange_nodes');
    if (!result.ok) return result;
    if (!dryRun && result.data.changed) await this.publishScene(source, undefined, result.data.summary);
    return result;
  }

  private async generateAsset(input: unknown): Promise<BridgeResult<unknown>> {
    const result = unwrap(await this.runtime.generateAsset(input), 'generate_asset');
    if (!result.ok) return result;
    await this.copyAssetToDemoIfNeeded(result.data.asset.uri, result.data.asset.localPath);
    return result;
  }

  private async generateAndIngestAsset(input: unknown, source: SceneEvent['source']): Promise<BridgeResult<unknown>> {
    const generated = await this.generateAsset(input);
    if (!generated.ok) return generated;
    const asset = (generated.data as { asset: unknown }).asset;
    const ingested = await this.ingestAsset({ kind: 'generated', asset, includeHierarchy: true }, source);
    if (!ingested.ok) return ingested;
    return ok({ generated: generated.data, ingestion: ingested.data });
  }

  async importAsset(
    input: ImportAssetInput,
    source: SceneEvent['source'] = 'mcp',
  ): Promise<BridgeResult<ImportAssetResult>> {
    const scene = this.getSceneResult();
    if (!scene.ok) return scene;

    const mode = input.importMode ?? 'shallow';
    const sourcePath = await this.prepareImportAssetFile(input.source);
    if (!sourcePath.ok) return sourcePath;

    const { fileName, slug, format } = safeFileNameFor(sourcePath.data.localPath);
    const publicUri = `/assets/imports/${fileName}`;
    const assetId = uniqueRecordId(`asset-${slug}`, scene.data.scene.assets);
    const nodeId = uniqueRecordId(`${assetId}-node`, scene.data.scene.nodes);
    const semanticRole = input.semanticRole;

    const ingestion = await ingestAssetWithHierarchy({
      localPath: sourcePath.data.workspaceRelativePath,
      format,
      id: assetId,
      uri: publicUri,
      provider: 'mock',
      metadata: {
        importedFrom: sourcePath.data.workspaceRelativePath,
        importSource: input.source.kind,
      },
    }, {
      parentId: input.parentId ?? scene.data.scene.rootId,
      nodeId,
      nodeName: `${sanitizeStem(slug)} Product`,
      includeHierarchy: mode === 'shallow',
    });

    const importedNodeIds = commandNodeIds(ingestion.commands);
    if (semanticRole !== undefined && importedNodeIds[0] !== undefined) {
      ingestion.commands.push({
        type: 'SET_NODE_SEMANTICS',
        nodeIds: [importedNodeIds[0]],
        semantics: {
          role: semanticRole,
          source: 'agent',
        },
      });
    }

    return this.applyImportPlan(ingestion, input, source, {
      assetId,
      importedNodeIds,
      hierarchyRootNodeIds: importedNodeIds.slice(1).filter((id) =>
        ingestion.commands.some((command) =>
          command.type === 'ADD_NODE' && command.parentId === importedNodeIds[0] && command.node.id === id,
        ),
      ),
    });
  }

  private async importGlbAssetTool(input: unknown, source: SceneEvent['source']): Promise<BridgeResult<unknown>> {
    if (!isRecord(input) || typeof input.workspaceRelativePath !== 'string') {
      return fail('VALIDATION_ERROR', 'import_glb_asset requires { workspaceRelativePath }.');
    }
    if (input.importMode !== undefined && importModeFromValue(input.importMode) === undefined) {
      return fail('VALIDATION_ERROR', 'importMode must be "single" or "shallow".');
    }
    if (input.semanticRole !== undefined && semanticRoleFromValue(input.semanticRole) === undefined) {
      return fail('VALIDATION_ERROR', 'semanticRole is not a supported Diorama semantic role.');
    }
    const resolved = resolveWorkspaceRelativePath(input.workspaceRelativePath);
    if (!resolved.ok) return resolved;
    const sourceStat = await stat(resolved.data);
    if (!sourceStat.isFile()) {
      return fail('VALIDATION_ERROR', `Not a file: ${input.workspaceRelativePath}`);
    }
    return this.importAsset({
      source: { kind: 'workspacePath', path: input.workspaceRelativePath },
      importMode: importModeFromValue(input.importMode) ?? 'shallow',
      ...(semanticRoleFromValue(input.semanticRole) !== undefined
        ? { semanticRole: semanticRoleFromValue(input.semanticRole) }
        : {}),
      ...(typeof input.parentId === 'string' ? { parentId: input.parentId } : {}),
      ...(input.dryRun === true ? { dryRun: true } : {}),
    }, source);
  }

  private async prepareImportAssetFile(source: ImportAssetSource): Promise<BridgeResult<{
    localPath: string;
    workspaceRelativePath: string;
  }>> {
    const sourceInfo = source.kind === 'workspacePath'
      ? safeFileNameFor(source.path)
      : safeFileNameFor(source.name);
    const publicFileName = sourceInfo.fileName;
    const webAssetPath = repoPath('apps/web/public/assets/imports', publicFileName);
    const demoAssetPath = repoPath('apps/demo-export/public/assets/imports', publicFileName);
    const workspaceRelativePath = `apps/web/public/assets/imports/${publicFileName}`;

    if (source.kind === 'workspacePath') {
      const resolved = resolveWorkspaceRelativePath(source.path);
      if (!resolved.ok) return resolved;
      const sourceStat = await stat(resolved.data);
      if (!sourceStat.isFile()) return fail('VALIDATION_ERROR', `Not a file: ${source.path}`);
      await copyFileIfDifferent(resolved.data, webAssetPath);
      await copyFileIfDifferent(resolved.data, demoAssetPath);
      return ok({ localPath: resolved.data, workspaceRelativePath });
    }

    if (source.data.byteLength === 0) {
      return fail('VALIDATION_ERROR', 'Uploaded GLB file is empty.');
    }
    if (source.data.byteLength > MAX_UPLOAD_BYTES) {
      return fail('VALIDATION_ERROR', `Uploaded GLB file exceeds ${MAX_UPLOAD_BYTES} bytes.`);
    }
    await writeFileIfDifferent(webAssetPath, source.data);
    await writeFileIfDifferent(demoAssetPath, source.data);
    return ok({ localPath: webAssetPath, workspaceRelativePath });
  }

  private async applyImportPlan(
    ingestion: IngestionResult,
    input: ImportAssetInput,
    source: SceneEvent['source'],
    summary: {
      assetId: string;
      importedNodeIds: string[];
      hierarchyRootNodeIds: string[];
    },
  ): Promise<BridgeResult<ImportAssetResult>> {
    const result = unwrap(
      this.runtime.applyCommandBatch(ingestion.commands, { dryRun: input.dryRun === true, source: source === 'web' ? 'user' : 'agent' }),
      'import_glb_asset',
    );
    if (!result.ok) return result;
    if (input.dryRun !== true && result.data.changed) await this.publishScene(source);
    const warnings = [...result.data.warnings, ...ingestion.warnings];
    return ok({
      ...result.data,
      assetId: commandAssetId(ingestion.commands) ?? summary.assetId,
      commands: ingestion.commands,
      warnings,
      sceneSummary: sceneSummary(result.data.scene),
      importedNodeIds: summary.importedNodeIds,
      hierarchySummary: {
        nodeCount: Math.max(0, summary.importedNodeIds.length - 1),
        rootNodeIds: summary.hierarchyRootNodeIds,
      },
    });
  }

  private async ingestAsset(input: unknown, source: SceneEvent['source']): Promise<BridgeResult<unknown>> {
    const dryRun = isRecord(input) && input.dryRun === true;
    if (isRecord(input) && (input.kind === 'local' || input.kind === 'generated')) {
      const sourceRecord = input.kind === 'generated' && isRecord(input.asset) ? input.asset : input;
      const format = assetFormatFromValue(sourceRecord.format);
      const localPath = typeof sourceRecord.localPath === 'string' ? sourceRecord.localPath : undefined;
      const shouldIncludeHierarchy = input.kind === 'local'
        ? input.includeHierarchy !== false
        : input.includeHierarchy === true;
      if (format !== undefined && localPath !== undefined && shouldIncludeHierarchy) {
        const scene = this.getSceneResult();
        if (!scene.ok) return scene;
        const provider = assetProviderFromValue(sourceRecord.provider);
        const assetInput: IngestAssetInput = {
          localPath,
          format,
          ...(typeof sourceRecord.id === 'string' ? { id: sourceRecord.id } : {}),
          ...(typeof sourceRecord.uri === 'string' ? { uri: sourceRecord.uri } : {}),
          ...(typeof sourceRecord.prompt === 'string' ? { prompt: sourceRecord.prompt } : {}),
          ...(provider !== undefined ? { provider } : {}),
          ...(isRecord(sourceRecord.metadata) ? { metadata: sourceRecord.metadata } : {}),
        };
        const ingestion = await ingestAssetWithHierarchy(assetInput, {
          parentId: typeof input.parentId === 'string' ? input.parentId : scene.data.scene.rootId,
          ...(typeof input.nodeId === 'string' ? { nodeId: input.nodeId } : {}),
          ...(typeof input.nodeName === 'string' ? { nodeName: input.nodeName } : {}),
          includeHierarchy: true,
          ...(finiteNumberFromValue(input.maxHierarchyNodes) !== undefined
            ? { maxHierarchyNodes: finiteNumberFromValue(input.maxHierarchyNodes) }
            : {}),
        });
        return this.applyIngestionPlan(ingestion, input, source, 'ingest_asset');
      }
    }

    const runtimeInput = isRecord(input) && ('includeHierarchy' in input || 'maxHierarchyNodes' in input)
      ? Object.fromEntries(
        Object.entries(input).filter(([key]) => key !== 'includeHierarchy' && key !== 'maxHierarchyNodes'),
      )
      : input;
    const result = unwrap(this.runtime.ingestAsset(runtimeInput), 'ingest_asset');
    if (!result.ok) return result;
    if (!dryRun && result.data.changed) await this.publishScene(source);
    return result;
  }

  private async ingestLocalAsset(input: unknown, source: SceneEvent['source']): Promise<BridgeResult<unknown>> {
    if (!isRecord(input) || typeof input.localPath !== 'string') {
      return fail('VALIDATION_ERROR', 'ingest_local_asset requires { localPath }.');
    }
    const sourcePath = resolve(input.localPath);
    const sourceStat = await stat(sourcePath);
    if (!sourceStat.isFile()) return fail('VALIDATION_ERROR', `Not a file: ${sourcePath}`);
    const { fileName, slug, format } = safeFileNameFor(sourcePath);
    const publicUri = `/assets/imports/${fileName}`;
    const webAssetPath = repoPath('apps/web/public/assets/imports', fileName);
    const demoAssetPath = repoPath('apps/demo-export/public/assets/imports', fileName);
    await copyFileIfDifferent(sourcePath, webAssetPath);
    await copyFileIfDifferent(sourcePath, demoAssetPath);
    const scene = this.getSceneResult();
    if (!scene.ok) return scene;
    const provider = assetProviderFromValue(input.provider) ?? 'mock';
    const ingestion = await ingestAssetWithHierarchy({
      localPath: `apps/web/public/assets/imports/${fileName}`,
      format,
      id: typeof input.id === 'string' ? input.id : `asset-${slug}`,
      uri: publicUri,
      provider,
      ...(typeof input.prompt === 'string' ? { prompt: input.prompt } : {}),
      metadata: {
        importedFrom: `apps/web/public/assets/imports/${fileName}`,
      },
    }, {
      parentId: typeof input.parentId === 'string' ? input.parentId : scene.data.scene.rootId,
      nodeId: typeof input.nodeId === 'string' ? input.nodeId : `asset-${slug}-node`,
      nodeName: typeof input.nodeName === 'string' ? input.nodeName : `${sanitizeStem(slug)} Product`,
      includeHierarchy: input.includeHierarchy !== false,
      ...(finiteNumberFromValue(input.maxHierarchyNodes) !== undefined
        ? { maxHierarchyNodes: finiteNumberFromValue(input.maxHierarchyNodes) }
        : {}),
    });
    return this.applyIngestionPlan(ingestion, input, source, 'ingest_local_asset');
  }

  private async exportJson(input: unknown): Promise<BridgeResult<unknown>> {
    const exported = unwrap(this.runtime.exportJSON(), 'export_json');
    if (!exported.ok) return exported;
    if (!isRecord(input) || input.write !== false) {
      await mkdir(dirname(WEB_LIVE_SCENE_PATH), { recursive: true });
      await writeFile(WEB_LIVE_SCENE_PATH, exported.data.content, 'utf8');
    }
    return ok({
      ...exported.data,
      path: WEB_LIVE_SCENE_PATH,
    });
  }

  private async exportR3f(input: unknown): Promise<BridgeResult<unknown>> {
    const options = isRecord(input) && isRecord(input.options)
      ? input.options
      : isRecord(input)
        ? Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'write'))
        : {};
    const exported = unwrap(this.runtime.exportR3F({
      mode: 'module',
      componentName: 'DioramaScene',
      semanticComponents: true,
      behaviorScaffold: 'handlers',
      includeStudioLights: true,
      ...options,
    }), 'export_r3f');
    if (!exported.ok) return exported;
    if (!isRecord(input) || input.write !== false) {
      const json = unwrap(this.runtime.exportJSON(), 'export_json');
      if (!json.ok) return json;
      await mkdir(dirname(GENERATED_R3F_PATH), { recursive: true });
      await mkdir(dirname(DEMO_SCENE_PATH), { recursive: true });
      await writeFile(GENERATED_R3F_PATH, exported.data.content, 'utf8');
      await writeFile(DEMO_SCENE_PATH, json.data.content, 'utf8');
    }
    return ok({
      ...exported.data,
      componentPath: GENERATED_R3F_PATH,
      scenePath: DEMO_SCENE_PATH,
    });
  }

  private async copyAssetToDemoIfNeeded(uri: string | undefined, localPath: string | undefined): Promise<void> {
    if (!uri || !localPath || !uri.startsWith('/assets/')) return;
    const sourcePath = resolve(localPath);
    const targetPath = repoPath('apps/demo-export/public', uri.replace(/^\//, ''));
    await copyFileIfDifferent(sourcePath, targetPath);
  }
}

export type StartedBridgeServer = {
  server: Server;
  runtime: DioramaBridgeRuntime;
  port: number;
  close: () => Promise<void>;
};

export const startDioramaBridgeServer = async (
  port = Number(process.env.DIORAMA_BRIDGE_PORT ?? DEFAULT_BRIDGE_PORT),
): Promise<StartedBridgeServer> => {
  const runtime = new DioramaBridgeRuntime(await loadInitialBridgeScene());
  const server = createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        writeJson(res, 204, {});
        return;
      }
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `127.0.0.1:${port}`}`);
      if (req.method === 'GET' && url.pathname === '/health') {
        writeJson(res, 200, { ok: true, data: { status: 'ok' } });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/scene') {
        writeJson(res, 200, await runtime.callTool('get_scene', {}));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/events') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Content-Type': 'text/event-stream',
        });
        runtime.addClient(res);
        return;
      }
      if (req.method !== 'POST') {
        writeJson(res, 404, fail('NOT_FOUND', `No route for ${req.method ?? 'GET'} ${url.pathname}`));
        return;
      }
      if (url.pathname === '/import-glb-asset') {
        const fileName = url.searchParams.get('fileName') ?? '';
        const data = await readRequestBuffer(req);
        const rawImportMode = url.searchParams.get('importMode');
        const semanticRole = url.searchParams.get('semanticRole');
        if (rawImportMode !== null && importModeFromValue(rawImportMode) === undefined) {
          writeJson(res, 400, fail('VALIDATION_ERROR', 'importMode must be "single" or "shallow".'));
          return;
        }
        if (semanticRole !== null && semanticRoleFromValue(semanticRole) === undefined) {
          writeJson(res, 400, fail('VALIDATION_ERROR', 'semanticRole is not a supported Diorama semantic role.'));
          return;
        }
        const result = await runtime.importAsset({
          source: { kind: 'uploadedFile', name: fileName, data },
          importMode: importModeFromValue(rawImportMode) ?? 'shallow',
          ...(semanticRoleFromValue(semanticRole) !== undefined
            ? { semanticRole: semanticRoleFromValue(semanticRole) }
            : {}),
          ...(url.searchParams.get('parentId') ? { parentId: url.searchParams.get('parentId') as string } : {}),
          ...(url.searchParams.get('dryRun') === 'true' ? { dryRun: true } : {}),
        }, 'web');
        writeJson(res, result.ok ? 200 : 400, result);
        return;
      }
      const body = await readJson(req);
      const routeToTool: Record<string, string> = {
        '/command/apply': 'apply_command',
        '/command/batch': 'apply_command_batch',
        '/load-scene': 'load_scene',
        '/structure-scene': 'structure_scene',
        '/make-interactive': 'make_interactive',
        '/arrange-nodes': 'arrange_nodes',
        '/import-glb-asset-json': 'import_glb_asset',
        '/ingest-asset': 'ingest_asset',
        '/ingest-local-asset': 'ingest_local_asset',
        '/export-json': 'export_json',
        '/export-r3f': 'export_r3f',
      };
      const toolName = routeToTool[url.pathname] ?? url.pathname.match(/^\/tools\/([^/]+)$/)?.[1];
      if (!toolName) {
        writeJson(res, 404, fail('NOT_FOUND', `No route for POST ${url.pathname}`));
        return;
      }
      const result = await runtime.callTool(toolName, body, 'web');
      writeJson(res, result.ok ? 200 : 400, result);
    } catch (error) {
      writeJson(res, 500, fail('BRIDGE_ERROR', error instanceof Error ? error.message : String(error)));
    }
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });

  return {
    server,
    runtime,
    port,
    close: () =>
      new Promise((resolveClose, rejectClose) => {
        server.close((error) => error ? rejectClose(error) : resolveClose());
      }),
  };
};
