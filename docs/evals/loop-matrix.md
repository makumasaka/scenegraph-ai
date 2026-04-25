# Code -> Canvas -> Code Loop Matrix

These loops validate that Diorama's scenegraph and command system remain the
single source of truth across UI, export, and future agent surfaces.

## Loop A: JSON Roundtrip

Owner: QA Agent with Core Agent support.

Required APIs:

- `getStarterScene`
- `serializeScene`
- `parseSceneJson`
- `validateScene`

Flow:

1. Load a starter scene.
2. Serialize it to JSON.
3. Parse the JSON.
4. Compare the canonical scene.
5. Serialize again and compare strings.

Pass criteria:

- Parsed scene validates.
- Canonical scene data is equal.
- Second serialization equals first serialization.

Tests live in:

- `packages/core/src/serialization.test.ts`
- future schema package tests

## Loop B: Command Replay

Owner: QA Agent.

Required APIs:

- `applyCommand`
- starter fixtures
- command fixture sequences

Flow:

1. Load an original scene.
2. Apply a sequence of commands.
3. Serialize the final scene.
4. Reload the original scene.
5. Replay the same commands.
6. Compare final scenes and JSON output.

Pass criteria:

- Replay is deterministic.
- Final serialized JSON matches.
- Expected no-op commands return no change.

Tests live in:

- `packages/core/src/editingReducer.flows.test.ts`
- future eval fixtures in `docs/evals`

## Loop C: Canvas Editing

Owner: UI Agent and QA Agent.

Required APIs:

- web scene store `dispatch`
- web scene store `select`
- inspector transform fields
- viewport picking/gizmo path
- command log selectors

Flow:

1. Load a scene in the app.
2. Select a node.
3. Edit transform in the inspector or gizmo.
4. Verify a command changed scene state.
5. Verify viewport and command log update.
6. Undo and redo.

Pass criteria:

- Persistent edit goes through command dispatch.
- Scene state updates once.
- Viewport reflects scene state.
- Command log shows the expected summary.
- Undo and redo restore expected scenes.

Tests live in:

- `apps/web/src/App.editing.test.tsx`
- `apps/web/src/store/sceneStore.test.ts`
- viewport-focused component tests

## Loop D: Code Export

Owner: Export Agent and QA Agent.

Required APIs:

- `getStarterScene`
- `applyCommand`
- `exportSceneToR3fJsx`

Flow:

1. Load a starter scene.
2. Apply commands.
3. Export R3F JSX.
4. Compare snapshot.
5. Optionally parse or compile the generated TSX.

Pass criteria:

- Output is deterministic.
- Hierarchy follows scene child order.
- Local transforms are emitted correctly.
- Unsupported features are documented instead of silently misrepresented.

Tests live in:

- `packages/export-r3f/src/r3f.test.ts`

## Loop E: Agent Simulation

Owner: QA Agent with Spec Agent support.

Required APIs:

- `createAgentSession`
- `getScene`
- `getSelection`
- `applyCommand`
- `exportScene`

Flow:

1. Start with a natural-language intent fixture.
2. Map intent to a command batch.
3. Dry-run the batch.
4. Apply the batch.
5. Validate final scene.
6. Export JSON and R3F.
7. Compare expected fixtures.

Pass criteria:

- Invalid payloads are rejected.
- Dry-run does not mutate session state.
- Apply mutates only through commands.
- Exported output matches expected fixtures.

Tests live in:

- `packages/agent-interface/src/agentInterface.test.ts`
- future eval fixtures in `docs/evals`

## Loop F: Future MCP

Owner: future MCP owner with QA Agent.

Required APIs:

- `get_scene_graph`
- `get_selection`
- `apply_command`
- `load_scene`
- `export_scene`

Flow:

1. External agent reads scene state.
2. Agent proposes a command batch.
3. Tool dry-runs the command batch.
4. Tool applies the command batch.
5. Scene updates through the same reducer.
6. Tool exports JSON or R3F.

Pass criteria:

- Every write validates payloads.
- No tool mutates hidden state directly.
- Command replay produces the same final scene.

Tests live in:

- future `packages/mcp` tests
- future eval fixtures in `docs/evals`
