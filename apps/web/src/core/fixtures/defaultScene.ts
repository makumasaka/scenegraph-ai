import { createNode } from '../scene';
import type { Scene } from '../types';

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
    nodes: { [root.id]: root, [cube.id]: cube },
  };
})();
