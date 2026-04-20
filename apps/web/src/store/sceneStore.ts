import { create } from 'zustand';
import {
  applyCommand,
  createEmptyScene,
  createNode,
  type Command,
  type Scene,
} from '../core';

const buildInitialScene = (): Scene => {
  let scene = createEmptyScene('Root');
  const firstCube = createNode({
    name: 'Cube 1',
    transform: { position: [0, 0.5, 0] },
  });
  scene = applyCommand(scene, {
    type: 'ADD_NODE',
    parentId: scene.rootId,
    node: firstCube,
  });
  return scene;
};

export interface SceneState {
  scene: Scene;
  selectedId: string | null;
  dispatch: (command: Command) => void;
  select: (id: string | null) => void;
  reset: () => void;
}

export const useSceneStore = create<SceneState>()((set) => ({
  scene: buildInitialScene(),
  selectedId: null,

  dispatch: (command) =>
    set((state) => {
      const nextScene = applyCommand(state.scene, command);
      if (nextScene === state.scene) return state;

      let nextSelectedId = state.selectedId;
      if (
        nextSelectedId !== null &&
        nextScene.nodes[nextSelectedId] === undefined
      ) {
        nextSelectedId = null;
      }
      return { scene: nextScene, selectedId: nextSelectedId };
    }),

  select: (id) => set({ selectedId: id }),

  reset: () => set({ scene: buildInitialScene(), selectedId: null }),
}));
