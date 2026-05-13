import type { Object3D } from 'three';

export type RuntimeNodeRegistration = {
  nodeId: string;
  object: Object3D;
};

export type RuntimeNodeRegistry = {
  register(registration: RuntimeNodeRegistration): () => void;
  unregister(nodeId: string, object?: Object3D): void;
  get(nodeId: string): Object3D | undefined;
  has(nodeId: string): boolean;
  ids(): string[];
  clear(): void;
  size(): number;
};

export const createRuntimeNodeRegistry = (): RuntimeNodeRegistry => {
  const entries = new Map<string, Object3D>();

  return {
    register({ nodeId, object }) {
      entries.set(nodeId, object);
      return () => {
        if (entries.get(nodeId) === object) entries.delete(nodeId);
      };
    },

    unregister(nodeId, object) {
      if (object !== undefined && entries.get(nodeId) !== object) return;
      entries.delete(nodeId);
    },

    get(nodeId) {
      return entries.get(nodeId);
    },

    has(nodeId) {
      return entries.has(nodeId);
    },

    ids() {
      return Array.from(entries.keys()).sort((a, b) => a.localeCompare(b));
    },

    clear() {
      entries.clear();
    },

    size() {
      return entries.size;
    },
  };
};
