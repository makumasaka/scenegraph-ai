# ADR 009: glTF and broad 3D import deferred

## Status

Accepted

## Context

Asset pipelines explode scope (materials, skins, animations, coordinate conventions).

## Decision

- MVP does **not** include glTF/glB import into the command graph.
- `assetRef` with `kind: 'uri'` may appear in schema for forward compatibility; loading such assets in the viewport is optional and not required for MVP acceptance.

## Rationale

Preserve focus on graph + commands + export loop.

## Tradeoffs

- Users bring geometry via primitives / fixtures until a future import ADR.

## Consequences

- Docs and UI must not promise Blender-class import for MVP.
