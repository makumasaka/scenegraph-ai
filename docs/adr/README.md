# Architecture Decision Records (ADRs)

Short, durable decisions for Diorama’s MVP “system lock.” Each file states **context**, **decision**, **rationale**, **tradeoffs**, and **consequences**.

| ADR | Title |
|-----|--------|
| [001](001-canonical-scene-vs-render-tree.md) | Canonical `Scene` vs render tree |
| [002](002-commands-as-sole-mutation-path.md) | Commands as sole mutation path; selection log policy; deferred rename/visibility |
| [003](003-zod-schema-source-of-truth.md) | Zod as source of truth; versioning |
| [004](004-zustand-ui-scope.md) | Zustand scope (UI vs scene) |
| [005](005-r3f-product-canvas.md) | R3F as product canvas |
| [006](006-json-canonical-exchange.md) | JSON document as canonical exchange |
| [007](007-r3f-jsx-first-code-export.md) | R3F JSX as first code export |
| [008](008-mcp-deferred.md) | MCP deferred until agent API stable |
| [009](009-gltf-import-deferred.md) | glTF / broad import deferred |
| [010](010-threejs-in-core-for-trs-math.md) | Three.js in core for TRS math |

## How to add a new ADR

Use the next number, keep one decision per file, and link it from [ARCHITECTURE.md](../ARCHITECTURE.md) or [MIGRATION.md](../../MIGRATION.md) when it affects repo layout or workflows.
