export type {
  Vec3,
  Transform,
  SceneNode,
  Scene,
  NodeType,
  Metadata,
  JsonValue,
} from '@diorama/schema';
export {
  serializeScene,
  parseSceneJson,
  cloneSceneFromJson,
  validateScene,
  cloneSceneImmutable,
} from '@diorama/schema';
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
  getAncestorPath,
} from './scene';
export { getWorldMatrix, matrixToTransform } from './worldTransform';
export type { CreateNodeInput } from './scene';
export { applyCommand, applyCommandWithResult, applyReparent } from './commands';
export type { Command, CommandResult } from './commands';
export {
  mergeTransform,
  transformEqual,
  isEmptyPatch,
  vec3Equal,
} from './transform';
export type { TransformPatch } from './transform';
export { computeArrangement } from './layout';
export type { ArrangeLayout, ArrangeOptions } from './layout';
export {
  duplicateNodeInScene,
  collectSubtreeBfsOrder,
} from './duplicate';
export { summarizeCommand } from './commandLog';
export type { CommandSummary } from './commandLog';
export { replayCommands } from './replay';
export {
  getStarterScene,
  defaultFixtureScene,
  showroomScene,
  galleryScene,
  livingSpaceScene,
} from './fixtures';
export type { StarterKitId } from './fixtures';
