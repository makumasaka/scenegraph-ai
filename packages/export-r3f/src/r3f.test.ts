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
    const root = createNode({ id: 'r3f-light-root', name: 'Root', type: 'root' });
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
    expect(out).toMatchSnapshot();
  });

  it('treats the deprecated includeLights alias as includeStudioLights', () => {
    const preferred = exportSceneToR3fJsx(defaultFixtureScene, {
      includeStudioLights: true,
    });
    const legacy = exportSceneToR3fJsx(defaultFixtureScene, {
      includeLights: true,
    });
    expect(legacy).toBe(preferred);
  });

  it('omits the studio fill block by default', () => {
    const out = exportSceneToR3fJsx(defaultFixtureScene);
    expect(out).not.toContain('Studio fill');
  });

  it('emits semantic and behavior metadata as deterministic comments and userData', () => {
    let s = applyCommand(showroomScene, { type: 'STRUCTURE_SHOWROOM_SCENE' });
    s = applyCommand(s, {
      type: 'ADD_BEHAVIOR',
      nodeIds: ['product_01'],
      behavior: {
        hoverHighlight: true,
        clickSelect: true,
        info: { title: 'Product 01', description: 'Demo info' },
      },
    });

    const out = exportSceneToR3fJsx(s);

    expect(out).toContain('semantics: role=product | group=display_area');
    expect(out).toContain('behavior=hoverHighlight+clickSelect');
    expect(out).toContain('"semanticRole":"product"');
    expect(out).toContain('"behaviors":{"hoverHighlight":true,"clickSelect":true');
    expect(out).toMatchSnapshot();
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
    expect(out).toMatchSnapshot();
  });

  it('matches snapshot for nested root transform hierarchy', () => {
    const root = createNode({
      id: 'nested-root',
      name: 'Nested Root',
      type: 'root',
      children: ['nested-parent'],
      transform: {
        position: [10, 0, 0],
        rotation: [0, 0.25, 0],
        scale: [1.5, 1.5, 1.5],
      },
    });
    const parent = createNode({
      id: 'nested-parent',
      name: 'Nested Parent',
      type: 'group',
      children: ['nested-child'],
      transform: { position: [0, 2, 0] },
    });
    const child = createNode({
      id: 'nested-child',
      name: 'Nested Child',
      children: [],
      transform: { position: [0, 0, 3], rotation: [0.1, 0.2, 0.3] },
    });
    const scene: Scene = {
      rootId: root.id,
      selection: null,
      nodes: {
        [root.id]: root,
        [parent.id]: parent,
        [child.id]: child,
      },
    };

    const out = exportSceneToR3fJsx(scene);

    expect(out).toContain('/* nested-root - Nested Root */');
    expect(out).toContain(
      '<group name="Nested Root" position={[10, 0, 0]} rotation={[0, 0.25, 0]} scale={[1.5, 1.5, 1.5]}>',
    );
    expect(out.indexOf('nested-root')).toBeLessThan(out.indexOf('nested-parent'));
    expect(out.indexOf('nested-parent')).toBeLessThan(out.indexOf('nested-child'));
    expect(out).toMatchSnapshot();
  });
});
