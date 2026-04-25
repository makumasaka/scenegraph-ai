# Diorama Commands

Commands are the only mutation path for persistent scene state. UI actions,
agent sessions, evals, and future MCP tools must produce commands and pass them
through the core reducer instead of editing scene objects directly.

The reducer entry point is `applyCommand(scene, command)` in
`packages/core/src/commands.ts`. Untrusted payloads are validated by
`CommandSchema` in `packages/agent-interface/src/commandSchema.ts`.

## Reducer Contract

- Reducers are pure, deterministic functions.
- Reducers do not access DOM, storage, network, clocks, or random sources.
- No-op commands return the same scene reference where practical.
- Changing commands preserve graph invariants.
- Commands operate on local transforms. World transforms are derived from the
  scene hierarchy.
- Command summaries must be deterministic and ASCII-only.

## ADD_NODE

Payload:

```ts
{ type: 'ADD_NODE'; parentId: string; node: SceneNode }
```

Behavior:

- Adds `node` to `scene.nodes`.
- Appends `node.id` to the parent `children` array.
- Leaves selection unchanged.

No-op cases:

- Parent does not exist.
- Node ID already exists.
- Node would break graph invariants.

Tests:

- Add under root.
- Add under nested parent.
- Duplicate ID returns no change.
- Missing parent returns no change.
- Invalid child refs are rejected by validation paths.

## DELETE_NODE

Payload:

```ts
{ type: 'DELETE_NODE'; nodeId: string }
```

Behavior:

- Deletes the node and all descendants.
- Removes the node ID from its parent.
- Clears selection if the selected node was inside the deleted subtree.

No-op cases:

- Node is the root.
- Node does not exist.

Tests:

- Delete leaf.
- Delete subtree.
- Delete selected node.
- Delete ancestor of selected node.
- Delete root returns no change.

## UPDATE_TRANSFORM

Payload:

```ts
{
  type: 'UPDATE_TRANSFORM';
  nodeId: string;
  patch: {
    position?: Vec3;
    rotation?: Vec3;
    scale?: Vec3;
  };
}
```

Behavior:

- Merges the patch into the node local transform.
- Preserves unchanged transform fields.

No-op cases:

- Node does not exist.
- Patch is empty.
- Patch equals the current transform.

Tests:

- Position-only patch.
- Rotation-only patch.
- Scale-only patch.
- Full transform patch.
- Empty patch returns no change.
- Same values return no change.

## DUPLICATE_NODE

Payload:

```ts
{
  type: 'DUPLICATE_NODE';
  nodeId: string;
  includeSubtree: boolean;
  newParentId?: string;
  idMap?: Record<string, string>;
}
```

Behavior:

- Duplicates a node or subtree.
- Attaches the duplicate root to `newParentId`, the current parent, or root.
- Preserves local transforms and refs.
- Uses `idMap` when supplied for deterministic IDs.

No-op cases:

- Source node does not exist.
- Source node is root.
- Target parent does not exist.
- `idMap` is incomplete, has collisions, or contains extra keys.
- Target parent is inside the duplicated subtree.

Tests:

- Duplicate leaf.
- Duplicate subtree.
- Deterministic `idMap`.
- ID collision returns no change.
- Missing parent returns no change.

## SET_PARENT

Payload:

```ts
{
  type: 'SET_PARENT';
  nodeId: string;
  parentId: string;
  preserveWorldTransform?: boolean;
}
```

Behavior:

- Moves `nodeId` under `parentId`.
- Default behavior preserves local transform.
- With `preserveWorldTransform`, computes a new local transform so the node keeps
  its previous world matrix when possible.

No-op cases:

- Node does not exist.
- Parent does not exist.
- Node is root.
- Node is already under the parent.
- Node is parented to itself or a descendant.

Tests:

- Reparent leaf.
- Reparent subtree.
- Preserve local transform by default.
- Preserve world transform when requested.
- Reject self-parent and descendant-parent cases.

## ARRANGE_NODES

Payload:

```ts
{
  type: 'ARRANGE_NODES';
  nodeIds: string[];
  layout: 'line' | 'grid' | 'circle';
  options?: {
    spacing?: number;
    cols?: number;
    radius?: number;
    axis?: 'x' | 'y' | 'z';
  };
}
```

Behavior:

- Filters invalid IDs, duplicate IDs, and the root.
- Computes deterministic positions from input order.
- Updates local positions only.
- Preserves rotation and scale.

No-op cases:

- Empty input.
- No valid target nodes.
- Computed positions match current positions.

Tests:

- Line layout.
- Grid layout.
- Circle layout.
- Empty and one-node inputs.
- Duplicate and invalid IDs.
- Same positions return no change.

## SET_SELECTION

Payload:

```ts
{ type: 'SET_SELECTION'; nodeId: string | null }
```

Behavior:

- Sets canonical scene selection to a valid node ID or null.
- The product command log omits selection changes by default.

No-op cases:

- Node ID does not exist.
- Selection is already equal to the payload.

Tests:

- Select valid node.
- Clear selection.
- Missing node returns no change.
- Product store does not add selection changes to the visible command log.

## REPLACE_SCENE

Payload:

```ts
{ type: 'REPLACE_SCENE'; scene: Scene }
```

Behavior:

- Validates and clones the incoming scene.
- Replaces current scene.
- The web store treats this as a session boundary and clears undo, redo, and
  command log state.

No-op cases:

- Incoming scene fails validation.

Tests:

- Valid scene replacement.
- Invalid scene returns no change.
- Replacement is cloned, not aliased.
- Web history and log are cleared.
