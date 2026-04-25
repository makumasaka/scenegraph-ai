# ADR 003: Zod schema as the source of truth for scene documents

## Status

Accepted

## Context

TypeScript interfaces alone do not protect persisted JSON or agent payloads. The product requires validated imports and stable evolution.

## Decision

- `@diorama/schema` owns Zod schemas (`SceneGraphSchema`, `SceneDocumentSchema`, node fields, refinements for graph invariants).
- Exported TypeScript types for the graph are inferred from Zod where practical.
- **Legacy parse path**: `parseSceneJson` accepts a wrapped `diorama-scene` document or a bare legacy graph when `parseSceneGraph` can normalize it; behavior is covered by tests and must not widen silently without a version bump.

## Rationale

One parser for UI, tests, and agents reduces drift; Zod issues map cleanly to agent errors.

## Tradeoffs

- Refinements can be harder to read than hand-written validators; we keep graph refinements centralized in `schemas.ts`.

## Consequences

- Any new persisted field requires `SCENE_DATA_VERSION` review and migration tests when the version increments.
- **Visibility and metadata** on nodes: **not** in v1; add only with a new ADR and `SCENE_DATA_VERSION` 2.
