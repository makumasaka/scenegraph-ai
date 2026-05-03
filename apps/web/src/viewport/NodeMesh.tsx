import {
  useState,
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
  const [isHovered, setIsHovered] = useState(false);

  const { node, hasHoverHighlight, isSelected, gizmoMode, dispatch, select } = useSceneStore(
    useShallow((s) => {
      const self = s.scene.nodes[nodeId];
      const behaviorRefs = self?.behaviorRefs ?? [];
      const hasHover = behaviorRefs.some(
        (id) => s.scene.behaviors?.[id]?.type === 'hover_highlight',
      );
      const isSel = s.scene.selection === nodeId;
      return {
        node: self,
        hasHoverHighlight: Boolean(self?.behaviors?.hoverHighlight) || hasHover,
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
    if (isHovered && hasHoverHighlight) return '#38bdf8';
    let hash = 0;
    for (let i = 0; i < nodeId.length; i += 1) {
      hash = (hash * 31 + nodeId.charCodeAt(i)) >>> 0;
    }
    const hue = hash % 360;
    return `hsl(${hue}, 65%, 55%)`;
  }, [hasHoverHighlight, isHovered, isSelected, nodeId]);

  if (!node || node.visible === false) return null;

  const handleClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    select(nodeId);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>): void => {
    e.stopPropagation();
    if (hasHoverHighlight) setIsHovered(true);
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>): void => {
    e.stopPropagation();
    if (isHovered) setIsHovered(false);
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
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
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
              emissive={isSelected ? '#f59e0b' : isHovered ? '#0284c7' : '#000000'}
              emissiveIntensity={isSelected ? 0.35 : isHovered ? 0.28 : 0}
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
