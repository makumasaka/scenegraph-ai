export type MeshyGenerationMode = 'mock' | 'live';

export type MeshyJobStatus = 'queued' | 'processing' | 'succeeded' | 'failed';

export type MeshyGenerationErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'NETWORK_ERROR'
  | 'GENERATION_FAILED'
  | 'TIMEOUT'
  | 'PARSE_ERROR';

export type MeshyGenerationError = {
  code: MeshyGenerationErrorCode;
  message: string;
};

export type MeshyGenerationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: MeshyGenerationError };

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export type MeshyPromptCache = Map<string, MeshyGenerateGlbData>;

export type MeshyRetryOptions = {
  maxAttempts?: number;
  delayMs?: number;
};

export type MeshyCostOptions = {
  maxLiveGenerationCalls?: number;
};

export type MeshyAdapterOptions = {
  mode?: MeshyGenerationMode;
  apiKey?: string;
  endpoint?: string;
  fetch?: FetchLike;
  retry?: MeshyRetryOptions;
  cache?: MeshyPromptCache;
  cost?: MeshyCostOptions;
  signal?: AbortSignal;
};

export type MeshyGenerateModelData = {
  jobId: string;
  source: MeshyGenerationMode;
};

export type MeshyPollJobData = {
  jobId: string;
  status: MeshyJobStatus;
  downloadUrl?: string;
  source: MeshyGenerationMode;
};

export type MeshyGenerateGlbData = {
  jobId: string;
  glb: ArrayBuffer;
  source: MeshyGenerationMode;
  downloadUrl?: string;
  cached: boolean;
};
