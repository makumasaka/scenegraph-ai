import type { Command, DioramaAsset } from '@diorama/core';
import type { GeneratedAsset } from '@diorama/generation';

export type IngestAssetInput =
  | GeneratedAsset
  | {
      localPath: string;
      format: 'glb' | 'gltf';
      id?: string;
      uri?: string;
      prompt?: string;
      provider?: GeneratedAsset['provider'];
      metadata?: Record<string, unknown>;
    };

export type IngestionOptions = {
  parentId?: string;
  nodeId?: string;
  nodeName?: string;
  includeHierarchy?: boolean;
  maxHierarchyNodes?: number;
};

export type IngestionResult = {
  commands: Command[];
  warnings: string[];
  assets?: DioramaAsset[];
};
