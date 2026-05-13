# R3F Runtime Bridge And Sync Export

Diorama has two deliberately separate R3F surfaces:

- `@diorama/r3f-bridge` projects canonical scene state into a live React Three
  Fiber runtime and translates runtime interactions into Diorama commands.
- `@diorama/export-r3f` emits deterministic app-ready R3F code from canonical
  scene state.

Neither package treats R3F refs, Three objects, viewport state, or Zustand state
as canonical.

## Runtime Bridge

`@diorama/r3f-bridge` owns the live adapter layer:

- recursive scene-to-R3F projection
- runtime object registration by stable node id
- selection helpers
- transform commit helpers for `UPDATE_TRANSFORM`
- `assetRef` GLB/GLTF rendering through Drei `useGLTF`
- inspector schema helpers

Runtime transforms may draft through `TransformControls`, but commit through a
command:

```text
TransformControls draft
  -> UPDATE_TRANSFORM command
  -> @diorama/core reducer
  -> canonical scene
  -> runtime projection refresh
```

## Sync Module Export

`@diorama/export-r3f` provides `exportSceneToR3fSyncModule(scene, options)` for
the MVP live code sync path.

The generated module includes:

- `// @diorama-generated`
- an embedded `dioramaScene` object
- stable `userData={{ dioramaId, sourceId }}`
- recursive R3F rendering derived from `dioramaScene.data`
- safe GLB/GLTF loading for project-relative public asset URIs

Default generated location:

```text
src/diorama/DioramaScene.generated.tsx
```

Code-to-runtime sync parses only the embedded `dioramaScene` block. Arbitrary JSX
roundtripping is intentionally deferred.

## Safety Rules

The R3F bridge and exporter must not leak:

- command logs or action logs
- undo/redo history
- editor UI state
- local filesystem paths or `file:///` URIs
- arbitrary JavaScript from metadata
- live runtime refs as persisted scene state

## Deferred

Legacy fragment/module exporters remain for compatibility, but the MVP path is
the sync module. AST patching, arbitrary JSX import, material graph export,
animation authoring, physics, and generation-provider orchestration are outside
the runtime sync MVP.
