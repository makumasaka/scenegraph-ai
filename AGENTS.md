# Diorama Agent Guide

Diorama is a deterministic scenegraph and command system with a browser canvas
on top. The scenegraph is the source of truth. The canvas, outliner, inspector,
exporters, and future agent tools must read scene state and emit commands rather
than mutating scene data directly.

## Product Boundary

Diorama is a programmable spatial interface layer, not a DCC tool, rendering
engine, Blender replacement, or generic generative AI product.

Phase 1 locks the human editing loop:

- Load a starter scene.
- Render it in the web canvas.
- Select nodes.
- Inspect hierarchy.
- Edit transforms.
- Apply layout commands.
- Log meaningful commands.
- Undo and redo.
- Export JSON and basic React Three Fiber JSX.

Phase 2 exposes the same command system to agents through an MCP-compatible
surface. Agents compile intent into commands; they do not directly mutate scene
state, React state, files, or generated code.

## Package Ownership

Spec Agent owns:

- `docs/**`
- `.cursor/rules/**`
- `AGENTS.md`
- roadmap, ADRs, prompts, eval specs, and scope control

Spec Agent must not edit:

- `apps/web/**` product implementation
- `packages/schema/**` schema contracts
- `packages/core/**` command or reducer implementation
- `packages/export-r3f/**` exporter implementation
- `package.json` or `package-lock.json` without coordination

Core Agent owns:

- `packages/schema/**`
- `packages/core/**`
- scene schema, commands, reducer, invariants, serialization, layout utilities,
  fixtures, and core tests

Core Agent must not edit:

- `apps/web/**` UI implementation
- `packages/export-r3f/**` exporter behavior, except coordinated type/import fixes
- `packages/mcp/**` adapter implementation
- docs/rules owned by Spec Agent, except matching command/schema references
- root package files without coordination

UI Agent owns:

- `apps/web/**`
- app shell, viewport, outliner, inspector, command log, interaction loop, and
  app tests

UI Agent must not edit:

- `packages/schema/**` scene contracts
- `packages/core/**` command semantics
- `packages/agent-interface/**` command validation
- `packages/export-r3f/**` exporter behavior
- root package files without coordination

Export Agent owns:

- `packages/export-r3f/**`
- export tests and export examples in coordination with Core and QA

Export Agent must not edit:

- `packages/schema/**` scene contracts
- `packages/core/**` command or fixture behavior without Core Agent approval
- `apps/web/**` product UI, except coordinated export button wiring
- `packages/agent-interface/**` or `packages/mcp/**`
- root package files without coordination

QA Agent owns:

- tests across packages
- `docs/evals/**`
- command replay fixtures, roundtrip checks, UI flow checks, export snapshots,
  and agent simulation loops

QA Agent must not edit:

- production schema, command, UI, or exporter behavior unless paired with the
  owning agent
- root package files without coordination

MCP work is deferred until the agent-interface surface is stable. `packages/mcp`
should stay a thin adapter unless a dedicated MCP milestone is active.

## Hard Rules

- Persistent scene changes must go through `applyCommand` or validated scene
  replacement.
- UI code must not rewrite `scene.nodes` directly.
- Export code must be pure and must not mutate scenes.
- Future MCP tools must validate payloads and call the same command surface.
- Do not redefine scene or command types in the web app or exporter.
- Keep command semantics in `packages/core/src/commands.ts`.
- Keep untrusted command validation in
  `packages/agent-interface/src/commandSchema.ts`.
- Any command contract change must update core tests, command schema tests, docs,
  and affected UI/export tests in the same branch.
- Use ASCII only in generated code, docs, snapshots, and comments.

## Merge Protocol

- Avoid parallel edits to root `package.json`, `package-lock.json`, command
  contracts, schema contracts, and the Zustand scene store.
- Merge schema and command contract branches before dependent UI or export work.
- Branch per agent when multiple agents are active.
- Include an integration note in each PR or handoff: contracts touched, tests run,
  and downstream files likely affected.
- If a branch changes command payloads or scene shape, it must land before
  branches that consume those contracts.
- If pre-commit or tests update snapshots, call that out explicitly in the
  integration note.

## Required Validation

For meaningful behavior changes, run the narrow package tests first, then the
workspace gates when practical:

- `npm run typecheck`
- `npm test`
- `npm run lint`

New behavior must include tests. Prefer reducer tests for command semantics,
roundtrip tests for serialization/export changes, browser or component tests for
UI regressions, and eval fixtures for Code -> Canvas -> Code loops.
