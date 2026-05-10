import { mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { createMockGlb, generateGLB, hashPrompt } from '@diorama/generation-meshy';
import type { GenerateAssetInput, GeneratedAsset, GenerationConfig, GeneratorAdapter } from './types';

const DEFAULT_ASSET_OUTPUT_DIR = 'apps/demo-export/public/assets/generated';
const DEFAULT_PUBLIC_URL_BASE = '/assets/generated';

const normalizePrompt = (prompt: string): string => prompt.trim().replace(/\s+/g, ' ');

const toProvider = (
  provider?: GenerateAssetInput['provider'],
): NonNullable<GenerateAssetInput['provider']> => provider ?? 'mock';

const toMode = (mode: GenerateAssetInput['mode'], config: GenerationConfig): 'mock' | 'live' =>
  mode ?? config.defaultMode ?? 'mock';

const hasMeshyKey = (): boolean => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const value = env?.MESHY_API_KEY;
  return value !== undefined && value.trim().length > 0;
};

const providerForExecution = (
  requestedProvider: NonNullable<GenerateAssetInput['provider']>,
  requestedMode: 'mock' | 'live',
): { provider: GeneratedAsset['provider']; mode: 'mock' | 'live'; reason?: string } => {
  if (requestedProvider === 'meshy' && requestedMode === 'live' && hasMeshyKey()) {
    return { provider: 'meshy', mode: 'live' };
  }
  if (requestedProvider === 'meshy') {
    return requestedMode === 'live'
      ? { provider: 'mock', mode: 'mock', reason: 'MESHY_API_KEY is missing, defaulted to mock mode' }
      : { provider: 'mock', mode: 'mock' };
  }
  return { provider: 'mock', mode: 'mock' };
};

const sanitizeSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'asset';

const exists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const toPublicUri = (filePath: string, publicUrlBase: string): string => {
  const name = basename(filePath);
  const normalizedBase = publicUrlBase.endsWith('/') ? publicUrlBase.slice(0, -1) : publicUrlBase;
  return `${normalizedBase}/${name}`;
};

export class DefaultGeneratorAdapter implements GeneratorAdapter {
  private readonly config: Required<GenerationConfig>;
  private readonly cache = new Map<string, GeneratedAsset>();

  constructor(config: GenerationConfig = {}) {
    this.config = {
      assetOutputDir: config.assetOutputDir ?? DEFAULT_ASSET_OUTPUT_DIR,
      publicUrlBase: config.publicUrlBase ?? DEFAULT_PUBLIC_URL_BASE,
      defaultMode: config.defaultMode ?? 'mock',
    };
  }

  async generateAsset(input: GenerateAssetInput): Promise<GeneratedAsset> {
    const prompt = normalizePrompt(input.prompt);
    if (prompt.length === 0) {
      throw new Error('generateAsset prompt must not be empty');
    }

    const requestedProvider = toProvider(input.provider);
    const requestedMode = toMode(input.mode, this.config);
    const execution = providerForExecution(requestedProvider, requestedMode);
    const promptHash = hashPrompt(prompt);
    const cacheKey = `${requestedProvider}:${requestedMode}:${promptHash}`;
    const cached = this.cache.get(cacheKey);
    if (cached?.localPath && await exists(cached.localPath)) {
      return cached;
    }

    const outputDir = resolve(this.config.assetOutputDir);
    await mkdir(outputDir, { recursive: true });

    const bytes =
      execution.provider === 'meshy'
        ? await this.generateFromMeshy(prompt)
        : createMockGlb();

    const fileName = `${sanitizeSlug(requestedProvider)}-${promptHash}.glb`;
    const filePath = join(outputDir, fileName);
    await writeFile(filePath, Buffer.from(bytes));

    const generated: GeneratedAsset = {
      id: `asset-${promptHash}`,
      provider: execution.provider,
      prompt,
      format: extname(fileName).toLowerCase() === '.gltf' ? 'gltf' : 'glb',
      localPath: filePath,
      uri: toPublicUri(filePath, this.config.publicUrlBase),
      metadata: {
        requestedProvider,
        requestedMode,
        ...(execution.reason !== undefined ? { fallbackReason: execution.reason } : {}),
      },
    };
    this.cache.set(cacheKey, generated);
    return generated;
  }

  private async generateFromMeshy(prompt: string): Promise<ArrayBuffer> {
    const result = await generateGLB(prompt, { mode: 'live' });
    if (!result.ok) {
      throw new Error(`Meshy generation failed: ${result.error.code} ${result.error.message}`);
    }
    return result.data.glb;
  }
}

export const createGeneratorAdapter = (config: GenerationConfig = {}): GeneratorAdapter =>
  new DefaultGeneratorAdapter(config);
