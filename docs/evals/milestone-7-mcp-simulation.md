# Milestone 7 MCP Simulation / Evaluation

Milestone 7 proves the future MCP loop without implementing MCP transport.

Target future architecture:

```text
Cursor/Claude/Codex -> local Diorama MCP server -> Diorama API layer -> validated commands -> live canvas updates -> JSON/R3F export
```

Current implementation uses `createAgentSession()` and fixture-driven command
batches. No local MCP server, stdio transport, HTTP transport, JSON-RPC handler,
network call, shell execution, filesystem mutation, arbitrary JavaScript
execution, direct Zustand access, or direct R3F object access is part of this
milestone.

## Fixture Set

Fixtures live in `docs/evals/fixtures/m7`.

- `intents/001-gallery-3x3-grid.json`: successful 3 by 3 `ARRANGE_NODES`
  batch.
- `intents/002-showroom-duplicate-focus.json`: deterministic pedestal branch
  `DUPLICATE_NODE` with complete `idMap`.
- `intents/003-living-transform-export.json`: transform, selection, and export
  scenario.
- `intents/004-invalid-command-rejection.json`: semantic command rejection with
  no mutation.
- `mcp-tools.json`: future MCP tool names, runtime method mapping, and forbidden
  capabilities.

## Eval Files

- `packages/agent-interface/src/mcpSimulation.eval.test.ts`: Loop E/F harness
  for dry-run, apply, action log, export, and replay.
- `packages/mcp/src/toolContract.test.ts`: future MCP tool contract without
  transport.
- `packages/export-r3f/src/milestone7ExportEval.test.ts`: JSON roundtrip and R3F
  snapshots after fixture command batches.
- `apps/web/src/milestone7CanvasEval.test.tsx`: narrow canvas parity check
  through tree, inspector, command log, and JSON export.

## Pass Criteria

- Intent fixtures compile to deterministic command batches without calling an
  LLM.
- Every successful fixture dry-runs before apply.
- Dry-runs do not mutate session state or action log.
- Successful applies mutate only through validated commands.
- Applied batches record deterministic action log entries.
- Rejected batches return structured errors, mutate nothing, and write no action
  log entries.
- Replay from the same initial scene and same command batch produces the same
  final scene and JSON export.
- JSON exports parse and reserialize identically.
- R3F exports are deterministic snapshots.
- The web parity test shows fixture-driven state through the existing product
  path.
- Future MCP tool names map to `DioramaSceneRuntime`.
- Future MCP forbidden capabilities remain absent.

## Go/No-Go For Real MCP

Go for real MCP transport only after:

- all Milestone 7 eval files pass;
- fixture coverage includes success, deterministic duplicate, export-after-apply,
  and rejection cases;
- no test requires direct Zustand, R3F object, shell, file, network, or arbitrary
  JS access;
- `npm test`, `npm run typecheck`, and `npm run lint` pass.

No-go if transport work would require a new scene shape, a second mutation path,
direct store access, nondeterministic duplicate ids, or changed command
semantics.
