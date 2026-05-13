import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { RuntimeScene, createRuntimeNodeRegistry } from '@diorama/r3f-bridge';
import { useMemo } from 'react';
import { useSceneStore } from '../store/sceneStore';

export function Viewport() {
  const { scene, gizmoMode, dispatch, select } = useSceneStore(
    useShallow((s) => ({
      scene: s.scene,
      gizmoMode: s.gizmoMode,
      dispatch: s.dispatch,
      select: s.select,
    })),
  );
  const registry = useMemo(() => createRuntimeNodeRegistry(), []);
  const root = scene.nodes[scene.rootId];

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

        {root ? (
          <RuntimeScene
            scene={scene}
            selectedId={scene.selection}
            gizmoMode={gizmoMode}
            registry={registry}
            onCommand={dispatch}
            onSelect={select}
          />
        ) : null}

        <OrbitControls makeDefault enableDamping />
      </Canvas>
    </div>
  );
}
