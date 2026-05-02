import {
  cloneSceneFromJson,
  validateScene,
  type InteractionBehavior,
  type Scene,
  type SceneNode,
  type SemanticRole,
} from '@diorama/schema';
import { summarizeCommand, type CommandSummary } from './commandLog';
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
      type: 'CREATE_SEMANTIC_GROUP';
      groupId: string;
      name: string;
      role: SemanticRole;
      nodeIds: string[];
    }
  | {
      type: 'SET_NODE_SEMANTICS';
      nodeIds: string[];
      semanticRole: SemanticRole;
      semanticGroupId?: string;
    }
  | {
      type: 'ADD_BEHAVIOR';
      nodeIds: string[];
      behavior: InteractionBehavior;
    }
  | { type: 'STRUCTURE_SHOWROOM_SCENE' }
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

const semanticGroupNode = (
  groupId: string,
  name: string,
  role: SemanticRole,
  children: string[],
): SceneNode => ({
  id: groupId,
  name,
  type: 'group',
  children,
  transform: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  },
  visible: true,
  metadata: { semanticGroupRole: role },
  semanticRole: 'group',
  semanticGroupId: groupId,
});

const validNonRootIds = (scene: Scene, nodeIds: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of nodeIds) {
    if (!id || id === scene.rootId || !scene.nodes[id] || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
};

const topLevelTargets = (scene: Scene, nodeIds: string[]): string[] => {
  const targets = validNonRootIds(scene, nodeIds);
  const targetSet = new Set(targets);
  return targets.filter(
    (id) => !targets.some((candidate) => candidate !== id && targetSet.has(candidate) && isDescendant(scene, candidate, id)),
  );
};

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
  const nextScene: Scene = {
    ...scene,
    nodes: { ...scene.nodes, [nodeId]: nextNode },
  };
  if (!validateScene(nextScene)) return scene;
  return nextScene;
};

const applyCreateSemanticGroup = (
  scene: Scene,
  groupId: string,
  name: string,
  role: SemanticRole,
  nodeIds: string[],
): Scene => {
  if (!groupId || scene.nodes[groupId]) return scene;
  const targets = topLevelTargets(scene, nodeIds);
  if (targets.length === 0) return scene;

  const targetSet = new Set(targets);
  const nextNodes: Record<string, SceneNode> = {};
  for (const [id, node] of Object.entries(scene.nodes)) {
    const nextChildren =
      id === scene.rootId
        ? node.children.filter((childId) => !targetSet.has(childId)).concat(groupId)
        : node.children.filter((childId) => !targetSet.has(childId));
    const grouped = nodeIds.includes(id)
      ? { ...node, semanticGroupId: groupId }
      : node;
    nextNodes[id] =
      nextChildren === node.children
        ? grouped
        : { ...grouped, children: nextChildren };
  }

  nextNodes[groupId] = semanticGroupNode(groupId, name, role, targets);
  const nextScene = { ...scene, nodes: nextNodes };
  if (!validateScene(nextScene)) return scene;
  return nextScene;
};

const applySetNodeSemantics = (
  scene: Scene,
  nodeIds: string[],
  semanticRole: SemanticRole,
  semanticGroupId?: string,
): Scene => {
  const targets = validNonRootIds(scene, nodeIds);
  if (targets.length === 0) return scene;

  let nextNodes: Record<string, SceneNode> | null = null;
  for (const id of targets) {
    const node = (nextNodes ?? scene.nodes)[id];
    if (!node) continue;
    if (
      node.semanticRole === semanticRole &&
      node.semanticGroupId === semanticGroupId
    ) {
      continue;
    }
    if (!nextNodes) nextNodes = { ...scene.nodes };
    nextNodes[id] = {
      ...node,
      semanticRole,
      ...(semanticGroupId !== undefined
        ? { semanticGroupId }
        : { semanticGroupId: undefined }),
    };
  }

  if (!nextNodes) return scene;
  const nextScene = { ...scene, nodes: nextNodes };
  if (!validateScene(nextScene)) return scene;
  return nextScene;
};

