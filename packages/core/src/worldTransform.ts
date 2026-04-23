import type { Scene, Transform } from '@diorama/schema';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { getAncestorPath } from './scene';

const eulerOrder = 'XYZ' as const;

const localMatrixFromTransform = (t: Transform): Matrix4 => {
  const m = new Matrix4();
  const e = new Euler(t.rotation[0], t.rotation[1], t.rotation[2], eulerOrder);
  m.compose(
    new Vector3(t.position[0], t.position[1], t.position[2]),
    new Quaternion().setFromEuler(e),
    new Vector3(t.scale[0], t.scale[1], t.scale[2]),
  );
  return m;
};

/** World matrix from root to `nodeId` (inclusive), column-major semantics matching Three.js. */
export const getWorldMatrix = (scene: Scene, nodeId: string): Matrix4 | null => {
  const path = getAncestorPath(scene, nodeId);
  if (path.length === 0) return null;
  const m = new Matrix4().identity();
  for (const id of path) {
    const node = scene.nodes[id];
    if (!node) return null;
    m.multiply(localMatrixFromTransform(node.transform));
  }
  return m;
};

export const matrixToTransform = (mat: Matrix4): Transform => {
  const pos = new Vector3();
  const quat = new Quaternion();
  const scale = new Vector3();
  mat.decompose(pos, quat, scale);
  const euler = new Euler().setFromQuaternion(quat, eulerOrder);
  return {
    position: [pos.x, pos.y, pos.z],
    rotation: [euler.x, euler.y, euler.z],
    scale: [scale.x, scale.y, scale.z],
  };
};
