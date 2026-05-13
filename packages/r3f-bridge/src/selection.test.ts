import { describe, expect, it } from 'vitest';
import { createEmptyScene, createNode, applyCommand } from '@diorama/core';
import { createSelectionManager } from './selection';

describe('createSelectionManager', () => {
  it('emits SET_SELECTION only for valid changed selections', () => {
    const manager = createSelectionManager();
    const empty = createEmptyScene('Root');
    const child = createNode({ id: 'child', name: 'Child' });
    const scene = applyCommand(empty, {
      type: 'ADD_NODE',
      parentId: empty.rootId,
      node: child,
    });

    expect(manager.select(scene, 'child')).toEqual({
      type: 'SET_SELECTION',
      nodeId: 'child',
    });
    expect(manager.select(scene, 'missing')).toBeNull();

    const selected = applyCommand(scene, { type: 'SET_SELECTION', nodeId: 'child' });
    expect(manager.select(selected, 'child')).toBeNull();
  });

  it('builds deterministic valid multi-select models', () => {
    const manager = createSelectionManager();
    const empty = createEmptyScene('Root');
    const a = createNode({ id: 'a' });
    const b = createNode({ id: 'b' });
    const scene = applyCommand(
      applyCommand(empty, { type: 'ADD_NODE', parentId: empty.rootId, node: a }),
      { type: 'ADD_NODE', parentId: empty.rootId, node: b },
    );

    expect(manager.multiSelect(scene, ['b', 'missing', 'a', 'b'], 'a')).toEqual({
      selectedIds: ['b', 'a'],
      pivotId: 'a',
    });
  });
});