const mergeBehavior = (
  current: InteractionBehavior | undefined,
  incoming: InteractionBehavior,
): InteractionBehavior => {
  const merged: InteractionBehavior = {
    ...(current ?? {}),
    ...incoming,
  };
  if (current?.info !== undefined && incoming.info !== undefined) {
    merged.info = { ...current.info, ...incoming.info };
  } else if (incoming.info !== undefined) {
    merged.info = incoming.info;
  } else if (current?.info !== undefined) {
    merged.info = current.info;
  }
  return merged;
};

const behaviorEqual = (
  a: InteractionBehavior | undefined,
  b: InteractionBehavior | undefined,
): boolean => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

const applyAddBehavior = (
  scene: Scene,
  nodeIds: string[],
  behavior: InteractionBehavior,
): Scene => {
  const targets = validNonRootIds(scene, nodeIds);
  if (targets.length === 0) return scene;

  let nextNodes: Record<string, SceneNode> | null = null;
  for (const id of targets) {
    const node = (nextNodes ?? scene.nodes)[id];
    if (!node) continue;
    const behaviors = mergeBehavior(node.behaviors, behavior);
    if (behaviorEqual(node.behaviors, behaviors)) continue;
    if (!nextNodes) nextNodes = { ...scene.nodes };
    nextNodes[id] = { ...node, behaviors };
  }

  if (!nextNodes) return scene;
  const nextScene = { ...scene, nodes: nextNodes };
  if (!validateScene(nextScene)) return scene;
  return nextScene;
};

const showroomGroupSpecs = [
  {
    groupId: 'display_area',
    name: 'Display Area',
    role: 'display' as SemanticRole,
    match: (node: SceneNode) => {
      const s = `${node.id} ${node.name}`.toLowerCase();
      return s.includes('product') || s.includes('display') || s.includes('plinth') || s.includes('table');
    },
  },
  {
    groupId: 'seating_area',
    name: 'Seating Area',
    role: 'seating' as SemanticRole,
    match: (node: SceneNode) => {
      const s = `${node.id} ${node.name}`.toLowerCase();
      return s.includes('bench') || s.includes('chair') || s.includes('seat');
    },
  },
  {
    groupId: 'lighting_zone',
    name: 'Lighting Zone',
    role: 'light' as SemanticRole,
    match: (node: SceneNode) => {
      const s = `${node.id} ${node.name}`.toLowerCase();
      return node.type === 'light' || node.light !== undefined || s.includes('light');
    },
  },
  {
    groupId: 'environment',
    name: 'Environment',
    role: 'environment' as SemanticRole,
    match: (node: SceneNode) => {
      const s = `${node.id} ${node.name}`.toLowerCase();
      return s.includes('wall') || s.includes('floor') || s.includes('backdrop') || s.includes('environment');
    },
  },
] as const;

const semanticRoleForNode = (node: SceneNode, groupRole: SemanticRole): SemanticRole => {
  const s = `${node.id} ${node.name}`.toLowerCase();
  if (s.includes('product')) return 'product';
  if (s.includes('display') || s.includes('plinth') || s.includes('table')) return 'display';
  if (s.includes('bench') || s.includes('chair') || s.includes('seat')) return 'seating';
  if (node.type === 'light' || node.light !== undefined || s.includes('light')) return 'light';
  if (s.includes('wall') || s.includes('floor') || s.includes('backdrop')) return 'environment';
  return groupRole === 'group' ? 'unknown' : groupRole;
};

