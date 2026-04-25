import type { Scene } from '@diorama/schema';
import { createNode } from '../scene';

/**
 * Living-space style kit: room slab + furniture proxies (boxes) with materialRef tokens.
 * IDs use the `living-*` prefix (see docs/EXAMPLE_SCENES.md).
 */
export const livingSpaceScene: Scene = (() => {
  const sofa = createNode({
    id: 'living-sofa',
    name: 'Sofa',
    children: [],
    transform: {
      position: [-1.2, 0.45, 0.5],
      rotation: [0, 0.25, 0],
      scale: [1.8, 0.55, 0.85],
    },
    materialRef: { kind: 'token', token: 'mat.fabric' },
  });
  const table = createNode({
    id: 'living-table',
    name: 'Coffee table',
    children: [],
    transform: {
      position: [0.6, 0.32, 0.4],
      rotation: [0, 0, 0],
      scale: [1.1, 0.12, 0.65],
    },
    materialRef: { kind: 'token', token: 'mat.wood' },
  });
  const lamp = createNode({
    id: 'living-lamp',
    name: 'Floor lamp',
    children: [],
    transform: {
      position: [1.9, 0.95, -0.6],
      rotation: [0, 0, 0],
      scale: [0.2, 1.9, 0.2],
    },
    materialRef: { kind: 'token', token: 'mat.metal' },
  });
  const furnitureGroup = createNode({
    id: 'living-furniture-group',
    name: 'Furniture',
    children: [sofa.id, table.id, lamp.id],
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  });
  const floor = createNode({
    id: 'living-floor',
    name: 'Floor',
    children: [],
    transform: {
      position: [0, 0.04, 0],
      rotation: [0, 0, 0],
      scale: [6, 0.08, 4.5],
    },
    materialRef: { kind: 'token', token: 'mat.floor' },
  });
  const room = createNode({
    id: 'living-room',
    name: 'Room',
    children: [floor.id, furnitureGroup.id],
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  });
  const root = createNode({
    id: 'living-root',
    name: 'Living space',
    children: [room.id],
  });

  return {
    rootId: root.id,
    selection: null,
    nodes: {
      [root.id]: root,
      [room.id]: room,
      [floor.id]: floor,
      [furnitureGroup.id]: furnitureGroup,
      [sofa.id]: sofa,
      [table.id]: table,
      [lamp.id]: lamp,
    },
  };
})();
