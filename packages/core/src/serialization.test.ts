import { describe, expect, it } from 'vitest';
import {
  parseSceneJson,
  serializeScene,
  stableStringify,
  validateScene,
} from '@diorama/schema';
import { applyCommand } from './commands';
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
});
