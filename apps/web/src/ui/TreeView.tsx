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
  const role = node.semantics?.role ?? node.semanticRole;
  const groupId = node.semantics?.groupId ?? node.semanticGroupId;
  const semantic = role
    ? `${role}${groupId ? ` @ ${groupId}` : ''}`
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
        {scene.semanticGroups && Object.keys(scene.semanticGroups).length > 0 ? (
          <div className="semantic-groups">
            <div className="semantic-groups__label">Semantic Groups</div>
            {Object.values(scene.semanticGroups).map((group) => (
              <div key={group.id} className="semantic-groups__row">
                <span>{group.name}</span>
                <span>{group.role} - {group.nodeIds.length}</span>
              </div>
            ))}
          </div>
        ) : null}
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
