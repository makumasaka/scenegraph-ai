import { z } from 'zod';
import type { Command } from '@diorama/core';
import { SceneGraphSchema, SceneNodeSchema, Vec3Schema } from '@diorama/schema';

const TransformPatchSchema = z
  .object({
    position: Vec3Schema.optional(),
    rotation: Vec3Schema.optional(),
    scale: Vec3Schema.optional(),
  })
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
 */
export const CommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ADD_NODE'),
    parentId: z.string().min(1),
    node: SceneNodeSchema,
  }),
  z.object({
    type: z.literal('DELETE_NODE'),
    nodeId: z.string().min(1),
  }),
  z.object({
    type: z.literal('UPDATE_TRANSFORM'),
    nodeId: z.string().min(1),
    patch: TransformPatchSchema,
  }),
  z.object({
    type: z.literal('DUPLICATE_NODE'),
    nodeId: z.string().min(1),
    includeSubtree: z.boolean(),
    newParentId: z.string().min(1).optional(),
    idMap: z.record(z.string().min(1), z.string().min(1)).optional(),
  }),
  z.object({
    type: z.literal('SET_PARENT'),
    nodeId: z.string().min(1),
    parentId: z.string().min(1),
    preserveWorldTransform: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('ARRANGE_NODES'),
    nodeIds: z.array(z.string().min(1)),
    layout: ArrangeLayoutSchema,
    options: ArrangeOptionsSchema.optional(),
  }),
  z.object({
    type: z.literal('REPLACE_SCENE'),
    scene: SceneGraphSchema,
  }),
  z.object({
    type: z.literal('SET_SELECTION'),
    nodeId: z.string().min(1).nullable(),
  }),
]) as z.ZodType<Command>;
