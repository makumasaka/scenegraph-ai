import {
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
  type ReactNode,
  type RefObject,
} from 'react';
import { TransformControls } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { TransformControls as TransformControlsImpl } from 'three-stdlib';
import type { Group, Object3D } from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useSceneStore } from '../store/sceneStore';
import { transformPatchFromObject3D } from './object3dTransform';

interface NodeMeshProps {
  nodeId: string;
  children?: ReactNode;
}

function NodeMeshInner({ nodeId, children }: NodeMeshProps) {
  const groupRef = useRef<Group | null>(null);
  const tcRef = useRef<TransformControlsImpl | null>(null);

  const { node, isSelected, gizmoMode, dispatch, select } = useSceneStore(
    useShallow((s) => {
      const self = s.scene.nodes[nodeId];
      const isSel = s.scene.selection === nodeId;
      return {
        node: self,
        isSelected: isSel,
        gizmoMode: isSel ? s.gizmoMode : 'translate',
        dispatch: s.dispatch,
        select: s.select,
      };
    }),
  );

  const commitGizmo = useCallback(() => {
    const group = groupRef.current;
    if (!group) return;
    dispatch({
      type: 'UPDATE_TRANSFORM',
      nodeId,
      patch: transformPatchFromObject3D(group),
    });
  }, [dispatch, nodeId]);

  useLayoutEffect(() => {
    if (!isSelected) return;
    const c = tcRef.current as unknown as { addEventListener: (n: 'dragging-changed', f: (e: { value: boolean }) => void) => void; removeEventListener: (n: 'dragging-changed', f: (e: { value: boolean }) => void) => void };
    if (!c) return;
    const onDraggingChanged = (e: { value: boolean }): void => {
      if (e.value) return;
      commitGizmo();
    };
    c.addEventListener('dragging-changed', onDraggingChanged);
    return () => c.removeEventListener('dragging-changed', onDraggingChanged);
  }, [isSelected, commitGizmo]);

  const color = useMemo(() => {
    if (isSelected) return '#fbbf24';
    let hash = 0;
    for (let i = 0; i < nodeId.length; i += 1) {
      hash = (hash * 31 + nodeId.charCodeAt(i)) >>> 0;
    }
    const hue = hash % 360;
    return `hsl(${hue}, 65%, 55%)`;
  }, [isSelected, nodeId]);

  if (!node || node.visible === false) return null;

  const handleClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    select(nodeId);
  };

  const showLight = node.light !== undefined || node.type === 'light';
  const showMesh = node.type === 'mesh' && !showLight;

  return (
    <>
      <group
        ref={groupRef}
        position={node.transform.position}
        rotation={node.transform.rotation}
        scale={node.transform.scale}
        onClick={handleClick}
      >
        {showLight && node.light?.kind === 'ambient' ? (
          <ambientLight intensity={node.light.intensity ?? 0.4} />
        ) : null}
        {showLight && node.light?.kind === 'directional' ? (
          <directionalLight
            castShadow={node.light.castShadow}
            intensity={node.light.intensity ?? 1}
          />
        ) : null}
        {showMesh ? (
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={color}
              emissive={isSelected ? '#f59e0b' : '#000000'}
              emissiveIntensity={isSelected ? 0.35 : 0}
            />
          </mesh>
        ) : null}
        {children}
      </group>
      {isSelected ? (
        <TransformControls
          key={`tc-${nodeId}`}
          ref={tcRef}
          object={groupRef as RefObject<Object3D | null> as RefObject<Object3D>}
          mode={gizmoMode}
        />
      ) : null}
    </>
  );
}

export const NodeMesh = memo(NodeMeshInner);
