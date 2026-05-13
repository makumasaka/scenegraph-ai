import type { Command, TransformPatch } from '@diorama/core';
import type { Object3D } from 'three';

export type TransformCommitInput = {
  nodeId: string;
  object: Object3D;
};

export const transformPatchFromObject3D = (object: Object3D): TransformPatch => ({
  position: [object.position.x, object.position.y, object.position.z],
  rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
  scale: [object.scale.x, object.scale.y, object.scale.z],
});

export const commandFromTransformPatch = (
  nodeId: string,
  patch: TransformPatch,
): Command => ({
  type: 'UPDATE_TRANSFORM',
  nodeId,
  patch,
});

export const commandFromObject3DTransform = ({
  nodeId,
  object,
}: TransformCommitInput): Command =>
  commandFromTransformPatch(nodeId, transformPatchFromObject3D(object));
