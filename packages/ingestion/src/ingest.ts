import { createNode, type Command, type DioramaAsset } from '@diorama/core';
import type { GeneratedAsset } from '@diorama/generation';
import type { IngestAssetInput, IngestionOptions, IngestionResult } from './types';

const hashText = (value: string): string => {
  let hash = 2166136261;
  for (const ch of value) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
};

const basenameNoExt = (path: string): string => {
  const fileName = path.split(/[\\/]/).pop() ?? path;
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(0, idx) : fileName;
};

const localPathFromInput = (input: IngestAssetInput): string =>
  typeof input.localPath === 'string' ? input.localPath : '';

const defaultIdFromInput = (input: IngestAssetInput): string => {
  if ('id' in input && typeof input.id === 'string' && input.id.length > 0) {
    return input.id;
  }
  const seed = 'prompt' in input && typeof input.prompt === 'string' && input.prompt.length > 0
    ? input.prompt
    : localPathFromInput(input);
  return `asset-${hashText(seed)}`;
};

const providerFromInput = (input: IngestAssetInput): GeneratedAsset['provider'] =>
  'provider' in input && input.provider !== undefined ? input.provider : 'mock';

const promptFromInput = (input: IngestAssetInput): string | undefined =>
  'prompt' in input && typeof input.prompt === 'string' ? input.prompt : undefined;

const uriFromInput = (input: IngestAssetInput): string | undefined => {
  if ('uri' in input && typeof input.uri === 'string' && input.uri.length > 0) {
    return input.uri;
  }
  return undefined;
};

const toAsset = (input: IngestAssetInput, assetId: string): DioramaAsset => {
  const localPath = localPathFromInput(input);
  const format = input.format === 'gltf' ? 'gltf' : 'glb';
  const localName = basenameNoExt(localPath);
  const prompt = promptFromInput(input);
  const uri = uriFromInput(input);
  return {
    id: assetId,
    name: localName.length > 0 ? localName : 'Generated Asset',
    kind: format,
    ...(uri ? { uri } : {}),
    source: 'generator',
    generator: {
      provider: providerFromInput(input),
      ...(prompt ? { prompt } : {}),
    },
    metadata: {
      source: 'generator',
      provider: providerFromInput(input),
      ...(prompt ? { prompt } : {}),
      ...(localPath.length > 0 ? { localPath } : {}),
      ...(('metadata' in input && input.metadata !== undefined) ? input.metadata : {}),
    },
  };
};

export const ingestAsset = (
  input: IngestAssetInput,
  options: IngestionOptions = {},
): IngestionResult => {
  const warnings: string[] = [];
  const localPath = localPathFromInput(input);
  if (localPath.trim().length === 0) {
    return {
      commands: [],
      warnings: ['ingestAsset requires a non-empty localPath'],
    };
  }

  const parentId = options.parentId ?? 'root';
  const assetId = defaultIdFromInput(input);
  const asset = toAsset(input, assetId);
  if (asset.uri === undefined) {
    warnings.push('Asset URI is missing; exporter may use placeholder output until uri is set.');
  }

  const nodeId = options.nodeId ?? `${assetId}-node`;
  const node = createNode({
    id: nodeId,
    name: options.nodeName ?? 'Generated Product',
    type: 'mesh',
    assetRef: asset.uri ? { kind: 'uri', uri: asset.uri } : { kind: 'none' },
    metadata: {
      source: 'generator',
      provider: providerFromInput(input),
      ...(promptFromInput(input) ? { prompt: promptFromInput(input) } : {}),
      assetId,
      localPath,
    },
    semantics: {
      role: 'product',
      source: 'import',
    },
    semanticRole: 'product',
  });

  const commands: Command[] = [
    { type: 'REGISTER_ASSET', asset },
    { type: 'ADD_NODE', parentId, node },
  ];

  return {
    commands,
    warnings,
    assets: [asset],
  };
};
