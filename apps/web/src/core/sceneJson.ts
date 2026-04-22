import { validateScene } from './sceneValidation';
import type { Scene } from './types';

export const serializeScene = (scene: Scene): string =>
  JSON.stringify(scene, null, 2);

export const parseSceneJson = (text: string): Scene | null => {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!validateScene(parsed)) return null;
    return cloneSceneFromJson(parsed);
  } catch {
    return null;
  }
};

/** Deep-clone a validated scene so callers cannot mutate shared fixture graphs. */
export const cloneSceneFromJson = (scene: Scene): Scene => ({
  rootId: scene.rootId,
  nodes: Object.fromEntries(
    Object.entries(scene.nodes).map(([id, node]) => [
      id,
      {
        ...node,
        children: [...node.children],
        transform: {
          position: [...node.transform.position] as [number, number, number],
          rotation: [...node.transform.rotation] as [number, number, number],
          scale: [...node.transform.scale] as [number, number, number],
        },
      },
    ]),
  ),
});
