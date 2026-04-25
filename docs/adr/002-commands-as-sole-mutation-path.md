# ADR 002: Commands as the sole mutation path for the scene graph

## Status

Accepted

## Context

The product promise is a deterministic, inspectable editing loop. Ad hoc mutation of `scene.nodes` from UI or agents would fork semantics and break undo/redo consistency.

## Decision

- All changes to canonical `Scene` data go through `applyCommand(scene, command)` in `@diorama/core`.
- The Zustand store updates `scene` only as `next = applyCommand(prev, command)` (except dev-only harnesses).

### Selection and command log (MVP lock)

- **`SET_SELECTION`** updates `scene.selection` and participates in undo/redo snapshots like any other scene field.
- **Editor command log** (`apps/web` sidebar): entries are recorded for commands that affect structure, transforms, layout, scene replace, etc. **`SET_SELECTION` is intentionally omitted** from this log to avoid noise from rapid picking; selection is still visible via the outliner, inspector context, and `scene.selection` in JSON export.
- **Agents** read selection via `getSelection()` / `scene.selection` on the same `Scene` snapshot; they must not infer selection only from the human command log.

### Deferred commands (post–v1 unless bumped)

- **Rename node** (`RENAME_NODE` or `UPDATE_NODE`): not in the MVP union; UI shows name read-only until an ADR adds a versioned command.
- **Visibility / arbitrary metadata**: not in `SCENE_DATA_VERSION` 1; deferred to a future schema version with explicit migration (see ADR 003).

## Rationale

A single reducer keeps property tests, serialization, and agent batches aligned. Logging policy separates “replay-critical document” from “human-auditable edit stream.”

## Tradeoffs

- Replaying edits from the command log alone does not reproduce selection changes during MVP; full `Scene` snapshots or exported JSON do.

## Consequences

- PR review checks that `apps/web` does not assign into `scene.nodes` outside the store reducer path.
- `docs/COMMANDS.md` lists payloads and no-op rules for automation.
