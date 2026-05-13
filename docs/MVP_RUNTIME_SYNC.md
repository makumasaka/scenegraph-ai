# MVP Runtime Sync

The runtime-sync MVP proves one loop:

```text
runtime edit -> command -> canonical scene -> generated R3F module -> hot reload
code edit -> parse embedded scene document -> canonical scene -> runtime refresh
```

## Generated File Convention

Default generated file:

```text
src/diorama/DioramaScene.generated.tsx
```

Default asset location:

```text
public/assets/diorama
```

The generated module contains a canonical scene document and an R3F renderer:

```tsx
// @diorama-generated
export const dioramaScene = {
  "format": "diorama-scene",
  "version": 2,
  "data": {}
} as const;

export function DioramaScene() {
  return <DioramaSceneRenderer scene={dioramaScene.data} />;
}
```

MVP code -> runtime sync parses only the `dioramaScene` object. Arbitrary JSX
roundtripping is deferred. Developers should customize wrapper files that import
`DioramaScene`, not the generated renderer body.

## Runtime -> Code

1. User selects a node in the R3F viewport.
2. TransformControls mutates only the local draft Object3D during dragging.
3. On commit, `@diorama/r3f-bridge` reads the draft local transform and emits
   `UPDATE_TRANSFORM`.
4. `@diorama/core` updates the canonical scene.
5. The local bridge regenerates the deterministic R3F module if bytes changed.
6. The developer app hot reloads from the generated module.

## Code -> Runtime

1. The local bridge watches the generated module inside the configured project
   root.
2. File changes are debounced.
3. `@diorama/export-r3f` extracts the embedded `dioramaScene` object.
4. Zod validates the scene document.
5. The bridge applies `REPLACE_SCENE`.
6. Web clients receive an SSE scene event and reproject the runtime.

## Project Safety

The bridge accepts a project root through `DIORAMA_PROJECT_ROOT` or an explicit
startup option. All generated files and registered assets must resolve inside
that project root. The bridge must reject absolute, parent-directory, `file://`,
remote, or otherwise unsafe asset/code paths.

## MVP Limits

- No AST patching.
- No eval or arbitrary code interpretation.
- No file watching outside the configured project root.
- No cloud publishing.
- No Meshy/Tripo/World Labs or text-to-3D tools.
- No hidden mutation path from runtime refs to canonical scene.
