import type { Vec3 } from './types';
import {
  SCENE_DATA_VERSION,
  SCENE_DOCUMENT_FORMAT,
  SceneDocumentSchema,
  type Scene,
} from './schemas';
import { parseSceneGraph } from './sceneValidation';

/** Deterministic JSON: sorted object keys at every depth (arrays keep order). */
export const stableStringify = (value: unknown, space = 2): string => {
  const norm = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(norm);
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = norm(o[k]);
    return out;
  };
  return JSON.stringify(norm(value), null, space);
};

/**
 * Canonical JSON export: `diorama-scene` document wrapper, version tag, and
 * {@link stableStringify} so object keys sort lexicographically at every depth
 * (arrays such as `children` keep graph order).
 */
export const serializeScene = (scene: Scene): string => {
  const doc = {
    format: SCENE_DOCUMENT_FORMAT,
    version: SCENE_DATA_VERSION,
    data: scene,
  };
  return stableStringify(doc);
};

export const parseSceneJson = (text: string): Scene | null => {
  try {
    const parsed: unknown = JSON.parse(text);
    const doc = SceneDocumentSchema.safeParse(parsed);
    if (doc.success) return cloneSceneFromJson(doc.data.data);

    const legacy = parseSceneGraph(parsed);
    if (legacy) return cloneSceneFromJson(legacy);
    return null;
  } catch {
    return null;
  }
};

/** Deep-clone a validated scene so callers cannot mutate shared fixture graphs. */
export const cloneSceneFromJson = (scene: Scene): Scene => ({
  rootId: scene.rootId,
  selection: scene.selection,
  nodes: Object.fromEntries(
    Object.entries(scene.nodes).map(([id, node]) => [
      id,
      {
        ...node,
        children: [...node.children],
        transform: {
          position: [...node.transform.position] as Vec3,
          rotation: [...node.transform.rotation] as Vec3,
          scale: [...node.transform.scale] as Vec3,
        },
        type: node.type,
        visible: node.visible,
        metadata: { ...node.metadata },
        ...(node.assetRef !== undefined ? { assetRef: node.assetRef } : {}),
        ...(node.materialRef !== undefined ? { materialRef: node.materialRef } : {}),
        ...(node.light !== undefined ? { light: node.light } : {}),
      },
    ]),
  ),
});