const applyStructureShowroomScene = (scene: Scene): Scene => {
  let next = scene;
  for (const spec of showroomGroupSpecs) {
    const nodeIds = Object.values(next.nodes)
      .filter((node) => node.id !== next.rootId && node.semanticRole !== 'group' && spec.match(node))
      .map((node) => node.id);
    if (nodeIds.length === 0) continue;

    if (!next.nodes[spec.groupId]) {
      next = applyCreateSemanticGroup(next, spec.groupId, spec.name, spec.role, nodeIds);
    }

    const groupedIds = nodeIds.filter((id) => next.nodes[id]);
    const nodesByRole = groupedIds.reduce<Record<SemanticRole, string[]>>(
      (acc, id) => {
        const node = next.nodes[id];
        if (!node) return acc;
        const role = semanticRoleForNode(node, spec.role);
        acc[role].push(id);
        return acc;
      },
      {
        product: [],
        display: [],
        seating: [],
        light: [],
        environment: [],
        group: [],
        unknown: [],
      },
    );

    for (const [role, ids] of Object.entries(nodesByRole) as Array<[SemanticRole, string[]]>) {
      if (ids.length > 0) {
        next = applySetNodeSemantics(next, ids, role, spec.groupId);
      }
    }
  }
  return next;
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
    case 'CREATE_SEMANTIC_GROUP':
      return applyCreateSemanticGroup(
        scene,
        command.groupId,
        command.name,
        command.role,
        command.nodeIds,
      );
    case 'SET_NODE_SEMANTICS':
      return applySetNodeSemantics(
        scene,
        command.nodeIds,
        command.semanticRole,
        command.semanticGroupId,
      );
    case 'ADD_BEHAVIOR':
      return applyAddBehavior(scene, command.nodeIds, command.behavior);
    case 'STRUCTURE_SHOWROOM_SCENE':
      return applyStructureShowroomScene(scene);
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
  summary: CommandSummary;
  error?: string;
  warnings?: string[];
  command: Command;
}

const validDuplicateTargets = (
  scene: Scene,
  nodeId: string,
  includeSubtree: boolean,
): string[] => (includeSubtree ? collectSubtreeIds(scene, nodeId) : [nodeId]);

