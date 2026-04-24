import {
  applyCommand,
  createEmptyScene,
  type Command,
} from '@diorama/core';
import { exportSceneToR3fJsx } from '@diorama/export-r3f';
import {
  cloneSceneFromJson,
  parseSceneJson,
  serializeScene,
  validateScene,
  type Scene,
} from '@diorama/schema';
import { CommandSchema } from './commandSchema';
import {
  ExportSceneParamsSchema,
  mediaTypeForFormat,
  type ExportMediaType,
  type ExportSceneParams,
} from './exportParams';
import { err, issuesFromZod, ok, type AgentResult } from './errors';
import { LoadSceneInputSchema } from './loadSceneInput';

export type ApplyCommandOptions = {
  /** When true, computes the next scene but does not update session state. */
  dryRun?: boolean;
};

export type ApplyCommandResult = {
  scene: Scene;
  changed: boolean;
  dryRun: boolean;
};

export type ExportSceneResult = {
  format: ExportSceneParams['format'];
  content: string;
  mediaType: ExportMediaType;
};

/**
 * Small typed surface for agents: reads return clones, writes go only through
 * validated commands (or validated full-graph loads).
 */
export type AgentSession = {
  getScene(): AgentResult<{ scene: Scene }>;
  getSelection(): AgentResult<{ selection: string | null }>;
  applyCommand(
    input: unknown,
    options?: ApplyCommandOptions,
  ): AgentResult<ApplyCommandResult>;
  loadScene(input: unknown): AgentResult<{ scene: Scene }>;
  exportScene(input: unknown): AgentResult<ExportSceneResult>;
};

const validationError = (message: string, issues?: ReturnType<typeof issuesFromZod>) =>
  err({
    code: 'VALIDATION_ERROR',
    message,
    issues,
  });

export const createAgentSession = (initialScene?: Scene): AgentSession => {
  let scene: Scene = cloneSceneFromJson(initialScene ?? createEmptyScene());

  return {
    getScene() {
      return ok({ scene: cloneSceneFromJson(scene) });
    },

    getSelection() {
      return ok({ selection: scene.selection });
    },

    applyCommand(input: unknown, options?: ApplyCommandOptions) {
      const parsed = CommandSchema.safeParse(input);
      if (!parsed.success) {
        return validationError('Invalid command payload', issuesFromZod(parsed.error));
      }
      const command: Command = parsed.data;
      const dryRun = options?.dryRun === true;
      const next = applyCommand(scene, command);
      const changed = next !== scene;
      const snapshot = cloneSceneFromJson(next);
      if (!dryRun) {
        scene = next;
      }
      return ok({ scene: snapshot, changed, dryRun });
    },

    loadScene(input: unknown) {
      const parsed = LoadSceneInputSchema.safeParse(input);
      if (!parsed.success) {
        return validationError('Invalid loadScene payload', issuesFromZod(parsed.error));
      }
      let next: Scene | null = null;
      if (parsed.data.kind === 'json') {
        next = parseSceneJson(parsed.data.json);
        if (next === null) {
          return err({
            code: 'PARSE_ERROR',
            message: 'Scene JSON could not be parsed',
          });
        }
      } else {
        next = cloneSceneFromJson(parsed.data.scene);
      }
      if (!validateScene(next)) {
        return err({
          code: 'SCENE_INVALID',
          message: 'Scene graph failed validation',
        });
      }
      scene = cloneSceneFromJson(next);
      return ok({ scene: cloneSceneFromJson(scene) });
    },

    exportScene(input: unknown) {
      const parsed = ExportSceneParamsSchema.safeParse(input);
      if (!parsed.success) {
        return validationError('Invalid exportScene payload', issuesFromZod(parsed.error));
      }
      const p: ExportSceneParams = parsed.data;
      if (p.format === 'json') {
        return ok({
          format: 'json',
          content: serializeScene(scene),
          mediaType: mediaTypeForFormat('json'),
        });
      }
      return ok({
        format: 'r3f',
        content: exportSceneToR3fJsx(scene, p.r3f ?? {}),
        mediaType: mediaTypeForFormat('r3f'),
      });
    },
  };
};
