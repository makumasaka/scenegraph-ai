# Agent-Ready Internal API

Diorama's agent-ready API is an internal runtime surface for reading canonical
scene state, validating commands, previewing changes, applying changes, and
exporting results. It is not an MCP server yet. Future MCP tools must wrap this
runtime instead of inventing a second mutation path.

## Runtime Surface

The current runtime is `DioramaSceneRuntime`, created with
`createAgentSession()` from `@diorama/agent-interface`.

| Runtime method | Status | Behavior |
| --- | --- | --- |
| `getScene()` | implemented | Returns a detached clone of the current canonical `Scene`. |
| `getSelection()` | implemented | Returns the current `scene.selection`. |
| `dryRunCommand(input)` | implemented | Validates one command, applies it to a preview scene, returns summary/warnings, and does not mutate session state or action log. |
| `applyCommand(input, options?)` | implemented | Validates one command, applies it through core, mutates session state on success unless `options.dryRun` is true, and logs committed actions. |
| `dryRunCommandBatch(input)` | implemented | Validates an array of commands and previews sequential results without mutating session state or action log. |
| `applyCommandBatch(input, options?)` | implemented | Validates an array of commands, applies all commands atomically, and logs one batch action on success. |
| `loadScene(input)` | implemented | Loads either `{ kind: "json", json }` or `{ kind: "scene", scene }`, validates/migrates, and records a `load_scene` action. |
| `exportScene(input)` | implemented | Exports `{ format: "json" }` or `{ format: "r3f", r3f? }` from the current scene. |
| `getCommandLog()` | implemented | Returns detached copies of deterministic in-memory action log entries. |
| `undo()` / `redo()` | deferred | Optional runtime type hooks exist, but `createAgentSession()` does not expose undo/redo yet. |

## Results And Errors

All runtime methods return `AgentResult<T>`:

- `{ ok: true, data }` for success.
- `{ ok: false, error }` for validation, parse, scene, or command rejection.

Structured error codes:

- `VALIDATION_ERROR`: payload failed Zod validation before core reducer entry.
- `COMMAND_REJECTED`: payload shape was valid, but core rejected command
  semantics.
- `PARSE_ERROR`: scene JSON could not be parsed.
- `SCENE_INVALID`: loaded scene failed graph validation.

Batch policy:

- Batch payloads are validated before mutation.
- Semantic batch failures are all-or-nothing: no session mutation, no action log
  entry, `appliedCommandCount: 0`, and `failedCommandIndex` identifies the first
  rejected command.
- Successful applied batches log one `command_batch` entry.
- Dry-run batches never mutate session state or action log.

## Safety Model

The agent-ready runtime is intentionally narrow:

- No arbitrary filesystem access.
- No shell execution.
- No arbitrary JavaScript execution.
- No direct scene mutation.
- No direct Zustand mutation.
- No direct R3F or Three object access.
- Commands validate with `CommandSchema` before reducer entry.
- Scene loads validate with `LoadSceneInputSchema` and `SceneGraphSchema`.
- Exports validate with `ExportSceneParamsSchema`.
- Agents should dry-run before apply.
- All expected failures return structured errors instead of throwing.
- Read APIs return clones so callers cannot mutate hidden shared state.

## Action Log Policy

`getCommandLog()` returns deterministic in-memory action entries:

- committed single commands log `operation: "command"`.
- committed batches log `operation: "command_batch"`.
- scene loads log `operation: "load_scene"`.
- dry-runs do not log.
- rejected commands and failed batches do not log.
- entries use monotonic `sequence` values, not timestamps.
- entries are cloned on read.

This is an agent/runtime action log, not the web product's visible command log.

## Runtime Architecture

Target MCP direction:

```text
Cursor/Claude/Codex
  -> local Diorama MCP server
  -> Diorama agent runtime
  -> validated commands
  -> structured scene
  -> R3F export
```

Current boundary:

- MCP-lite is implemented as a library/runtime facade, not transport.
- `packages/mcp` currently re-exports `@diorama/agent-interface` for future tool
  handlers.
- Future MCP tools must wrap `DioramaSceneRuntime` or the MCP-lite facade.
- MCP must not invent a second scene shape or mutation path.
- MCP must not connect directly to Zustand.
- MCP must not access R3F objects, files, shells, or arbitrary JS execution.
- Mutating future MCP tools must validate payloads, support dry-run, and log
  applied actions through the runtime action log or an explicitly scoped
  successor.

## Future MCP Mapping

`docs/mcp-tools.md` is the canonical future MCP tool contract. ADR 011 records
the architecture decision. Narrow MCP tools should compile to runtime APIs or
validated commands instead of bypassing commands.

| Future MCP tool | Underlying agent-interface API |
| --- | --- |
| `get_scene` | `getScene()` |
| `get_semantic_groups` | MCP-lite facade over `getScene().scene.semanticGroups ?? {}` |
| `get_behaviors` | MCP-lite facade over `getScene().scene.behaviors ?? {}` |
| `get_selected_nodes` | `getSelection()` plus `getScene()` when node details are requested |
| `structure_scene` | `structureScene()` or `applyCommand({ type: "STRUCTURE_SCENE", ... })` |
| `set_node_semantics` | `applyCommand({ type: "SET_NODE_SEMANTICS", ... })` |
| `create_semantic_group` | `applyCommand({ type: "CREATE_SEMANTIC_GROUP", ... })` |
| `assign_to_semantic_group` | `applyCommand({ type: "ASSIGN_TO_SEMANTIC_GROUP", ... })` |
| `add_behavior` | `applyCommand({ type: "ADD_BEHAVIOR", ... })` |
| `remove_behavior` | `applyCommand({ type: "REMOVE_BEHAVIOR", ... })` |
| `make_interactive` | `makeInteractive()` or `applyCommand({ type: "MAKE_INTERACTIVE", ... })` |
| `arrange_nodes` | `arrangeNodes()` or `applyCommand({ type: "ARRANGE_NODES", ... })` |
| `apply_command` | `dryRunCommand()` / `applyCommand()` |
| `apply_command_batch` | `dryRunCommandBatch()` / `applyCommandBatch()` |
| `load_scene` | `loadScene()` plus an MCP adapter dry-run validation path |
| `export_json` | `exportScene({ format: "json" })` |
| `export_r3f` | `exportScene({ format: "r3f", r3f })` |

## Eval Contract

Agent simulation fixtures should:

1. Start from a known canonical scene.
2. Read the scene through `getScene()`.
3. Read selection through `getSelection()` when needed.
4. Generate a command or command batch.
5. Dry-run the command or batch.
6. Apply only if dry-run succeeds.
7. Export JSON and R3F after apply.
8. Replay the same command batch from the same initial scene and verify the same
   final scene and exports.

Replay-safe fixtures must provide deterministic `idMap` values for
`DUPLICATE_NODE`.
