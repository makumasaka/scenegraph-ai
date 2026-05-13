import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import {
  commandFromObject3DTransform,
  commandFromTransformPatch,
  transformPatchFromObject3D,
} from './transformCommand';

describe('transform command helpers', () => {
  it('reads local Object3D transform into an UPDATE_TRANSFORM command', () => {
    const object = new Object3D();
    object.position.set(1, 2, 3);
    object.rotation.set(0.1, 0.2, 0.3);
    object.scale.set(2, 0.5, 1.5);

    const patch = transformPatchFromObject3D(object);

    expect(patch).toEqual({
      position: [1, 2, 3],
      rotation: [0.1, 0.2, 0.3],
      scale: [2, 0.5, 1.5],
    });
    expect(commandFromObject3DTransform({ nodeId: 'node', object })).toEqual({
      type: 'UPDATE_TRANSFORM',
      nodeId: 'node',
      patch,
    });
  });

  it('wraps explicit transform patches without adding runtime state', () => {
    expect(commandFromTransformPatch('node', { position: [4, 5, 6] })).toEqual({
      type: 'UPDATE_TRANSFORM',
      nodeId: 'node',
      patch: { position: [4, 5, 6] },
    });
  });
});
