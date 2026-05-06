# Future MCP Tool Contract

This document defines Diorama's future MCP tool contract after MCP-lite. It is a
target contract only. Do not implement MCP transport from this document alone.

Target architecture:

```text
Cursor/Claude/Codex
  -> local Diorama MCP server
  -> Diorama agent runtime
  -> validated commands
  -> structured scene
  -> R3F export
```

The local MCP server must be a thin adapter over `@diorama/agent-interface`.
Tools must not connect directly to Zustand, React Three Fiber objects, Three.js
objects, source files, shells, or arbitrary JavaScript execution.

## Shared Result Shape

All tools return an `AgentResult<T>` style envelope:

```ts
type AgentResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AgentError };

type AgentError = {
  code: 'VALIDATION_ERROR' | 'COMMAND_REJECTED' | 'PARSE_ERROR' | 'SCENE_INVALID';
  message: string;
  issues?: Array<{ path: Array<string | number>; message: string }>;
};
```

Mutation tools return command results compatible with the agent runtime:

```ts
type ApplyCommandResult = {
  scene: Scene;
  changed: boolean;
  dryRun: boolean;
  summary: CommandSummary;
  warnings?: string[];
};
```

Batch mutation tools return:

```ts
type CommandBatchResult = {
  scene: Scene;
  changed: boolean;
  dryRun: boolean;
  results: CommandBatchItemResult[];
  errors: CommandBatchError[];
  warnings: string[];
  appliedCommandCount: number;
  failedCommandIndex?: number;
};
```

## Shared Safety Rules

- No filesystem browsing.
- No shell execution.
- No arbitrary JavaScript execution.
- No direct Zustand access.
- No direct R3F or Three object access.
- No direct scene mutation outside commands or validated scene loads.
- Every mutating tool validates payloads before reducer execution.
- Every mutating tool supports `dryRun`.
- Every MCP tool action is logged by the agent runtime action log or an
  explicitly scoped successor before real transport ships.
- MCP tools wrap `@diorama/agent-interface` only.

## Read Tools

### `get_scene`

Purpose: return the current cloned canonical scene.

Input schema:

```ts
type GetSceneInput = {};
```

Output schema:

```ts
type GetSceneOutput = {
  scene: Scene;
};
```

Mutation behavior: none.

Dry-run support: not applicable.

Underlying agent-interface API: `DioramaSceneRuntime.getScene()`.

Safety notes: returns a detached clone. Callers cannot mutate runtime state by
editing returned objects.

### `get_semantic_groups`

Purpose: return semantic group definitions from the current scene.

Input schema:

```ts
type GetSemanticGroupsInput = {};
```

Output schema:

```ts
type GetSemanticGroupsOutput = {
  semanticGroups: Record<string, SemanticGroup>;
};
```

Mutation behavior: none.

Dry-run support: not applicable.

Underlying agent-interface API: MCP-lite facade over `getScene()`.

Safety notes: returns cloned records from `scene.semanticGroups ?? {}`.

### `get_behaviors`

Purpose: return behavior definitions from the current scene.

Input schema:

```ts
type GetBehaviorsInput = {};
```

Output schema:

```ts
type GetBehaviorsOutput = {
  behaviors: Record<string, BehaviorDefinition>;
};
```

Mutation behavior: none.

Dry-run support: not applicable.

Underlying agent-interface API: MCP-lite facade over `getScene()`.

Safety notes: returns cloned records from `scene.behaviors ?? {}`. Behavior
metadata is data only; tools must not execute metadata as code.

### `get_selected_nodes`

Purpose: return the current selection and selected node summaries.

Input schema:

```ts
type GetSelectedNodesInput = {
  includeNodes?: boolean;
};
```

Output schema:

```ts
type GetSelectedNodesOutput = {
  selection: string | null;
  nodes?: SceneNode[];
};
```

Mutation behavior: none.

Dry-run support: not applicable.

Underlying agent-interface API: `getSelection()` plus `getScene()` when
`includeNodes` is true.

Safety notes: selection is read from canonical scene state. Returned nodes are
cloned scene data, not R3F objects.

## Mutation Tools

All mutation tools accept `dryRun?: boolean`. When `dryRun` is true, the tool
returns a preview result and must not mutate scene state. Current MCP-lite
dry-runs do not write the runtime action log; real MCP must either audit dry-run
tool calls in a scoped successor log or explicitly decide that dry-runs remain
unlogged.

### `structure_scene`

Purpose: infer MVP scene structure, semantic groups, node roles, and traits.

Input schema:

```ts
type StructureSceneInput = {
  preset?: 'showroom';
  dryRun?: boolean;
};
```

Output schema: `AgentResult<ApplyCommandResult>`.

Mutation behavior: compiles to `STRUCTURE_SCENE` and mutates scene semantics on
apply.

Dry-run support: yes.

