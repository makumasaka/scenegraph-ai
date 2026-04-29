import { describe, expect, it } from 'vitest';
import { cloneSceneFromJson, validateScene, type Scene, type SceneNode } from '@diorama/schema';
import { applyCommand, applyCommandWithResult, type Command } from './commands';
import { createEmptyScene, createNode, getParent } from './scene';
import { getWorldMatrix } from './worldTransform';

const expectValid = (scene: Scene): void => {
  expect(validateScene(scene)).toBe(true);
};

const addNode = (scene: Scene, parentId: string, node: SceneNode): Scene =>
  applyCommand(scene, { type: 'ADD_NODE', parentId, node });

const baseScene = (): Scene => {
  const root = createNode({
    id: 'contract-root',
    name: 'Root',
    type: 'root',
    children: [],
  });
  let scene: Scene = {
    rootId: root.id,
    selection: null,
    nodes: { [root.id]: root },
  };
  scene = addNode(
    scene,
    scene.rootId,
    createNode({
      id: 'a',
      name: 'A',
      children: [],
      transform: { position: [1, 0, 0] },
      metadata: { role: 'source' },
      materialRef: { kind: 'token', token: 'mat.a' },
    }),
  );
  scene = addNode(
    scene,
    scene.rootId,
    createNode({
      id: 'b',
      name: 'B',
      children: [],
      transform: { position: [4, 0, 0] },
      visible: false,
      assetRef: { kind: 'uri', uri: 'asset://b' },
    }),
  );
  scene = addNode(scene, 'a', createNode({ id: 'a-child', name: 'A child' }));
  scene = addNode(
    scene,
    'a-child',
    createNode({
      id: 'a-grandchild',
      name: 'A grandchild',
      light: { kind: 'directional', intensity: 0.7 },
    }),
  );
  expectValid(scene);
  return scene;
};

const childIds = (scene: Scene, nodeId: string): string[] => scene.nodes[nodeId]?.children ?? [];

const expectSameMatrix = (a: number[], b: number[]): void => {
  expect(a).toHaveLength(b.length);
  for (let i = 0; i < a.length; i += 1) {
    expect(a[i]).toBeCloseTo(b[i]!, 10);
  }
};

