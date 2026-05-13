import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import { createRuntimeNodeRegistry } from './registry';

describe('createRuntimeNodeRegistry', () => {
  it('registers, replaces, unregisters, and lists stable node ids', () => {
    const registry = createRuntimeNodeRegistry();
    const a = new Object3D();
    const b = new Object3D();

    const cleanupA = registry.register({ nodeId: 'node-b', object: a });
    registry.register({ nodeId: 'node-a', object: b });

    expect(registry.size()).toBe(2);
    expect(registry.ids()).toEqual(['node-a', 'node-b']);
    expect(registry.get('node-b')).toBe(a);

    const replacement = new Object3D();
    registry.register({ nodeId: 'node-b', object: replacement });
    cleanupA();
    expect(registry.get('node-b')).toBe(replacement);

    registry.unregister('node-b', a);
    expect(registry.get('node-b')).toBe(replacement);

    registry.unregister('node-b', replacement);
    expect(registry.has('node-b')).toBe(false);
  });
});
