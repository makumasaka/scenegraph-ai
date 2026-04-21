import { create } from 'zustand';
import {
  applyCommand,
  createEmptyScene,
  createNode,
  type Command,
  type Scene,
} from '../core';

const HISTORY_LIMIT = 100;

interface CoalesceTag {
  type: 'UPDATE_TRANSFORM';
  nodeId: string;
}

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

const pushPast = (past: Scene[], entry: Scene): Scene[] => {
  const next = past.length >= HISTORY_LIMIT ? past.slice(1) : past.slice();
  next.push(entry);
  return next;
};

const getCoalesceTag = (command: Command): CoalesceTag | null =>
  command.type === 'UPDATE_TRANSFORM'
    ? { type: 'UPDATE_TRANSFORM', nodeId: command.nodeId }
    : null;

const sameTag = (a: CoalesceTag | null, b: CoalesceTag | null): boolean =>
  a !== null &&
  b !== null &&
  a.type === b.type &&
  a.nodeId === b.nodeId;

export interface SceneState {
  scene: Scene;
  selectedId: string | null;
  past: Scene[];
  future: Scene[];
  lastTag: CoalesceTag | null;
  dispatch: (command: Command) => void;
  select: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  reset: () => void;
}

const reconcileSelection = (
  scene: Scene,
  selectedId: string | null,
): string | null => {
  if (selectedId === null) return null;
  return scene.nodes[selectedId] ? selectedId : null;
};

export const useSceneStore = create<SceneState>()((set, get) => ({
  scene: buildInitialScene(),
  selectedId: null,
  past: [],
  future: [],
  lastTag: null,

  dispatch: (command) => {
    const state = get();
    const nextScene = applyCommand(state.scene, command);
    if (nextScene === state.scene) return;

    const tag = getCoalesceTag(command);
    const shouldCoalesce = sameTag(state.lastTag, tag) && state.past.length > 0;

    const nextPast = shouldCoalesce
      ? state.past
      : pushPast(state.past, state.scene);

    set({
      scene: nextScene,
      past: nextPast,
      future: [],
      lastTag: tag,
      selectedId: reconcileSelection(nextScene, state.selectedId),
    });
  },

  select: (id) => set({ selectedId: id }),

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const previous = state.past[state.past.length - 1];
    const nextPast = state.past.slice(0, -1);
    const nextFuture = [...state.future, state.scene];
    set({
      scene: previous,
      past: nextPast,
      future: nextFuture,
      lastTag: null,
      selectedId: reconcileSelection(previous, state.selectedId),
    });
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const next = state.future[state.future.length - 1];
    const nextFuture = state.future.slice(0, -1);
    const nextPast = pushPast(state.past, state.scene);
    set({
      scene: next,
      past: nextPast,
      future: nextFuture,
      lastTag: null,
      selectedId: reconcileSelection(next, state.selectedId),
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  reset: () =>
    set({
      scene: buildInitialScene(),
      selectedId: null,
      past: [],
      future: [],
      lastTag: null,
    }),
}));
