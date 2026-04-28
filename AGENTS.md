# Diorama Agent Guide

## What Diorama Is

Diorama is a structured spatial system, not a traditional 3D editor.

A Diorama scene is a scene graph plus a deterministic command history. The
scene graph defines spatial state. Commands define how that state changes. The
system is designed for both humans and AI agents, so every behavior must be
inspectable, replayable, and schema-valid.

The canvas is one interface to the system. It is not the system.

## System Boundary

Diorama treats a 3D scene as a structured system of state and transformations,
not as meshes or rendering output.

- React Three Fiber is visualization only.
- The scene graph is the source of truth.
- Commands are the only mutation path.
- Exports are read models derived from validated scene state.
- UI state may support interaction, but it must not become canonical scene
  state.

## Dual Interface

Diorama exposes two equal interfaces:

- a visual canvas for humans
- a programmatic API (future MCP layer) for agents

Both interfaces must use the same schema, the same command contracts, and the
same reducer semantics. The human canvas must not have private powers that the
agent API cannot express. The agent API must not bypass the rules used by the
canvas.

## AI as Compiler

AI does not directly mutate the scene.
AI compiles intent into structured commands that Diorama executes
deterministically.

Agents may read scene state, propose command batches, dry-run changes, and
inspect results. Agents must not edit scene JSON, React state, Zustand state,
R3F objects, generated code, or files as a substitute for commands.

## Architecture Rules

- No direct mutation of persistent scene state.
- All persistent changes go through commands or validated scene replacement.
- Reducers must be pure, deterministic, and replayable.
- No hidden side effects: no DOM, storage, network, clocks, random values, or
  rendering state inside core command execution.
- Schema-first: persisted state, imported JSON, and untrusted command payloads
  must validate at package boundaries.
- The scene graph and command contracts live outside the UI.
- The UI consumes core contracts; it does not redefine them.
- Exporters read validated scenes; they never mutate scenes.
- Future MCP tools wrap the same command surface; they do not introduce a second
  scene shape or mutation path.
- Command summaries, snapshots, docs, and generated code must be deterministic
  and ASCII-only.

## Non-Goals

Diorama is not:

- Blender
- a DCC
- a renderer
- an AI generation tool
- a modeling package
- a shader graph
- a generic 3D import/export pipeline

Do not add features that pull Diorama toward those products unless a scoped ADR
changes the system boundary.

## Agent Rules

Core owns schema and commands.

- Owns `packages/schema/**` and `packages/core/**`.
- Owns scene schema, command union, reducers, invariants, serialization, layout
  utilities, fixtures, and core tests.
- Must keep scene and command behavior deterministic and validated.

UI consumes only.

- Owns `apps/web/**`.
- Renders scene state, collects human intent, and dispatches commands.
- Must not mutate `scene.nodes` directly.
- Must not redefine scene types, command payloads, or validation rules.

Export reads only.

- Owns `packages/export-r3f/**`.
- Converts validated scene state into deterministic output.
- Must preserve hierarchy and transform semantics.
- Must not mutate scenes or command contracts.

Agent Interface validates agent input.

- Owns `packages/agent-interface/**`.
- Validates untrusted command payloads and scene load inputs before they reach
  core.
- Must keep agent behavior command-first and replayable.

MCP remains deferred.

- `packages/mcp/**` stays a thin adapter until a dedicated MCP milestone is
  active.
- MCP must expose the same scene and command contracts as the agent interface.

Spec owns system alignment.

- Owns `docs/**`, `.cursor/rules/**`, `AGENTS.md`, ADRs, prompts, eval specs,
  roadmap, and scope control.
- Must keep all docs aligned with the spatial-system model.

QA owns validation loops.

- Owns tests across packages and `docs/evals/**`.
- Covers command replay, schema invariants, JSON roundtrip, UI command flow,
  export snapshots, and agent simulation.
- Must treat direct mutation paths as failures.

All agents:

- Never invent a new mutation path.
- Never make the canvas, exporter, MCP layer, or agent interface own scene
  semantics.
- Coordinate before changing root package files, schema contracts, command
  contracts, or shared test fixtures.

## Package Boundaries

Spec Agent may edit:

- `docs/**`
- `.cursor/rules/**`
- `AGENTS.md`

Spec Agent must not edit production packages without explicit coordination.

Core Agent may edit:

- `packages/schema/**`
- `packages/core/**`

Core Agent must not edit UI, exporter, agent-interface, MCP, or root package
files without coordination.

UI Agent may edit:

- `apps/web/**`

UI Agent must not edit schema contracts, command semantics, agent validation, or
export behavior.

Export Agent may edit:

- `packages/export-r3f/**`

Export Agent must not edit schema or command behavior without Core Agent
approval.

QA Agent may edit:

- tests across packages
- `docs/evals/**`

QA Agent must not change production behavior unless paired with the owning
agent.

## Merge Protocol

- Merge schema and command contract branches before dependent UI, export,
  agent-interface, or MCP work.
- Avoid parallel edits to `package.json`, `package-lock.json`, schema contracts,
  command contracts, and the Zustand scene store.
- Use branch-per-agent when multiple agents are active.
- Include an integration note in each PR or handoff: contracts touched, tests
  run, and downstream files likely affected.
- If a branch changes command payloads or scene shape, it must land before
  branches that consume those contracts.
- If tests update snapshots, call that out explicitly.

## Required Validation

For meaningful behavior changes, run the narrow package tests first, then the
workspace gates when practical:

- `npm run typecheck`
- `npm test`
- `npm run lint`

New behavior must include tests. Prefer reducer tests for command semantics,
roundtrip tests for serialization/export changes, browser or component tests for
UI regressions, and eval fixtures for Code -> Canvas -> Code loops.
