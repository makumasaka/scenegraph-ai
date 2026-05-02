import type { Scene, SceneLight, SceneNode, Vec3 } from '@diorama/schema';

/**
 * Options for {@link exportSceneToR3fJsx}.
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

/**
 * Stable numeric formatting. Integers render without a decimal point; finite
 * non-integers use the default `String` representation. JSON.stringify already
 * normalises `-0` to `0`, and `String(-0) === '0'`, so deterministic byte
 * output is preserved.
 */
const fmtNum = (n: number): string => String(n);

const fmtVec = (v: Vec3): string => `[${fmtNum(v[0])}, ${fmtNum(v[1])}, ${fmtNum(v[2])}]`;

const escapeAttr = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');

const escapeComment = (s: string): string => s.replace(/\*\//g, '* /');

const emitSemanticComment = (node: SceneNode, indent: string): string => {
  const parts: string[] = [];
  if (node.semanticRole) parts.push(`role=${node.semanticRole}`);
  if (node.semanticGroupId) parts.push(`group=${node.semanticGroupId}`);
  if (node.behaviors) {
    const enabled = Object.entries(node.behaviors)
      .filter(([key, value]) => key !== 'info' && value === true)
      .map(([key]) => key);
    if (enabled.length > 0) parts.push(`behavior=${enabled.join('+')}`);
    if (node.behaviors.info?.title) {
      parts.push(`info=${escapeComment(node.behaviors.info.title)}`);
    }
  }
  return parts.length > 0 ? `${indent}{/* semantics: ${parts.join(' | ')} */}\n` : '';
};

const emitUserDataAttr = (node: SceneNode): string => {
  const userData: Record<string, unknown> = {};
  if (node.semanticRole) userData.semanticRole = node.semanticRole;
  if (node.semanticGroupId) userData.semanticGroupId = node.semanticGroupId;
  if (node.behaviors) userData.behaviors = node.behaviors;
  return Object.keys(userData).length > 0
    ? ` userData={${JSON.stringify(userData)}}`
    : '';
};

const emitLight = (light: SceneLight, indent: string): string => {
  if (light.kind === 'ambient') {
    const attrs =
      light.intensity !== undefined ? ` intensity={${fmtNum(light.intensity)}}` : '';
    return `${indent}<ambientLight${attrs} />\n`;
  }
  const parts: string[] = [];
  if (light.intensity !== undefined) parts.push(`intensity={${fmtNum(light.intensity)}}`);
  if (light.castShadow === true) parts.push('castShadow');
  const tail = parts.length > 0 ? ` ${parts.join(' ')}` : '';
  return `${indent}<directionalLight${tail} />\n`;
};

/** Neutral primitive proxy used for `mesh` nodes. Keeps export readable. */
const placeholderMesh = (indent: string): string =>
  `${indent}<mesh castShadow receiveShadow>\n` +
  `${indent}  <boxGeometry args={[1, 1, 1]} />\n` +
  `${indent}  <meshStandardMaterial color="#9ca3af" />\n` +
  `${indent}</mesh>\n`;

/**
 * Depth-first traversal using each node's `children` array order (canonical
 * scene-graph order). Hidden nodes and their entire subtree are skipped to
 * mirror viewport traversal.
 */
const emitNode = (scene: Scene, id: string, depth: number): string => {
  const node: SceneNode | undefined = scene.nodes[id];
  if (!node) return '';
  if (node.visible === false) return '';

  const ind = '  '.repeat(depth);
  const inner = '  '.repeat(depth + 1);
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
export const exportSceneToR3fJsx = (
  scene: Scene,
  options: R3fExportOptions = {},
): string => {
  const tree = emitNode(scene, scene.rootId, 2);
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
    `<>\n` +
    `${studio}${tree}` +
    `</>\n`
  );
};
