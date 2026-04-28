export type {
  Vec3,
  Transform,
  SceneNode,
  Scene,
  NodeType,
  SceneLight,
  AssetRef,
  MaterialRef,
  Metadata,
  JsonValue,
} from './types';
export {
  SceneGraphSchema,
  SceneNodeSchema,
  NodeTypeSchema,
  MetadataSchema,
  JsonValueSchema,
  SceneLightSchema,
  TransformSchema,
  Vec3Schema,
  AssetRefSchema,
  MaterialRefSchema,
  SceneDocumentSchema,
  SCENE_DOCUMENT_FORMAT,
  SCENE_DATA_VERSION,
  SCENE_LEGACY_DATA_VERSION,
} from './schemas';
export type { SceneDocument } from './schemas';
export { validateScene, cloneSceneImmutable, parseSceneGraph } from './sceneValidation';
export {
  serializeScene,
  parseSceneJson,
  cloneSceneFromJson,
  stableStringify,
} from './sceneJson';
