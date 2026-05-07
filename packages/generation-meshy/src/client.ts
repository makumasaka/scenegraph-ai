import {
  createMockGlb,
  mockDownloadUrlForJob,
  mockGenerateModel,
  mockJobIdForPrompt,
  mockPollJob,
  promptCacheKey,
} from './mock';
import type {
  FetchLike,
  MeshyAdapterOptions,
  MeshyGenerateGlbData,
  MeshyGenerateModelData,
  MeshyGenerationError,
  MeshyGenerationMode,
  MeshyGenerationResult,
  MeshyJobStatus,
  MeshyPollJobData,
} from './types';

const DEFAULT_ENDPOINT = 'https://api.meshy.ai/openapi/v2/text-to-3d';
const DEFAULT_MAX_ATTEMPTS = 30;
const DEFAULT_DELAY_MS = 2_000;

let liveGenerationCalls = 0;

const ok = <T>(data: T): MeshyGenerationResult<T> => ({ ok: true, data });

const err = (
  code: MeshyGenerationError['code'],
  message: string,
): MeshyGenerationResult<never> => ({
  ok: false,
  error: { code, message },
});

const validatePrompt = (prompt: string): MeshyGenerationResult<string> => {
  const normalized = prompt.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0) {
    return err('VALIDATION_ERROR', 'Prompt must not be empty');
  }
  return ok(normalized);
};

const validateJobId = (jobId: string): MeshyGenerationResult<string> => {
  const normalized = jobId.trim();
  if (normalized.length === 0) {
    return err('VALIDATION_ERROR', 'Job id must not be empty');
  }
  return ok(normalized);
};

const modeForOptions = (options: MeshyAdapterOptions = {}): MeshyGenerationMode =>
  options.mode ?? 'mock';

const envValue = (name: string): string | undefined => {
  const maybeGlobal = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  return maybeGlobal.process?.env?.[name];
};

const fetchForOptions = (options: MeshyAdapterOptions): MeshyGenerationResult<FetchLike> => {
  const fetchLike = options.fetch ?? globalThis.fetch;
  if (fetchLike === undefined) {
    return err('CONFIGURATION_ERROR', 'A fetch implementation is required for live Meshy mode');
  }
  return ok(fetchLike as FetchLike);
};

const apiKeyForOptions = (options: MeshyAdapterOptions): MeshyGenerationResult<string> => {
  const apiKey = options.apiKey ?? envValue('MESHY_API_KEY');
  if (apiKey === undefined || apiKey.trim().length === 0) {
    return err('CONFIGURATION_ERROR', 'MESHY_API_KEY is required for live Meshy mode');
  }
  return ok(apiKey);
};

const assertLiveCallAllowed = (options: MeshyAdapterOptions): MeshyGenerationResult<void> => {
  const limit = options.cost?.maxLiveGenerationCalls;
  if (limit !== undefined && liveGenerationCalls >= limit) {
    return err('CONFIGURATION_ERROR', 'Live Meshy generation call limit reached');
  }
  liveGenerationCalls += 1;
  return ok(undefined);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const stringField = (value: unknown, names: string[]): string | undefined => {
  if (!isRecord(value)) return undefined;
  for (const name of names) {
    const candidate = value[name];
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate;
  }
  return undefined;
};

const nestedStringField = (
  value: unknown,
  parentName: string,
  names: string[],
): string | undefined => {
  if (!isRecord(value)) return undefined;
  return stringField(value[parentName], names);
};

const normalizeStatus = (status: string | undefined): MeshyJobStatus => {
  switch (status?.toLowerCase()) {
    case 'pending':
    case 'queued':
      return 'queued';
    case 'running':
    case 'processing':
    case 'in_progress':
      return 'processing';
    case 'success':
    case 'succeeded':
    case 'completed':
      return 'succeeded';
    case 'error':
    case 'failed':
      return 'failed';
    default:
      return 'processing';
  }
};

const downloadUrlFromPayload = (payload: unknown): string | undefined =>
  stringField(payload, ['downloadUrl', 'download_url', 'glbUrl', 'glb_url']) ??
  nestedStringField(payload, 'model_urls', ['glb', 'glb_url']) ??
  nestedStringField(payload, 'output', ['glb', 'glb_url', 'download_url']);

const sleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

export const resetMeshyGenerationLimitsForTests = (): void => {
  liveGenerationCalls = 0;
};

export const generateModel = async (
  prompt: string,
  options: MeshyAdapterOptions = {},
): Promise<MeshyGenerationResult<MeshyGenerateModelData>> => {
  const parsedPrompt = validatePrompt(prompt);
  if (!parsedPrompt.ok) return parsedPrompt;
  const mode = modeForOptions(options);
  if (mode === 'mock') return mockGenerateModel(parsedPrompt.data);

  const apiKey = apiKeyForOptions(options);
  if (!apiKey.ok) return apiKey;
  const fetchLike = fetchForOptions(options);
  if (!fetchLike.ok) return fetchLike;
  const allowed = assertLiveCallAllowed(options);
  if (!allowed.ok) return allowed;

  try {
    const response = await fetchLike.data(options.endpoint ?? DEFAULT_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.data}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode: 'preview', prompt: parsedPrompt.data }),
      signal: options.signal,
    });
    if (!response.ok) {
      return err('NETWORK_ERROR', `Meshy generation request failed with status ${response.status}`);
    }
    const payload = await response.json();
    const jobId = stringField(payload, ['result', 'jobId', 'job_id', 'id', 'task_id']);
    if (jobId === undefined) {
      return err('PARSE_ERROR', 'Meshy generation response did not include a job id');
    }
    return ok({ jobId, source: 'live' });
  } catch (error) {
    return err('NETWORK_ERROR', error instanceof Error ? error.message : 'Meshy generation request failed');
  }
};

