import {
  applyCommandWithResult,
  createEmptyScene,
  type Command,
  type CommandSummary,
} from '@diorama/core';
import { exportSceneToR3fJsx, exportSceneToR3fModule } from '@diorama/export-r3f';
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

export type ActionSource = 'agent' | 'ui' | 'system' | 'import';

export type ApplyCommandOptions = {
  /** When true, computes the next scene but does not update session state. */
  dryRun?: boolean;
  /** Identifies the caller for the deterministic in-memory action log. */
  source?: ActionSource;
};

export type ApplyCommandResult = {
  scene: Scene;
  changed: boolean;
  dryRun: boolean;
  summary: CommandSummary;
  warnings?: string[];
};

export type ExportSceneResult = {
  format: ExportSceneParams['format'];
  content: string;
  mediaType: ExportMediaType;
};

export type CommandBatchItemResult = {
  index: number;
  changed: boolean;
  summary: CommandSummary;
  warnings?: string[];
};

export type CommandBatchError = {
  index: number;
  code: 'COMMAND_REJECTED';
  message: string;
};

export type CommandBatchResult = {
  scene: Scene;
  changed: boolean;
  dryRun: boolean;
  results: CommandBatchItemResult[];
  errors: CommandBatchError[];
  warnings: string[];
  appliedCommandCount: number;
  failedCommandIndex?: number;
};

export type ActionLogEntry = {
  sequence: number;
  source: ActionSource;
  operation: 'command' | 'command_batch' | 'load_scene';
  dryRun: boolean;
  changed: boolean;
  command?: Command;
  commands?: Command[];
  summary?: CommandSummary;
  results?: CommandBatchItemResult[];
  error?: string;
  warnings?: string[];
};

/**
 * Small typed surface for agents: reads return clones, writes go only through
 * validated commands (or validated full-graph loads).
 */
export type DioramaSceneRuntime = {
  getScene(): AgentResult<{ scene: Scene }>;
  getSelection(): AgentResult<{ selection: string | null }>;
  dryRunCommand(input: unknown): AgentResult<ApplyCommandResult>;
  applyCommand(
    input: unknown,
    options?: ApplyCommandOptions,
  ): AgentResult<ApplyCommandResult>;
  dryRunCommandBatch(input: unknown): AgentResult<CommandBatchResult>;
  applyCommandBatch(
    input: unknown,
    options?: ApplyCommandOptions,
  ): AgentResult<CommandBatchResult>;
  getCommandLog(): AgentResult<{ entries: ActionLogEntry[] }>;
  loadScene(input: unknown): AgentResult<{ scene: Scene }>;
  exportScene(input: unknown): AgentResult<ExportSceneResult>;
  undo?: () => AgentResult<{ scene: Scene }>;
  redo?: () => AgentResult<{ scene: Scene }>;
};

export type AgentSession = DioramaSceneRuntime;

const validationError = (message: string, issues?: ReturnType<typeof issuesFromZod>) =>
  err({
    code: 'VALIDATION_ERROR',
    message,
    issues,
  });

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const cloneCommand = (command: Command): Command => cloneJson(command);

const cloneCommands = (commands: Command[]): Command[] => commands.map(cloneCommand);

const cloneActionLogEntry = (entry: ActionLogEntry): ActionLogEntry => cloneJson(entry);

const flattenWarnings = (results: CommandBatchItemResult[]): string[] =>
  results.flatMap((result) => result.warnings ?? []);

