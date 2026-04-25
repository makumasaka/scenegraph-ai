# ADR 007: React Three Fiber JSX as the first code export

## Status

Accepted

## Context

The code ↔ canvas ↔ code loop needs a human-readable code artifact that round-trips intent for simple scenes.

## Decision

- `@diorama/export-r3f` emits deterministic JSX strings: nested `<group>` elements, primitive mesh for non-root nodes (current MVP), optional studio lights block.
- Export is **illustrative**: not every schema field maps to distinct Three primitives yet (for example material tokens may not change emitted material nodes until a later iteration).

## Rationale

JSX is easy to paste into existing R3F apps; snapshot tests lock stability.

## Tradeoffs

- Not a full scene compiler; glTF and custom components are out of scope for MVP.

## Consequences

- Export tests live in `packages/export-r3f`; changes to output are intentional semver or snapshot updates with review.
