import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { SceneNode } from '../core';
import { useSceneStore } from '../store/sceneStore';

interface NodeMeshProps {
  node: SceneNode;
}

export function NodeMesh({ node }: NodeMeshProps) {
  const selectedId = useSceneStore((s) => s.selectedId);
  const select = useSceneStore((s) => s.select);

  const isSelected = selectedId === node.id;

  const color = useMemo(() => {
    if (isSelected) return '#fbbf24';
    let hash = 0;
    for (let i = 0; i < node.id.length; i += 1) {
      hash = (hash * 31 + node.id.charCodeAt(i)) >>> 0;
    }
    const hue = hash % 360;
    return `hsl(${hue}, 65%, 55%)`;
  }, [isSelected, node.id]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select(node.id);
  };

  return (
    <mesh
      position={node.transform.position}
      rotation={node.transform.rotation}
      scale={node.transform.scale}
      onClick={handleClick}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={isSelected ? '#f59e0b' : '#000000'}
        emissiveIntensity={isSelected ? 0.35 : 0}
      />
    </mesh>
  );
}
