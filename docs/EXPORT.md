# Export pipeline

Diorama exports stable JSON and readable React Three Fiber JSX from a validated
scene graph. Both formats are read models: the canonical `Scene` is the source
of truth, and exporters never mutate it.

This document covers what each format guarantees, what it intentionally does
not cover, and how the export loop is locked in tests.

## Formats

### JSON (`@diorama/schema`)

`serializeScene` produces a `diorama-scene` document:

- `format`: literal `diorama-scene`.
- `version`: integer data version (currently `2`).
- `data`: the validated `Scene` graph (`rootId`, `selection`, `nodes`).

JSON is the canonical exchange and reload format. `parseSceneJson` must be able
to read exported JSON back into the same canonical scene, and the web import UI
routes successful imports through `REPLACE_SCENE`.

Output is deterministic:

- Object keys are sorted lexicographically at every depth.
- Array order is preserved (`children`, `position`, `rotation`, `scale`).
- Re-serialising a parsed scene produces byte-identical bytes.

Each canonical v2 node carries:

- `id`, `name`, `type`, `children`, `transform`
- `visible`, `metadata`
- optional `assetRef`, `materialRef`, `light`

### R3F JSX (`@diorama/export-r3f`)

`exportSceneToR3fJsx(scene, options?)` produces a JSX string suitable for
pasting inside a React Three Fiber `<Canvas>`:

- Output is readable, deterministic JSX with stable comments for node `id` and
  `name`.
- Every visible node renders as a `<group>` with **local** `position`,
  `rotation`, `scale` (Euler radians, same convention as Three.js).
- The root node is emitted as a transformed group, matching viewport traversal.
- Nested scene hierarchy follows `children` order exactly.
- `mesh` nodes render a neutral primitive proxy (unit cube + neutral standard
  material).
- `light` nodes render `<ambientLight>` or `<directionalLight>` inside the
  node's group.
- Hidden nodes (`visible: false`) and their entire subtree are skipped, mirroring
  viewport traversal.

The header includes `/* eslint-disable */` and a banner so generated code is
obvious in pull requests.

## Options

```ts
exportSceneToR3fJsx(scene, {
  includeStudioLights: true, // preferred
});
```

| Option                | Status      | Behavior                                                                 |
| --------------------- | ----------- | ------------------------------------------------------------------------ |
| `includeStudioLights` | preferred   | Prepend a small ambient + directional pair so JSX is visible standalone. |
| `includeLights`       | deprecated  | Backward-compatible alias for `includeStudioLights`. Do not use in new code. |

The studio fill is not part of the scene graph; the comment in the JSX makes
this explicit. Scene `light` nodes render independently of this option.

## Limitations

The R3F exporter prioritises clarity and determinism over coverage. The
following are intentionally out of scope:

- **No real asset loading.** `assetRef` is not resolved or imported. The
  exporter does not emit `<useGLTF>`, `<useFBX>`, `Suspense` boundaries, or
  any IO-bound primitives.
- **No material graph.** `materialRef` tokens are not mapped to materials.
  Every mesh proxy uses a single neutral `meshStandardMaterial`.
- **No animation.** Tracks, mixers, clips, and `useFrame` hooks are never
  emitted.
- **No shader graph.** Custom GLSL, MeshPhysicalMaterial graphs, and node
  material trees are not generated.
- **No glTF export.** The exporter does not produce binary scene packages.
  Use the JSON format for scene interchange.
- **No full renderer semantics.** Cameras, post-processing, environment maps,
  tone mapping, and shadow tuning are out of scope. The optional studio fill
  is a preview convenience, not a renderer description.

The exporter is also strict about what it never emits, even if the input scene
carries it:

- `selection`, command log entries, undo and redo stacks, gizmo mode, and
  other UI-only state are ignored.
- Filesystem paths and `assetRef` URIs are never inlined into JSX. Resolving
  assets is a downstream concern.

## Examples

Canonical JSON examples live in `packages/examples/scenes/` and mirror the
core fixtures byte-for-byte (modulo a trailing newline). They cover:

- `default.json` - root plus a single cube.
- `showroom.json` - nested floor with pedestal children and an accent.
- `gallery.json` - root plus hall plus 3x3 frame grid.
- `living.json` - root plus room plus furniture group with `materialRef`.

The export loop tests
(`packages/export-r3f/src/exportLoop.test.ts`) lock:

- JSON parse, serialise, re-parse identity for every example.
- Stable lexicographic key ordering at every object depth.
- All required v2 node fields per node.
- Reloadability through `parseSceneJson(serializeScene(scene))`.
- Byte-for-byte parity between checked-in JSON and serialised core fixtures.
- R3F output excludes UI-only state and filesystem paths.
- R3F output reflects local hierarchy and root transforms in viewport order.

The R3F snapshot tests (`packages/export-r3f/src/r3f.test.ts`) cover:

- Default, showroom, gallery, living-space scenes.
- Hidden node skipping.
- Ambient and directional light nodes.
- Nested transforms and root transforms.
- Optional studio fill output.

## Code -> Canvas -> Code Loop

Milestone 5 locks the loop used by humans, tests, and future agents:

1. Load a starter scene from `@diorama/core` or `packages/examples/scenes`.
2. Edit scene state through commands in the canvas.
3. Export JSON with `serializeScene`.
4. Export R3F JSX with `exportSceneToR3fJsx`.
5. Re-import the JSON with `parseSceneJson` / the web import UI.
6. Verify the re-imported scene, JSON bytes, and R3F output remain
   deterministic for the same scene state.

The R3F output is a code view of the scene graph, not a replacement for the
canonical JSON scene document.

## Future work

- Map `materialRef` tokens to a small set of named materials.
- Optional `assetRef` resolution behind a separate exporter.
- glTF export remains deferred and would live in its own package.
