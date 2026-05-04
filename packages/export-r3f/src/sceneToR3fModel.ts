import type { BehaviorDefinition, Scene, SceneNode, SemanticGroup } from '@diorama/schema';
import { resolveBehaviorRequirements } from './behaviorMapper';
import { componentNameForRole } from './semanticMapper';
import type {
  R3fExportDiagnostic,
  R3fExportModel,
  R3fResolvedNode,
  R3fSemanticGroupSummary,
} from './types';

const resolveRole = (node: SceneNode) => node.semantics?.role ?? node.semanticRole;

const resolveGroupId = (node: SceneNode) => node.semantics?.groupId ?? node.semanticGroupId;

const sortedRecordValues = <T extends { id: string }>(record: Record<string, T> | undefined): T[] =>
  Object.values(record ?? {}).sort((a, b) => a.id.localeCompare(b.id));

const collectSemanticGroups = (scene: Scene): R3fSemanticGroupSummary[] =>
  sortedRecordValues<SemanticGroup>(scene.semanticGroups).map((group) => ({
    group,
    memberIds: [...group.nodeIds],
  }));

const collectBehaviors = (scene: Scene): BehaviorDefinition[] =>
  sortedRecordValues<BehaviorDefinition>(scene.behaviors);

const parentMapForScene = (scene: Scene): Map<string, string> => {
  const out = new Map<string, string>();
  for (const [parentId, node] of Object.entries(scene.nodes)) {
    for (const childId of node.children) out.set(childId, parentId);
  }
  return out;
};

const diagnoseGroups = (scene: Scene): R3fExportDiagnostic[] => {
  const parentOf = parentMapForScene(scene);
  const diagnostics: R3fExportDiagnostic[] = [];
  for (const group of collectSemanticGroups(scene)) {
    const parents = new Set(group.memberIds.map((id) => parentOf.get(id) ?? '<root>'));
    if (parents.size > 1) {
      diagnostics.push({
        level: 'info',
        code: 'semantic_group_crosses_hierarchy',
        message: `Semantic group ${group.group.id} spans multiple parents; exporter will preserve scene hierarchy and emit comments instead of wrapping/reordering nodes.`,
      });
    }
  }
  return diagnostics;
};

export const buildR3fExportModel = (scene: Scene): R3fExportModel => {
  const nodesInOrder: R3fResolvedNode[] = [];

  const visit = (id: string, parentId: string | null, depth: number): R3fResolvedNode | null => {
    const node = scene.nodes[id];
    if (!node || node.visible === false) return null;
    const role = resolveRole(node);
    const groupId = resolveGroupId(node);
    const hasLight = node.light !== undefined || node.type === 'light';
    const resolved: R3fResolvedNode = {
      id,
      parentId,
      depth,
      node,
      ...(role !== undefined ? { role } : {}),
      ...(groupId !== undefined ? { groupId } : {}),
      traits: [...(node.semantics?.traits ?? [])],
      componentName: componentNameForRole(role, node.type),
      behaviorRefs: [...(node.behaviorRefs ?? [])],
      behaviorRequirements: resolveBehaviorRequirements(scene, node),
      children: [],
      hasLight,
      showPlaceholderMesh: id !== scene.rootId && node.type === 'mesh' && !hasLight,
    };
    nodesInOrder.push(resolved);
    resolved.children = node.children
      .map((childId) => visit(childId, id, depth + 1))
      .filter((child): child is R3fResolvedNode => child !== null);
    return resolved;
  };

  return {
    scene,
    root: visit(scene.rootId, null, 0),
    nodesInOrder,
    semanticGroups: collectSemanticGroups(scene),
    behaviorDefinitions: collectBehaviors(scene),
    diagnostics: diagnoseGroups(scene),
  };
};
