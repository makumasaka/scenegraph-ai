import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createAgentRuntime } from '@diorama/agent-interface';

const expectOk = <T>(
  result: { ok: true; data: T } | { ok: false; error: { code: string; message: string } },
  step: string,
): T => {
  if (result.ok) return result.data;
  throw new Error(`${step} failed: ${result.error.code} ${result.error.message}`);
};

const run = async (): Promise<void> => {
  const assetOutputDir = resolve('apps/demo-export/public/assets/generated');
  const generatedTargetPath = resolve('apps/demo-export/src/generated/DioramaScene.generated.tsx');

  await mkdir(assetOutputDir, { recursive: true });
  await mkdir(dirname(generatedTargetPath), { recursive: true });

  const runtime = createAgentRuntime(undefined, {
    generation: {
      assetOutputDir,
      publicUrlBase: '/assets/generated',
      defaultMode: 'mock',
    },
  });

  const generated = expectOk(
    await runtime.generateAsset({
      prompt: 'Generate a modern chair product display scene.',
      provider: 'mock',
      mode: 'mock',
    }),
    'generateAsset',
  ).asset;

  const ingested = expectOk(
    runtime.ingestAsset({
      kind: 'generated',
      asset: generated,
    }),
    'ingestAsset',
  );
  if (ingested.errors.length > 0) {
    throw new Error(`ingestAsset command batch returned ${ingested.errors.length} error(s)`);
  }

  const structured = expectOk(runtime.structureScene({ preset: 'showroom' }), 'structureScene');
  if (structured.error) throw new Error(`structureScene rejected: ${structured.error.code}`);

  const interactive = expectOk(runtime.makeInteractive({ targetRole: 'product' }), 'makeInteractive');
  if (interactive.error) throw new Error(`makeInteractive rejected: ${interactive.error.code}`);

  const arranged = expectOk(
    runtime.arrangeNodes({
      role: 'product',
      layout: 'line',
      options: { spacing: 1.25, axis: 'x' },
    }),
    'arrangeNodes',
  );
  if (arranged.error) throw new Error(`arrangeNodes rejected: ${arranged.error.code}`);

  const exported = expectOk(
    runtime.exportR3F({
      mode: 'module',
      componentName: 'DioramaScene',
      semanticComponents: true,
      behaviorScaffold: 'handlers',
    }),
    'exportR3F',
  );

  await writeFile(generatedTargetPath, exported.content, 'utf8');

  console.log(`Generated asset file under: ${assetOutputDir}`);
  console.log(`Wrote component to: ${generatedTargetPath}`);
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
