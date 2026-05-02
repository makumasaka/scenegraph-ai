import { z } from 'zod';
import type { Command } from '@diorama/core';
import {
  InteractionBehaviorSchema,
  SceneGraphSchema,
  SceneNodeSchema,
  SemanticRoleSchema,
  Vec3Schema,
} from '@diorama/schema';

export const COMMAND_TYPES = [
  'ADD_NODE',
  'DELETE_NODE',
  'UPDATE_TRANSFORM',
  'CREATE_SEMANTIC_GROUP',
  'SET_NODE_SEMANTICS',
  'ADD_BEHAVIOR',
  'STRUCTURE_SHOWROOM_SCENE',
  'DUPLICATE_NODE',
  'SET_PARENT',
  'ARRANGE_NODES',
  'SET_SELECTION',
  'REPLACE_SCENE',
] as const satisfies readonly Command['type'][];

type CommandTypeParity = Record<Command['type'], true>;

export const COMMAND_SCHEMA_PARITY: CommandTypeParity = {
  ADD_NODE: true,
  DELETE_NODE: true,
  UPDATE_TRANSFORM: true,
  CREATE_SEMANTIC_GROUP: true,
  SET_NODE_SEMANTICS: true,
  ADD_BEHAVIOR: true,
  STRUCTURE_SHOWROOM_SCENE: true,
  DUPLICATE_NODE: true,
  SET_PARENT: true,
  ARRANGE_NODES: true,
  SET_SELECTION: true,
  REPLACE_SCENE: true,
};

const TransformPatchSchema = z
  .object({
    position: Vec3Schema.optional(),
    rotation: Vec3Schema.optional(),
    scale: Vec3Schema.optional(),
  })
  .strict()
  .refine(
    (p) =>
      p.position !== undefined ||
      p.rotation !== undefined ||
      p.scale !== undefined,
    { message: 'patch must include at least one of position, rotation, scale' },
  );

const ArrangeLayoutSchema = z.enum(['line', 'grid', 'circle']);

const ArrangeOptionsSchema = z
  .object({
    spacing: z.number().finite().optional(),
    cols: z.number().int().positive().optional(),
    radius: z.number().finite().optional(),
    axis: z.enum(['x', 'y', 'z']).optional(),
  })
  .strict();

/**
 * Zod mirror of {@link Command} for validating untrusted agent payloads before
 * they reach the core reducer.
 *
 * Input is intentionally `unknown`-shaped JSON; output is narrowed to {@link Command}.
 *
 * Convention: any future core command union change must update this file,
 * docs/COMMANDS.md, core command tests, and agent-interface validation tests.
 */
export const CommandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('ADD_NODE'),
      parentId: z.string().min(1),
      node: SceneNodeSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('DELETE_NODE'),
      nodeId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal('UPDATE_TRANSFORM'),
      nodeId: z.string().min(1),
      patch: TransformPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('CREATE_SEMANTIC_GROUP'),
      groupId: z.string().min(1),
      name: z.string(),
      role: SemanticRoleSchema,
      nodeIds: z.array(z.string().min(1)),
    })
    .strict(),
  z
    .object({
      type: z.literal('SET_NODE_SEMANTICS'),
      nodeIds: z.array(z.string().min(1)),
      semanticRole: SemanticRoleSchema,
      semanticGroupId: z.string().min(1).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('ADD_BEHAVIOR'),
      nodeIds: z.array(z.string().min(1)),
      behavior: InteractionBehaviorSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('STRUCTURE_SHOWROOM_SCENE'),
    })
    .strict(),
  z
    .object({
      type: z.literal('DUPLICATE_NODE'),
      nodeId: z.string().min(1),
      includeSubtree: z.boolean(),
      newParentId: z.string().min(1).optional(),
      idMap: z.record(z.string().min(1), z.string().min(1)).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('SET_PARENT'),
      nodeId: z.string().min(1),
      parentId: z.string().min(1),
      preserveWorldTransform: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('ARRANGE_NODES'),
      nodeIds: z.array(z.string().min(1)),
      layout: ArrangeLayoutSchema,
      options: ArrangeOptionsSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('REPLACE_SCENE'),
      scene: SceneGraphSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('SET_SELECTION'),
      nodeId: z.string().min(1).nullable(),
    })
    .strict(),
]) as z.ZodType<Command>;
