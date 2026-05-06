import { stableStringify, type Scene, type SceneNode } from '@diorama/schema';
import { emitLight, escapeAttr, escapeComment, fmtVec, indent, placeholderMesh } from './jsxWriter';
import type { R3fExportOptions } from './types';

const emitSemanticComment = (node: SceneNode, baseIndent: string): string => {
  const parts: string[] = [];
  const role = node.semantics?.role ?? node.semanticRole;
  const groupId = node.semantics?.groupId ?? node.semanticGroupId;
  if (role) parts.push(`role=${role}`);
  if (groupId) parts.push(`group=${groupId}`);
  if (node.semantics?.traits && node.semantics.traits.length > 0) {
    parts.push(`traits=${[...node.semantics.traits].sort((a, b) => a.localeCompare(b)).join(',')}`);
  }
  if (node.semantics?.label) parts.push(`label=${escapeComment(node.semantics.label)}`);
  if (node.behaviors) {
    const enabled = Object.entries(node.behaviors)
      .filter(([key, value]) => key !== 'info' && value === true)
      .map(([key]) => key)
      .sort((a, b) => a.localeCompare(b));
    if (enabled.length > 0) parts.push(`behavior=${enabled.join('+')}`);
    if (node.behaviors.info?.title) {
      parts.push(`info=${escapeComment(node.behaviors.info.title)}`);
    }
  }
  return parts.length > 0 ? `${baseIndent}{/* semantics: ${parts.join(' | ')} */}\n` : '';
};

const emitUserDataAttr = (node: SceneNode): string => {
  const userData: Record<string, unknown> = {};
  if (node.semantics) userData.semantics = node.semantics;
  if (node.behaviorRefs) userData.behaviorRefs = node.behaviorRefs;
  if (node.semanticRole) userData.semanticRole = node.semanticRole;
  if (node.semanticGroupId) userData.semanticGroupId = node.semanticGroupId;
  if (node.behaviors) userData.behaviors = node.behaviors;
  if (Object.keys(userData).length === 0) return '';
  /** Stable keys at every object depth for deterministic JSX props. */
  const payload = stableStringify(userData, 0);
  return ` userData={${payload}}`;
};

/**
 * Depth-first traversal using each node's `children` array order (canonical
 * scene-graph order). Hidden nodes and their entire subtree are skipped to
 * mirror viewport traversal.
 */
const emitNode = (scene: Scene, id: string, depth: number): string => {
  const node: SceneNode | undefined = scene.nodes[id];
  if (!node) return '';
  if (node.visible === false) return '';

  const ind = indent(depth);
  const inner = indent(depth + 1);
  const pos = fmtVec(node.transform.position);
  const rot = fmtVec(node.transform.rotation);
  const scale = fmtVec(node.transform.scale);
  const userData = emitUserDataAttr(node);

  const isRoot = id === scene.rootId;
  const hasLight = node.light !== undefined || node.type === 'light';
  const showPlaceholderMesh = !isRoot && node.type === 'mesh' && !hasLight;

  const open =
    `${ind}{/* ${escapeComment(node.id)} - ${escapeComment(node.name)} */}\n` +
    emitSemanticComment(node, ind) +
    `${ind}<group name="${escapeAttr(node.name)}" position={${pos}} rotation={${rot}} scale={${scale}}${userData}>\n`;

  let body = '';
  if (hasLight && node.light) body += emitLight(node.light, inner);
  if (showPlaceholderMesh) body += placeholderMesh(inner);

  const childBlocks = node.children.map((childId) => emitNode(scene, childId, depth + 1)).join('');

  return `${open}${body}${childBlocks}${ind}</group>\n`;
};

/**
 * Readable React Three Fiber-style JSX string for a {@link Scene}.
 *
 * Mapping (minimal):
 * - Every visible node -> `<group>` with local `position` / `rotation` /
 *   `scale` (Euler radians, same as Three).
 * - Group, root, and empty nodes -> group only.
 * - Mesh nodes -> placeholder `<mesh>` (unit cube + neutral material) unless
 *   the node has a `light` payload.
 * - `light` -> `<ambientLight>` or `<directionalLight>` inside the node's
 *   group.
 *
 * Comments include each visible node's id and name so the output can be cross
 * referenced with the source scene graph.
 *
 * Limitations (intentional):
 * - No real asset loading. `assetRef` is not resolved or imported.
 * - No material graph. `materialRef` tokens are not mapped to materials.
 * - No animation, no shader graph, no glTF export.
 * - No full renderer semantics. Cameras, post-processing, environment maps,
 *   and shadow tuning are out of scope.
 * - Editor-only state is never emitted: `selection`, command log, undo and
 *   redo stacks, camera UI state, gizmo mode, and filesystem paths are
 *   ignored even when present on the input.
 */
const semanticGroupHeader = (scene: Scene): string => {
  if (!scene.semanticGroups || Object.keys(scene.semanticGroups).length === 0) return '';
  const groups = Object.values(scene.semanticGroups).sort((a, b) => a.id.localeCompare(b.id));
  return `/* Semantic groups: ${groups.map((g) => `${g.id}=${g.role}(${g.nodeIds.length})`).join(', ')} */\n`;
};

const behaviorHeader = (scene: Scene): string => {
  if (!scene.behaviors || Object.keys(scene.behaviors).length === 0) return '';
  const defs = Object.values(scene.behaviors).sort((a, b) => a.id.localeCompare(b.id));
  return `/* Behaviors: ${defs.map((b) => `${b.id}:${b.type}(${b.nodeIds.length})`).join(', ')} */\n`;
};

export const exportSceneToR3fJsx = (
  scene: Scene,
  options: R3fExportOptions = {},
): string => {
  const tree = emitNode(scene, scene.rootId, 2);
  const semanticGroups = semanticGroupHeader(scene);
  const behaviors = behaviorHeader(scene);
  const studioWanted =
    options.includeStudioLights === true || options.includeLights === true;
  const studio = studioWanted
      ? '  {/* Studio fill - not from scene graph */}\n' +
        '  <ambientLight intensity={0.4} />\n' +
        '  <directionalLight castShadow position={[5, 8, 5]} intensity={1.1} />\n'
      : '';

  return (
    `/* eslint-disable */\n` +
    `/* Auto-generated for React Three Fiber - paste inside <Canvas> */\n` +
    semanticGroups +
    behaviors +
    `<>\n` +
    `${studio}${tree}` +
    `</>\n`
  );
};
