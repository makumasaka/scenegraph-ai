import type {
  MeshyGenerateModelData,
  MeshyGenerationResult,
  MeshyPollJobData,
} from './types';

const normalizePrompt = (prompt: string): string => prompt.trim().replace(/\s+/g, ' ');

export const promptCacheKey = (prompt: string): string => normalizePrompt(prompt).toLowerCase();

export const hashPrompt = (prompt: string): string => {
  let hash = 2166136261;
  for (const char of promptCacheKey(prompt)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
};

export const mockJobIdForPrompt = (prompt: string): string => `mock_${hashPrompt(prompt)}`;

export const mockDownloadUrlForJob = (jobId: string): string => `mock://meshy/${jobId}.glb`;

export const mockGenerateModel = (prompt: string): MeshyGenerationResult<MeshyGenerateModelData> => ({
  ok: true,
  data: {
    jobId: mockJobIdForPrompt(prompt),
    source: 'mock',
  },
});

export const mockPollJob = (jobId: string): MeshyGenerationResult<MeshyPollJobData> => ({
  ok: true,
  data: {
    jobId,
    status: 'succeeded',
    downloadUrl: mockDownloadUrlForJob(jobId),
    source: 'mock',
  },
});

const padTo4 = (value: Uint8Array): Uint8Array => {
  const paddedLength = Math.ceil(value.byteLength / 4) * 4;
  const out = new Uint8Array(paddedLength);
  out.set(value);
  for (let i = value.byteLength; i < paddedLength; i += 1) {
    out[i] = 0x20;
  }
  return out;
};

/** Minimal deterministic GLB container with an empty glTF scene. */
export const createMockGlb = (): ArrayBuffer => {
  const json = JSON.stringify({
    asset: { version: '2.0', generator: '@dioramai/generation-meshy mock' },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
  });
  const jsonBytes = padTo4(new TextEncoder().encode(json));
  const byteLength = 12 + 8 + jsonBytes.byteLength;
  const out = new ArrayBuffer(byteLength);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);

  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, byteLength, true);
  view.setUint32(12, jsonBytes.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(jsonBytes, 20);

  return out;
};
