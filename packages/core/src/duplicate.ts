import type { Scene, SceneNode, Transform, Vec3 } from '@diorama/schema';
import { createId, getParent } from './scene';

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

const validateIdMap = (
  scene: Scene,
  orderedIds: string[],
  idMap: Record<string, string>,
): boolean => {
  const usedNew = new Set<string>();
  for (const oldId of orderedIds) {
    const newId = idMap[oldId];
    if (!newId || typeof newId !== 'string') return false;
    if (scene.nodes[newId]) return false;
    if (usedNew.has(newId)) return false;
    usedNew.add(newId);
  }
  if (Object.keys(idMap).length !== orderedIds.length) return false;
  for (const k of Object.keys(idMap)) {
    if (!orderedIds.includes(k)) return false;
  }
  return true;
};

export const duplicateNodeInScene = (
  scene: Scene,
  nodeId: string,
  includeSubtree: boolean,
  newParentId?: string,
  idMap?: Record<string, string>,
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

  const effectiveMap: Record<string, string> = {};
  if (idMap) {
    if (!validateIdMap(scene, orderedIds, idMap)) return scene;
    for (const oldId of orderedIds) effectiveMap[oldId] = idMap[oldId];
  } else {
    for (const oldId of orderedIds) {
      effectiveMap[oldId] = createId();
    }
  }

  const nextNodes: Record<string, SceneNode> = { ...scene.nodes };

  for (const oldId of orderedIds) {
    const old = scene.nodes[oldId];
    const newId = effectiveMap[oldId];
    const isDupRoot = oldId === nodeId;

    const newChildren = includeSubtree
      ? old.children.filter((c) => idSet.has(c)).map((c) => effectiveMap[c])
      : [];

    const name = isDupRoot ? `${old.name} (copy)` : old.name;

    const dup: SceneNode = {
      id: newId,
      name,
      children: newChildren,
      transform: cloneTransform(old.transform),
    };
    if (old.assetRef !== undefined) dup.assetRef = old.assetRef;
    if (old.materialRef !== undefined) dup.materialRef = old.materialRef;
    if (old.light !== undefined) dup.light = old.light;
    nextNodes[newId] = dup;
  }

  const duplicateRootId = effectiveMap[nodeId];
  nextNodes[targetParentId] = {
    ...targetParent,
    children: [...targetParent.children, duplicateRootId],
  };

  return { ...scene, nodes: nextNodes };
};
