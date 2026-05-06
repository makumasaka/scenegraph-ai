# MCP-lite → R3F export validation

This note complements [`mcp-lite-loop.md`](./mcp-lite-loop.md) and [`milestone-7-mcp-simulation.md`](./milestone-7-mcp-simulation.md): it records **what the export bridge guarantees** when the scene is mutated by the same commands the MCP-lite agent uses (`STRUCTURE_SCENE`, `MAKE_INTERACTIVE`, `ARRANGE_NODES`), without going through the agent HTTP surface.

## What is locked in tests

Automated coverage lives in `packages/export-r3f/src/mcpLiteShowroomExport.test.ts`:

| Step | Scene state | Fragment export snapshot |
|------|-------------|-------------------------|
| 01 | `showroomScene` (messy flat graph) | `01-messy-fragment` |
| 02 | after `STRUCTURE_SCENE` | `02-structured-fragment` |
| 03 | after `MAKE_INTERACTIVE` (product role) | `03-interactive-fragment` |
| 04 | after `ARRANGE_NODES` on three products | `04-arranged-fragment` |
| 05 | full chain | `05-workflow-fragment` + `05-workflow-module` |

Additional invariants per test:

- **Determinism**: duplicate `exportSceneToR3fJsx(fullWorkflow)` is byte-identical.
- **No leaks**: forbidden substrings include quoted `"selection"`, `commandLog`, undo stacks, `UPDATE_TRANSFORM`, `SET_SELECTION`, `command_batch`, POSIX/Windows absolute paths, and `file:///`.
- **Poisoned scene**: extra fields on the in-memory object (`selection`, `commandLog`, `past`, `future`, `gizmoMode`) and `file://` URIs in metadata/asset refs must not appear in output.

## Export quality (current)

**Fragment (`exportSceneToR3fJsx`)**

- Top-of-file **semantic group** and **behavior definition** summaries; group and behavior ids are **sorted** for stable bytes.
- Per-node **`{/* id - name */}`** markers and **`{/* semantics: … */}`** lines, including sorted **trait lists** when present.
- **`userData={…}`** uses schema **`stableStringify`** so object keys are sorted at every depth (matches canonical JSON philosophy).

**Module (`exportSceneToR3fModule`)**

- Semantic **component names** (`Product`, `DisplaySurface`, …) and optional **wrapper** components when a semantic group is contiguous under one parent.
- **Handler scaffolding** (`behaviorScaffold: 'handlers'`): `useState` for selection when needed, `handleSelect` / `handleHoverStart` / `handleFocusCamera` stubs, and **TODO** lines for behavior types that do not have generated runtime yet (`anchor_point`, `open_url`, …).

## Remaining bridge gaps

1. **Semantics vs. geometry**: `STRUCTURE_SCENE` is mostly metadata and **child order** under the root; the exporter does **not** regroup the scene to match semantic buckets unless members are already **contiguous** siblings (module exporter wraps those cases; otherwise **info diagnostics** and comments describe the intent).
2. **Assets**: `assetRef` URIs are **not** turned into imports or loaders; a malicious `file://` path must never be echoed (covered by tests when injected).
3. **Behaviors**: Exported code is **scaffolding** — URLs for `open_url`, camera motion for `focus_camera`, and anchors for `anchor_point` remain TODOs.
4. **Fragment vs module**: The JSX **fragment** is the easiest human-readable dump; the **module** is closer to an app integration point but still needs review before shipping UX.

## Commands run

```bash
cd packages/export-r3f
npx vitest run
```

From repo root:

```bash
npm run test -w @diorama/export-r3f
npm run build -w @diorama/export-r3f
```
