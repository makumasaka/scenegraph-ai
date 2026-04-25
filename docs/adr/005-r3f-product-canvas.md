# ADR 005: React Three Fiber as the product canvas layer

## Status

Accepted

## Context

The MVP needs a credible spatial preview without building a renderer.

## Decision

- `apps/web` uses React Three Fiber for the interactive viewport.
- R3F/Three objects reflect `Scene` transforms; picking updates selection through commands.
- The canvas is **not** the source of truth: it reads `Scene` and emits commands; it does not invent parallel node ids.

## Rationale

Fast path for a browser MVP; aligns with export to R3F JSX.

## Tradeoffs

- Engine-specific quirks (euler order, controls) must be documented alongside core math (`worldTransform`).

## Consequences

- Performance tuning stays in the product layer; core stays graph-focused.
