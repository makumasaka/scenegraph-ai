import { startDioramaBridgeServer } from './diorama-bridge-runtime';

const run = async (): Promise<void> => {
  const started = await startDioramaBridgeServer();
  console.log(`Diorama bridge listening on http://127.0.0.1:${started.port}`);
  console.log('Scene events: http://127.0.0.1:%s/events', started.port);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
