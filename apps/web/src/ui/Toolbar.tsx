import { useSceneStore } from '../store/sceneStore';
import { createNode, getParent, type Scene, type Vec3 } from '@diorama/core';
import { SceneLoader } from './SceneLoader';

const PALETTE: Vec3[] = [
  [0, 0.5, 0],
  [1.5, 0.5, 0],
  [-1.5, 0.5, 0],
  [0, 0.5, 1.5],
  [0, 0.5, -1.5],
  [1.5, 0.5, 1.5],
  [-1.5, 0.5, -1.5],
];

const arrangeTargets = (scene: Scene, selectedId: string | null): string[] => {
  if (selectedId && scene.nodes[selectedId]) {
    const ch = scene.nodes[selectedId].children;
    if (ch.length > 0) return [...ch];
    if (selectedId !== scene.rootId) return [selectedId];
  }
  return [...scene.nodes[scene.rootId].children];
};

const showroomTargets = (scene: Scene): string[] =>
  Object.values(scene.nodes)
    .filter((node) => {
      if (node.id === scene.rootId || node.type === 'root') return false;
      if (node.semanticRole === 'product' || node.semanticRole === 'display') return true;
      const label = `${node.id} ${node.name}`.toLowerCase();
      return label.includes('product') || label.includes('display') || label.includes('plinth');
    })
    .map((node) => node.id);

export function Toolbar() {
  const scene = useSceneStore((s) => s.scene);
  const selectedId = scene.selection;
  const dispatch = useSceneStore((s) => s.dispatch);
  const reset = useSceneStore((s) => s.reset);
  const undo = useSceneStore((s) => s.undo);
  const redo = useSceneStore((s) => s.redo);
  const pastCount = useSceneStore((s) => s.past.length);
  const futureCount = useSceneStore((s) => s.future.length);

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
    dispatch({ type: 'SET_PARENT', nodeId: selectedId, parentId: scene.rootId });
  };

  const handleDuplicate = (includeSubtree: boolean) => {
    if (!selectedId || isRootSelected) return;
    dispatch({
      type: 'DUPLICATE_NODE',
      nodeId: selectedId,
      includeSubtree,
    });
  };

  const handleArrange = (layout: 'line' | 'grid' | 'circle') => {
    const nodeIds = arrangeTargets(scene, selectedId);
    if (nodeIds.length === 0) return;
    dispatch({ type: 'ARRANGE_NODES', nodeIds, layout });
  };

  const handleStructureShowroom = () => {
    dispatch({ type: 'STRUCTURE_SHOWROOM_SCENE' });
  };

  const handleMakeInteractive = () => {
    for (const nodeId of showroomTargets(scene)) {
      const node = scene.nodes[nodeId];
      if (!node) continue;
      dispatch({
        type: 'ADD_BEHAVIOR',
        nodeIds: [nodeId],
        behavior: {
          hoverHighlight: true,
          clickSelect: true,
          focusOnClick: true,
          info: {
            title: node.name,
            description: `${node.name} is ready for showroom hover and click interactions.`,
          },
        },
      });
    }
  };

  const handleArrangeProducts = () => {
    const nodeIds = showroomTargets(scene);
    if (nodeIds.length === 0) return;
    dispatch({
      type: 'ARRANGE_NODES',
      nodeIds,
      layout: 'grid',
      options: { spacing: 1.45, cols: 3 },
    });
  };

  return (
    <header className="toolbar">
      <div className="toolbar__primary">
        <div className="toolbar__brand">
          <span className="toolbar__title">Diorama</span>
          <span className="toolbar__subtitle">AI-native spatial canvas</span>
        </div>

        <div className="toolbar__actions">
          <button
            type="button"
            className="toolbar__demo-action"
            onClick={handleStructureShowroom}
          >
            Structure Scene
          </button>
          <button
            type="button"
            className="toolbar__demo-action"
            onClick={handleMakeInteractive}
          >
            Make Interactive
          </button>
          <button
            type="button"
            className="toolbar__demo-action"
            onClick={handleArrangeProducts}
          >
            Arrange Products
          </button>
          <div className="toolbar__divider" aria-hidden="true" />
          <div className="toolbar__group">
            <button
              type="button"
              onClick={undo}
              disabled={pastCount === 0}
              title="Undo (Ctrl/Cmd+Z)"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={futureCount === 0}
              title="Redo (Ctrl/Cmd+Shift+Z)"
            >
              Redo
            </button>
          </div>
          <div className="toolbar__divider" aria-hidden="true" />
          <button type="button" onClick={handleAdd}>
            Add Cube
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!selectedId || isRootSelected}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={handleMoveToRoot}
            disabled={
              !selectedId ||
              isRootSelected ||
              parentOfSelected?.id === scene.rootId
            }
            title="Reparent under root"
          >
            To root
          </button>
          <button
            type="button"
            onClick={() => handleDuplicate(false)}
            disabled={!selectedId || isRootSelected}
            title="Duplicate node only"
          >
            Dup
          </button>
          <button
            type="button"
            onClick={() => handleDuplicate(true)}
            disabled={!selectedId || isRootSelected}
            title="Duplicate subtree"
          >
            Dup tree
          </button>
          <div className="toolbar__divider" aria-hidden="true" />
          <button type="button" onClick={() => handleArrange('line')}>
            Line
          </button>
          <button type="button" onClick={() => handleArrange('grid')}>
            Grid
          </button>
          <button type="button" onClick={() => handleArrange('circle')}>
            Circle
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
      </div>

      <div className="toolbar__secondary">
        <SceneLoader />
      </div>
    </header>
  );
}
