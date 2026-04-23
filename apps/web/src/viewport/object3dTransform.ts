import type { Object3D } from 'three';
import type { TransformPatch } from '@diorama/core';

/** Reads local position / Euler rotation / scale from a Three `Object3D` into a core transform patch. */
export function transformPatchFromObject3D(object: Object3D): TransformPatch {
  return {
    position: [object.position.x, object.position.y, object.position.z],
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    scale: [object.scale.x, object.scale.y, object.scale.z],
  };
}
