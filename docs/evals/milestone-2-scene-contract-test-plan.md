# Milestone 2 Scene Contract Test Plan

## Goal

Lock the scene JSON contract around fixture validity, graph invariants,
legacy migration/defaulting, and deterministic serialization. These tests
should catch schema drift before UI, exporter, or future agent surfaces consume
invalid scene state.

## Scope

- Schema validation through `@diorama/schema`.
- Core starter fixtures from `packages/core/src/fixtures`.
- Checked-in example scene parity from `packages/examples/scenes`.
- Serialization behavior for canonical `diorama-scene` documents.

Out of scope:

- Command reducer semantics.
- Web UI behavior.
- Production schema behavior changes without Core Agent pairing.

## Test Matrix

Valid scenes:

- `defaultFixtureScene` validates.
- `showroomScene` validates.
- `galleryScene` validates.
- `livingSpaceScene` validates.
- Each checked-in example JSON parses, validates, and matches its core fixture.

Invalid scenes:

- Missing `rootId`.
- `rootId` points to a missing node.
- `rootId` points to a non-root node type.
- Root appears as a child.
- Missing child reference.
- Duplicate child reference.
- Orphan node.
- Cycle.
- Node `id` does not match map key.
- Selection points to a missing node.

Migration/defaulting:

- Legacy v1 documents default missing node `type`.
- Legacy v1 documents default missing node `visible`.
- Legacy v1 documents default missing node `metadata`.
- Legacy bare scene objects remain accepted while retained.
- Unsupported document versions are rejected.

Serialization:

- Canonical JSON key ordering is deterministic.
- `parse -> serialize -> parse` is stable.
- Child order is preserved across serialization.

## Ownership Notes

Schema contract changes belong in `packages/schema`. Core fixture updates belong
in `packages/core/src/fixtures`. If canonical document version changes, Core
Agent should also update checked-in examples or explicitly document why example
files remain legacy fixtures.