const commandError = (scene: Scene, command: Command): string | undefined => {
  switch (command.type) {
    case 'ADD_NODE': {
      if (!scene.nodes[command.parentId]) return 'ADD_NODE parentId does not exist';
      if (scene.nodes[command.node.id]) return 'ADD_NODE node id already exists';
      const nextScene: Scene = {
        ...scene,
        nodes: {
          ...scene.nodes,
          [command.parentId]: addChild(scene.nodes[command.parentId], command.node.id),
          [command.node.id]: command.node,
        },
      };
      if (!validateScene(nextScene)) return 'ADD_NODE would violate scene invariants';
      return undefined;
    }
    case 'DELETE_NODE':
      if (command.nodeId === scene.rootId) return 'DELETE_NODE cannot delete root';
      if (!scene.nodes[command.nodeId]) return 'DELETE_NODE nodeId does not exist';
      return undefined;
    case 'UPDATE_TRANSFORM': {
      const node = scene.nodes[command.nodeId];
      if (!node) return 'UPDATE_TRANSFORM nodeId does not exist';
      if (isEmptyPatch(command.patch)) return undefined;
      const nextScene: Scene = {
        ...scene,
        nodes: {
          ...scene.nodes,
          [command.nodeId]: {
            ...node,
            transform: mergeTransform(node.transform, command.patch),
          },
        },
      };
      if (!validateScene(nextScene)) {
        return 'UPDATE_TRANSFORM would violate scene invariants';
      }
      return undefined;
    }
    case 'CREATE_SEMANTIC_GROUP': {
      if (scene.nodes[command.groupId]) {
        return 'CREATE_SEMANTIC_GROUP groupId already exists';
      }
      const targets = topLevelTargets(scene, command.nodeIds);
      if (targets.length === 0) {
        return 'CREATE_SEMANTIC_GROUP has no valid non-root targets';
      }
      const nextScene = applyCreateSemanticGroup(
        scene,
        command.groupId,
        command.name,
        command.role,
        command.nodeIds,
      );
      if (nextScene === scene) return 'CREATE_SEMANTIC_GROUP would violate scene invariants';
      return undefined;
    }
    case 'SET_NODE_SEMANTICS': {
      const hasTarget = command.nodeIds.some(
        (id) => id !== scene.rootId && scene.nodes[id] !== undefined,
      );
      return hasTarget ? undefined : 'SET_NODE_SEMANTICS has no valid non-root targets';
    }
    case 'ADD_BEHAVIOR': {
      const hasTarget = command.nodeIds.some(
        (id) => id !== scene.rootId && scene.nodes[id] !== undefined,
      );
      return hasTarget ? undefined : 'ADD_BEHAVIOR has no valid non-root targets';
    }
    case 'STRUCTURE_SHOWROOM_SCENE':
      return applyStructureShowroomScene(scene) === scene
        ? 'STRUCTURE_SHOWROOM_SCENE found no showroom nodes to structure'
        : undefined;
    case 'DUPLICATE_NODE': {
      if (command.nodeId === scene.rootId) return 'DUPLICATE_NODE cannot duplicate root';
      if (!scene.nodes[command.nodeId]) return 'DUPLICATE_NODE nodeId does not exist';
      const targetParentId =
        command.newParentId ?? getParent(scene, command.nodeId)?.id ?? scene.rootId;
      if (!scene.nodes[targetParentId]) {
        return 'DUPLICATE_NODE newParentId does not exist';
      }
      const duplicatedIds = validDuplicateTargets(
        scene,
        command.nodeId,
        command.includeSubtree,
      );
      if (duplicatedIds.includes(targetParentId)) {
        return 'DUPLICATE_NODE cannot parent duplicate under its own subtree';
      }
      if (command.idMap !== undefined) {
        const expected = new Set(duplicatedIds);
        const actual = Object.keys(command.idMap);
        const used = new Set<string>();
        if (actual.length !== duplicatedIds.length) {
          return 'DUPLICATE_NODE idMap must map each duplicated node';
        }
        for (const oldId of actual) {
          const newId = command.idMap[oldId];
          if (!expected.has(oldId)) {
            return 'DUPLICATE_NODE idMap contains unknown source id';
          }
          if (!newId) return 'DUPLICATE_NODE idMap contains empty target id';
          if (scene.nodes[newId]) return 'DUPLICATE_NODE idMap target id already exists';
          if (used.has(newId)) return 'DUPLICATE_NODE idMap target ids must be unique';
          used.add(newId);
        }
      }
      return undefined;
    }
    case 'SET_PARENT': {
      if (command.nodeId === scene.rootId) return 'SET_PARENT cannot reparent root';
      if (command.nodeId === command.parentId) {
        return 'SET_PARENT nodeId cannot equal parentId';
      }
      if (!scene.nodes[command.nodeId]) return 'SET_PARENT nodeId does not exist';
      if (!scene.nodes[command.parentId]) return 'SET_PARENT parentId does not exist';
      if (isDescendant(scene, command.nodeId, command.parentId)) {
        return 'SET_PARENT cannot create a cycle';
      }
      return undefined;
    }
    case 'ARRANGE_NODES': {
      const hasTarget = command.nodeIds.some(
        (id) => id !== scene.rootId && scene.nodes[id] !== undefined,
      );
      return hasTarget ? undefined : 'ARRANGE_NODES has no valid non-root targets';
    }
    case 'REPLACE_SCENE':
      return validateScene(command.scene)
        ? undefined
        : 'REPLACE_SCENE scene failed validation';
    case 'SET_SELECTION':
      if (command.nodeId !== null && !scene.nodes[command.nodeId]) {
        return 'SET_SELECTION nodeId does not exist';
      }
      return undefined;
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
};

const commandWarnings = (command: Command): string[] | undefined => {
  if (command.type === 'DUPLICATE_NODE' && command.idMap === undefined) {
    return ['DUPLICATE_NODE without idMap uses generated ids'];
  }
  return undefined;
};

export const applyCommandWithResult = (
  scene: Scene,
  command: Command,
): CommandResult => {
  const error = commandError(scene, command);
  const next = applyCommand(scene, command);
  const result: CommandResult = {
    scene: next,
    changed: next !== scene,
    summary: summarizeCommand(command),
    command,
  };
  if (error !== undefined && next === scene) result.error = error;
  const warnings = commandWarnings(command);
  if (warnings !== undefined) result.warnings = warnings;
  return result;
};
