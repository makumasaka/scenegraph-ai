# ADR 001: Canonical scene state separate from the render tree

## Status

Accepted

## Context

Diorama must support human editing, export, and future agent tooling without ambiguity about where truth lives. React Three Fiber builds a runtime object graph that is convenient for rendering but is not a stable interchange format.

## Decision

- **Canonical state** is the `Scene` graph validated by `@diorama/schema` (nodes, hierarchy, transforms, selection, optional refs).
- **Render state** is whatever R3F/Three.js holds (meshes, materials resolved for display, camera pose, OrbitControls internals). It is derived from `Scene` plus non-serialized UI preferences (for example gizmo mode in Zustand).

## Rationale

Replay, diffing, and agents require one deterministic document. The viewport is a projection, not an authority.

## Tradeoffs

- Duplication: local TRS in `Scene` vs world matrices in the engine; we accept explicit sync via commands and helpers like `getWorldMatrix`.

## Consequences

- No persisting camera or picker state inside `Scene` for MVP.
- Tests that assert canvas behavior must still validate through `Scene` or dispatched commands where possible.
