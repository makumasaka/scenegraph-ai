import { useSceneStore } from '../store/sceneStore';
import { createNode, getParent, type Vec3 } from '../core';

const PALETTE: Vec3[] = [
  [0, 0.5, 0],
  [1.5, 0.5, 0],
  [-1.5, 0.5, 0],
  [0, 0.5, 1.5],
  [0, 0.5, -1.5],
  [1.5, 0.5, 1.5],
  [-1.5, 0.5, -1.5],
];

export function Toolbar() {
  const scene = useSceneStore((s) => s.scene);
  const selectedId = useSceneStore((s) => s.selectedId);
  const dispatch = useSceneStore((s) => s.dispatch);
  const reset = useSceneStore((s) => s.reset);

  const selectedNode = selectedId ? scene.nodes[selectedId] : null;
  const isRootSelected = selectedId === scene.rootId;
  const parentOfSelected = selectedId ? getParent(scene, selectedId) : undefined;

  const totalCubes = Object.keys(scene.nodes).length - 1;

  const handleAdd = () => {
    const parentId = selectedId ?? scene.rootId;
    const position = PALETTE[totalCubes % PALETTE.length];
    const node = createNode({
      name: `Cube ${totalCubes + 1}`,
      transform: { position },
    });
    dispatch({ type: 'ADD_NODE', parentId, node });
  };

  const handleDelete = () => {
    if (!selectedId || isRootSelected) return;
    dispatch({ type: 'DELETE_NODE', nodeId: selectedId });
  };

  const handleMoveToRoot = () => {
    if (!selectedId || isRootSelected) return;
    if (parentOfSelected?.id === scene.rootId) return;
    dispatch({ type: 'MOVE_NODE', nodeId: selectedId, newParentId: scene.rootId });
  };

  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__title">scenegraph-ai</span>
        <span className="toolbar__subtitle">MVP foundation</span>
      </div>

      <div className="toolbar__actions">
        <button type="button" onClick={handleAdd}>
          Add Cube
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={!selectedId || isRootSelected}
        >
          Delete Selected
        </button>
        <button
          type="button"
          onClick={handleMoveToRoot}
          disabled={
            !selectedId ||
            isRootSelected ||
            parentOfSelected?.id === scene.rootId
          }
          title="Reparent selected node under the root"
        >
          Move to Root
        </button>
        <button type="button" className="toolbar__ghost" onClick={reset}>
          Reset
        </button>
      </div>

      <div className="toolbar__status">
        {selectedNode ? (
          <>
            Selected: <strong>{selectedNode.name}</strong>
          </>
        ) : (
          <span className="toolbar__status--muted">No selection</span>
        )}
      </div>
    </header>
  );
}
