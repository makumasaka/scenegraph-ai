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
- Serialized documents use canonical scene document version 2.
- Wrapped v1 documents migrate to the version 2 scene shape.
- Legacy bare scene graphs migrate to the version 2 scene shape while that path is retained.
- Migrated scenes default missing `visible` to `true`, missing `metadata` to `{}`, and omitted `selection` to `null`.
- Missing legacy node `type` is inferred as `root`, `light`, `group`, or `mesh`
  based on node role.
- `rootId` points to a node with `type: "root"`.
- Non-root nodes cannot use `type: "root"`.
- Transforms remain local, rotations use Euler radians in XYZ order, and world
  transforms are computed.
- Canonical scene data is equal.
- Second serialization equals first serialization.

Tests live in:

- `packages/core/src/serialization.test.ts`
- `packages/core/src/sceneContract.test.ts`
- `packages/export-r3f/src/milestone7ExportEval.test.ts`

## Loop B: Command Replay

Owner: QA Agent.

Required APIs:

- `applyCommand`
- `applyCommandWithResult`
- `CommandSchema`
- starter fixtures
- command fixture sequences

Flow:

1. Load an original scene.
2. Validate the command batch shape before reducer execution.
3. Dry-run the batch with `applyCommandWithResult`.
4. Apply the batch with `applyCommand`.
5. Serialize the final scene.
6. Reload the original scene.
7. Replay the same commands.
8. Compare final scenes and JSON output.

Pass criteria:

- Replay is deterministic.
- Replayed commands operate on canonical version 2 scene state.
- Command batches dry-run before apply in agent and future MCP flows.
- Dry-run reports `changed`, `error`, `warnings`, and `summary` without
  mutating session state.
- `DUPLICATE_NODE` commands in replay/eval fixtures provide deterministic
  `idMap` entries for every duplicated source id.
- Commands without deterministic duplicate ids are allowed for UI use only and
  surface a warning through `applyCommandWithResult`.
- Expected invalid commands return unchanged scenes and structured errors; they
  do not throw.
- Every changing command preserves scene invariants.
- Final serialized JSON matches.
- Expected no-op commands return no change.

Tests live in:

- `packages/core/src/commandContract.test.ts`
- `packages/core/src/editingReducer.flows.test.ts`
- `packages/agent-interface/src/mcpSimulation.eval.test.ts`
- eval fixtures in `docs/evals/fixtures/m7`

## Loop C: Canvas Editing

Owner: UI Agent and QA Agent.

Required APIs:

- web scene store `dispatch`
- web scene store `select`
- web scene store `undo` / `redo`
- web scene store `exportSceneJson` / import and export UI actions
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
7. Export JSON and R3F from the updated scene.

Pass criteria:

- Persistent edit goes through command dispatch.
- Scene state updates once.
- Viewport reflects scene state.
- Viewport renders from `scene.rootId` and treats the root as a transformed
  scene group.
- Viewport hierarchy follows scene `children` order and matches export traversal.
- Hidden nodes skip their descendants in the viewport, matching R3F export
  traversal semantics.
- Command log shows the expected summary.
- `SET_SELECTION` updates selection but does not add a visible product log row.
- `REPLACE_SCENE` acts as a session boundary and clears undo, redo, and visible
  command log state.
- Undo and redo restore expected scenes.
- JSON and R3F exports reflect the edited canonical scene state.

Tests live in:

- `apps/web/src/App.editing.test.tsx`
- `apps/web/src/store/sceneStore.test.ts`
- `apps/web/src/viewport/Viewport.test.tsx`
- `apps/web/src/viewport/NodeMesh.test.tsx`
- `apps/web/src/viewport/object3dTransform.test.ts`
- `apps/web/src/milestone7CanvasEval.test.tsx`

Manual QA checklist:

- Load: load each starter kit and confirm the tree, canvas, and inspector reset
  to the loaded scene.
- Select: select from the tree and viewport; confirm selection appears in the
  tree/inspector and no visible command log row is added for selection alone.