describe('Milestone 3 command contract', () => {
  describe('ADD_NODE', () => {
    it('adds under root and preserves invariants', () => {
      const scene = createEmptyScene();
      const next = applyCommand(scene, {
        type: 'ADD_NODE',
        parentId: scene.rootId,
        node: createNode({ id: 'child', name: 'Child' }),
      });

      expect(next).not.toBe(scene);
      expect(childIds(next, scene.rootId)).toContain('child');
      expectValid(next);
    });

    it('adds nested nodes', () => {
      const scene = baseScene();
      const next = applyCommand(scene, {
        type: 'ADD_NODE',
        parentId: 'a-child',
        node: createNode({ id: 'nested', name: 'Nested' }),
      });

      expect(childIds(next, 'a-child')).toContain('nested');
      expectValid(next);
    });

    it('returns no-op errors for duplicate ids and missing parents', () => {
      const scene = baseScene();
      const duplicate = applyCommandWithResult(scene, {
        type: 'ADD_NODE',
        parentId: scene.rootId,
        node: createNode({ id: 'a', name: 'Duplicate' }),
      });
      const missingParent = applyCommandWithResult(scene, {
        type: 'ADD_NODE',
        parentId: 'missing',
        node: createNode({ id: 'new-node', name: 'New' }),
      });

      expect(duplicate.scene).toBe(scene);
      expect(duplicate.error).toBe('ADD_NODE node id already exists');
      expect(missingParent.scene).toBe(scene);
      expect(missingParent.error).toBe('ADD_NODE parentId does not exist');
      expectValid(scene);
    });

    it('rejects invalid children and root-type misuse as no-ops', () => {
      const scene = baseScene();
      const invalidChildren = applyCommandWithResult(scene, {
        type: 'ADD_NODE',
        parentId: scene.rootId,
        node: createNode({ id: 'bad-children', name: 'Bad', children: ['missing'] }),
      });
      const rootTypeMisuse = applyCommandWithResult(scene, {
        type: 'ADD_NODE',
        parentId: scene.rootId,
        node: createNode({ id: 'bad-root', name: 'Bad root', type: 'root' }),
      });

      expect(invalidChildren.scene).toBe(scene);
      expect(invalidChildren.error).toBe('ADD_NODE would violate scene invariants');
      expect(rootTypeMisuse.scene).toBe(scene);
      expect(rootTypeMisuse.error).toBe('ADD_NODE would violate scene invariants');
    });
  });

  describe('DELETE_NODE', () => {
    it('deletes leaves and subtrees', () => {
      const scene = baseScene();
      const withoutLeaf = applyCommand(scene, { type: 'DELETE_NODE', nodeId: 'b' });
      const withoutSubtree = applyCommand(scene, { type: 'DELETE_NODE', nodeId: 'a' });

      expect(withoutLeaf.nodes.b).toBeUndefined();
      expect(childIds(withoutLeaf, scene.rootId)).not.toContain('b');
      expect(withoutSubtree.nodes.a).toBeUndefined();
      expect(withoutSubtree.nodes['a-child']).toBeUndefined();
      expect(withoutSubtree.nodes['a-grandchild']).toBeUndefined();
      expectValid(withoutLeaf);
      expectValid(withoutSubtree);
    });

    it('clears selection when deleting selected nodes or their ancestors', () => {
      const selected = applyCommand(baseScene(), {
        type: 'SET_SELECTION',
        nodeId: 'a-grandchild',
      });
      const deleteSelected = applyCommand(selected, {
        type: 'DELETE_NODE',
        nodeId: 'a-grandchild',
      });
      const deleteAncestor = applyCommand(selected, { type: 'DELETE_NODE', nodeId: 'a' });

      expect(deleteSelected.selection).toBe(null);
      expect(deleteAncestor.selection).toBe(null);
      expectValid(deleteSelected);
      expectValid(deleteAncestor);
    });

    it('returns no-op errors for root and missing nodes', () => {
      const scene = baseScene();
      const rootDelete = applyCommandWithResult(scene, {
        type: 'DELETE_NODE',
        nodeId: scene.rootId,
      });
      const missingDelete = applyCommandWithResult(scene, {
        type: 'DELETE_NODE',
        nodeId: 'missing',
      });

      expect(rootDelete.scene).toBe(scene);
      expect(rootDelete.error).toBe('DELETE_NODE cannot delete root');
      expect(missingDelete.scene).toBe(scene);
      expect(missingDelete.error).toBe('DELETE_NODE nodeId does not exist');
    });
  });

  describe('UPDATE_TRANSFORM', () => {
    it('applies position, rotation, scale, and full patches', () => {
      let scene = baseScene();
      scene = applyCommand(scene, {
        type: 'UPDATE_TRANSFORM',
        nodeId: 'a',
        patch: { position: [2, 3, 4] },
      });
      scene = applyCommand(scene, {
        type: 'UPDATE_TRANSFORM',
        nodeId: 'a',
        patch: { rotation: [0.1, 0.2, 0.3] },
      });
      scene = applyCommand(scene, {
        type: 'UPDATE_TRANSFORM',
        nodeId: 'a',
        patch: { scale: [2, 2, 2] },
      });
      scene = applyCommand(scene, {
        type: 'UPDATE_TRANSFORM',
        nodeId: 'a',
        patch: {
          position: [5, 6, 7],
          rotation: [0.4, 0.5, 0.6],
          scale: [3, 4, 5],
        },
      });

      expect(scene.nodes.a?.transform).toEqual({
        position: [5, 6, 7],
        rotation: [0.4, 0.5, 0.6],
        scale: [3, 4, 5],
      });
      expectValid(scene);
    });

    it('keeps the same reference for empty, equal, and missing-node patches', () => {
      const scene = baseScene();
      const empty = applyCommand(scene, { type: 'UPDATE_TRANSFORM', nodeId: 'a', patch: {} });
      const equal = applyCommand(scene, {
        type: 'UPDATE_TRANSFORM',
        nodeId: 'a',
        patch: { position: scene.nodes.a!.transform.position },
      });
      const missing = applyCommand(scene, {
        type: 'UPDATE_TRANSFORM',
        nodeId: 'missing',
        patch: { position: [1, 2, 3] },
      });

      expect(empty).toBe(scene);
      expect(equal).toBe(scene);
      expect(missing).toBe(scene);
    });
  });

  describe('DUPLICATE_NODE', () => {
    it('duplicates leaves and subtrees with deterministic idMap', () => {
      const scene = baseScene();
      const leaf = applyCommand(scene, {
        type: 'DUPLICATE_NODE',
        nodeId: 'b',
        includeSubtree: false,
        idMap: { b: 'b-copy' },
      });
      const subtree = applyCommand(scene, {
        type: 'DUPLICATE_NODE',
        nodeId: 'a',
        includeSubtree: true,
        idMap: {
          a: 'a-copy',
          'a-child': 'a-child-copy',
          'a-grandchild': 'a-grandchild-copy',
        },
      });

      expect(leaf.nodes['b-copy']?.children).toEqual([]);
      expect(leaf.nodes['b-copy']?.visible).toBe(false);
      expect(subtree.nodes['a-copy']?.children).toEqual(['a-child-copy']);
      expect(subtree.nodes['a-child-copy']?.children).toEqual(['a-grandchild-copy']);
      expect(childIds(subtree, scene.rootId)).toContain('a-copy');
      expectValid(leaf);
      expectValid(subtree);
    });

    it('preserves duplicated node type, visible flag, metadata, refs, and light', () => {
      const scene = baseScene();
      const next = applyCommand(scene, {
        type: 'DUPLICATE_NODE',
        nodeId: 'a',
        includeSubtree: true,
        idMap: {
          a: 'a-copy',
          'a-child': 'a-child-copy',
          'a-grandchild': 'a-grandchild-copy',
        },
      });

      expect(next.nodes['a-copy']?.type).toBe(scene.nodes.a?.type);
      expect(next.nodes['a-copy']?.visible).toBe(scene.nodes.a?.visible);
      expect(next.nodes['a-copy']?.metadata).toEqual({ role: 'source' });
      expect(next.nodes['a-copy']?.materialRef).toEqual({ kind: 'token', token: 'mat.a' });
      expect(next.nodes['a-grandchild-copy']?.light).toEqual({
        kind: 'directional',
        intensity: 0.7,
      });

      const leaf = applyCommand(scene, {
        type: 'DUPLICATE_NODE',
        nodeId: 'b',
        includeSubtree: false,
        idMap: { b: 'b-copy' },
      });
      expect(leaf.nodes['b-copy']?.assetRef).toEqual({ kind: 'uri', uri: 'asset://b' });
    });

    it('returns no-op errors for invalid idMaps, root source, and missing source', () => {
      const scene = baseScene();
      const collision = applyCommandWithResult(scene, {
        type: 'DUPLICATE_NODE',
        nodeId: 'a',
        includeSubtree: false,
        idMap: { a: 'b' },
      });
      const incomplete = applyCommandWithResult(scene, {
        type: 'DUPLICATE_NODE',
        nodeId: 'a',
        includeSubtree: true,
        idMap: { a: 'a-copy' },
      });
      const root = applyCommandWithResult(scene, {
        type: 'DUPLICATE_NODE',
        nodeId: scene.rootId,
        includeSubtree: false,
      });
      const missing = applyCommandWithResult(scene, {
        type: 'DUPLICATE_NODE',
        nodeId: 'missing',
        includeSubtree: false,
      });

      expect(collision.scene).toBe(scene);
      expect(collision.error).toBe('DUPLICATE_NODE idMap target id already exists');
      expect(incomplete.scene).toBe(scene);
      expect(incomplete.error).toBe('DUPLICATE_NODE idMap must map each duplicated node');
      expect(root.scene).toBe(scene);
      expect(root.error).toBe('DUPLICATE_NODE cannot duplicate root');
      expect(missing.scene).toBe(scene);
      expect(missing.error).toBe('DUPLICATE_NODE nodeId does not exist');
    });
  });

  describe('SET_PARENT', () => {
    it('reparents leaves and subtrees with append child order', () => {
      const scene = baseScene();
      const leaf = applyCommand(scene, { type: 'SET_PARENT', nodeId: 'b', parentId: 'a' });
      const subtree = applyCommand(scene, {
        type: 'SET_PARENT',
        nodeId: 'a-child',
        parentId: scene.rootId,
      });

      expect(getParent(leaf, 'b')?.id).toBe('a');
      expect(childIds(leaf, 'a')).toEqual(['a-child', 'b']);
      expect(getParent(subtree, 'a-child')?.id).toBe(scene.rootId);
      expect(subtree.nodes['a-grandchild']).toBeDefined();
      expectValid(leaf);
      expectValid(subtree);
    });

    it('keeps same reference for same parent, self-parent, descendant parent, and root', () => {
      const scene = baseScene();
      expect(applyCommand(scene, { type: 'SET_PARENT', nodeId: 'a', parentId: scene.rootId })).toBe(
        scene,
      );
      expect(applyCommand(scene, { type: 'SET_PARENT', nodeId: 'a', parentId: 'a' })).toBe(scene);
      expect(applyCommand(scene, { type: 'SET_PARENT', nodeId: 'a', parentId: 'a-child' })).toBe(
        scene,
      );
      expect(applyCommand(scene, { type: 'SET_PARENT', nodeId: scene.rootId, parentId: 'a' })).toBe(
        scene,
      );
    });

    it('preserves local transform by default and world transform when requested', () => {
      const scene = baseScene();
      const localBefore = scene.nodes['a-child']!.transform;
      const localReparent = applyCommand(scene, {
        type: 'SET_PARENT',
        nodeId: 'a-child',
        parentId: scene.rootId,
      });

      const worldBefore = getWorldMatrix(scene, 'a-child')!.elements;
      const worldReparent = applyCommand(scene, {
        type: 'SET_PARENT',
        nodeId: 'a-child',
        parentId: scene.rootId,
        preserveWorldTransform: true,
      });
      const worldAfter = getWorldMatrix(worldReparent, 'a-child')!.elements;

      expect(localReparent.nodes['a-child']?.transform).toEqual(localBefore);
      expectSameMatrix(worldAfter, worldBefore);
      expectValid(localReparent);
      expectValid(worldReparent);
    });
  });

  describe('ARRANGE_NODES', () => {
    it('arranges line, grid, and circle layouts', () => {
      const scene = baseScene();
      const line = applyCommand(scene, {
        type: 'ARRANGE_NODES',
        nodeIds: ['a', 'b'],
        layout: 'line',
        options: { spacing: 2 },
      });
      const grid = applyCommand(scene, {
        type: 'ARRANGE_NODES',
        nodeIds: ['a', 'b', 'a-child', 'a-grandchild'],
        layout: 'grid',
        options: { spacing: 2, cols: 2 },
      });
      const circle = applyCommand(scene, {
        type: 'ARRANGE_NODES',
        nodeIds: ['a', 'b'],
        layout: 'circle',
        options: { radius: 2 },
      });

      expect(line.nodes.a?.transform.position).toEqual([-1, 0.5, 0]);
      expect(line.nodes.b?.transform.position).toEqual([1, 0.5, 0]);
      expect(grid.nodes.a?.transform.position).toEqual([-1, 0.5, -1]);
      expect(grid.nodes.b?.transform.position).toEqual([1, 0.5, -1]);
      expect(circle.nodes.a?.transform.position).toEqual([2, 0.5, 0]);
      expect(circle.nodes.b?.transform.position[0]).toBeCloseTo(-2);
      expect(circle.nodes.b?.transform.position[2]).toBeCloseTo(0);
      expectValid(line);
      expectValid(grid);
      expectValid(circle);
    });

    it('handles one node, empty lists, duplicates, invalid ids, root exclusion, and unchanged positions', () => {
      const scene = baseScene();
      const one = applyCommand(scene, {
        type: 'ARRANGE_NODES',
        nodeIds: ['a'],
        layout: 'line',
      });
      const empty = applyCommand(scene, {
        type: 'ARRANGE_NODES',
        nodeIds: [],
        layout: 'line',
      });
      const filtered = applyCommand(scene, {
        type: 'ARRANGE_NODES',
        nodeIds: [scene.rootId, 'missing', 'a', 'a'],
        layout: 'line',
      });
      const alreadyPlaced = applyCommand(one, {
        type: 'ARRANGE_NODES',
        nodeIds: ['a'],
        layout: 'line',
      });

      expect(one.nodes.a?.transform.position).toEqual([0, 0.5, 0]);
      expect(empty).toBe(scene);
      expect(filtered.nodes.a?.transform.position).toEqual([0, 0.5, 0]);
      expect(filtered.nodes[scene.rootId]?.transform.position).toEqual([0, 0, 0]);
      expect(alreadyPlaced).toBe(one);
    });
  });

  describe('SET_SELECTION', () => {
    it('selects valid nodes, clears selection, and no-ops for missing or unchanged selection', () => {
      const scene = baseScene();
      const selected = applyCommand(scene, { type: 'SET_SELECTION', nodeId: 'a' });
      const cleared = applyCommand(selected, { type: 'SET_SELECTION', nodeId: null });
      const missing = applyCommand(scene, { type: 'SET_SELECTION', nodeId: 'missing' });
      const same = applyCommand(selected, { type: 'SET_SELECTION', nodeId: 'a' });

      expect(selected.selection).toBe('a');
      expect(cleared.selection).toBe(null);
      expect(missing).toBe(scene);
      expect(same).toBe(selected);
      expectValid(selected);
      expectValid(cleared);
    });
  });

  describe('REPLACE_SCENE', () => {
    it('replaces valid scenes, rejects invalid scenes, and clones without aliasing', () => {
      const scene = createEmptyScene();
      const replacement = baseScene();
      const replaced = applyCommand(scene, { type: 'REPLACE_SCENE', scene: replacement });
      const invalid = cloneSceneFromJson(replacement) as Scene;
      invalid.rootId = 'missing-root';
      const rejected = applyCommand(scene, { type: 'REPLACE_SCENE', scene: invalid });

      replacement.nodes.a!.name = 'Mutated after replace';

      expect(replaced).toEqual(baseScene());
      expect(replaced).not.toBe(replacement);
      expect(replaced.nodes.a?.name).toBe('A');
      expect(rejected).toBe(scene);
      expectValid(replaced);
    });
  });

  describe('command replay and invariant preservation', () => {
    it('replays deterministic duplicate commands to the same scene', () => {
      const commands: Command[] = [
        { type: 'UPDATE_TRANSFORM', nodeId: 'a', patch: { position: [2, 0, 0] } },
        {
          type: 'DUPLICATE_NODE',
          nodeId: 'a',
          includeSubtree: true,
          idMap: {
            a: 'a-copy',
            'a-child': 'a-child-copy',
            'a-grandchild': 'a-grandchild-copy',
          },
        },
        { type: 'SET_PARENT', nodeId: 'b', parentId: 'a-copy' },
        { type: 'SET_SELECTION', nodeId: 'a-grandchild-copy' },
      ];

      const replay = () =>
        commands.reduce((scene, command) => {
          const next = applyCommand(scene, command);
          expectValid(next);
          return next;
        }, baseScene());

      expect(replay()).toEqual(replay());
    });

    it('preserves scene invariants after every command kind in a focused sequence', () => {
      let scene = createEmptyScene();
      const commands: Command[] = [
        { type: 'ADD_NODE', parentId: scene.rootId, node: createNode({ id: 'one', name: 'One' }) },
        { type: 'ADD_NODE', parentId: 'one', node: createNode({ id: 'two', name: 'Two' }) },
        { type: 'UPDATE_TRANSFORM', nodeId: 'two', patch: { position: [1, 2, 3] } },
        { type: 'DUPLICATE_NODE', nodeId: 'one', includeSubtree: false, idMap: { one: 'one-copy' } },
        { type: 'SET_PARENT', nodeId: 'two', parentId: scene.rootId },
        { type: 'ARRANGE_NODES', nodeIds: ['one', 'two', 'one-copy'], layout: 'grid' },
        { type: 'SET_SELECTION', nodeId: 'two' },
        { type: 'DELETE_NODE', nodeId: 'one' },
        { type: 'REPLACE_SCENE', scene: baseScene() },
      ];

      for (const command of commands) {
        scene = applyCommand(scene, command);
        expectValid(scene);
      }
    });
  });
});
