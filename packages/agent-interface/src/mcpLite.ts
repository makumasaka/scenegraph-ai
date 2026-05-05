import { z } from 'zod';
import type {
  BehaviorDefinition,
  Scene,
  SemanticGroup,
} from '@diorama/schema';
import { SemanticRoleSchema } from '@diorama/schema';
import type { Command } from '@diorama/core';
import {
  type ArrangeLayout,
  type ArrangeOptions,
} from '@diorama/core';
import {
  createAgentSession,
  type AgentSession,
  type ApplyCommandResult,
  type CommandBatchResult,
  type ExportSceneResult,
} from './session';
import {
  err,
  issuesFromZod,
  ok,
  type AgentResult,
} from './errors';

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const validationError = (message: string, error: z.ZodError) =>
  err({
    code: 'VALIDATION_ERROR',
    message,
    issues: issuesFromZod(error),
  });

const DryRunOptionSchema = z
  .object({
    dryRun: z.boolean().optional(),
  })
  .strict();

export const StructureSceneInputSchema = DryRunOptionSchema.extend({
  preset: z.literal('showroom').optional(),
});

export type StructureSceneInput = z.infer<typeof StructureSceneInputSchema>;

export const MakeInteractiveInputSchema = DryRunOptionSchema.extend({
  targetRole: SemanticRoleSchema.optional(),
});

export type MakeInteractiveInput = z.infer<typeof MakeInteractiveInputSchema>;

const ArrangeOptionsSchema = z
  .object({
    spacing: z.number().finite().optional(),
    cols: z.number().int().positive().optional(),
    radius: z.number().finite().optional(),
    axis: z.enum(['x', 'y', 'z']).optional(),
  })
  .strict();

export const ArrangeNodesInputSchema = DryRunOptionSchema.extend({
  nodeIds: z.array(z.string().min(1)),
  layout: z.enum(['line', 'grid', 'circle']),
  options: ArrangeOptionsSchema.optional(),
});

export type ArrangeNodesInput = z.infer<typeof ArrangeNodesInputSchema>;

export const ExportR3FInputSchema = z
  .object({
    includeStudioLights: z.boolean().optional(),
    includeLights: z.boolean().optional(),
    mode: z.enum(['fragment', 'module']).optional(),
    componentName: z.string().min(1).optional(),
    semanticComponents: z.boolean().optional(),
    behaviorScaffold: z.enum(['none', 'comments', 'handlers']).optional(),
    includeUserData: z.boolean().optional(),
  })
  .strict();

export type ExportR3FInput = z.infer<typeof ExportR3FInputSchema>;

export type McpLiteRuntime = {
  getScene(): AgentResult<{ scene: Scene }>;
  getSemanticGroups(): AgentResult<{ semanticGroups: Record<string, SemanticGroup> }>;
  getBehaviors(): AgentResult<{ behaviors: Record<string, BehaviorDefinition> }>;
  dryRunCommand(input: unknown): AgentResult<ApplyCommandResult>;
  applyCommand(input: unknown): AgentResult<ApplyCommandResult>;
  dryRunCommandBatch(input: unknown): AgentResult<CommandBatchResult>;
  applyCommandBatch(input: unknown): AgentResult<CommandBatchResult>;
  structureScene(input?: unknown): AgentResult<ApplyCommandResult>;
  makeInteractive(input?: unknown): AgentResult<ApplyCommandResult>;
  arrangeNodes(input: unknown): AgentResult<ApplyCommandResult>;
  exportR3F(input?: unknown): AgentResult<ExportSceneResult>;
  exportJSON(): AgentResult<ExportSceneResult>;
  /** Exposes the underlying safe runtime for tests and future transport adapters. */
  runtime: AgentSession;
};

const commandResult = (
  runtime: AgentSession,
  command: Command,
  dryRun: boolean | undefined,
): AgentResult<ApplyCommandResult> =>
  dryRun === true
    ? runtime.dryRunCommand(command)
    : runtime.applyCommand(command, { source: 'agent' });

export const createMcpLiteRuntime = (initialScene?: Scene): McpLiteRuntime => {
  const runtime = createAgentSession(initialScene);

  return {
    runtime,

    getScene() {
      return runtime.getScene();
    },

    getSemanticGroups() {
      const scene = runtime.getScene();
      if (!scene.ok) return scene;
      return ok({
        semanticGroups: cloneJson(scene.data.scene.semanticGroups ?? {}),
      });
    },

    getBehaviors() {
      const scene = runtime.getScene();
      if (!scene.ok) return scene;
      return ok({
        behaviors: cloneJson(scene.data.scene.behaviors ?? {}),
      });
    },

    dryRunCommand(input: unknown) {
      return runtime.dryRunCommand(input);
    },

    applyCommand(input: unknown) {
      return runtime.applyCommand(input, { source: 'agent' });
    },

    dryRunCommandBatch(input: unknown) {
      return runtime.dryRunCommandBatch(input);
    },

    applyCommandBatch(input: unknown) {
      return runtime.applyCommandBatch(input, { source: 'agent' });
    },

    structureScene(input: unknown = {}) {
      const parsed = StructureSceneInputSchema.safeParse(input ?? {});
      if (!parsed.success) {
        return validationError('Invalid structureScene payload', parsed.error);
      }
      return commandResult(
        runtime,
        { type: 'STRUCTURE_SCENE', preset: parsed.data.preset ?? 'showroom' },
        parsed.data.dryRun,
      );
    },

    makeInteractive(input: unknown = {}) {
      const parsed = MakeInteractiveInputSchema.safeParse(input ?? {});
      if (!parsed.success) {
        return validationError('Invalid makeInteractive payload', parsed.error);
      }
      return commandResult(
        runtime,
        {
          type: 'MAKE_INTERACTIVE',
          ...(parsed.data.targetRole !== undefined ? { targetRole: parsed.data.targetRole } : {}),
        },
        parsed.data.dryRun,
      );
    },

    arrangeNodes(input: unknown) {
      const parsed = ArrangeNodesInputSchema.safeParse(input);
      if (!parsed.success) {
        return validationError('Invalid arrangeNodes payload', parsed.error);
      }
      return commandResult(
        runtime,
        {
          type: 'ARRANGE_NODES',
          nodeIds: parsed.data.nodeIds,
          layout: parsed.data.layout as ArrangeLayout,
          ...(parsed.data.options !== undefined
            ? { options: parsed.data.options as ArrangeOptions }
            : {}),
        },
        parsed.data.dryRun,
      );
    },

    exportR3F(input: unknown = {}) {
      const parsed = ExportR3FInputSchema.safeParse(input ?? {});
      if (!parsed.success) {
        return validationError('Invalid exportR3F payload', parsed.error);
      }
      return runtime.exportScene({ format: 'r3f', r3f: parsed.data });
    },

    exportJSON() {
      return runtime.exportScene({ format: 'json' });
    },
  };
};