Underlying agent-interface API: `createMcpLiteRuntime().structureScene()` or
`applyCommand({ type: 'STRUCTURE_SCENE', preset })`.

Safety notes: no direct scene patching. Future presets require command schema,
core reducer, docs, and tests to move together.

### `set_node_semantics`

Purpose: set semantic roles, group ids, traits, labels, descriptions, tags, or
confidence on one or more nodes.

Input schema:

```ts
type SetNodeSemanticsInput = {
  nodeIds: string[];
  semantics: Partial<NodeSemantics>;
  dryRun?: boolean;
};
```

Output schema: `AgentResult<ApplyCommandResult>`.

Mutation behavior: compiles to `SET_NODE_SEMANTICS`.

Dry-run support: yes.

Underlying agent-interface API: `dryRunCommand()` / `applyCommand()` with
`CommandSchema`.

Safety notes: semantics metadata remains JSON data. No metadata value may be
executed or emitted as executable JavaScript.

### `create_semantic_group`

Purpose: create or replace a semantic group definition.

Input schema:

```ts
type CreateSemanticGroupInput = {
  group: SemanticGroup;
  dryRun?: boolean;
};
```

Output schema: `AgentResult<ApplyCommandResult>`.

Mutation behavior: compiles to `CREATE_SEMANTIC_GROUP`.

Dry-run support: yes.

Underlying agent-interface API: `dryRunCommand()` / `applyCommand()` with
`CommandSchema`.

Safety notes: validates the group with `SemanticGroupSchema` through
`CommandSchema`.

### `assign_to_semantic_group`

Purpose: assign nodes to an existing semantic group and update matching node
semantics.

Input schema:

```ts
type AssignToSemanticGroupInput = {
  groupId: string;
  nodeIds: string[];
  dryRun?: boolean;
};
```

Output schema: `AgentResult<ApplyCommandResult>`.

Mutation behavior: compiles to `ASSIGN_TO_SEMANTIC_GROUP`.

Dry-run support: yes.

Underlying agent-interface API: `dryRunCommand()` / `applyCommand()` with
`CommandSchema`.

Safety notes: command reducer validates target ids and graph invariants.

### `add_behavior`

Purpose: add a behavior definition and attach behavior refs to target nodes.

Input schema:

```ts
type AddBehaviorInput = {
  behavior: BehaviorDefinition;
  dryRun?: boolean;
};
```

Output schema: `AgentResult<ApplyCommandResult>`.

Mutation behavior: compiles to `ADD_BEHAVIOR`.

Dry-run support: yes.

Underlying agent-interface API: `dryRunCommand()` / `applyCommand()` with
`CommandSchema`.

Safety notes: behavior params are JSON data only. `open_url` and other advanced
behaviors are scaffolding hints, not permission to browse files or execute code.

### `remove_behavior`

Purpose: remove a behavior definition and detach refs from nodes.

Input schema:

```ts
type RemoveBehaviorInput = {
  behaviorId: string;
  dryRun?: boolean;
};
```

Output schema: `AgentResult<ApplyCommandResult>`.

Mutation behavior: compiles to `REMOVE_BEHAVIOR`.

Dry-run support: yes.

Underlying agent-interface API: `dryRunCommand()` / `applyCommand()` with
`CommandSchema`.

Safety notes: removal is command-driven and preserves scene validation.

### `make_interactive`

Purpose: infer behavior definitions for nodes matching a semantic role.

Input schema:

```ts
type MakeInteractiveInput = {
  targetRole?: SemanticRole;
  dryRun?: boolean;
};
```

Output schema: `AgentResult<ApplyCommandResult>`.

Mutation behavior: compiles to `MAKE_INTERACTIVE`.

Dry-run support: yes.

Underlying agent-interface API: `createMcpLiteRuntime().makeInteractive()` or
`applyCommand({ type: 'MAKE_INTERACTIVE', targetRole })`.

Safety notes: creates structured behavior data only. Runtime UI behavior and R3F
handler scaffolds remain derived outputs.

### `arrange_nodes`

Purpose: arrange specific nodes or nodes matching a role using deterministic
layout options.

Input schema:

```ts
type ArrangeNodesInput = {
  nodeIds?: string[];
  role?: SemanticRole;
  layout: 'line' | 'grid' | 'circle';
  options?: {
    spacing?: number;
    cols?: number;
    radius?: number;
    axis?: 'x' | 'y' | 'z';
  };
  dryRun?: boolean;
};
```

Output schema: `AgentResult<ApplyCommandResult>`.

Mutation behavior: compiles to `ARRANGE_NODES` and mutates local transforms.

Dry-run support: yes.

Underlying agent-interface API: `createMcpLiteRuntime().arrangeNodes()` or
`applyCommand({ type: 'ARRANGE_NODES', ... })`.

Safety notes: stores local transforms only. World transforms remain derived from
hierarchy.

