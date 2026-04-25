import { describe, expect, it } from 'vitest';
import {
  parseSceneJson,
  serializeScene,
  stableStringify,
  validateScene,
} from '@diorama/schema';
import { applyCommand } from './commands';
import {
  defaultFixtureScene,
  galleryScene,
  livingSpaceScene,
  showroomScene,
} from './fixtures';
import { createEmptyScene, createNode } from './scene';

describe('versioned serialization', () => {
  it('roundtrips a scene through document JSON', () => {
    let scene = createEmptyScene();
    const root = scene.rootId;
    scene = applyCommand(scene, {
      type: 'ADD_NODE',
      parentId: root,
      node: createNode({ id: 'x', name: 'X' }),
    });
    const text = serializeScene(scene);
    expect(text).toContain('"format"');
    expect(text).toContain('diorama-scene');
    const parsed = parseSceneJson(text);
    expect(parsed).not.toBeNull();
    expect(validateScene(parsed)).toBe(true);
    expect(parsed!.rootId).toBe(scene.rootId);
    expect(parsed!.nodes.x?.name).toBe('X');
  });

  it('accepts legacy bare scene objects without document wrapper', () => {
    const legacy = {
      rootId: 'r',
      selection: null,
      nodes: {
        r: {
          id: 'r',
          name: 'Root',
          children: [],
          transform: {
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
        },
      },
    };
    const parsed = parseSceneJson(JSON.stringify(legacy));
    expect(parsed).not.toBeNull();
    expect(parsed!.rootId).toBe('r');
  });

  it('defaults selection to null when legacy JSON omits selection', () => {
    const legacy = {
      rootId: 'r',
      nodes: {
        r: {
          id: 'r',
          name: 'Root',
          children: [],
          transform: {
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
        },
      },
    };
    const parsed = parseSceneJson(JSON.stringify(legacy));
    expect(parsed?.selection).toBe(null);
  });

  it('stableStringify sorts keys deterministically', () => {
    const a = stableStringify({ z: 1, a: { m: 2, b: 3 } });
    const b = stableStringify({ a: { b: 3, m: 2 }, z: 1 });
    expect(a).toBe(b);
  });

  it('roundtrips fixture scenes with structural equality', () => {
    for (const scene of [
      defaultFixtureScene,
      showroomScene,
      galleryScene,
      livingSpaceScene,
    ]) {
      const again = parseSceneJson(serializeScene(scene));
      expect(again).not.toBeNull();
      expect(again).toEqual(scene);
    }
  });

  it('roundtrips child order and optional light metadata', () => {
    let scene = createEmptyScene();
    const root = scene.rootId;
    scene = applyCommand(scene, {
      type: 'ADD_NODE',
      parentId: root,
      node: createNode({
        id: 'branch',
        name: 'Branch',
        children: [],
        transform: { position: [1, 2, 3] },
      }),
    });
    scene = applyCommand(scene, {
      type: 'ADD_NODE',
      parentId: 'branch',
      node: createNode({ id: 'z-first', name: 'Z' }),
    });
    scene = applyCommand(scene, {
      type: 'ADD_NODE',
      parentId: 'branch',
      node: createNode({
        id: 'a-second',
        name: 'Key',
        children: [],
        light: { kind: 'directional', intensity: 0.8, castShadow: true },
      }),
    });
    const text = serializeScene(scene);
    const parsed = parseSceneJson(text);
    expect(parsed).toEqual(scene);
    expect(parsed!.nodes.branch?.children).toEqual(['z-first', 'a-second']);
    expect(parsed!.nodes['a-second']?.light).toEqual({
      kind: 'directional',
      intensity: 0.8,
      castShadow: true,
    });
  });

  it('is idempotent on bytes for a fixed scene', () => {
    const once = serializeScene(showroomScene);
    const twice = serializeScene(parseSceneJson(once)!);
    expect(twice).toBe(once);
  });

  it('matches snapshot bytes for default + showroom fixtures', () => {
    expect(serializeScene(defaultFixtureScene)).toMatchSnapshot();
    expect(serializeScene(showroomScene)).toMatchSnapshot();
  });

  it('preserves node type, visibility, and metadata', () => {
    let scene = createEmptyScene();
    scene = applyCommand(scene, {
      type: 'ADD_NODE',
      parentId: scene.rootId,
      node: createNode({
        id: 'meta-node',
        name: 'Meta',
        type: 'empty',
        visible: false,
        metadata: { kit: 'test', count: 1 },
      }),
    });
    const parsed = parseSceneJson(serializeScene(scene));
    expect(parsed?.nodes['meta-node']?.type).toBe('empty');
    expect(parsed?.nodes['meta-node']?.visible).toBe(false);
    expect(parsed?.nodes['meta-node']?.metadata).toEqual({ kit: 'test', count: 1 });
  });
});
