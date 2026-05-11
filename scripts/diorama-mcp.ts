import { startDioramaBridgeServer, DEFAULT_BRIDGE_PORT } from './diorama-bridge-runtime';

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const port = Number(process.env.DIORAMA_BRIDGE_PORT ?? DEFAULT_BRIDGE_PORT);
const bridgeUrl = `http://127.0.0.1:${port}`;

const objectSchema = (properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const commandSchema = {
  type: 'object',
  description: 'A validated Diorama command payload. Must include a command type.',
  additionalProperties: true,
};

const sceneRef = {
  type: 'object',
  description: 'A Diorama scene graph object.',
  additionalProperties: true,
};

const tools: ToolDefinition[] = [
  {
    name: 'get_scene',
    description: 'Return the active Diorama bridge scene.',
    inputSchema: objectSchema(),
  },
  {
    name: 'get_semantic_groups',
    description: 'Return semantic groups from the active scene.',
    inputSchema: objectSchema(),
  },
  {
    name: 'get_behaviors',
    description: 'Return behavior definitions from the active scene.',
    inputSchema: objectSchema(),
  },
  {
    name: 'get_action_log',
    description: 'Return the bridge runtime action log.',
    inputSchema: objectSchema(),
  },
  {
    name: 'apply_command',
    description: 'Apply one Diorama command to the shared bridge scene. Use dryRun first for risky edits.',
    inputSchema: objectSchema({
      command: commandSchema,
      dryRun: { type: 'boolean' },
    }, ['command']),
  },
  {
    name: 'apply_command_batch',
    description: 'Apply a batch of Diorama commands atomically to the shared bridge scene.',
    inputSchema: objectSchema({
      commands: { type: 'array', items: commandSchema },
      dryRun: { type: 'boolean' },
    }, ['commands']),
  },
  {
    name: 'load_scene',
    description: 'Replace the shared bridge scene from JSON text or a parsed scene graph.',
    inputSchema: objectSchema({
      json: { type: 'string' },
      scene: sceneRef,
      dryRun: { type: 'boolean' },
    }),
  },
  {
    name: 'ingest_local_asset',
    description: 'Copy a local GLB/GLTF into Diorama public asset folders and register it as an asset-backed scene node.',
    inputSchema: objectSchema({
      localPath: { type: 'string' },
      id: { type: 'string' },
      nodeId: { type: 'string' },
      nodeName: { type: 'string' },
      parentId: { type: 'string' },
      prompt: { type: 'string' },
      provider: { type: 'string', enum: ['mock', 'meshy', 'tripo', 'luma'] },
      includeHierarchy: { type: 'boolean', description: 'Default true. Introspect GLB/GLTF nodes into inspect-only Diorama child nodes.' },
      maxHierarchyNodes: { type: 'number' },
      dryRun: { type: 'boolean' },
    }, ['localPath']),
  },
  {
    name: 'ingest_asset',
    description: 'Register an already-described generated or local asset through the Diorama ingest command path.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
    },
  },
  {
    name: 'generate_asset',
    description: 'Generate a GLB asset through the configured Diorama generator adapter. Defaults to mock mode unless configured otherwise.',
    inputSchema: objectSchema({
      prompt: { type: 'string' },
      provider: { type: 'string', enum: ['mock', 'meshy', 'tripo', 'luma'] },
      mode: { type: 'string', enum: ['mock', 'live'] },
    }, ['prompt']),
  },
  {
    name: 'generate_and_ingest_asset',
    description: 'Generate a GLB asset and immediately register it in the shared Diorama scene.',
    inputSchema: objectSchema({
      prompt: { type: 'string' },
      provider: { type: 'string', enum: ['mock', 'meshy', 'tripo', 'luma'] },
      mode: { type: 'string', enum: ['mock', 'live'] },
    }, ['prompt']),
  },
  {
    name: 'structure_scene',
    description: 'Infer MVP showroom-style semantic groups, roles, and traits.',
    inputSchema: objectSchema({
      preset: { type: 'string', enum: ['showroom'] },
      dryRun: { type: 'boolean' },
    }),
  },
  {
    name: 'make_interactive',
    description: 'Attach behavior definitions for nodes with the target semantic role.',
    inputSchema: objectSchema({
      targetRole: { type: 'string' },
      dryRun: { type: 'boolean' },
    }),
  },
  {
    name: 'arrange_nodes',
    description: 'Deterministically arrange explicit nodes or nodes matching a semantic role.',
    inputSchema: objectSchema({
      nodeIds: { type: 'array', items: { type: 'string' } },
      role: { type: 'string' },
      layout: { type: 'string', enum: ['line', 'grid', 'circle'] },
      options: objectSchema({
        spacing: { type: 'number' },
        cols: { type: 'number' },
        radius: { type: 'number' },
        axis: { type: 'string', enum: ['x', 'y', 'z'] },
      }),
      dryRun: { type: 'boolean' },
    }, ['layout']),
  },
  {
    name: 'export_json',
    description: 'Export the shared scene as Diorama JSON. Writes apps/web/public/scenes/bridge-session.scene.json by default.',
    inputSchema: objectSchema({
      write: { type: 'boolean' },
    }),
  },
  {
    name: 'export_r3f',
    description: 'Export the shared scene to the demo R3F Vite app. Writes generated files by default.',
    inputSchema: objectSchema({
      write: { type: 'boolean' },
      options: {
        type: 'object',
        additionalProperties: true,
      },
    }),
  },
];

