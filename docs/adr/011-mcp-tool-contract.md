# ADR 011: Future MCP tool contract

## Status

Accepted for Milestone 7 simulation. Real MCP transport remains deferred.

## Context

Milestone 7 proves the future code -> canvas -> code loop without implementing a
local MCP server. The target architecture is:

```text
Cursor/Claude/Codex -> local Diorama MCP server -> Diorama API layer -> validated commands -> live canvas updates -> JSON/R3F export
```

The existing `@diorama/agent-interface` runtime already supports validated scene
reads, command dry-run, command apply, scene load, action logging, and export.
MCP should become a thin transport over that runtime, not a second scene system.

## Decision

Future MCP will expose narrow, typed tools for common operations plus a generic
`apply_command` escape hatch for advanced command payloads. Every tool maps to
`DioramaSceneRuntime`, `CommandSchema`, or an explicit command constructor. MCP
tools must not connect directly to Zustand, R3F objects, files, shells, or
arbitrary JavaScript execution.

## Runtime Mapping

| Tool | Kind | Runtime or command mapping | Mutation |
| --- | --- | --- | --- |
| `get_scene_graph` | read | `getScene()` | none |
| `get_selected_nodes` | read | `getSelection()` plus scene lookup when needed | none |
| `select_nodes` | command | `SET_SELECTION` | selection only |
| `apply_command` | command | generic `CommandSchema` -> `applyCommand()` | scene or selection |
| `update_transform` | command | `UPDATE_TRANSFORM` | scene |
| `duplicate_node` | command | `DUPLICATE_NODE` | scene |
| `set_parent` | command | `SET_PARENT` | scene |
| `arrange_nodes` | command | `ARRANGE_NODES` | scene |
| `export_r3f` | read/export | `exportScene({ format: "r3f" })` | none |
| `export_json` | read/export | `exportScene({ format: "json" })` | none |
| `load_scene` | session boundary | `loadScene()` | replaces scene |

## Tool Contracts

### `get_scene_graph`

- Read-only.
- Returns the validated canonical scene document or a graph summary derived from
  it.
- Does not mutate scene, selection, action log, UI state, or viewport state.

### `get_selected_nodes`

- Read-only.
- Returns the current selection id and, when requested, selected node summaries.
- Does not mutate scene, selection, action log, UI state, or viewport state.

### `select_nodes`

- Validates node ids against the current scene.
- MVP maps to `SET_SELECTION` and supports one selected node id or `null`.
- Supports dry-run.
- Mutates selection only.
- Must return structured rejection for missing ids.

### `apply_command`

- Validates a generic command with `CommandSchema`.
- Maps to `applyCommand()` / `dryRunCommand()`.
- Supports dry-run.
- Mutates scene or selection according to the command.
- Intended for advanced or newly added commands that do not yet have a narrow
  tool.

### `update_transform`

- Validates `nodeId` and a non-empty transform patch.
- Maps to `UPDATE_TRANSFORM`.
- Supports dry-run.
- Mutates scene transform state only.

### `duplicate_node`

- Validates source node id, optional target parent id, subtree choice, and
  deterministic `idMap`.
- Maps to `DUPLICATE_NODE`.
- Supports dry-run.
- Mutates scene.
- Future MCP usage must require deterministic `idMap`; generated ids are a UI
  convenience, not a replay-safe agent contract.

### `set_parent`

- Validates source node id, target parent id, and hierarchy constraints.
- Maps to `SET_PARENT`.
- Supports dry-run.
- Mutates scene hierarchy.
- May expose `preserveWorldTransform` once the runtime contract documents the
  option for external tools.

### `arrange_nodes`

- Validates node ids, layout, and layout options.
- Maps to `ARRANGE_NODES`.
- Supports dry-run.
- Mutates scene transforms for the provided node set.

### `export_r3f`

- Validates export options.
- Maps to `exportScene({ format: "r3f" })`.
- Does not mutate scene, selection, action log, UI state, or viewport state.

### `export_json`

- Validates export options.
- Maps to `exportScene({ format: "json" })`.
- Does not mutate scene, selection, action log, UI state, or viewport state.

### `load_scene`

- Validates full scene input or JSON text.
- Maps to `loadScene()`.
- Mutates scene as a session boundary.
- Must reset any runtime state that is scoped to the prior scene.

## Safety Requirements

- No filesystem browsing.
- No shell execution.
- No arbitrary JavaScript execution.
- No direct Zustand access.
- No direct R3F or Three object access.
- No direct scene patching outside commands or validated scene load.
- Every mutating tool records source, payload, dry-run status, result, errors,
  and warnings in the runtime action log or an explicitly scoped successor.
- Mutating tools must support dry-run before apply.
- Narrow schemas should be used for common tools; generic `apply_command` remains
  available for advanced cases.

## Go/No-Go For Real MCP

Real MCP implementation can begin only when:

- command validation is complete;
- dry-run behavior is complete for every mutating tool;
- action logging is complete or explicitly scoped;
- replay tests pass;
- export snapshots pass;
- the local runtime adapter decision is made;
- the live canvas bridge architecture is chosen;
- security review is complete.

Current recommendation: do not begin real MCP transport yet. Milestone 7 proves
the contract shape, but the live canvas bridge architecture and security review
still need explicit decisions before transport work starts.

## Consequences

- MCP transport stays thin and delegates to `DioramaSceneRuntime`.
- Future MCP tools must not bypass commands.
- Tests can validate tool contracts without stdio, HTTP, JSON-RPC, auth, or a
  long-running local server.
- New commands require updates to command schemas, narrow MCP tools if needed,
  eval fixtures, and this ADR.
