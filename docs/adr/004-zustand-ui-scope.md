# ADR 004: Zustand scope for session UI only

## Status

Accepted

## Context

The store should not become a second scene graph or hide mutations from the command reducer.

## Decision

Zustand in `apps/web` may hold:

- Current `scene` (canonical), updated only via `dispatch` → `applyCommand`.
- Undo/redo stacks of scene snapshots.
- Command log entries (presentation: ids, timestamps, summaries).
- **UI-only**: `gizmoMode`, and similar viewport chrome that does not belong in `Scene`.

Zustand must **not** hold authoritative duplicates of node transforms or hierarchy outside `scene`.

## Rationale

Clear boundary between serialized/document state and per-session ergonomics.

## Tradeoffs

- Selection lives in `Scene` (not only Zustand) so it serializes and undoes consistently; see ADR 002 for log policy.

## Consequences

- New UI state fields default to Zustand locals unless they must round-trip; then they need a command or document field.