- Inspect: confirm selected node name, id, parent, type, visibility, metadata
  count, and transform fields match scene state.
- Transform: edit position, rotation, and scale in the inspector and with the
  viewport gizmo; confirm all persistent edits dispatch `UPDATE_TRANSFORM`.
- Undo/redo: confirm transform and structural edits undo/redo scene snapshots;
  consecutive transform edits on one node coalesce into one undo step.
- Export: after an edit, export JSON and R3F; confirm both outputs reflect the
  same canonical scene state and hierarchy as the viewport.

## Loop D: Code Export

Owner: Export Agent and QA Agent.

Required APIs:

- `getStarterScene`
- `applyCommand`
- `serializeScene`
- `parseSceneJson`
- `exportSceneToR3fJsx`
- `createAgentSession` (for Loop D <-> Loop E parity on agent-applied batches)
- checked-in examples from `packages/examples/scenes`
- intent fixtures in `docs/evals/fixtures/m7/intents`

Flow:

1. Load a starter scene.
2. Apply commands directly with `applyCommand` or compile an intent fixture
   into a deterministic batch and apply it through `createAgentSession`.
3. Export JSON.
4. Export R3F JSX.
5. Re-import exported JSON.
6. Re-export JSON and R3F from the re-imported scene.
7. Compare snapshots and deterministic output.
8. Optionally parse or compile the generated TSX.

Pass criteria:

- JSON output uses the `format` / `version` / `data` wrapper.
- JSON output uses canonical version 2 node fields and stable object key
  ordering.
- Exported JSON reloads through `parseSceneJson`.
- Checked-in examples remain byte-for-byte aligned with serialized core
  fixtures.
- Output is deterministic.
- Hierarchy follows scene child order, including for duplicated subtrees and
  children added through agent-driven `ADD_NODE` batches.
- Local transforms are emitted correctly.
- Root and child transform semantics match the canvas contract, including
  agent-driven `UPDATE_TRANSFORM` on the root node.
- Export consumes canonical version 2 scene state and does not emit UI-only state.
- Exported JSON and R3F from an agent session contain no action log entries,
  command summaries, source labels, dry-run flags, applied/failed batch
  counters, or filesystem paths.
- R3F output is readable JSX with comments for node ids and names.
- R3F output emits primitive mesh placeholders and simple ambient/directional
  lights only, including agent-added light nodes.
- Hidden nodes and their descendants are omitted, including agent-added
  hidden subtrees.
- R3F output does not resolve real assets, material graphs, animation, shader
  graphs, glTF, or full renderer semantics.
- Unsupported features are documented instead of silently misrepresented.

Tests live in:

- `packages/export-r3f/src/r3f.test.ts`
- `packages/export-r3f/src/exportLoop.test.ts`
- `packages/export-r3f/src/milestone7ExportEval.test.ts`
- `apps/web/src/App.editing.test.tsx`

## Loop E: Agent Simulation

Owner: QA Agent with Spec Agent support.

Required APIs:

- `createAgentSession`
- `getScene`
- `getSelection`
- `dryRunCommand`
- `applyCommand`
- `dryRunCommandBatch`
- `applyCommandBatch`
- `getCommandLog`
- `exportScene`

Flow:

1. Start with a natural-language intent fixture.
2. Read scene state with `getScene`.
3. Read selection with `getSelection` when the intent depends on selected nodes.
4. Map intent to a command or command batch.
5. Dry-run the command with `dryRunCommand` or the batch with
   `dryRunCommandBatch`.
6. Apply with `applyCommand` or `applyCommandBatch` only after dry-run succeeds.
7. Validate final scene.
8. Export JSON and R3F after apply.
9. Replay the same command batch from the original scene.
10. Compare final scene and exported fixtures.

Pass criteria:

- Invalid payloads are rejected.
- Dry-run command does not mutate session state or action log.
- Dry-run batch does not mutate session state or action log.
- Apply mutates only through validated commands.
- Apply batch is all-or-nothing on semantic command failure.
- Applied commands and batches record deterministic action log entries.
- Agent inputs are validated against canonical version 2 scene/command schemas.
- Agent command validation stays in parity with the core `Command` union.
- Core command rejections are reported as structured `COMMAND_REJECTED` errors.
- Agent runtime exposes no filesystem, shell, arbitrary JS, Zustand, or R3F
  object access.
