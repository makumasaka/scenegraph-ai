import type { Command, Scene } from '@diorama/core';

export type BridgeSceneEvent = {
  type: 'scene';
  scene: Scene;
  command?: Command;
  summary?: unknown;
  source: 'bridge' | 'mcp' | 'web' | 'code';
};

export type BridgeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; issues?: unknown } };

export type ImportGlbAssetResult = {
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
  appliedCommandCount: number;
};

export type BridgeProjectInfo = {
  projectRoot: string;
  configFound: boolean;
  configPath: string;
  sessionPath: string;
  sessionRelativePath: string;
  generatedModulePath: string;
  generatedModuleRelativePath: string;
  assetDirPath: string;
  assetDirRelativePath: string;
  publicUrlBase: string;
  lastSync:
    | { ok: true; path: string; bytesChanged: boolean; ts: number }
    | { ok: false; error: string; ts: number }
    | null;
};

export type BridgeProjectStatus = {
  bridgeConnected: true;
  projectRoot: string;
  configFound: boolean;
  configPath: string;
  configWarnings: string[];
  assetDir: string;
  assetDirExists: boolean;
  generatedSceneFile: string;
  generatedFileExists: boolean;
  publicAssetBase: string;
  sceneJsonFile: string;
  sceneJsonFileExists: boolean;
  currentSceneLoaded: boolean;
  nodeCount: number;
  assetCount: number;
  lastSync: BridgeProjectInfo['lastSync'];
};

export const BRIDGE_URL =
  import.meta.env.VITE_DIORAMA_BRIDGE_URL ?? 'http://127.0.0.1:7777';

const BRIDGE_TOKEN_STORAGE_KEY = 'diorama.bridgeToken';

export const getBridgeToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('bridgeToken');
  if (token && token.length > 0) {
    window.localStorage.setItem(BRIDGE_TOKEN_STORAGE_KEY, token);
    return token;
  }
  return window.localStorage.getItem(BRIDGE_TOKEN_STORAGE_KEY);
};

const withBridgeToken = (path: string): string => {
  const token = getBridgeToken();
  if (!token) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}token=${encodeURIComponent(token)}`;
};

export const bridgeUrlFor = (path: string): string =>
  `${BRIDGE_URL}${withBridgeToken(path)}`;

const bridgeHeaders = (): Record<string, string> => {
  const token = getBridgeToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'x-diorama-token': token } : {}),
  };
};

const postJson = async <T>(path: string, body: unknown): Promise<BridgeResult<T>> => {
  const response = await fetch(bridgeUrlFor(path), {
    method: 'POST',
    headers: bridgeHeaders(),
    body: JSON.stringify(body),
  });
  return response.json() as Promise<BridgeResult<T>>;
};

export const fetchBridgeScene = async (): Promise<BridgeResult<{ scene: Scene }>> => {
  const response = await fetch(bridgeUrlFor('/scene'));
  return response.json() as Promise<BridgeResult<{ scene: Scene }>>;
};

export const fetchBridgeProjectInfo = async (): Promise<BridgeResult<BridgeProjectInfo>> => {
  const response = await fetch(bridgeUrlFor('/project-info'));
  return response.json() as Promise<BridgeResult<BridgeProjectInfo>>;
};

export const fetchBridgeProjectStatus = async (): Promise<BridgeResult<BridgeProjectStatus>> => {
  const response = await fetch(bridgeUrlFor('/project-status'));
  return response.json() as Promise<BridgeResult<BridgeProjectStatus>>;
};

export const postBridgeUpdateTransform = async (
  command: Extract<Command, { type: 'UPDATE_TRANSFORM' }>,
): Promise<BridgeResult<{ scene: Scene; changed: boolean }>> =>
  postJson('/update-transform', {
    nodeId: command.nodeId,
    patch: command.patch,
  });

export const postBridgeLoadScene = async (
  json: string,
): Promise<BridgeResult<{ scene: Scene; changed: boolean }>> =>
  postJson('/load-scene', { json });

export const postBridgeSyncCode = async (
  direction: 'toCode' | 'fromCode' = 'toCode',
): Promise<BridgeResult<unknown>> => postJson('/sync-code', { direction });

export const postBridgeWriteSceneToFile = async (): Promise<BridgeResult<unknown>> =>
  postJson('/write-scene-to-file', {});

export const postBridgeReloadSceneFromFile = async (): Promise<BridgeResult<unknown>> =>
  postJson('/reload-scene-from-file', {});

export const postBridgeImportGlbAsset = async (
  file: File,
  options: {
    importMode?: 'single' | 'shallow';
    semanticRole?: string;
    parentId?: string;
  } = {},
): Promise<BridgeResult<ImportGlbAssetResult>> => {
  const params = new URLSearchParams({
    fileName: file.name,
    importMode: options.importMode ?? 'shallow',
  });
  if (options.semanticRole) params.set('semanticRole', options.semanticRole);
  if (options.parentId) params.set('parentId', options.parentId);
  const token = getBridgeToken();
  if (token) params.set('token', token);

  const response = await fetch(`${BRIDGE_URL}/import-glb-asset?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      ...(token ? { 'x-diorama-token': token } : {}),
    },
    body: file,
  });
  return response.json() as Promise<BridgeResult<ImportGlbAssetResult>>;
};

export const bridgeAssetUrl = (uri: string): string => {
  const clean = uri.startsWith('/') ? uri : `/${uri}`;
  return bridgeUrlFor(`/project-assets${clean}`);
};
