export type Vec3 = [number, number, number];

export interface Transform {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export interface SceneNode {
  id: string;
  name: string;
  children: string[];
  transform: Transform;
}

export interface Scene {
  rootId: string;
  nodes: Record<string, SceneNode>;
}
