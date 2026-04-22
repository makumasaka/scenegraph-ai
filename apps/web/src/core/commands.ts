import { duplicateNodeInScene } from './duplicate';
import { computeArrangement, type ArrangeLayout, type ArrangeOptions } from './layout';
import { cloneSceneImmutable, validateScene } from './sceneValidation';
import { collectSubtreeIds, getParent, isDescendant } from './scene';
import {
  isEmptyPatch,
  mergeTransform,
  transformEqual,
  vec3Equal,
  type TransformPatch,
} from './transform';
import type { Scene, SceneNode } from './types';

export type Command =
  | { type: 'ADD_NODE'; parentId: string; node: SceneNode }
  | { type: 'DELETE_NODE'; nodeId: string }
  | { type: 'MOVE_NODE'; nodeId: string; newParentId: string }
  | { type: 'SET_PARENT'; nodeId: string; parentId: string }
  | { type: 'UPDATE_TRANSFORM'; nodeId: string; patch: TransformPatch }
  | {
      type: 'DUPLICATE_NODE';
      nodeId: string;
      includeSubtree: boolean;
      newParentId?: string;
    }
  | {
      type: 'ARRANGE_NODES';
      nodeIds: string[];
      layout: ArrangeLayout;
      options?: ArrangeOptions;
    }
  | { type: 'REPLACE_SCENE'; scene: Scene };

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

export const applyReparent = (
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

const applyUpdateTransform = (
  scene: Scene,
  nodeId: string,
  patch: TransformPatch,
): Scene => {
  const node = scene.nodes[nodeId];
  if (!node) return scene;
  if (isEmptyPatch(patch)) return scene;

  const nextTransform = mergeTransform(node.transform, patch);
  if (transformEqual(node.transform, nextTransform)) return scene;

  const nextNode: SceneNode = { ...node, transform: nextTransform };
  return {
    ...scene,
    nodes: { ...scene.nodes, [nodeId]: nextNode },
  };
};

const applyReplaceScene = (scene: Scene, incoming: Scene): Scene => {
  if (!validateScene(incoming)) return scene;
  return cloneSceneImmutable(incoming);
};

const applyArrangeNodes = (
  scene: Scene,
  nodeIds: string[],
  layout: ArrangeLayout,
  options?: ArrangeOptions,
): Scene => {
  const seen = new Set<string>();
  const targets: string[] = [];
  for (const id of nodeIds) {
    if (!id || id === scene.rootId) continue;
    if (!scene.nodes[id]) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    targets.push(id);
  }
  if (targets.length === 0) return scene;

  const positions = computeArrangement(targets.length, layout, options ?? {});

  let nextNodes: Record<string, SceneNode> | null = null;
  for (let i = 0; i < targets.length; i += 1) {
    const id = targets[i];
    const node = (nextNodes ?? scene.nodes)[id];
    const pos = positions[i];
    if (!node || vec3Equal(node.transform.position, pos)) continue;
    if (!nextNodes) nextNodes = { ...scene.nodes };
    nextNodes[id] = {
      ...node,
      transform: {
        ...node.transform,
        position: [pos[0], pos[1], pos[2]],
      },
    };
  }

  if (!nextNodes) return scene;
  return { ...scene, nodes: nextNodes };
};

export const applyCommand = (scene: Scene, command: Command): Scene => {
  switch (command.type) {
    case 'ADD_NODE':
      return applyAddNode(scene, command.parentId, command.node);
    case 'DELETE_NODE':
      return applyDeleteNode(scene, command.nodeId);
    case 'MOVE_NODE':
      return applyReparent(scene, command.nodeId, command.newParentId);
    case 'SET_PARENT':
      return applyReparent(scene, command.nodeId, command.parentId);
    case 'UPDATE_TRANSFORM':
      return applyUpdateTransform(scene, command.nodeId, command.patch);
    case 'DUPLICATE_NODE':
      return duplicateNodeInScene(
        scene,
        command.nodeId,
        command.includeSubtree,
        command.newParentId,
      );
    case 'ARRANGE_NODES':
      return applyArrangeNodes(
        scene,
        command.nodeIds,
        command.layout,
        command.options,
      );
    case 'REPLACE_SCENE':
      return applyReplaceScene(scene, command.scene);
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
};
