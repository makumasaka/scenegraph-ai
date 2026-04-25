import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createNode,
  defaultFixtureScene,
  galleryScene,
  livingSpaceScene,
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

  it('matches snapshot for living kit', () => {
    expect(exportSceneToR3fJsx(livingSpaceScene)).toMatchSnapshot();
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
    const out = exportSceneToR3fJsx(defaultFixtureScene, { includeStudioLights: true });
    expect(out).toContain('Studio fill');
    expect(out).toContain('<ambientLight');
  });

  it('omits hidden nodes and their descendants', () => {
    const root = createNode({
      id: 'hidden-root',
      name: 'Hidden root',
      type: 'root',
      children: ['hidden-branch'],
    });
    const hidden = createNode({
      id: 'hidden-branch',
      name: 'Hidden branch',
      visible: false,
      children: ['hidden-child'],
    });
    const child = createNode({ id: 'hidden-child', name: 'Hidden child' });
    const scene: Scene = {
      rootId: root.id,
      selection: null,
      nodes: {
        [root.id]: root,
        [hidden.id]: hidden,
        [child.id]: child,
      },
    };
    const out = exportSceneToR3fJsx(scene);
    expect(out).not.toContain('Hidden branch');
    expect(out).not.toContain('Hidden child');
  });
});
