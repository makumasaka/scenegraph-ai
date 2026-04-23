import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { useSceneStore } from '../store/sceneStore';
import { NodeMesh } from './NodeMesh';

function meshNodeIdsFromScene(rootId: string, nodes: Record<string, { id: string }>): string[] {
  return Object.keys(nodes)
    .filter((id) => id !== rootId)
    .sort();
}

function SceneNodes({ nodeIds }: { nodeIds: string[] }) {
  return (
    <>
      {nodeIds.map((id) => (
        <NodeMesh key={id} nodeId={id} />
      ))}
    </>
  );
}

export function Viewport() {
  const nodeIds = useSceneStore(
    useShallow((s) => meshNodeIdsFromScene(s.scene.rootId, s.scene.nodes)),
  );
  const select = useSceneStore((s) => s.select);

  return (
    <div className="viewport">
      <Canvas
        shadows
        camera={{ position: [5, 5, 7], fov: 50 }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={['#0f1115']} />
        <ambientLight intensity={0.4} />
        <directionalLight
          castShadow
          position={[5, 8, 5]}
          intensity={1.1}
          shadow-mapSize={[1024, 1024]}
        />

        <Grid
          position={[0, 0, 0]}
          args={[20, 20]}
          cellSize={1}
          cellThickness={0.6}
          cellColor="#2a2f3a"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#3b4252"
          fadeDistance={25}
          fadeStrength={1}
          infiniteGrid
        />

        <SceneNodes nodeIds={nodeIds} />

        <OrbitControls makeDefault enableDamping />
      </Canvas>
    </div>
  );
}
