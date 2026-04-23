import type { Scene, SceneNode, Transform } from '@diorama/schema';

export const identityTransform = (): Transform => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
});

/** Generates a new unique node id (used by createNode and duplicate). */
export const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `n_${Math.random().toString(36).slice(2, 10)}`;
};

export interface CreateNodeInput {
  id?: string;
  name?: string;
  transform?: Partial<Transform>;
  children?: string[];
  assetRef?: SceneNode['assetRef'];
  materialRef?: SceneNode['materialRef'];
}

export const createNode = (input: CreateNodeInput = {}): SceneNode => {
  const base = identityTransform();
  const node: SceneNode = {
    id: input.id ?? createId(),
    name: input.name ?? 'Node',
    children: input.children ?? [],
    transform: {
      position: input.transform?.position ?? base.position,
      rotation: input.transform?.rotation ?? base.rotation,
      scale: input.transform?.scale ?? base.scale,
    },
  };
  if (input.assetRef !== undefined) node.assetRef = input.assetRef;
  if (input.materialRef !== undefined) node.materialRef = input.materialRef;
  return node;
};

export const createEmptyScene = (rootName = 'Root'): Scene => {
  const root = createNode({ name: rootName });
  return {
    rootId: root.id,
    selection: null,
    nodes: { [root.id]: root },
  };
};

/** Path from root to `nodeId` (inclusive). Empty if `nodeId` is missing. */
export const getAncestorPath = (scene: Scene, nodeId: string): string[] => {
  if (!scene.nodes[nodeId]) return [];
  const up: string[] = [];
  let cur: string | null = nodeId;
  while (cur) {
    up.push(cur);
    if (cur === scene.rootId) break;
    const p = getParent(scene, cur);
    cur = p?.id ?? null;
  }
  return up.reverse();
};

export const getNode = (scene: Scene, id: string): SceneNode | undefined =>
  scene.nodes[id];

export const getChildren = (scene: Scene, id: string): SceneNode[] => {
  const node = scene.nodes[id];
  if (!node) return [];
  return node.children
    .map((childId) => scene.nodes[childId])
    .filter((n): n is SceneNode => Boolean(n));
};

export const getParent = (scene: Scene, id: string): SceneNode | undefined => {
  if (id === scene.rootId) return undefined;
  for (const candidate of Object.values(scene.nodes)) {
    if (candidate.children.includes(id)) return candidate;
  }
  return undefined;
};

export const isDescendant = (
  scene: Scene,
  ancestorId: string,
  candidateId: string,
): boolean => {
  if (ancestorId === candidateId) return true;
  const ancestor = scene.nodes[ancestorId];
  if (!ancestor) return false;
  const stack = [...ancestor.children];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (id === candidateId) return true;
    const n = scene.nodes[id];
    if (n) stack.push(...n.children);
  }
  return false;
};

export const collectSubtreeIds = (scene: Scene, rootId: string): string[] => {
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    const node = scene.nodes[id];
    if (!node) continue;
    out.push(id);
    stack.push(...node.children);
  }
  return out;
};
