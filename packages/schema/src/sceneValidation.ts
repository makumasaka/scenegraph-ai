import { SceneGraphSchema, type Scene } from './schemas';

export const validateScene = (scene: unknown): scene is Scene =>
  SceneGraphSchema.safeParse(scene).success;

/** Returns a parsed scene graph or null if validation fails. */
export const parseSceneGraph = (scene: unknown): Scene | null => {
  const r = SceneGraphSchema.safeParse(scene);
  return r.success ? r.data : null;
};

export const cloneSceneImmutable = (scene: Scene): Scene => ({
  rootId: scene.rootId,
  selection: scene.selection,
  nodes: { ...scene.nodes },
});
