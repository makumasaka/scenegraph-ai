# ADR 003: Zod schema as the source of truth for scene documents

## Status

Accepted

## Context

TypeScript interfaces alone do not protect persisted JSON or agent payloads. The product requires validated imports and stable evolution.

## Decision

- `@diorama/schema` owns Zod schemas (`SceneGraphSchema`, `SceneDocumentSchema`, node fields, refinements for graph invariants).
- Exported TypeScript types for the graph are inferred from Zod where practical.
- Canonical exports now use `SCENE_DATA_VERSION` 2. Version 2 formalizes persisted node `type`, `visible`, and `metadata` fields.
- **Legacy parse path**: `parseSceneJson` accepts a wrapped v2 `diorama-scene` document, migrates wrapped v1 documents, and accepts bare legacy scene graphs while that compatibility path is retained. Behavior is covered by tests and must not widen silently without a version/migration test.
- The canonical root contract is explicit: `rootId` must point to a node with `type: "root"`, and no non-root node may use `type: "root"`.

## Version 2 Scene Node Shape

Each canonical `SceneNode` includes:

- `id`: stable node id. The map key and node `id` must match.
- `name`: human-readable label.
- `type`: one of `root`, `group`, `mesh`, `light`, or `empty`.
- `children`: ordered child id list. Array order is canonical and preserved.
- `transform`: local `position`, `rotation`, and `scale` Vec3 tuples.
- `visible`: persisted visibility flag.
- `assetRef`: optional asset reference.
- `materialRef`: optional material token/reference.
- `light`: optional authored light payload.
- `metadata`: JSON-safe metadata object.

Transforms are local only. World transforms are computed from hierarchy when
needed. Euler rotations are stored in radians using XYZ rotation order for the
MVP.

## Migration

Wrapped v1 documents and legacy bare scene graphs are normalized into the v2
shape when parsed:

- `selection` defaults to `null` when omitted.
- `visible` defaults to `true`.
- `metadata` defaults to `{}`.
- missing node `type` is inferred during migration: the `rootId` node becomes
  `root`, nodes with `light` become `light`, branch nodes become `group`, and
  remaining leaf nodes become `mesh`.
- unsupported document versions are rejected.

The legacy bare-scene path is compatibility-only. New exports must use the
wrapped v2 document format.

## Rationale

One parser for UI, tests, and agents reduces drift; Zod issues map cleanly to agent errors.

## Tradeoffs

- Refinements can be harder to read than hand-written validators; we keep graph refinements centralized in `schemas.ts`.

## Consequences

- Any new persisted field requires `SCENE_DATA_VERSION` review and migration tests when the version increments.
- UI, exporters, agent-interface, and future MCP tools must treat the v2 schema as the canonical scene contract.
- UI rendering must respect root transforms; the root is rendered as a scene
  group, not treated as an identity-only document wrapper.
- Exporters must preserve hierarchy and local transform semantics.
- Agent Interface must validate or migrate imported scenes before commands run.
- MCP remains deferred and must not introduce a second scene shape.
- Import paths may accept v1/bare legacy scenes, but must return normalized v2 scene state to callers.
