import type { Command } from '@dioramai/core';
import type { Scene } from '@dioramai/schema';

export type SelectionModel = {
  selectedId: string | null;
};

export type MultiSelectionModel = {
  selectedIds: string[];
  pivotId: string | null;
};

export type SelectionManager = {
  select(scene: Scene, nodeId: string | null): Command | null;
  multiSelect(scene: Scene, nodeIds: string[], pivotId?: string | null): MultiSelectionModel;
};

const uniqueValidNodeIds = (scene: Scene, nodeIds: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const nodeId of nodeIds) {
    if (seen.has(nodeId) || scene.nodes[nodeId] === undefined) continue;
    seen.add(nodeId);
    out.push(nodeId);
  }
  return out;
};

export const createSelectionManager = (): SelectionManager => ({
  select(scene, nodeId) {
    if (nodeId !== null && scene.nodes[nodeId] === undefined) return null;
    if (scene.selection === nodeId) return null;
    return { type: 'SET_SELECTION', nodeId };
  },

  multiSelect(scene, nodeIds, pivotId = null) {
    const selectedIds = uniqueValidNodeIds(scene, nodeIds);
    const resolvedPivot =
      pivotId !== null && selectedIds.includes(pivotId)
        ? pivotId
        : selectedIds[0] ?? null;
    return { selectedIds, pivotId: resolvedPivot };
  },
});

export const createSingleSelectionModel = (scene: Scene): SelectionModel => ({
  selectedId: scene.selection,
});
