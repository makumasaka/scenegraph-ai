import type { BehaviorDefinition, Scene, SceneNode, SemanticGroup } from '@dioramai/schema';
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

const uriLooksLikeGltf = (uri: string): boolean => /\.(glb|gltf)(\?|#|$)/i.test(uri);

type AssetUriAnalysis =
  | { kind: 'none' }
  | { kind: 'safe'; uri: string }
  | { kind: 'unsafe'; reason: string };

const analyzeAssetUri = (uri: string | undefined): AssetUriAnalysis => {
  if (uri === undefined) return { kind: 'none' };
  const value = uri.trim();
  if (value.length === 0) return { kind: 'none' };
  if (value.startsWith('file://')) return { kind: 'unsafe', reason: 'file_uri' };
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return { kind: 'unsafe', reason: 'remote_uri' };
  }
  if (value.includes('/Users/') || value.includes('\\Users\\')) {
    return { kind: 'unsafe', reason: 'local_user_path' };
  }
  if (/^[a-zA-Z]:\\/.test(value)) return { kind: 'unsafe', reason: 'absolute_windows_path' };
  if (
    value.startsWith('/assets/') ||
    value.startsWith('assets/') ||
    value.startsWith('./') ||
    value.startsWith('../')
  ) {
    return { kind: 'safe', uri: value };
  }
  return { kind: 'unsafe', reason: 'unapproved_uri_scheme' };
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
  const diagnostics = diagnoseGroups(scene);
  const assetByUri = new Map(
    Object.values(scene.assets ?? {})
      .filter((asset) => typeof asset.uri === 'string' && asset.uri.length > 0)
      .map((asset) => [asset.uri as string, asset]),
  );

  const visit = (id: string, parentId: string | null, depth: number): R3fResolvedNode | null => {
    const node = scene.nodes[id];
    if (!node || node.visible === false) return null;
    const role = resolveRole(node);
    const groupId = resolveGroupId(node);
    const hasLight = node.light !== undefined || node.type === 'light';
    const isInspectOnly = node.metadata.renderMode === 'gltf-inspect-only';
    const rawAssetUri = node.assetRef?.kind === 'uri' ? node.assetRef.uri : undefined;
    const uriAnalysis = analyzeAssetUri(rawAssetUri);
    const assetUri = uriAnalysis.kind === 'safe' ? uriAnalysis.uri : undefined;
    if (uriAnalysis.kind === 'unsafe') {
      diagnostics.push({
        level: 'warning',
        code: 'unsafe_asset_uri',
        message: `Node ${id} has an unsafe asset URI (${uriAnalysis.reason}); exporter will emit placeholder mesh instead of useGLTF.`,
      });
    }
    const asset = assetUri !== undefined ? assetByUri.get(assetUri) : undefined;
    const assetKind = asset?.kind === 'glb' || asset?.kind === 'gltf'
      ? asset.kind
      : assetUri && uriLooksLikeGltf(assetUri)
        ? (assetUri.toLowerCase().includes('.gltf') ? 'gltf' : 'glb')
        : undefined;
    const showAssetModel = assetUri !== undefined && assetKind !== undefined;
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
      ...(assetUri !== undefined ? { assetUri } : {}),
      ...(assetKind !== undefined ? { assetKind } : {}),
      showAssetModel,
      showPlaceholderMesh:
        id !== scene.rootId && node.type === 'mesh' && !hasLight && !showAssetModel && !isInspectOnly,
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
    diagnostics,
  };
};
