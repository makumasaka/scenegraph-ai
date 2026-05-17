import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { DioramaiScene } from './generated/DioramaiScene.generated';

export function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f172a' }}>
      <Canvas camera={{ position: [3, 2, 5], fov: 50 }}>
        <OrbitControls />
        <DioramaiScene />
      </Canvas>
    </div>
  );
}
