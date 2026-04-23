import { describe, expect, it } from 'vitest';
import { validateScene } from '@diorama/schema';
import { applyCommand, applyReparent } from './commands';
import { createEmptyScene, createNode } from './scene';
import { getWorldMatrix } from './worldTransform';

const assertValid = (scene: ReturnType<typeof createEmptyScene>) => {
  expect(validateScene(scene)).toBe(true);
};

describe('applyCommand', () => {
  it('ADD_NODE is a no-op when parent is missing', () => {
    const scene = createEmptyScene();
    const node = createNode({ id: 'n1', name: 'A' });
    const next = applyCommand(scene, {
      type: 'ADD_NODE',
      parentId: 'missing',
      node,
    });
    expect(next).toBe(scene);
  });

  it('ADD_NODE is a no-op when node id already exists', () => {
    const scene = createEmptyScene();
    const rootId = scene.rootId;
    const dup = createNode({ id: rootId, name: 'Dup' });
    const next = applyCommand(scene, {
      type: 'ADD_NODE',
      parentId: rootId,
      node: dup,
    });
    expect(next).toBe(scene);
  });

  it('DELETE_NODE does not remove root', () => {
    const scene = createEmptyScene();
    const next = applyCommand(scene, { type: 'DELETE_NODE', nodeId: scene.rootId });
    expect(next).toBe(scene);
  });

  it('UPDATE_TRANSFORM no-op for empty patch', () => {
    const scene = createEmptyScene();
    const next = applyCommand(scene, {
      type: 'UPDATE_TRANSFORM',
      nodeId: scene.rootId,
      patch: {},
    });
    expect(next).toBe(scene);
  });

  it('SET_PARENT blocks cycles (moving under own descendant)', () => {
    const scene = createEmptyScene();
    const root = scene.rootId;
    const a = createNode({ id: 'a', name: 'A' });
    const b = createNode({ id: 'b', name: 'B' });
    let s = applyCommand(scene, { type: 'ADD_NODE', parentId: root, node: a });
    s = applyCommand(s, { type: 'ADD_NODE', parentId: 'a', node: b });
    const blocked = applyCommand(s, { type: 'SET_PARENT', nodeId: 'a', parentId: 'b' });
    expect(blocked).toBe(s);
    assertValid(blocked);
  });

  it('SET_PARENT no-op when already under target parent', () => {
    const scene = createEmptyScene();
    const root = scene.rootId;
    const a = createNode({ id: 'a', name: 'A' });
    let s = applyCommand(scene, { type: 'ADD_NODE', parentId: root, node: a });
    const again = applyCommand(s, { type: 'SET_PARENT', nodeId: 'a', parentId: root });
    expect(again).toBe(s);
  });

  it('SET_PARENT preserveWorldTransform keeps world matrix (explicit flag)', () => {
    const scene = createEmptyScene();
    const root = scene.rootId;
    const parent = createNode({
      id: 'p',
      name: 'P',
      transform: { position: [3, 0, 0] },
    });
    const child = createNode({
      id: 'c',
      name: 'C',
      transform: { position: [1, 0, 0] },
    });
    let s = applyCommand(scene, { type: 'ADD_NODE', parentId: root, node: parent });
    s = applyCommand(s, { type: 'ADD_NODE', parentId: 'p', node: child });
    const worldBefore = getWorldMatrix(s, 'c');
    expect(worldBefore).not.toBeNull();
    const rep = applyCommand(s, {
      type: 'SET_PARENT',
      nodeId: 'c',
      parentId: root,
      preserveWorldTransform: true,
    });
    assertValid(rep);
    const worldAfter = getWorldMatrix(rep, 'c');
    expect(worldAfter!.elements).toEqual(worldBefore!.elements);
  });

  it('SET_PARENT without preserve changes local transform only (world may change)', () => {
    const scene = createEmptyScene();
    const root = scene.rootId;
    const parent = createNode({
      id: 'p',
      name: 'P',
      transform: { position: [3, 0, 0] },
    });
    const child = createNode({
      id: 'c',
      name: 'C',
      transform: { position: [1, 0, 0] },
    });
    let s = applyCommand(scene, { type: 'ADD_NODE', parentId: root, node: parent });
    s = applyCommand(s, { type: 'ADD_NODE', parentId: 'p', node: child });
    const worldBefore = getWorldMatrix(s, 'c');
    const rep = applyCommand(s, {
      type: 'SET_PARENT',
      nodeId: 'c',
      parentId: root,
      preserveWorldTransform: false,
    });
    const worldAfter = getWorldMatrix(rep, 'c');
    expect(worldAfter!.equals(worldBefore!)).toBe(false);
  });

  it('DUPLICATE_NODE is a no-op when idMap is invalid', () => {
    const scene = createEmptyScene();
    const root = scene.rootId;
    const a = createNode({ id: 'a', name: 'A' });
    let s = applyCommand(scene, { type: 'ADD_NODE', parentId: root, node: a });
    const bad = applyCommand(s, {
      type: 'DUPLICATE_NODE',
      nodeId: 'a',
      includeSubtree: false,
      idMap: { a: 'a' },
    });
    expect(bad).toBe(s);
  });

  it('DUPLICATE_NODE uses idMap for deterministic ids', () => {
    const scene = createEmptyScene();
    const root = scene.rootId;
    const a = createNode({ id: 'a', name: 'A' });
    let s = applyCommand(scene, { type: 'ADD_NODE', parentId: root, node: a });
    s = applyCommand(s, {
      type: 'DUPLICATE_NODE',
      nodeId: 'a',
      includeSubtree: false,
      idMap: { a: 'a-copy' },
    });
    expect(s.nodes['a-copy']).toBeDefined();
    expect(s.nodes['a-copy']?.name).toBe('A (copy)');
    assertValid(s);
  });

  it('ARRANGE_NODES ignores unknown ids and root', () => {
    const scene = createEmptyScene();
    const next = applyCommand(scene, {
      type: 'ARRANGE_NODES',
      nodeIds: [scene.rootId, 'missing', scene.rootId],
      layout: 'line',
    });
    expect(next).toBe(scene);
  });

  it('maintains hierarchy integrity and reachability after edits', () => {
    let s = createEmptyScene();
    const root = s.rootId;
    const a = createNode({ id: 'a', name: 'A' });
    const b = createNode({ id: 'b', name: 'B' });
    s = applyCommand(s, { type: 'ADD_NODE', parentId: root, node: a });
    s = applyCommand(s, { type: 'ADD_NODE', parentId: 'a', node: b });
    assertValid(s);
    s = applyCommand(s, { type: 'DELETE_NODE', nodeId: 'a' });
    assertValid(s);
    expect(s.nodes['b']).toBeUndefined();
  });

  it('clears selection when selected node is deleted', () => {
    let s = createEmptyScene();
    const root = s.rootId;
    const a = createNode({ id: 'a', name: 'A' });
    s = applyCommand(s, { type: 'ADD_NODE', parentId: root, node: a });
    s = applyCommand(s, { type: 'SET_SELECTION', nodeId: 'a' });
    expect(s.selection).toBe('a');
    s = applyCommand(s, { type: 'DELETE_NODE', nodeId: 'a' });
    expect(s.selection).toBe(null);
    assertValid(s);
  });

  it('SET_SELECTION no-op for missing node id', () => {
    const scene = createEmptyScene();
    const next = applyCommand(scene, { type: 'SET_SELECTION', nodeId: 'ghost' });
    expect(next).toBe(scene);
  });

  it('SET_SELECTION is a no-op when unchanged', () => {
    const scene = createEmptyScene();
    const withSel = applyCommand(scene, {
      type: 'SET_SELECTION',
      nodeId: scene.rootId,
    });
    const again = applyCommand(withSel, {
      type: 'SET_SELECTION',
      nodeId: scene.rootId,
    });
    expect(again).toBe(withSel);
  });
});

describe('applyReparent', () => {
  it('returns same reference when moving root', () => {
    const scene = createEmptyScene();
    expect(applyReparent(scene, scene.rootId, scene.rootId)).toBe(scene);
  });
});
