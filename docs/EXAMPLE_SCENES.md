# Example scenes

This document describes how scenes are represented in the repo, which **starter kits** ship with the editor, and how to move JSON in and out of the app.

## Document format

Exported files use a small wrapper so tooling can detect version and format:

- **`format`**: `diorama-scene` (see `SCENE_DOCUMENT_FORMAT` in `@diorama/schema`).
- **`version`**: Integer data version (`SCENE_DATA_VERSION`). Canonical exports currently use version 2.
- **`data`**: The `Scene` object: `rootId`, `selection`, and `nodes` (id -> node record).

Each canonical version 2 **node** includes:

- `id`
- `name`
- `type` (`root`, `group`, `mesh`, `light`, or `empty`)
- `children` (ordered list of child ids)
- `transform`: `position`, `rotation`, `scale` as 3-tuples of finite numbers
- `visible`
- optional `assetRef`
- optional `materialRef`
- optional `light`
- `metadata`

The `rootId` node must have `type: "root"`. Scene transforms are local; world
transforms are computed from hierarchy when needed.

Serialization uses **stable key ordering** at every object depth so diffs stay readable; array order (for example `children`) is preserved.

## Legacy import policy

`parseSceneJson` still accepts wrapped version 1 documents and legacy bare scene
graphs while that compatibility path is retained. Those inputs are migrated to
the canonical version 2 scene shape before callers receive them.

Migration/defaulting behavior:

- `selection` defaults to `null` when omitted.
- `visible` defaults to `true`.
- `metadata` defaults to `{}`.
- missing node `type` defaults through the schema, and the `rootId` node is
  rewritten to `type: "root"` for legacy imports.
- unsupported document versions are rejected.

## Starter kits (built-in)

These are TypeScript fixtures in `@diorama/core` (`packages/core/src/fixtures/`). In the web app, use the **Kit** dropdown and **Load kit** in the scene loader panel.

| Kit ID | Description |
|--------|-------------|
| `default` | Minimal graph: root plus one cube (useful for smoke tests and empty-slate edits). |
| `showroom` | Root -> wide floor slab with pedestals and a slightly scaled/rotated accent cube. |
| `gallery` | Root -> hall with a 3 by 3 grid of thin frame boxes on the floor. |
| `living` | Root -> room -> furniture group with sofa, coffee table, floor, and lamp proxies. |

Fixture IDs are prefixed per kit (`default-*`, `showroom-*`, `gallery-*`, `living-*`) so graphs do not collide when switching kits in one session.

## Checked-in JSON examples

Canonical JSON examples live in `packages/examples/scenes/`:

- `default.json`
- `showroom.json`
- `gallery.json`
- `living.json`

These examples are intended for docs, regression fixtures, export snapshots, and
future eval harnesses.

## Import and export in the UI

1. **Export JSON** - Writes a `diorama-scene` document (wrapper + sorted keys) suitable for Git or CI fixtures.
2. **Import JSON** - Parses the wrapper or, when applicable, a **legacy** graph shape the schema layer still accepts.
3. **Copy R3F JSX** - Uses `@diorama/export-r3f` to place the current scene into a clipboard-friendly JSX snippet (lights optional per exporter options).

## Authoring JSON by hand

- Ensure `rootId` exists in `nodes` and matches the root node's `id`.
- Ensure the `rootId` node has `type: "root"`.
- Every non-root node must appear exactly once in some parent's `children` array.
- Do not attach the root as a child of any node.
- Avoid duplicate ids and cycles.

When in doubt, export a kit from the app and edit from that template.

## `packages/examples`

The `@diorama/examples` package is reserved for checked-in JSON scenes, small
scripts that load scenes through `@diorama/core`, and regression assets shared by
docs and tests.

## Related reading

- [ARCHITECTURE.md](ARCHITECTURE.md) - how commands update `Scene`.
- `packages/agent-interface/examples/prompt-to-command.md` - mapping natural language to validated commands.