const writeResponse = (id: JsonRpcId | undefined, result: unknown): void => {
  if (id === undefined) return;
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
};

const writeError = (id: JsonRpcId | undefined, code: number, message: string): void => {
  if (id === undefined) return;
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);
};

const bridgeFetch = async (toolName: string, args: unknown): Promise<unknown> => {
  const response = await fetch(`${bridgeUrl}/tools/${encodeURIComponent(toolName)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args ?? {}),
  });
  return response.json() as Promise<unknown>;
};

const ensureBridge = async (): Promise<void> => {
  try {
    const health = await fetch(`${bridgeUrl}/health`);
    if (health.ok) return;
  } catch {
    // Start an embedded bridge below.
  }
  await startDioramaBridgeServer(port);
  process.stderr.write(`Diorama MCP started embedded bridge at ${bridgeUrl}\n`);
};

const toolResult = (payload: unknown) => {
  const isError = typeof payload === 'object' && payload !== null && 'ok' in payload && (payload as { ok: unknown }).ok === false;
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
    isError,
  };
};

const handleRequest = async (request: JsonRpcRequest): Promise<void> => {
  switch (request.method) {
    case 'initialize':
      writeResponse(request.id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'diorama',
          version: '0.1.0',
        },
      });
      return;
    case 'notifications/initialized':
      return;
    case 'ping':
      writeResponse(request.id, {});
      return;
    case 'tools/list':
      writeResponse(request.id, { tools });
      return;
    case 'tools/call': {
      const name = typeof request.params?.name === 'string' ? request.params.name : '';
      const args = request.params?.arguments ?? {};
      if (!tools.some((tool) => tool.name === name)) {
        writeResponse(request.id, toolResult({ ok: false, error: { code: 'TOOL_NOT_FOUND', message: `Unknown tool: ${name}` } }));
        return;
      }
      const payload = await bridgeFetch(name, args);
      writeResponse(request.id, toolResult(payload));
      return;
    }
    default:
      writeError(request.id, -32601, `Method not found: ${request.method}`);
  }
};

const run = async (): Promise<void> => {
  await ensureBridge();
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
      if (line.length === 0) continue;
      void Promise.resolve()
        .then(() => handleRequest(JSON.parse(line) as JsonRpcRequest))
        .catch((error) => writeError(undefined, -32603, error instanceof Error ? error.message : String(error)));
    }
  });
};

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
