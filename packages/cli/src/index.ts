#!/usr/bin/env tsx
import {
  DEFAULT_BRIDGE_PORT,
  initializeDioramaiProject,
  loadInitialBridgeScene,
  DioramaiBridgeRuntime,
  startDioramaiBridgeServer,
  validateDioramaiProject,
} from '@dioramai/local-bridge';

const argValue = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const projectRootArg = (): string =>
  argValue('projectRoot') ?? argValue('root') ?? process.cwd();

const printJson = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const run = async (): Promise<void> => {
  const command = process.argv[2] ?? 'help';
  const projectRoot = projectRootArg();
  const port = Number(argValue('port') ?? process.env.DIORAMAI_BRIDGE_PORT ?? DEFAULT_BRIDGE_PORT);

  switch (command) {
    case 'init': {
      const result = await initializeDioramaiProject(projectRoot);
      printJson(result);
      if (!result.ok) process.exitCode = 1;
      return;
    }

    case 'dev': {
      const started = await startDioramaiBridgeServer(port, {
        projectRoot,
        watchCode: process.env.DIORAMAI_WATCH_CODE !== 'false',
        pairingToken: argValue('token') ?? process.env.DIORAMAI_BRIDGE_TOKEN,
      });
      const info = started.runtime.getProjectInfo();
      process.stdout.write(`Dioramai local bridge listening on http://127.0.0.1:${started.port}\n`);
      process.stdout.write(`Project root: ${info.projectRoot}\n`);
      process.stdout.write(`Config: ${info.configFound ? info.configPath : 'not found; defaults active'}\n`);
      process.stdout.write(`Generated module: ${info.generatedModulePath}\n`);
      process.stdout.write(`Scene JSON: ${info.sessionPath}\n`);
      process.stdout.write(`Asset dir: ${info.assetDirPath}\n`);
      process.stdout.write(`Pairing token: ${started.pairingToken}\n`);
      process.stdout.write(`Shell query: ?bridgeToken=${encodeURIComponent(started.pairingToken)}\n`);
      return;
    }

    case 'export': {
      const runtime = new DioramaiBridgeRuntime(await loadInitialBridgeScene({ projectRoot }), { projectRoot });
      const result = await runtime.callTool('write_scene_to_file', {});
      runtime.close();
      printJson(result);
      if (!result.ok) process.exitCode = 1;
      return;
    }

    case 'validate': {
      const result = await validateDioramaiProject(projectRoot);
      printJson(result);
      if (!result.ok) process.exitCode = 1;
      return;
    }

    default:
      process.stdout.write(
        [
          'Usage: dioramai <command> [--projectRoot path] [--port 7777]',
          '',
          'Commands:',
          '  init      Create dioramai.config.json and local asset/generated dirs',
          '  dev       Start the local repo bridge',
          '  export    Write the generated R3F scene module',
          '  validate  Validate the local Dioramai project config/status',
        ].join('\n'),
      );
      process.stdout.write('\n');
  }
};

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
