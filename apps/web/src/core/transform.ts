import type { Transform, Vec3 } from './types';

export type TransformPatch = Partial<{
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}>;

export const vec3Equal = (a: Vec3, b: Vec3): boolean =>
  a === b || (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]);

export const mergeTransform = (
  prev: Transform,
  patch: TransformPatch,
): Transform => ({
  position: patch.position ?? prev.position,
  rotation: patch.rotation ?? prev.rotation,
  scale: patch.scale ?? prev.scale,
});

export const transformEqual = (a: Transform, b: Transform): boolean =>
  vec3Equal(a.position, b.position) &&
  vec3Equal(a.rotation, b.rotation) &&
  vec3Equal(a.scale, b.scale);

export const isEmptyPatch = (patch: TransformPatch): boolean =>
  patch.position === undefined &&
  patch.rotation === undefined &&
  patch.scale === undefined;
