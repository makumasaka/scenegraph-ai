# MCP-Lite

MCP-lite is a library-level proof of the future MCP surface. It proves the
agent workflow without a server transport:

Agent intent -> MCP-lite facade -> validated Diorama commands -> dry-run ->
apply -> inspect result -> JSON/R3F export.

The implementation lives in `packages/agent-interface/src/mcpLite.ts` and is
re-exported by `@diorama/mcp` through the existing package re-export.

## Scope

MCP-lite wraps `createAgentSession()` with helper names that match future MCP
tools. It does not implement a real MCP server, tool descriptors,
authentication, persistence, or remote sessions.

All write helpers compile to canonical commands and then delegate to the
validated agent runtime. They do not mutate scenes directly.

Implemented helpers:

- `createMcpLiteRuntime(initialScene?)`
- `getScene()`
- `getSemanticGroups()`
- `getBehaviors()`
- `dryRunCommand(command)`
- `applyCommand(command)`
- `dryRunCommandBatch(commands)`
- `applyCommandBatch(commands)`
- `structureScene({ preset, dryRun? })`
- `makeInteractive({ targetRole, dryRun? })`
- `arrangeNodes({ nodeIds, layout, options, dryRun? })`
- `exportR3F(options?)`
- `exportJSON()`

All helpers return `AgentResult<T>`: either `{ ok: true, data }` or
`{ ok: false, error }`.

## Safety Rules

MCP-lite explicitly forbids:

- Filesystem browsing.
- Shell execution.
- Arbitrary JavaScript execution.
- Zustand access.
- React Three Fiber object access.
- Editing exported code or scene files as a substitute for commands.
- Direct hidden mutation of scene state.

Expected validation and command failures return structured `AgentErr` values
instead of throwing.

## Future Tool Mapping

| Future MCP tool | MCP-lite helper | Input | Output | Mutates? | Dry-run support |
|-----------------|-----------------|-------|--------|----------|-----------------|
| `get_scene` | `getScene()` | none | cloned `Scene` | No | N/A |
| `get_semantic_groups` | `getSemanticGroups()` | none | `Record<string, SemanticGroup>` | No | N/A |
| `get_behaviors` | `getBehaviors()` | none | `Record<string, BehaviorDefinition>` | No | N/A |
| `dry_run_command` | `dryRunCommand(command)` | unknown command payload | `ApplyCommandResult` | No | Built-in |
| `apply_command` | `applyCommand(command)` | unknown command payload | `ApplyCommandResult` | Yes | Use dry-run tool first |
| `dry_run_command_batch` | `dryRunCommandBatch(commands)` | unknown command array | `CommandBatchResult` | No | Built-in |
| `apply_command_batch` | `applyCommandBatch(commands)` | unknown command array | `CommandBatchResult` | Yes | Use dry-run tool first |
| `structure_scene` | `structureScene({ preset, dryRun? })` | preset (`showroom`) | command result | Optional | Yes |
| `make_interactive` | `makeInteractive({ targetRole, dryRun? })` | semantic role | command result | Optional | Yes |
| `arrange_nodes` | `arrangeNodes({ nodeIds, layout, options, dryRun? })` | arrange payload | command result | Optional | Yes |
| `export_r3f` | `exportR3F(options)` | R3F options | `{ content, mediaType }` | No | N/A |
| `export_json` | `exportJSON()` | none | `{ content, mediaType }` | No | N/A |

## Go Criteria For Real MCP

Move to a real MCP transport when all are true:

- MCP-lite facade tests pass for dry-run, apply, inspect, and export loops.
- Every write path goes through `CommandSchema` or existing validated load
  schemas.
- Convenience helpers compile to command payloads rather than changing scene
  directly.
- `getSemanticGroups()` and `getBehaviors()` are clone-safe read helpers.
- Agent eval proves: structure scene -> make interactive -> arrange -> export
  R3F module.
- R3F module export is deterministic and safe against command log, path, and
  raw URL leakage.
- Docs list forbidden capabilities and future tool mapping.
- No dependency on `apps/web`, Zustand, DOM objects, R3F runtime objects,
  filesystem browsing, shell, or arbitrary JS execution.

## No-Go Criteria

Do not implement real MCP if any are true:

- A helper mutates scene outside `applyCommandWithResult`.
- Convenience helpers duplicate reducer behavior instead of compiling commands.
- Dry-run and apply produce inconsistent results for the same valid payload.
- Any export leaks action logs, command logs, local filesystem paths, or
  arbitrary metadata as executable JavaScript.
- MCP design requires access to Zustand, React components, Three objects, shell,
  filesystem browsing, or raw source-code mutation.
- Tool results are unstructured strings instead of `AgentResult`-style objects.