export const pollJob = async (
  jobId: string,
  options: MeshyAdapterOptions = {},
): Promise<MeshyGenerationResult<MeshyPollJobData>> => {
  const parsedJobId = validateJobId(jobId);
  if (!parsedJobId.ok) return parsedJobId;
  const mode = modeForOptions(options);
  if (mode === 'mock') return mockPollJob(parsedJobId.data);

  const apiKey = apiKeyForOptions(options);
  if (!apiKey.ok) return apiKey;
  const fetchLike = fetchForOptions(options);
  if (!fetchLike.ok) return fetchLike;

  try {
    const response = await fetchLike.data(`${options.endpoint ?? DEFAULT_ENDPOINT}/${encodeURIComponent(parsedJobId.data)}`, {
      headers: { Authorization: `Bearer ${apiKey.data}` },
      signal: options.signal,
    });
    if (!response.ok) {
      return err('NETWORK_ERROR', `Meshy poll request failed with status ${response.status}`);
    }
    const payload = await response.json();
    const status = normalizeStatus(stringField(payload, ['status', 'state']));
    const downloadUrl = downloadUrlFromPayload(payload);
    return ok({
      jobId: parsedJobId.data,
      status,
      ...(downloadUrl !== undefined ? { downloadUrl } : {}),
      source: 'live',
    });
  } catch (error) {
    return err('NETWORK_ERROR', error instanceof Error ? error.message : 'Meshy poll request failed');
  }
};

export const pollUntilComplete = async (
  jobId: string,
  options: MeshyAdapterOptions = {},
): Promise<MeshyGenerationResult<MeshyPollJobData>> => {
  const maxAttempts = options.retry?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const delayMs = options.retry?.delayMs ?? DEFAULT_DELAY_MS;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await pollJob(jobId, options);
    if (!result.ok) return result;
    if (result.data.status === 'failed') {
      return err('GENERATION_FAILED', `Meshy job ${jobId} failed`);
    }
    if (result.data.status === 'succeeded') {
      if (result.data.downloadUrl === undefined) {
        return err('PARSE_ERROR', `Meshy job ${jobId} succeeded without a GLB download URL`);
      }
      return result;
    }
    if (attempt < maxAttempts && delayMs > 0) {
      await sleep(delayMs);
    }
  }
  return err('TIMEOUT', `Meshy job ${jobId} did not complete within ${maxAttempts} attempts`);
};

export const downloadGLB = async (
  url: string,
  options: MeshyAdapterOptions = {},
): Promise<MeshyGenerationResult<ArrayBuffer>> => {
  const normalizedUrl = url.trim();
  if (normalizedUrl.length === 0) {
    return err('VALIDATION_ERROR', 'Download URL must not be empty');
  }
  if (normalizedUrl.startsWith('mock://')) {
    return ok(createMockGlb());
  }

  const fetchLike = fetchForOptions(options);
  if (!fetchLike.ok) return fetchLike;
  try {
    const response = await fetchLike.data(normalizedUrl, { signal: options.signal });
    if (!response.ok) {
      return err('NETWORK_ERROR', `GLB download failed with status ${response.status}`);
    }
    return ok(await response.arrayBuffer());
  } catch (error) {
    return err('NETWORK_ERROR', error instanceof Error ? error.message : 'GLB download failed');
  }
};

export const generateGLB = async (
  prompt: string,
  options: MeshyAdapterOptions = {},
): Promise<MeshyGenerationResult<MeshyGenerateGlbData>> => {
  const parsedPrompt = validatePrompt(prompt);
  if (!parsedPrompt.ok) return parsedPrompt;
  const cacheKey = promptCacheKey(parsedPrompt.data);
  const cached = options.cache?.get(cacheKey);
  if (cached !== undefined) {
    return ok({ ...cached, glb: cached.glb.slice(0), cached: true });
  }

  const generated = await generateModel(parsedPrompt.data, options);
  if (!generated.ok) return generated;
  const completed = await pollUntilComplete(generated.data.jobId, options);
  if (!completed.ok) return completed;
  const glb = await downloadGLB(completed.data.downloadUrl ?? mockDownloadUrlForJob(mockJobIdForPrompt(parsedPrompt.data)), options);
  if (!glb.ok) return glb;

  const data: MeshyGenerateGlbData = {
    jobId: generated.data.jobId,
    glb: glb.data,
    source: generated.data.source,
    ...(completed.data.downloadUrl !== undefined ? { downloadUrl: completed.data.downloadUrl } : {}),
    cached: false,
  };
  options.cache?.set(cacheKey, { ...data, glb: data.glb.slice(0) });
  return ok(data);
};
