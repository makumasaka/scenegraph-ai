import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { transformPatchFromObject3D } from './object3dTransform';

describe('transformPatchFromObject3D', () => {
  it('maps local position, Euler rotation, and scale', () => {
    const o = new Object3D();
    o.position.set(1, 2, 3);
    o.rotation.set(0.1, 0.2, 0.3);
    o.scale.set(2, 0.5, 1.5);
    expect(transformPatchFromObject3D(o)).toEqual({
      position: [1, 2, 3],
      rotation: [0.1, 0.2, 0.3],
      scale: [2, 0.5, 1.5],
    });
  });
});
