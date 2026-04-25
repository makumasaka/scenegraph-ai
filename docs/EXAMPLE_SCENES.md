# Example scenes

This document describes how scenes are represented in the repo, which **starter kits** ship with the editor, and how to move JSON in and out of the app.

## Document format

Exported files use a small wrapper so tooling can detect version and format:

- **`format`**: `diorama-scene` (see `SCENE_DOCUMENT_FORMAT` in `@diorama/schema`).
- **`version`**: Integer data version (`SCENE_DATA_VERSION`).
- **`data`**: The `Scene` object: `rootId`, `selection`, and `nodes` (id -> node record).

Each **node** includes at least:

- `id`, `name`, `children` (ordered list of child ids)
- `transform`: `position`, `rotation`, `scale` as 3-tuples of finite numbers

Optional fields include `assetRef`, `materialRef`, and `light`, per the Zod schemas.

Serialization uses **stable key ordering** at every object depth so diffs stay readable; array order (for example `children`) is preserved.

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
