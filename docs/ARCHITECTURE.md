# Architecture overview

Diorama separates **canonical scene state**, **how it changes**, and **how it is shown or exported**. The goal is a small, testable core with clear boundaries.

## Layered model

```mermaid
flowchart TB
  subgraph agents [Agents and tools]
    MCP["@diorama/mcp"]
    AIF["@diorama/agent-interface"]
  end
  subgraph app [Application]
    Web["apps/web — React + R3F"]
    Store["Zustand store — dispatch only"]
  end
  subgraph core [Core]
    Cmd["Command union + applyCommand"]
    Scene["Scene graph — Zod-validated"]
  end
  subgraph io [I/O]
    Ser["serializeScene / parseSceneJson"]
    Exp["@diorama/export-r3f"]
  end
  Schema["@diorama/schema — types + validation"]
  Schema --> Scene
  Schema --> Ser
  Cmd --> Scene
  Store --> Cmd
  Web --> Store
  AIF --> Cmd
  MCP --> AIF
  Scene --> Exp
  Web --> Exp
```

## `@diorama/schema`

- Defines `Scene`, `SceneNode`, transforms, optional asset/material/light fields.
- Validates graph invariants: single root, no cycles, no orphans, consistent `children` references.
- Provides `serializeScene` / `parseSceneJson` (including legacy graph parsing where supported) and `stableStringify` for deterministic JSON.

## `@diorama/core`

- **`Command`** — Discriminated union (`ADD_NODE`, `DELETE_NODE`, `UPDATE_TRANSFORM`, `SET_PARENT`, `DUPLICATE_NODE`, `ARRANGE_NODES`, `REPLACE_SCENE`, `SET_SELECTION`).
- **`applyCommand(scene, command)`** — Pure, deterministic reducer entry point.
- **Fixtures** — `getStarterScene` and static scenes for tests and the web “kits” UI.
- **Layout** — Helpers such as `ARRANGE_NODES` for grid-like positioning.

No React, no Three.js imports in core—only graph logic and math that serves commands.

## `apps/web`

- Renders the scene graph in the viewport.
- User actions should **dispatch commands** through the scene store, not rewrite `scene.nodes` imperatively.
- Import/export and “Load kit” use the same schema and command paths as automation would.

## `@diorama/export-r3f`

- Consumes a validated `Scene` and emits JSX strings suitable for R3F apps.
- Kept separate so export behavior is tested independently of the editor UI.

## `@diorama/agent-interface`

- Schemas and types for sessions, commands, and load-scene inputs so agents produce **validated** payloads before they hit `applyCommand`.

## `@diorama/mcp`

- Thin integration layer for MCP hosts; expected to grow alongside agent-interface stability.

## `@diorama/examples`

- Intended for static JSON examples, scripts, and docs-driven demos. Currently a placeholder; see [GOOD_FIRST_ISSUES.md](GOOD_FIRST_ISSUES.md).

## Data flow (editing)

1. UI or agent builds a `Command` (or sequence).
2. Store calls `applyCommand` (and related invariants if any).
3. Updated `Scene` flows to the viewport and to export/serialize paths.

This keeps **replay**, **testing**, and **tooling** aligned on one semantic model.
