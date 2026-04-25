import type { Scene } from '@diorama/schema';
import { createNode } from '../scene';

/** Root → Floor (wide slab) → pedestals + accent cube. */
export const showroomScene: Scene = (() => {
  const root = createNode({
    id: 'showroom-root',
    name: 'Showroom',
    type: 'root',
    children: ['showroom-floor', 'showroom-accent'],
  });
  const floor = createNode({
    id: 'showroom-floor',
    name: 'Floor',
    type: 'mesh',
    children: ['showroom-pedestal-west', 'showroom-pedestal-east'],
    transform: {
      position: [0, 0.05, 0],
      rotation: [0, 0, 0],
      scale: [7, 0.1, 5],
    },
  });
  const west = createNode({
    id: 'showroom-pedestal-west',
    name: 'Pedestal West',
    children: [],
    transform: { position: [-2, 0.35, 0] },
  });
  const east = createNode({
    id: 'showroom-pedestal-east',
    name: 'Pedestal East',
    children: [],
    transform: { position: [2, 0.35, 0] },
  });
  const accent = createNode({
    id: 'showroom-accent',
    name: 'Accent',
    children: [],
    transform: {
      position: [0, 1.1, 0],
      rotation: [0, 0.35, 0],
      scale: [1.2, 1.2, 1.2],
    },
  });

  return {
    rootId: root.id,
    selection: null,
    nodes: {
      [root.id]: root,
      [floor.id]: floor,
      [west.id]: west,
      [east.id]: east,
      [accent.id]: accent,
    },
  };
})();
