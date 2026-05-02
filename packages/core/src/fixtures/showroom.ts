import type { Scene } from '@diorama/schema';
import { createNode } from '../scene';

/** Flat, intentionally messy showroom used by the MVP demo flow. */
export const showroomScene: Scene = (() => {
  const root = createNode({
    id: 'showroom-root',
    name: 'Messy Product Showroom',
    type: 'root',
    children: [
      'floor',
      'wall',
      'product_01',
      'bench',
      'display_table',
      'product_03',
      'light_fill',
      'chair',
      'display_plinth',
      'product_02',
      'light_key',
      'backdrop_panel',
    ],
  });
  const floor = createNode({
    id: 'floor',
    name: 'Floor',
    type: 'mesh',
    children: [],
    transform: {
      position: [0, -0.05, 0],
      rotation: [0, 0, 0],
      scale: [8, 0.1, 6],
    },
  });
  const wall = createNode({
    id: 'wall',
    name: 'North Wall',
    type: 'mesh',
    children: [],
    transform: {
      position: [0, 1.6, -3],
      rotation: [0, 0, 0],
      scale: [8, 3.2, 0.12],
    },
  });
  const backdrop = createNode({
    id: 'backdrop_panel',
    name: 'Backdrop Panel',
    type: 'mesh',
    children: [],
    transform: {
      position: [-2.4, 1.05, -2.65],
      rotation: [0, 0.18, 0],
      scale: [1.6, 2.1, 0.1],
    },
  });
  const product01 = createNode({
    id: 'product_01',
    name: 'Product 01',
    children: [],
    transform: {
      position: [-1.8, 0.65, 0.4],
      rotation: [0, 0.4, 0],
      scale: [0.65, 0.9, 0.65],
    },
  });
  const product02 = createNode({
    id: 'product_02',
    name: 'Product 02',
    children: [],
    transform: {
      position: [2.1, 0.55, -0.2],
      rotation: [0, -0.25, 0],
      scale: [0.8, 0.7, 0.8],
    },
  });
  const product03 = createNode({
    id: 'product_03',
    name: 'Product 03',
    children: [],
    transform: {
      position: [0.35, 0.8, 1.45],
      rotation: [0, 0.85, 0],
      scale: [0.55, 1.1, 0.55],
    },
  });
  const displayTable = createNode({
    id: 'display_table',
    name: 'Display Table',
    children: [],
    transform: {
      position: [-0.4, 0.28, 0.15],
      rotation: [0, -0.12, 0],
      scale: [1.8, 0.35, 0.9],
    },
  });
  const displayPlinth = createNode({
    id: 'display_plinth',
    name: 'Display Plinth',
    children: [],
    transform: {
      position: [1.3, 0.32, 1.15],
      rotation: [0, 0.1, 0],
      scale: [0.9, 0.65, 0.9],
    },
  });
  const bench = createNode({
    id: 'bench',
    name: 'Bench',
    children: [],
    transform: {
      position: [-2.6, 0.32, 1.9],
      rotation: [0, 0.18, 0],
      scale: [1.5, 0.45, 0.55],
    },
  });
  const chair = createNode({
    id: 'chair',
    name: 'Chair',
    children: [],
    transform: {
      position: [2.7, 0.45, 1.65],
      rotation: [0, -0.55, 0],
      scale: [0.75, 0.9, 0.75],
    },
  });
  const keyLight = createNode({
    id: 'light_key',
    name: 'Light Key',
    type: 'light',
    children: [],
    transform: {
      position: [-3.2, 3.4, 2.2],
      rotation: [0, 0.5, 0],
      scale: [0.25, 0.25, 0.25],
    },
    light: { kind: 'directional', intensity: 1.2, castShadow: true },
  });
  const fillLight = createNode({
    id: 'light_fill',
    name: 'Light Fill',
    type: 'light',
    children: [],
    transform: {
      position: [3.1, 2.4, 2.5],
      rotation: [0, -0.4, 0],
      scale: [0.25, 0.25, 0.25],
    },
    light: { kind: 'ambient', intensity: 0.35 },
  });

  return {
    rootId: root.id,
    selection: null,
    nodes: {
      [root.id]: root,
      [floor.id]: floor,
      [wall.id]: wall,
      [backdrop.id]: backdrop,
      [product01.id]: product01,
      [product02.id]: product02,
      [product03.id]: product03,
      [displayTable.id]: displayTable,
      [displayPlinth.id]: displayPlinth,
      [bench.id]: bench,
      [chair.id]: chair,
      [keyLight.id]: keyLight,
      [fillLight.id]: fillLight,
    },
  };
})();
