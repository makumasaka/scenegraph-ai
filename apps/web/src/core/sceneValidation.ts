import type { Scene, SceneNode } from './types';

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isVec3 = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) &&
  v.length === 3 &&
  v.every((n) => typeof n === 'number' && Number.isFinite(n));

const isTransform = (v: unknown): boolean => {
  if (!isPlainObject(v)) return false;
  return (
    isVec3(v.position) &&
    isVec3(v.rotation) &&
    isVec3(v.scale)
  );
};

const isSceneNode = (v: unknown): v is SceneNode => {
  if (!isPlainObject(v)) return false;
  return (
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.name === 'string' &&
    Array.isArray(v.children) &&
    v.children.every((c) => typeof c === 'string') &&
    isTransform(v.transform)
  );
};

/** Minimal structural validation for imported or replaced scenes. */
export const validateScene = (scene: unknown): scene is Scene => {
  if (!isPlainObject(scene)) return false;
  if (typeof scene.rootId !== 'string' || scene.rootId.length === 0)
    return false;
  if (!isPlainObject(scene.nodes)) return false;

  const nodes = scene.nodes as Record<string, unknown>;
  const root = nodes[scene.rootId];
  if (!isSceneNode(root) || root.id !== scene.rootId) return false;

  const ids = new Set(Object.keys(nodes));
  for (const [id, raw] of Object.entries(nodes)) {
    if (!isSceneNode(raw)) return false;
    if (raw.id !== id) return false;
    for (const childId of raw.children) {
      if (!ids.has(childId)) return false;
    }
  }

  const reachable = new Set<string>();
  const stack = [scene.rootId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const n = nodes[id] as SceneNode;
    for (const c of n.children) stack.push(c);
  }

  for (const id of ids) {
    if (!reachable.has(id)) return false;
  }

  return true;
};

export const cloneSceneImmutable = (scene: Scene): Scene => ({
  rootId: scene.rootId,
  nodes: { ...scene.nodes },
});
