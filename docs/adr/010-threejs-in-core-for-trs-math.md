# ADR 010: Three.js as a math dependency in core for TRS / world matrices

## Status

Accepted

## Context

Reparenting with `preserveWorldTransform` requires reliable compose/decompose of TRS matrices. Implementing robust decomposition in pure TypeScript duplicates Three.js work and adds bug surface.

## Decision

- `@diorama/core` may depend on **`three`** for `Matrix4`, `Vector3`, `Quaternion`, `Euler` in `worldTransform.ts` (and related command paths).
- This dependency is **math-only**: no WebGL renderer, no DOM, no frame loop in core.

## Rationale

Correctness and maintenance: Three’s decomposition matches the R3F stack the product already ships.

## Tradeoffs

- Core is not “renderer-free” in the strictest sense; bundle size for headless runs includes three math.
- Alternative: extract to `@diorama/math` with gl-matrix; revisit if non-Three consumers need a slimmer core.

## Consequences

- World transform behavior is documented with **Euler order XYZ** to match Three usage.
- Tests cover `preserveWorldTransform` numerically; changes to euler order require ADR revision.
