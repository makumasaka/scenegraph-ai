import { create } from 'zustand';
import {
  applyCommand,
  getStarterScene,
  parseSceneJson,
  serializeScene,
  type Command,
  type Scene,
} from '@diorama/core';

const HISTORY_LIMIT = 100;
const LOG_LIMIT = 200;

let logSeq = 0;

export interface CommandLogEntry {
  id: string;
  ts: number;
  command: Command;
}

interface CoalesceTag {
  type: 'UPDATE_TRANSFORM';
  nodeId: string;
}

const buildInitialScene = (): Scene => getStarterScene('default');

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

const pushLog = (log: CommandLogEntry[], command: Command): CommandLogEntry[] => {
  const entry: CommandLogEntry = {
    id: `log_${++logSeq}`,
    ts: Date.now(),
    command,
  };
  const next = [...log, entry];
  if (next.length > LOG_LIMIT) return next.slice(-LOG_LIMIT);
  return next;
};

export interface SceneState {
  scene: Scene;
  past: Scene[];
  future: Scene[];
  lastTag: CoalesceTag | null;
  commandLog: CommandLogEntry[];
  dispatch: (command: Command) => void;
  select: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  reset: () => void;
  exportSceneJson: () => string;
  importSceneJson: (text: string) => boolean;
}

export const useSceneStore = create<SceneState>()((set, get) => ({
  scene: buildInitialScene(),
  past: [],
  future: [],
  lastTag: null,
  commandLog: [],

  dispatch: (command) => {
    const state = get();
    const nextScene = applyCommand(state.scene, command);
    if (nextScene === state.scene) return;

    if (command.type === 'REPLACE_SCENE') {
      set({
        scene: nextScene,
        past: [],
        future: [],
        lastTag: null,
        commandLog: [],
      });
      return;
    }

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
      commandLog:
        command.type === 'SET_SELECTION'
          ? state.commandLog
          : pushLog(state.commandLog, command),
    });
  },

  select: (id) => get().dispatch({ type: 'SET_SELECTION', nodeId: id }),

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
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  reset: () =>
    set({
      scene: buildInitialScene(),
      past: [],
      future: [],
      lastTag: null,
      commandLog: [],
    }),

  exportSceneJson: () => serializeScene(get().scene),

  importSceneJson: (text) => {
    const parsed = parseSceneJson(text);
    if (!parsed) return false;
    get().dispatch({ type: 'REPLACE_SCENE', scene: parsed });
    return true;
  },
}));
