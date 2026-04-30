# ADR 007: React Three Fiber JSX as the first code export

## Status

Accepted

## Context

The code -> canvas -> code loop needs a human-readable code artifact that
round-trips intent for simple scenes.

## Decision

- `@diorama/export-r3f` emits deterministic JSX strings: nested `<group>`
  elements for every visible scene node, primitive mesh placeholders for visible
  `mesh` nodes, simple ambient/directional lights for scene light nodes, hidden
  subtree omission, and an optional studio lights block.
- Export is **illustrative**: not every schema field maps to distinct Three
  primitives yet. `assetRef` and `materialRef` are intentionally not resolved by
  the MVP exporter.

## Rationale

JSX is easy to paste into existing R3F apps; snapshot tests lock stability.

## Tradeoffs

- Not a full scene compiler; real asset loading, material graphs, animation,
  shader graphs, glTF, custom components, and full renderer semantics are out of
  scope for MVP.

## Consequences

- Export tests live in `packages/export-r3f`; changes to output are intentional semver or snapshot updates with review.
