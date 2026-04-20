import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { useSceneStore } from '../store/sceneStore';
import type { Scene } from '../core';
import { NodeMesh } from './NodeMesh';

function SceneNodes({ scene }: { scene: Scene }) {
  const meshes = Object.values(scene.nodes).filter(
    (n) => n.id !== scene.rootId,
  );
  return (
    <>
      {meshes.map((node) => (
        <NodeMesh key={node.id} node={node} />
      ))}
    </>
  );
}

export function Viewport() {
  const scene = useSceneStore((s) => s.scene);
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

        <SceneNodes scene={scene} />

        <OrbitControls makeDefault enableDamping />
      </Canvas>
    </div>
  );
}