export const createAgentSession = (initialScene?: Scene): AgentSession => {
  let scene: Scene = cloneSceneFromJson(initialScene ?? createEmptyScene());
  let nextLogSequence = 1;
  const actionLog: ActionLogEntry[] = [];

  const appendLog = (entry: Omit<ActionLogEntry, 'sequence'>) => {
    actionLog.push({
      sequence: nextLogSequence,
      ...entry,
    });
    nextLogSequence += 1;
  };

  const runCommand = (
    command: Command,
    dryRun: boolean,
    source: ActionSource,
  ): AgentResult<ApplyCommandResult> => {
    const result = applyCommandWithResult(scene, command);
    if (result.error !== undefined) {
      return err({
        code: 'COMMAND_REJECTED',
        message: result.error,
      });
    }
    const next = result.scene;
    const changed = result.changed;
    const payload: ApplyCommandResult = {
      scene: cloneSceneFromJson(next),
      changed,
      dryRun,
      summary: result.summary,
    };
    if (result.warnings !== undefined) payload.warnings = result.warnings;
    if (!dryRun) {
      scene = next;
      appendLog({
        source,
        operation: 'command',
        dryRun: false,
        changed,
        command: cloneCommand(command),
        summary: result.summary,
        ...(result.warnings !== undefined ? { warnings: result.warnings } : {}),
      });
    }
    return ok(payload);
  };

  const parseCommandBatch = (input: unknown): AgentResult<Command[]> => {
    const parsed = CommandSchema.array().safeParse(input);
    if (!parsed.success) {
      return validationError('Invalid command batch payload', issuesFromZod(parsed.error));
    }
    return ok(parsed.data);
  };

  const runCommandBatch = (
    commands: Command[],
    dryRun: boolean,
    source: ActionSource,
  ): AgentResult<CommandBatchResult> => {
    let workingScene = scene;
    const results: CommandBatchItemResult[] = [];
    let changed = false;

    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index] as Command;
      const result = applyCommandWithResult(workingScene, command);
      if (result.error !== undefined) {
        const warnings = flattenWarnings(results);
        return ok({
          scene: cloneSceneFromJson(scene),
          changed: false,
          dryRun,
          results,
          errors: [
            {
              index,
              code: 'COMMAND_REJECTED',
              message: result.error,
            },
          ],
          warnings,
          appliedCommandCount: 0,
          failedCommandIndex: index,
        });
      }
      const item: CommandBatchItemResult = {
        index,
        changed: result.changed,
        summary: result.summary,
      };
      if (result.warnings !== undefined) item.warnings = result.warnings;
      results.push(item);
      changed = changed || result.changed;
      workingScene = result.scene;
    }

    const warnings = flattenWarnings(results);
    const payload: CommandBatchResult = {
      scene: cloneSceneFromJson(workingScene),
      changed,
      dryRun,
      results,
      errors: [],
      warnings,
      appliedCommandCount: dryRun ? 0 : commands.length,
    };
    if (!dryRun) {
      scene = workingScene;
      appendLog({
        source,
        operation: 'command_batch',
        dryRun: false,
        changed,
        commands: cloneCommands(commands),
        results: cloneJson(results),
        ...(warnings.length > 0 ? { warnings } : {}),
      });
    }
    return ok(payload);
  };

  return {
    getScene() {
      return ok({ scene: cloneSceneFromJson(scene) });
    },

    getSelection() {
      return ok({ selection: scene.selection });
    },

    dryRunCommand(input: unknown) {
      const parsed = CommandSchema.safeParse(input);
      if (!parsed.success) {
        return validationError('Invalid command payload', issuesFromZod(parsed.error));
      }
      return runCommand(parsed.data, true, 'agent');
    },

    applyCommand(input: unknown, options?: ApplyCommandOptions) {
      const parsed = CommandSchema.safeParse(input);
      if (!parsed.success) {
        return validationError('Invalid command payload', issuesFromZod(parsed.error));
      }
      const command: Command = parsed.data;
      const dryRun = options?.dryRun === true;
      return runCommand(command, dryRun, options?.source ?? 'agent');
    },

    dryRunCommandBatch(input: unknown) {
      const parsed = parseCommandBatch(input);
      if (!parsed.ok) return parsed;
      return runCommandBatch(parsed.data, true, 'agent');
    },

    applyCommandBatch(input: unknown, options?: ApplyCommandOptions) {
      const parsed = parseCommandBatch(input);
      if (!parsed.ok) return parsed;
      return runCommandBatch(parsed.data, options?.dryRun === true, options?.source ?? 'agent');
    },

    getCommandLog() {
      return ok({ entries: actionLog.map(cloneActionLogEntry) });
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
      appendLog({
        source: 'import',
        operation: 'load_scene',
        dryRun: false,
        changed: true,
      });
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
      if (p.r3f?.mode === 'module') {
        return ok({
          format: 'r3f',
          content: exportSceneToR3fModule(scene, p.r3f).code,
          mediaType: mediaTypeForFormat('r3f'),
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
