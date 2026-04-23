import type { Scene } from '@diorama/schema';
import { createNode } from '../scene';

/** Root → Hall → small frame cubes in a 3×3 grid on the floor. */
export const galleryScene: Scene = (() => {
  const frameIds: string[] = [];
  const nodes: Scene['nodes'] = {};
  const cols = 3;
  const spacing = 1.1;

  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const id = `gallery-frame-${r}-${c}`;
      const x = (c - 1) * spacing;
      const z = (r - 1) * spacing;
      nodes[id] = createNode({
        id,
        name: `Frame ${r + 1}-${c + 1}`,
        children: [],
        transform: {
          position: [x, 0.45, z],
          rotation: [0, 0, 0],
          scale: [0.35, 0.9, 0.08],
        },
      });
      frameIds.push(id);
    }
  }

  const hall = createNode({
    id: 'gallery-hall',
    name: 'Hall',
    children: frameIds,
    transform: { position: [0, 0, 0] },
  });
  nodes[hall.id] = hall;

  const root = createNode({
    id: 'gallery-root',
    name: 'Gallery',
    children: [hall.id],
  });
  nodes[root.id] = root;

  return { rootId: root.id, selection: null, nodes };
})();
