import { createId, getParent } from './scene';
import type { Scene, SceneNode, Transform, Vec3 } from './types';

const cloneVec3 = (v: Vec3): Vec3 => [v[0], v[1], v[2]];

const cloneTransform = (t: Transform): Transform => ({
  position: cloneVec3(t.position),
  rotation: cloneVec3(t.rotation),
  scale: cloneVec3(t.scale),
});

/** Breadth-first order from `startId` (includes start). Only visits nodes present in `scene`. */
export const collectSubtreeBfsOrder = (
  scene: Scene,
  startId: string,
): string[] => {
  const out: string[] = [];
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const node = scene.nodes[id];
    if (!node) continue;
    out.push(id);
    for (const childId of node.children) queue.push(childId);
  }
  return out;
};

export const duplicateNodeInScene = (
  scene: Scene,
  nodeId: string,
  includeSubtree: boolean,
  newParentId?: string,
): Scene => {
  if (nodeId === scene.rootId) return scene;
  const sourceRoot = scene.nodes[nodeId];
  if (!sourceRoot) return scene;

  const targetParentId =
    newParentId ?? getParent(scene, nodeId)?.id ?? scene.rootId;
  const targetParent = scene.nodes[targetParentId];
  if (!targetParent) return scene;

  const orderedIds = includeSubtree
    ? collectSubtreeBfsOrder(scene, nodeId)
    : [nodeId];

  const idSet = new Set(orderedIds);
  if (idSet.has(targetParentId)) return scene;

  const idMap: Record<string, string> = {};
  for (const oldId of orderedIds) {
    idMap[oldId] = createId();
  }

  const nextNodes: Record<string, SceneNode> = { ...scene.nodes };

  for (const oldId of orderedIds) {
    const old = scene.nodes[oldId];
    const newId = idMap[oldId];
    const isDupRoot = oldId === nodeId;

    const newChildren = includeSubtree
      ? old.children.filter((c) => idSet.has(c)).map((c) => idMap[c])
      : [];

    const name = isDupRoot ? `${old.name} (copy)` : old.name;

    nextNodes[newId] = {
      id: newId,
      name,
      children: newChildren,
      transform: cloneTransform(old.transform),
    };
  }

  const duplicateRootId = idMap[nodeId];
  nextNodes[targetParentId] = {
    ...targetParent,
    children: [...targetParent.children, duplicateRootId],
  };

  return { ...scene, nodes: nextNodes };
};
