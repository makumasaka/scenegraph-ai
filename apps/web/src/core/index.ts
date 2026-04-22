export type { Vec3, Transform, SceneNode, Scene } from './types';
export {
  createEmptyScene,
  createNode,
  createId,
  identityTransform,
  getNode,
  getChildren,
  getParent,
  isDescendant,
  collectSubtreeIds,
} from './scene';
export type { CreateNodeInput } from './scene';
export { applyCommand, applyReparent } from './commands';
export type { Command } from './commands';
export { mergeTransform, transformEqual, isEmptyPatch, vec3Equal } from './transform';
export type { TransformPatch } from './transform';
export { computeArrangement } from './layout';
export type { ArrangeLayout, ArrangeOptions } from './layout';
export {
  duplicateNodeInScene,
  collectSubtreeBfsOrder,
} from './duplicate';
export { validateScene, cloneSceneImmutable } from './sceneValidation';
export { serializeScene, parseSceneJson, cloneSceneFromJson } from './sceneJson';
export { summarizeCommand } from './commandLog';
export type { CommandSummary } from './commandLog';
export {
  getStarterScene,
  defaultFixtureScene,
  showroomScene,
  galleryScene,
} from './fixtures';
export type { StarterKitId } from './fixtures';
