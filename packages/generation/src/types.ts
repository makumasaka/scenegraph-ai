export type GeneratedAsset = {
  id: string;
  provider: 'meshy' | 'tripo' | 'luma' | 'mock';
  prompt: string;
  format: 'glb' | 'gltf';
  uri?: string;
  localPath?: string;
  metadata?: Record<string, unknown>;
};

export type GenerateAssetInput = {
  prompt: string;
  provider?: 'meshy' | 'tripo' | 'luma' | 'mock';
  mode?: 'mock' | 'live';
};

export type GenerationConfig = {
  assetOutputDir?: string;
  publicUrlBase?: string;
  defaultMode?: 'mock' | 'live';
};

export interface GeneratorAdapter {
  generateAsset(input: GenerateAssetInput): Promise<GeneratedAsset>;
}
