import { startDioramaBridgeServer } from '@diorama/local-bridge';

const argValue = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const run = async (): Promise<void> => {
  const projectRoot = argValue('projectRoot') ?? process.env.DIORAMA_PROJECT_ROOT;
  if (projectRoot === undefined) {
    throw new Error('Diorama bridge requires an explicit --projectRoot or DIORAMA_PROJECT_ROOT.');
  }
  const watchCode = process.env.DIORAMA_WATCH_CODE !== 'false';
  const started = await startDioramaBridgeServer(undefined, {
    projectRoot,
    watchCode,
  });
  console.log(`Diorama bridge listening on http://127.0.0.1:${started.port}`);
  console.log('Scene events: http://127.0.0.1:%s/events', started.port);
  console.log('Pairing token: %s', started.pairingToken);
  console.log('Shell query: ?bridgeToken=%s', encodeURIComponent(started.pairingToken));
  console.log('Project root: %s', started.runtime.getProjectInfo().projectRoot);
  console.log('Config: %s', started.runtime.getProjectInfo().configFound ? started.runtime.getProjectInfo().configPath : 'not found');
  console.log('Generated module: %s', started.runtime.getProjectInfo().generatedModulePath);
  console.log('Scene JSON: %s', started.runtime.getProjectInfo().sessionPath);
  console.log('Asset dir: %s', started.runtime.getProjectInfo().assetDirPath);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
