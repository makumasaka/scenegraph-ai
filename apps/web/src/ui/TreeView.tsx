import { useSceneStore } from '../store/sceneStore';
import type { Scene } from '@diorama/core';

interface TreeRowProps {
  scene: Scene;
  nodeId: string;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function TreeRow({ scene, nodeId, depth, selectedId, onSelect }: TreeRowProps) {
  const node = scene.nodes[nodeId];
  if (!node) return null;

  const isSelected = selectedId === nodeId;
  const isRoot = nodeId === scene.rootId;
  const semantic = node.semanticRole
    ? `${node.semanticRole}${node.semanticGroupId ? ` @ ${node.semanticGroupId}` : ''}`
    : `${node.type}${node.visible ? '' : ' hidden'} - ${node.children.length} child${node.children.length === 1 ? '' : 'ren'}`;

  return (
    <div className="tree-group">
      <button
        type="button"
        className={`tree-row${isSelected ? ' tree-row--selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onSelect(nodeId)}
      >
        <span className="tree-row__name">{node.name}</span>
        <span className="tree-row__meta">
          {isRoot ? 'root' : semantic}
        </span>
      </button>
      {node.children.map((childId) => (
        <TreeRow
          key={childId}
          scene={scene}
          nodeId={childId}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export function TreeView() {
  const scene = useSceneStore((s) => s.scene);
  const select = useSceneStore((s) => s.select);
  const selectedId = scene.selection;

  return (
    <div className="tree-view">
      <div className="tree-view__header">Scene</div>
      <div className="tree-view__body">
        <TreeRow
          scene={scene}
          nodeId={scene.rootId}
          depth={0}
          selectedId={selectedId}
          onSelect={select}
        />
      </div>
    </div>
  );
}
