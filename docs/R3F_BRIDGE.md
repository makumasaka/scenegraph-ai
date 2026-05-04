# R3F Bridge

Diorama's primary product output is a clean, deterministic React Three Fiber
scene module generated from the canonical scenegraph. The bridge consumes
validated `Scene` data only; it does not read editor state, command logs,
filesystem paths, undo/redo stacks, or the app's Zustand store.

## Export Modes

`@diorama/export-r3f` exposes two output paths:

- `exportSceneToR3fJsx(scene, options)` - compatibility fragment for existing
  paste-into-`<Canvas>` workflows.
- `exportSceneToR3fModule(scene, options)` - structured React module output
  with semantic component hints, behavior scaffolds, diagnostics, and a named
  exported component.

## Module Options

```ts
exportSceneToR3fModule(scene, {
  componentName: 'DioramaScene',
  semanticComponents: true,
  behaviorScaffold: 'handlers',
  includeStudioLights: true,
});
```

- `componentName`: exported React component name. Defaults to `DioramaScene`.
- `semanticComponents`: emits role-based components like `Product` and
  `DisplaySurface`. Defaults to `true`.
- `behaviorScaffold`: `none`, `comments`, or `handlers`. Defaults to `handlers`.
- `includeStudioLights`: emits non-scene preview lights.

## Semantic Mapping

The bridge keeps the mapping small and deterministic:

| Role | Component |
|------|-----------|
| `product` | `Product` |
| `display` | `DisplaySurface` |
| `seating` | `SeatingElement` |
| `environment` | `EnvironmentGroup` |
| `lighting` / `light` | `SceneLight` |
| `navigation` | `NavigationMarker` |
| `decor` | `DecorElement` |
| `container` | `SceneSection` |
| missing / `unknown` | fallback by node type (`SceneMesh`, `SceneGroup`, `SceneLight`, `SceneEmpty`) |

Semantic groups are represented as comments and, when group members are
contiguous under the same parent, identity wrapper components such as
`DisplayArea`. The exporter never reorders scenegraph children to satisfy a
semantic group.

## Behavior Scaffolding

The bridge scaffolds obvious R3F event hooks and leaves heavier behavior as
TODO comments:

| Behavior / trait | Output |
|------------------|--------|
| `hover_highlight`, `hoverable` | `onHoverStart` / `onHoverEnd` handler props |
| `click_select`, `clickable` | `onSelect` handler prop and `selectedId` state |
| `focus_camera`, `focusable` | `handleFocusCamera` TODO stub |
| `show_info`, `displayable` | selected-state info panel TODO placeholder |
| `anchor_point`, `open_url`, `rotate_idle`, `scroll_reveal` | comments only; no runtime framework |

The generated code intentionally avoids injecting arbitrary JavaScript or URLs
from metadata. `open_url` stays a TODO for the developer to review.

## Safety Rules

The bridge must not emit:

- command log or action log entries
- undo/redo history
- editor UI state (`gizmoMode`, canvas camera state, etc.)
- filesystem paths or `file:///` URIs
- arbitrary JavaScript from metadata or behavior params

Coverage lives in `packages/export-r3f/src/exportLoop.test.ts` and module
snapshots under `packages/export-r3f/src/__snapshots__/`.

## Current Limits

- Placeholder geometry is still a unit cube proxy.
- `materialRef` appears as a readable comment; no material graph is generated.
- `assetRef` appears only as a safe `asset=uri` hint; no glTF loader is emitted.
- No animation runtime, physics runtime, shader graph, or full UI system is
generated.
