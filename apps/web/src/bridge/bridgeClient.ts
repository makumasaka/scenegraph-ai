import type { Command, Scene } from '@diorama/core';

export type BridgeSceneEvent = {
  type: 'scene';
  scene: Scene;
  command?: Command;
  summary?: unknown;
  source: 'bridge' | 'mcp' | 'web';
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

export const BRIDGE_URL =
  import.meta.env.VITE_DIORAMA_BRIDGE_URL ?? 'http://127.0.0.1:7777';

const postJson = async <T>(path: string, body: unknown): Promise<BridgeResult<T>> => {
  const response = await fetch(`${BRIDGE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<BridgeResult<T>>;
};

export const fetchBridgeScene = async (): Promise<BridgeResult<{ scene: Scene }>> => {
  const response = await fetch(`${BRIDGE_URL}/scene`);
  return response.json() as Promise<BridgeResult<{ scene: Scene }>>;
};

export const postBridgeCommand = async (
  command: Command,
): Promise<BridgeResult<{ scene: Scene; changed: boolean }>> =>
  postJson('/command/apply', { command });

export const postBridgeLoadScene = async (
  json: string,
): Promise<BridgeResult<{ scene: Scene; changed: boolean }>> =>
  postJson('/load-scene', { json });

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

  const response = await fetch(`${BRIDGE_URL}/import-glb-asset?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  });
  return response.json() as Promise<BridgeResult<ImportGlbAssetResult>>;
};
