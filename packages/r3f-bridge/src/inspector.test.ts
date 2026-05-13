import { describe, expect, it } from 'vitest';
import { createEmptyScene, createNode, applyCommand } from '@diorama/core';
import { inspectorFieldsForNode, sceneHierarchyItems } from './inspector';

describe('inspector helpers', () => {
  it('returns schema-derived fields and hierarchy items', () => {
    const empty = createEmptyScene('Root');
    const node = createNode({
      id: 'asset-node',
      name: 'Asset',
      assetRef: { kind: 'uri', uri: '/assets/diorama/model.glb' },
      semantics: { role: 'product', source: 'manual' },
    });
    const scene = applyCommand(empty, {
      type: 'ADD_NODE',
      parentId: empty.rootId,
      node,
    });

    expect(inspectorFieldsForNode(scene, 'asset-node')).toEqual(
      expect.arrayContaining([
        { label: 'ID', value: 'asset-node', mono: true },
        { label: 'Role', value: 'product' },
        { label: 'Asset', value: '/assets/diorama/model.glb', mono: true },
      ]),
    );
    expect(sceneHierarchyItems(scene).map((item) => item.id)).toEqual([
      empty.rootId,
      'asset-node',
    ]);
  });
});
