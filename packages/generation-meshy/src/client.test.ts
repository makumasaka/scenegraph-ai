import { describe, expect, it } from 'vitest';
import {
  downloadGLB,
  generateGLB,
  generateModel,
  mockJobIdForPrompt,
  pollJob,
  pollUntilComplete,
  resetMeshyGenerationLimitsForTests,
  type FetchLike,
  type MeshyGenerateGlbData,
} from './index';

const expectOk = <T>(result: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected ok result');
  return result.data;
};

const expectErr = <T>(
  result: { ok: true; data: T } | { ok: false; error: { code: string } },
  code: string,
): void => {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe(code);
};

const response = (payload: unknown): Awaited<ReturnType<FetchLike>> => ({
  ok: true,
  status: 200,
  json: async () => payload,
  arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
});

describe('@dioramai/generation-meshy', () => {
  it('generates deterministic mock job ids without network calls', async () => {
    const a = expectOk(await generateModel('Modern chair'));
    const b = expectOk(await generateModel('  modern   chair  '));

    expect(a.source).toBe('mock');
    expect(a.jobId).toBe(mockJobIdForPrompt('modern chair'));
    expect(b.jobId).toBe(a.jobId);
  });

  it('returns deterministic mock GLB bytes and caches by normalized prompt', async () => {
    const cache = new Map<string, MeshyGenerateGlbData>();
    const first = expectOk(await generateGLB('Modern chair', { cache }));
    const second = expectOk(await generateGLB(' modern chair ', { cache }));

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(first.jobId).toBe(second.jobId);
    expect(new DataView(first.glb).getUint32(0, true)).toBe(0x46546c67);
    expect(new DataView(second.glb).getUint32(4, true)).toBe(2);
    expect(second.glb).not.toBe(first.glb);
  });

  it('polls live jobs until success with bounded attempts', async () => {
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls += 1;
      return response(
        calls === 1
          ? { status: 'processing' }
          : { status: 'succeeded', model_urls: { glb: 'https://example.test/model.glb' } },
      );
    };

    const result = expectOk(
      await pollUntilComplete('job_1', {
        mode: 'live',
        apiKey: 'test-key',
        fetch,
        retry: { maxAttempts: 2, delayMs: 0 },
      }),
    );

    expect(calls).toBe(2);
    expect(result.status).toBe('succeeded');
    expect(result.downloadUrl).toBe('https://example.test/model.glb');
  });

  it('reports failed and timed-out jobs as structured errors', async () => {
    const failedFetch: FetchLike = async () => response({ status: 'failed' });
    const processingFetch: FetchLike = async () => response({ status: 'processing' });

    expectErr(
      await pollUntilComplete('job_1', {
        mode: 'live',
        apiKey: 'test-key',
        fetch: failedFetch,
        retry: { maxAttempts: 1, delayMs: 0 },
      }),
      'GENERATION_FAILED',
    );
    expectErr(
      await pollUntilComplete('job_2', {
        mode: 'live',
        apiKey: 'test-key',
        fetch: processingFetch,
        retry: { maxAttempts: 1, delayMs: 0 },
      }),
      'TIMEOUT',
    );
  });

  it('downloads mock and live GLB buffers', async () => {
    const mock = expectOk(await downloadGLB('mock://meshy/mock_model.glb'));
    const live = expectOk(
      await downloadGLB('https://example.test/model.glb', {
        mode: 'live',
        fetch: async () => response({}),
      }),
    );

    expect(new DataView(mock).getUint32(0, true)).toBe(0x46546c67);
    expect(Array.from(new Uint8Array(live))).toEqual([1, 2, 3, 4]);
  });

  it('validates prompt, job id, URL, API key, and live call limits', async () => {
    resetMeshyGenerationLimitsForTests();

    expectErr(await generateModel(''), 'VALIDATION_ERROR');
    expectErr(await pollJob('   '), 'VALIDATION_ERROR');
    expectErr(await downloadGLB('   '), 'VALIDATION_ERROR');
    expectErr(await generateModel('chair', { mode: 'live' }), 'CONFIGURATION_ERROR');

    const fetch: FetchLike = async () => response({ result: 'job_1' });
    expectOk(
      await generateModel('chair', {
        mode: 'live',
        apiKey: 'test-key',
        fetch,
        cost: { maxLiveGenerationCalls: 1 },
      }),
    );
    expectErr(
      await generateModel('chair again', {
        mode: 'live',
        apiKey: 'test-key',
        fetch,
        cost: { maxLiveGenerationCalls: 1 },
      }),
      'CONFIGURATION_ERROR',
    );
  });
});
