import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createNode,
  defaultFixtureScene,
  galleryScene,
  showroomScene,
} from '@diorama/core';
import type { Scene } from '@diorama/schema';
import { exportSceneToR3fJsx } from './r3f';

describe('exportSceneToR3fJsx', () => {
  it('matches snapshot for default fixture', () => {
    expect(exportSceneToR3fJsx(defaultFixtureScene)).toMatchSnapshot();
  });

  it('matches snapshot for showroom (nested branches)', () => {
    expect(exportSceneToR3fJsx(showroomScene)).toMatchSnapshot();
  });

  it('matches snapshot for gallery kit', () => {
    expect(exportSceneToR3fJsx(galleryScene)).toMatchSnapshot();
  });

  it('matches snapshot for scene light nodes', () => {
    const root = createNode({ id: 'r3f-light-root', name: 'Root' });
    let s: Scene = { rootId: root.id, selection: null, nodes: { [root.id]: root } };
    s = applyCommand(s, {
      type: 'ADD_NODE',
      parentId: s.rootId,
      node: createNode({
        id: 'sky',
        name: 'Sky fill',
        children: [],
        light: { kind: 'ambient', intensity: 0.32 },
      }),
    });
    s = applyCommand(s, {
      type: 'ADD_NODE',
      parentId: s.rootId,
      node: createNode({
        id: 'sun',
        name: 'Sun',
        children: [],
        transform: { position: [4, 10, 6] },
        light: { kind: 'directional', intensity: 1.05, castShadow: true },
      }),
    });
    expect(exportSceneToR3fJsx(s)).toMatchSnapshot();
  });

  it('prepends optional studio lights when requested', () => {
    const out = exportSceneToR3fJsx(defaultFixtureScene, { includeLights: true });
    expect(out).toContain('Studio fill');
    expect(out).toContain('<ambientLight');
  });
});
