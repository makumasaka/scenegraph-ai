import { collectSubtreeIds, getParent, isDescendant } from './scene';
import type { Scene, SceneNode } from './types';

export type Command =
  | { type: 'ADD_NODE'; parentId: string; node: SceneNode }
  | { type: 'DELETE_NODE'; nodeId: string }
  | { type: 'MOVE_NODE'; nodeId: string; newParentId: string };

const addChild = (node: SceneNode, childId: string): SceneNode => ({
  ...node,
  children: [...node.children, childId],
});

const removeChild = (node: SceneNode, childId: string): SceneNode => ({
  ...node,
  children: node.children.filter((id) => id !== childId),
});

const applyAddNode = (
  scene: Scene,
  parentId: string,
  node: SceneNode,
): Scene => {
  const parent = scene.nodes[parentId];
  if (!parent) return scene;
  if (scene.nodes[node.id]) return scene;

  return {
    ...scene,
    nodes: {
      ...scene.nodes,
      [parentId]: addChild(parent, node.id),
      [node.id]: node,
    },
  };
};

const applyDeleteNode = (scene: Scene, nodeId: string): Scene => {
  if (nodeId === scene.rootId) return scene;
  const node = scene.nodes[nodeId];
  if (!node) return scene;

  const parent = getParent(scene, nodeId);
  const idsToRemove = new Set(collectSubtreeIds(scene, nodeId));

  const nextNodes: Record<string, SceneNode> = {};
  for (const [id, n] of Object.entries(scene.nodes)) {
    if (idsToRemove.has(id)) continue;
    nextNodes[id] = n;
  }

  if (parent && nextNodes[parent.id]) {
    nextNodes[parent.id] = removeChild(nextNodes[parent.id], nodeId);
  }

  return { ...scene, nodes: nextNodes };
};

const applyMoveNode = (
  scene: Scene,
  nodeId: string,
  newParentId: string,
): Scene => {
  if (nodeId === scene.rootId) return scene;
  if (nodeId === newParentId) return scene;

  const node = scene.nodes[nodeId];
  const newParent = scene.nodes[newParentId];
  if (!node || !newParent) return scene;

  if (isDescendant(scene, nodeId, newParentId)) return scene;

  const currentParent = getParent(scene, nodeId);
  if (currentParent && currentParent.id === newParentId) return scene;

  const nextNodes: Record<string, SceneNode> = { ...scene.nodes };
  if (currentParent) {
    nextNodes[currentParent.id] = removeChild(
      nextNodes[currentParent.id],
      nodeId,
    );
  }
  nextNodes[newParentId] = addChild(nextNodes[newParentId], nodeId);

  return { ...scene, nodes: nextNodes };
};

export const applyCommand = (scene: Scene, command: Command): Scene => {
  switch (command.type) {
    case 'ADD_NODE':
      return applyAddNode(scene, command.parentId, command.node);
    case 'DELETE_NODE':
      return applyDeleteNode(scene, command.nodeId);
    case 'MOVE_NODE':
      return applyMoveNode(scene, command.nodeId, command.newParentId);
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
};
