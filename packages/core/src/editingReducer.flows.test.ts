import { describe, expect, it } from 'vitest';
import { parseSceneJson, serializeScene, validateScene } from '@diorama/schema';
import { applyCommand, type Command } from './commands';
import { getStarterScene, showroomScene } from './fixtures';

/**
 * End-to-end checks for the pure scene reducer (`applyCommand`) that back
 * the eight editor-critical flows. Undo coalescing lives in the web store.
 */
describe('editing reducer — critical flows', () => {
  it('1 loads a starter kit via REPLACE_SCENE', () => {
    const prior = getStarterScene('default');
    const next = applyCommand(prior, { type: 'REPLACE_SCENE', scene: showroomScene });
    expect(next.rootId).toBe(showroomScene.rootId);
    expect(validateScene(next)).toBe(true);
  });

  it('2 selects a node', () => {
    let s = getStarterScene('default');
    s = applyCommand(s, { type: 'SET_SELECTION', nodeId: 'default-cube-1' });
    expect(s.selection).toBe('default-cube-1');
  });

  it('3 updates transform', () => {
    let s = getStarterScene('default');
    const cube = 'default-cube-1';
    s = applyCommand(s, {
      type: 'UPDATE_TRANSFORM',
      nodeId: cube,
      patch: { position: [1, 2, 3] },
    });
    expect(s.nodes[cube]?.transform.position).toEqual([1, 2, 3]);
  });

  it('4 duplicates a node with a deterministic id map', () => {
    let s = getStarterScene('default');
    const cube = 'default-cube-1';
    s = applyCommand(s, {
      type: 'DUPLICATE_NODE',
      nodeId: cube,
      includeSubtree: false,
      idMap: { [cube]: 'dup-cube-1' },
    });
    expect(s.nodes['dup-cube-1']?.name).toBe('Cube 1 (copy)');
    expect(validateScene(s)).toBe(true);
  });

  it('5 reparents a node under root', () => {
    let s = showroomScene;
    s = applyCommand(s, { type: 'STRUCTURE_SHOWROOM_SCENE' });
    s = applyCommand(s, {
      type: 'SET_PARENT',
      nodeId: 'product_01',
      parentId: s.rootId,
    });
    const root = s.nodes[s.rootId];
    expect(root?.children).toContain('product_01');
    expect(s.nodes.display_area?.children.includes('product_01')).toBe(false);
    expect(validateScene(s)).toBe(true);
  });

  it('6 manual undo restores the previous reducer snapshot', () => {
    let scene = getStarterScene('default');
    const past: typeof scene[] = [];
    const dispatch = (c: Command) => {
      const next = applyCommand(scene, c);
      if (next === scene) return;
      past.push(scene);
      scene = next;
    };
    const undo = () => {
      const prev = past.pop();
      if (prev) scene = prev;
    };

    const cube = scene.nodes[scene.rootId]!.children[0]!;
    const y0 = scene.nodes[cube]!.transform.position[1];
    dispatch({
      type: 'UPDATE_TRANSFORM',
      nodeId: cube,
      patch: { position: [0, y0 + 2, 0] },
    });
    expect(scene.nodes[cube]!.transform.position[1]).toBe(y0 + 2);
    undo();
    expect(scene.nodes[cube]!.transform.position[1]).toBe(y0);
  });

  it('7 exports JSON that roundtrips through parseSceneJson', () => {
    let s = getStarterScene('gallery');
    s = applyCommand(s, { type: 'SET_SELECTION', nodeId: null });
    const text = serializeScene(s);
    const again = parseSceneJson(text);
    expect(again).toEqual(s);
  });
});
