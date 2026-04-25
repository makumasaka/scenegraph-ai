import type { Scene, SceneLight, SceneNode, Vec3 } from '@diorama/schema';

export interface R3fExportOptions {
  /** When true, prepends a small studio-style fill (not from scene nodes). */
  includeStudioLights?: boolean;
  /** @deprecated Prefer `includeStudioLights`; kept for callers that predate scene `light` nodes. */
  includeLights?: boolean;
}

const fmtNum = (n: number): string => (Number.isInteger(n) ? String(n) : String(n));

const fmtVec = (v: Vec3): string => `[${fmtNum(v[0])}, ${fmtNum(v[1])}, ${fmtNum(v[2])}]`;

const escapeAttr = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');

const escapeComment = (s: string): string => s.replace(/\*\//g, '* /');

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

const placeholderMesh = (indent: string): string =>
  `${indent}<mesh castShadow receiveShadow>\n${indent}  <boxGeometry args={[1, 1, 1]} />\n${indent}  <meshStandardMaterial color="#9ca3af" />\n${indent}</mesh>\n`;

/**
 * Depth-first traversal using each node's `children` array order (canonical graph order).
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

  const isRoot = id === scene.rootId;
  const hasLight = node.light !== undefined || node.type === 'light';
  const showPlaceholderMesh = !isRoot && node.type === 'mesh' && !hasLight;

  const open =
    `${ind}{/* ${escapeComment(node.id)} - ${escapeComment(node.name)} */}\n` +
    `${ind}<group name="${escapeAttr(node.name)}" position={${pos}} rotation={${rot}} scale={${scale}}>\n`;

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
 * - Every node -> `<group>` with local `position` / `rotation` / `scale` (Euler radians, same as Three).
 * - Group/root/empty nodes -> group only.
 * - Mesh nodes -> placeholder `<mesh>` (unit cube + neutral material) unless `light` is set.
 * - `light` -> `<ambientLight>` or `<directionalLight>` inside the node's group.
 *
 * Not exported: `selection`, internal ids beyond comments, `assetRef` / `materialRef` (comment-only future).
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
