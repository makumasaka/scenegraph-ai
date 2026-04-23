import type { Scene, SceneNode, Vec3 } from '@diorama/schema';

export interface R3fExportOptions {
  includeLights?: boolean;
}

const fmtVec = (v: Vec3): string => `[${v[0]}, ${v[1]}, ${v[2]}]`;

const escapeName = (name: string): string =>
  name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const meshBlock = (indent: string): string =>
  `${indent}<mesh castShadow receiveShadow>\n${indent}  <boxGeometry args={[1, 1, 1]} />\n${indent}  <meshStandardMaterial color="#9ca3af" />\n${indent}</mesh>\n`;

const emitNode = (scene: Scene, id: string, depth: number): string => {
  const node: SceneNode | undefined = scene.nodes[id];
  if (!node) return '';
  const ind = '  '.repeat(depth);
  const pos = fmtVec(node.transform.position);
  const rot = fmtVec(node.transform.rotation);
  const scale = fmtVec(node.transform.scale);
  const kids = node.children
    .map((childId) => emitNode(scene, childId, depth + 1))
    .join('');
  const body =
    id === scene.rootId ? '' : meshBlock(`${ind}  `);
  return `${ind}<group name="${escapeName(node.name)}" position={${pos}} rotation={${rot}} scale={${scale}}>\n${body}${kids}${ind}</group>\n`;
};

/**
 * Serializes a scene graph to a JSX-ish string for React Three Fiber.
 * Illustrative only: every non-root node is rendered as a unit cube.
 */
export const exportSceneToR3fJsx = (
  scene: Scene,
  options: R3fExportOptions = {},
): string => {
  const tree = emitNode(scene, scene.rootId, 2);
  const lights = options.includeLights
    ? `  <ambientLight intensity={0.4} />\n  <directionalLight castShadow position={[5, 8, 5]} intensity={1.1} />\n`
    : '';

  return `/* eslint-disable */\n/* Auto-generated scene — paste inside <Canvas> */\n<>\n${lights}${tree}</>\n`;
};
