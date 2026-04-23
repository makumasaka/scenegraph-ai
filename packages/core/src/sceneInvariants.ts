import type { Scene } from '@diorama/schema';
import { validateScene } from '@diorama/schema';

/**
 * Throws when the scene graph fails schema-level graph refinements.
 * Used by property-style tests as a single choke point for invariants.
 */
export const assertSceneGraphInvariants = (scene: Scene): void => {
  if (!validateScene(scene)) {
    throw new Error('Scene failed validateScene graph checks');
  }
};
