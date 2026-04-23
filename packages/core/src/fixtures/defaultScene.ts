import type { Scene } from '@diorama/schema';
import { createNode } from '../scene';

/** Same shape as the original editor default: root + one cube. */
export const defaultFixtureScene: Scene = (() => {
  const root = createNode({
    id: 'default-root',
    name: 'Root',
    children: ['default-cube-1'],
  });
  const cube = createNode({
    id: 'default-cube-1',
    name: 'Cube 1',
    children: [],
    transform: { position: [0, 0.5, 0] },
  });
  return {
    rootId: root.id,
    selection: null,
    nodes: { [root.id]: root, [cube.id]: cube },
  };
})();
