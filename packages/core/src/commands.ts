import {
  cloneSceneFromJson,
  validateScene,
  type Scene,
  type SceneNode,
} from '@diorama/schema';
import { duplicateNodeInScene } from './duplicate';
import { computeArrangement, type ArrangeLayout, type ArrangeOptions } from './layout';
import { collectSubtreeIds, getParent, isDescendant } from './scene';
import {
  isEmptyPatch,
  mergeTransform,
  transformEqual,
  vec3Equal,
  type TransformPatch,
} from './transform';
import { getWorldMatrix, matrixToTransform } from './worldTransform';

export type Command =
  | { type: 'ADD_NODE'; parentId: string; node: SceneNode }
  | { type: 'DELETE_NODE'; nodeId: string }
  | { type: 'UPDATE_TRANSFORM'; nodeId: string; patch: TransformPatch }
  | {
      type: 'DUPLICATE_NODE';
      nodeId: string;
      includeSubtree: boolean;
      newParentId?: string;
      /** Deterministic ids for duplicated subtrees; must map every duplicated node to a fresh id. */
      idMap?: Record<string, string>;
    }
  | {
      type: 'SET_PARENT';
      nodeId: string;
      parentId: string;
      /** When true, adjusts local TRS so the world matrix matches the state before reparenting. */
      preserveWorldTransform?: boolean;
    }
  | {
      type: 'ARRANGE_NODES';
      nodeIds: string[];
      layout: ArrangeLayout;
      options?: ArrangeOptions;
    }
  | { type: 'REPLACE_SCENE'; scene: Scene }
  | { type: 'SET_SELECTION'; nodeId: string | null };

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

  const nextScene: Scene = {
    ...scene,
    nodes: {
      ...scene.nodes,
      [parentId]: addChild(parent, node.id),
      [node.id]: node,
    },
  };
  if (!validateScene(nextScene)) return scene;
  return nextScene;
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

  let nextSelection = scene.selection;
  if (nextSelection !== null && idsToRemove.has(nextSelection)) {
    nextSelection = null;
  }

  return { ...scene, nodes: nextNodes, selection: nextSelection };
};

/** Reparents `nodeId` under `newParentId` without changing local transform. */
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

const applySetParent = (scene: Scene, command: Extract<Command, { type: 'SET_PARENT' }>): Scene => {
  const { nodeId, parentId, preserveWorldTransform } = command;
  if (!preserveWorldTransform) {
    return applyReparent(scene, nodeId, parentId);
  }

  const worldBefore = getWorldMatrix(scene, nodeId);
  if (!worldBefore) return scene;

  const reparented = applyReparent(scene, nodeId, parentId);
  if (reparented === scene) return scene;

  const parentWorld = getWorldMatrix(reparented, parentId);
  if (!parentWorld) return reparented;

  const inv = parentWorld.clone().invert();
  const localMat = inv.multiply(worldBefore);
  const nextTransform = matrixToTransform(localMat);
  const n = reparented.nodes[nodeId];
  if (!n) return reparented;
  if (transformEqual(n.transform, nextTransform)) return reparented;

  return {
    ...reparented,
    nodes: {
      ...reparented.nodes,
      [nodeId]: { ...n, transform: nextTransform },
    },
  };
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

const applyReplaceScene = (_scene: Scene, incoming: Scene): Scene => {
  if (!validateScene(incoming)) return _scene;
  return cloneSceneFromJson(incoming);
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

const applySetSelection = (scene: Scene, nodeId: string | null): Scene => {
  if (nodeId !== null && !scene.nodes[nodeId]) return scene;
  if (scene.selection === nodeId) return scene;
  return { ...scene, selection: nodeId };
};

export const applyCommand = (scene: Scene, command: Command): Scene => {
  switch (command.type) {
    case 'ADD_NODE':
      return applyAddNode(scene, command.parentId, command.node);
    case 'DELETE_NODE':
      return applyDeleteNode(scene, command.nodeId);
    case 'SET_PARENT':
      return applySetParent(scene, command);
    case 'UPDATE_TRANSFORM':
      return applyUpdateTransform(scene, command.nodeId, command.patch);
    case 'DUPLICATE_NODE':
      return duplicateNodeInScene(
        scene,
        command.nodeId,
        command.includeSubtree,
        command.newParentId,
        command.idMap,
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
    case 'SET_SELECTION':
      return applySetSelection(scene, command.nodeId);
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
};

export interface CommandResult {
  scene: Scene;
  changed: boolean;
  command: Command;
}

export const applyCommandWithResult = (
  scene: Scene,
  command: Command,
): CommandResult => {
  const next = applyCommand(scene, command);
  return {
    scene: next,
    changed: next !== scene,
    command,
  };
};
