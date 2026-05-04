import type {
  BehaviorDefinition,
  BehaviorType,
  NodeType,
  Scene,
  SceneNode,
  SemanticGroup,
  SemanticRole,
  Trait,
} from '@diorama/schema';

/**
 * Options for the legacy JSX fragment exporter.
 *
 * The exporter never reads editor-only state (selection, command log, undo
 * stack, camera UI state, filesystem paths). The only opt-in addition is a
 * non-scene "studio fill" pair of lights for previews.
 */
export interface R3fExportOptions {
  /**
   * When true, prepends a small studio-style ambient + directional light pair
   * before the scene tree. These lights are not scene nodes; they are an
   * authoring convenience so pasted JSX is visible in an empty Canvas.
   */
  includeStudioLights?: boolean;
  /**
   * @deprecated Prefer `includeStudioLights`. Retained as a backward compatible
   * alias so callers and validated agent payloads that predate scene `light`
   * nodes keep working. New callers must use `includeStudioLights`.
   */
  includeLights?: boolean;
}

export type R3fBehaviorScaffoldMode = 'none' | 'comments' | 'handlers';

export interface R3fModuleExportOptions extends R3fExportOptions {
  componentName?: string;
  semanticComponents?: boolean;
  behaviorScaffold?: R3fBehaviorScaffoldMode;
  includeUserData?: boolean;
}

export interface R3fExportDiagnostic {
  level: 'info' | 'warning';
  code: string;
  message: string;
}

export interface R3fExportResult {
  code: string;
  diagnostics: R3fExportDiagnostic[];
}

export interface R3fBehaviorRequirement {
  type: BehaviorType;
  source: 'behavior' | 'legacy' | 'trait';
  behaviorId?: string;
  label?: string;
  title?: string;
  description?: string;
}

export interface R3fResolvedNode {
  id: string;
  parentId: string | null;
  depth: number;
  node: SceneNode;
  role?: SemanticRole;
  groupId?: string;
  traits: Trait[];
  componentName: string;
  behaviorRefs: string[];
  behaviorRequirements: R3fBehaviorRequirement[];
  children: R3fResolvedNode[];
  hasLight: boolean;
  showPlaceholderMesh: boolean;
}

export interface R3fSemanticGroupSummary {
  group: SemanticGroup;
  memberIds: string[];
}

export interface R3fExportModel {
  scene: Scene;
  root: R3fResolvedNode | null;
  nodesInOrder: R3fResolvedNode[];
  semanticGroups: R3fSemanticGroupSummary[];
  behaviorDefinitions: BehaviorDefinition[];
  diagnostics: R3fExportDiagnostic[];
}

export type R3fComponentFallbackInput = {
  role?: SemanticRole;
  nodeType: NodeType;
};