### `apply_command`

Purpose: validate and execute one generic command payload.

Input schema:

```ts
type ApplyCommandInput = {
  command: Command;
  dryRun?: boolean;
};
```

Output schema: `AgentResult<ApplyCommandResult>`.

Mutation behavior: mutates according to command type when `dryRun` is false.

Dry-run support: yes.

Underlying agent-interface API: `dryRunCommand()` or `applyCommand()`.

Safety notes: payload must pass `CommandSchema`. This is the escape hatch for
advanced commands, not a way around validation.

### `apply_command_batch`

Purpose: validate and execute a command batch atomically.

Input schema:

```ts
type ApplyCommandBatchInput = {
  commands: Command[];
  dryRun?: boolean;
};
```

Output schema: `AgentResult<CommandBatchResult>`.

Mutation behavior: applies all valid commands atomically when `dryRun` is false.
If any command is semantically rejected, no command is committed.

Dry-run support: yes.

Underlying agent-interface API: `dryRunCommandBatch()` or `applyCommandBatch()`.

Safety notes: replay-safe duplicate commands must provide deterministic `idMap`
values.

### `load_scene`

Purpose: load a validated scene document or parsed scene as a session boundary.

Input schema:

```ts
type LoadSceneInput =
  | { kind: 'json'; json: string; dryRun?: boolean }
  | { kind: 'scene'; scene: Scene; dryRun?: boolean };
```

Output schema:

```ts
type LoadSceneOutput = {
  scene: Scene;
  dryRun: boolean;
  changed: boolean;
};
```

Mutation behavior: replaces the runtime scene on apply.

Dry-run support: required for future MCP, even though current
`DioramaSceneRuntime.loadScene()` applies directly. A transport adapter may
validate and return the normalized scene without committing when `dryRun` is
true.

Underlying agent-interface API: `loadScene()` plus validation through
`LoadSceneInputSchema` and `parseSceneJson`.

Safety notes: load is the only non-command mutation path and must remain a
validated scene replacement boundary. It must not read files; callers provide
JSON text or a parsed scene payload.

## Export Tools

### `export_json`

Purpose: export the current canonical scene document.

Input schema:

```ts
type ExportJsonInput = {};
```

Output schema:

```ts
type ExportSceneResult = {
  format: 'json';
  content: string;
  mediaType: 'application/json';
};
```

Mutation behavior: none.

Dry-run support: not applicable.

Underlying agent-interface API: `exportScene({ format: 'json' })` or
`createMcpLiteRuntime().exportJSON()`.

Safety notes: output is serialized scene state only. It must not include action
logs, command logs, source labels, dry-run flags, or editor UI state.

### `export_r3f`

Purpose: export the current scene as deterministic R3F JSX or a structured React
module.

Input schema:

```ts
type ExportR3FInput = {
  includeStudioLights?: boolean;
  includeLights?: boolean;
  mode?: 'fragment' | 'module';
  componentName?: string;
  semanticComponents?: boolean;
  behaviorScaffold?: 'none' | 'comments' | 'handlers';
  includeUserData?: boolean;
};
```

Output schema:

```ts
type ExportSceneResult = {
  format: 'r3f';
  content: string;
  mediaType: 'text/jsx';
};
```

Mutation behavior: none.

Dry-run support: not applicable.

Underlying agent-interface API: `exportScene({ format: 'r3f', r3f })` or
`createMcpLiteRuntime().exportR3F()`.

Safety notes: exporter reads validated scene state and must not emit action
logs, command logs, local filesystem paths, raw file URLs, arbitrary executable
metadata, editor UI state, Zustand state, or R3F runtime object references.

## Real MCP Go/No-Go Checklist

Real MCP transport can begin only when all are true:

- Schema complete.
- R3F bridge complete.
- Command validation complete.
- Dry-run complete for all mutating tools.
- Batch API complete.
- Action log complete or explicitly deferred with replacement scope.
- Replay tests pass.
- Export snapshots pass.
- Runtime adapter decision complete.
- Security review complete.

No-go if any tool needs filesystem browsing, shell execution, arbitrary
JavaScript, Zustand access, direct R3F access, hidden scene mutation, or
unstructured string-only results.

## Remaining Risks

- `load_scene` dry-run needs an explicit adapter contract because the current
  runtime load method commits directly.
- MCP transport session lifetime is undecided: per-agent in-memory session,
  live canvas session, or explicit project-scoped session.
- Action log visibility for external agents needs a product decision: expose it
  as a read tool, keep it internal, or provide summarized audit events.
- Security review must cover URL-like behavior params and exported code
  scaffolds, even when no network or filesystem capability is exposed.

## Recommendation

Start real MCP implementation after the MCP-lite eval loop, command replay
tests, R3F export snapshots, runtime adapter decision, and security review are
complete. Until then, keep improving the agent-interface facade and evals
without adding transport.
