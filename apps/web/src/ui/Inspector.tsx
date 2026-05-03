import { useSceneStore } from '../store/sceneStore';
import { getParent, type TransformPatch, type Vec3 } from '@diorama/core';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

const toDeg = (v: Vec3): Vec3 => [
  v[0] * RAD_TO_DEG,
  v[1] * RAD_TO_DEG,
  v[2] * RAD_TO_DEG,
];

const toRad = (v: Vec3): Vec3 => [
  v[0] * DEG_TO_RAD,
  v[1] * DEG_TO_RAD,
  v[2] * DEG_TO_RAD,
];

interface Vec3EditorProps {
  label: string;
  value: Vec3;
  step?: number;
  onChange: (next: Vec3) => void;
}

const AXIS_LABELS = ['x', 'y', 'z'] as const;

function Vec3Editor({ label, value, step = 0.1, onChange }: Vec3EditorProps) {
  const handleAxis = (axis: 0 | 1 | 2) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const parsed = raw === '' || raw === '-' ? 0 : Number(raw);
    if (Number.isNaN(parsed)) return;
    const next: Vec3 = [value[0], value[1], value[2]];
    next[axis] = parsed;
    onChange(next);
  };

  return (
    <div className="vec3-editor">
      <span className="vec3-editor__label">{label}</span>
      <div className="vec3-editor__inputs">
        {AXIS_LABELS.map((axisLabel, i) => (
          <label key={axisLabel} className="vec3-editor__field">
            <span className={`vec3-editor__axis vec3-editor__axis--${axisLabel}`}>
              {axisLabel}
            </span>
            <input
              type="number"
              step={step}
              value={Number.isFinite(value[i]) ? round(value[i]) : 0}
              onChange={handleAxis(i as 0 | 1 | 2)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

export function Inspector() {
  const scene = useSceneStore((s) => s.scene);
  const dispatch = useSceneStore((s) => s.dispatch);
  const selectedId = scene.selection;

  const node = selectedId ? scene.nodes[selectedId] : null;

  if (!node || !selectedId) {
    return (
      <aside className="inspector">
        <div className="inspector__header">Inspector</div>
        <div className="inspector__empty">
          <p>No node selected.</p>
          <p className="inspector__hint">
            Click a node in the tree or a cube in the viewport.
          </p>
        </div>
      </aside>
    );
  }

  const parent = getParent(scene, selectedId);
  const isRoot = selectedId === scene.rootId;

  const update = (patch: TransformPatch) => {
    dispatch({ type: 'UPDATE_TRANSFORM', nodeId: selectedId, patch });
  };

  const rotationDeg = toDeg(node.transform.rotation);
  const semantics = node.semantics;
  const semanticGroupId = semantics?.groupId ?? node.semanticGroupId;
  const semanticGroup = semanticGroupId ? scene.semanticGroups?.[semanticGroupId] : undefined;
  const behaviorDefinitions = (node.behaviorRefs ?? [])
    .map((id) => scene.behaviors?.[id])
    .filter((behavior): behavior is NonNullable<typeof behavior> => Boolean(behavior));
  const infoBehavior = behaviorDefinitions.find((behavior) => behavior.type === 'show_info');
  const infoTitle =
    typeof infoBehavior?.params?.title === 'string'
      ? infoBehavior.params.title
      : node.behaviors?.info?.title;
  const infoDescription =
    typeof infoBehavior?.params?.description === 'string'
      ? infoBehavior.params.description
      : node.behaviors?.info?.description;

  return (
    <aside className="inspector">
      <div className="inspector__header">Inspector</div>

      <section className="inspector__section">
        <div className="inspector__row">
          <span className="inspector__key">Name</span>
          <span className="inspector__value">{node.name}</span>
        </div>
        <div className="inspector__row">
          <span className="inspector__key">ID</span>
          <span className="inspector__value inspector__value--mono" title={node.id}>
            {node.id.slice(0, 8)}
          </span>
        </div>
        <div className="inspector__row">
          <span className="inspector__key">Parent</span>
          <span className="inspector__value inspector__value--mono">
            {isRoot ? '-' : parent ? `${parent.name} (${parent.id.slice(0, 8)})` : '-'}
          </span>
        </div>
        <div className="inspector__row">
          <span className="inspector__key">Type</span>
          <span className="inspector__value">{node.type}</span>
        </div>
        <div className="inspector__row">
          <span className="inspector__key">Visible</span>
          <span className="inspector__value">{node.visible ? 'Yes' : 'No'}</span>
        </div>
        <div className="inspector__row">
          <span className="inspector__key">Metadata</span>
          <span className="inspector__value inspector__value--mono">
            {Object.keys(node.metadata).length}
          </span>
        </div>
      </section>

      <section className="inspector__section">
        <div className="inspector__section-title">Semantics</div>
        <div className="inspector__row">
          <span className="inspector__key">Role</span>
          <span className="inspector__value">{semantics?.role ?? node.semanticRole ?? 'unknown'}</span>
        </div>
        <div className="inspector__row">
          <span className="inspector__key">Group</span>
          <span className="inspector__value inspector__value--mono">
            {semanticGroup?.name ?? semanticGroupId ?? '-'}
          </span>
        </div>
        {semantics?.tags?.length ? (
          <div className="inspector__row">
            <span className="inspector__key">Tags</span>
            <span className="inspector__value">{semantics.tags.join(', ')}</span>
          </div>
        ) : null}
        {semantics?.description ? (
          <p className="inspector__description">{semantics.description}</p>
        ) : null}
        <div className="inspector__row">
          <span className="inspector__key">Hover</span>
          <span className="inspector__value">
            {node.behaviors?.hoverHighlight || behaviorDefinitions.some((b) => b.type === 'hover_highlight')
              ? 'Highlight'
              : '-'}
          </span>
        </div>
        <div className="inspector__row">
          <span className="inspector__key">Click</span>
          <span className="inspector__value">
            {node.behaviors?.clickSelect || behaviorDefinitions.some((b) => b.type === 'click_select')
              ? node.behaviors.focusOnClick
                ? 'Select + focus'
                : 'Select'
              : '-'}
          </span>
        </div>
        <div className="inspector__row">
          <span className="inspector__key">Behaviors</span>
          <span className="inspector__value inspector__value--mono">
            {behaviorDefinitions.length > 0
              ? behaviorDefinitions.map((behavior) => behavior.type).join(', ')
              : '-'}
          </span>
        </div>
        {infoTitle ? (
          <>
            <div className="inspector__row">
              <span className="inspector__key">Info</span>
              <span className="inspector__value">{infoTitle}</span>
            </div>
            {infoDescription ? (
              <p className="inspector__description">
                {infoDescription}
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="inspector__section">
        <div className="inspector__section-title">Transform</div>
        <Vec3Editor
          label="Position"
          value={node.transform.position}
          step={0.1}
          onChange={(position) => update({ position })}
        />
        <Vec3Editor
          label="Rotation"
          value={rotationDeg}
          step={1}
          onChange={(deg) => update({ rotation: toRad(deg) })}
        />
        <Vec3Editor
          label="Scale"
          value={node.transform.scale}
          step={0.1}
          onChange={(scale) => update({ scale })}
        />
      </section>
    </aside>
  );
}
