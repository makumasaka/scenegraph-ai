# ADR 006: JSON document as canonical exchange format

## Status

Accepted

## Context

Files, CI fixtures, and agents need a portable interchange for full scene state.

## Decision

- Canonical on-disk / clipboard JSON uses the **`diorama-scene`** document envelope: `format`, `version`, `data` (`Scene`).
- Serialization uses **stable key ordering** (`stableStringify`) for readable diffs.
- `SCENE_DATA_VERSION` is an integer; bumps require migrations and tests.

## Rationale

Versioned documents prevent silent incompatible imports; stable ordering supports review.

## Tradeoffs

- Slightly larger payloads than minimal JSON; acceptable for MVP sizes.

## Consequences

- Roundtrip and snapshot tests must use the document shape, not ad hoc partial objects, for “golden” files.
