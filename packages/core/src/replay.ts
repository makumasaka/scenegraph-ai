import type { Scene } from '@diorama/schema';
import { applyCommand, type Command } from './commands';

/**
 * Deterministically rebuilds scene state by replaying commands from a base scene snapshot.
 */
export const replayCommands = (baseScene: Scene, commands: Command[]): Scene => {
  let next = baseScene;
  for (const command of commands) {
    next = applyCommand(next, command);
  }
  return next;
};