- Undo/redo are explicitly deferred for the agent runtime.
- Exported output matches expected fixtures.
- Replay verification produces the same final scene and exports.
- Exports captured after agent batch apply contain no editor state, action log
  entries, source labels, or filesystem paths.

Tests live in:

- `packages/agent-interface/src/runtimeContract.test.ts`
- `packages/agent-interface/src/agentInterface.test.ts`
- `packages/agent-interface/src/mcpSimulation.eval.test.ts`
- `packages/export-r3f/src/milestone7ExportEval.test.ts` (export side of agent
  simulation: hierarchy, local transforms, hidden nodes, lights, root
  transforms, and editor-state exclusions on agent-applied scenes)
- eval fixtures in `docs/evals/fixtures/m7`

## Loop F: Future MCP

Owner: future MCP owner with QA Agent.

Required APIs:

- `get_scene_graph`
- `get_selected_nodes`
- `select_nodes`
- `dry_run_command`
- `apply_command`
- `dry_run_command_batch`
- `apply_command_batch`
- `update_transform`
- `duplicate_node`
- `set_parent`
- `arrange_nodes`
- `load_scene`
- `export_json`
- `export_r3f`
- `get_command_log`

Flow:

1. External agent reads scene state.
2. Agent reads selection when needed.
3. Agent proposes a command or command batch.
4. Tool dry-runs the command or command batch.
5. Tool applies the command or command batch only after dry-run succeeds.
6. Scene updates through the same reducer.
7. Tool exports JSON or R3F.
8. Eval replays the same command batch from the original scene.
9. Eval verifies tool action logs include source, payload, dry-run status, and
   result data for mutating tools.

Pass criteria:

- Every write validates payloads.
- Common tools use narrow schemas; generic `apply_command` remains available for
  advanced command payloads.
- `select_nodes` validates ids, maps to `SET_SELECTION`, supports dry-run, and
  mutates selection only.
- `update_transform` validates a non-empty transform patch, maps to
  `UPDATE_TRANSFORM`, supports dry-run, and mutates scene transforms only.
- `duplicate_node` validates node id and deterministic `idMap`, maps to
  `DUPLICATE_NODE`, supports dry-run, and mutates scene.
- `set_parent` validates hierarchy requests, maps to `SET_PARENT`, supports
  dry-run, and mutates scene hierarchy.
- `arrange_nodes` validates layout/options, maps to `ARRANGE_NODES`, supports
  dry-run, and mutates scene transforms.
- `load_scene` validates a full scene or JSON and acts as a session boundary.
- `export_json` and `export_r3f` validate options and never mutate scene state.
- No tool mutates hidden state directly.
- Future tools consume normalized version 2 scenes and do not introduce a second scene shape.
- Future tools dry-run command batches before apply.
- Future tools require deterministic ids for duplicate replay.
- Future tools wrap `DioramaSceneRuntime` and do not connect directly to Zustand.
- Future tools expose no filesystem browsing, shell execution, arbitrary
  JavaScript execution, direct Zustand access, or direct R3F object access.
- Every mutating tool logs source, payload, dry-run status, result, errors, and
  warnings through the runtime action log or an explicitly scoped successor.
- Future tools expose committed action history through `get_command_log` if MCP
  agents need observability.
- Command replay produces the same final scene.
- Real MCP transport remains no-go until command validation, dry-run, action
  logging, replay tests, export snapshots, runtime adapter choice, live canvas
  bridge architecture, and security review are complete.

Tests live in:

- `packages/mcp/src/index.test.ts`
- `packages/mcp/src/toolContract.test.ts`
- `packages/agent-interface/src/mcpSimulation.eval.test.ts`
- eval fixtures in `docs/evals/fixtures/m7`
- `docs/adr/011-mcp-tool-contract.md`
