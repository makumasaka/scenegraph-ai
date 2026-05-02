import { z } from 'zod';

export const Vec3Schema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);

export type Vec3 = z.infer<typeof Vec3Schema>;

/** Local TRS transform. Rotation is Euler XYZ order in radians. */
export const TransformSchema = z.object({
  position: Vec3Schema,
  rotation: Vec3Schema,
  scale: Vec3Schema,
});

export type Transform = z.infer<typeof TransformSchema>;

export const AssetRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('uri'), uri: z.string().min(1) }),
]);

export type AssetRef = z.infer<typeof AssetRefSchema>;

export const MaterialRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('token'), token: z.string().min(1) }),
]);

export type MaterialRef = z.infer<typeof MaterialRefSchema>;

export const NodeTypeSchema = z.enum(['root', 'group', 'mesh', 'light', 'empty']);

export type NodeType = z.infer<typeof NodeTypeSchema>;

export const SemanticRoleSchema = z.enum([
  'product',
  'display',
  'seating',
  'light',
  'environment',
  'group',
  'unknown',
]);

export type SemanticRole = z.infer<typeof SemanticRoleSchema>;

export const InteractionBehaviorSchema = z
  .object({
    hoverHighlight: z.boolean().optional(),
    clickSelect: z.boolean().optional(),
    focusOnClick: z.boolean().optional(),
    info: z
      .object({
        title: z.string(),
        description: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type InteractionBehavior = z.infer<typeof InteractionBehaviorSchema>;

export type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

export const MetadataSchema = z.record(JsonValueSchema);

export type Metadata = z.infer<typeof MetadataSchema>;

/** Optional authored light; viewport may ignore until wired. */
export const SceneLightSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('ambient'),
    intensity: z.number().finite().optional(),
  }),
  z.object({
    kind: z.literal('directional'),
    intensity: z.number().finite().optional(),
    castShadow: z.boolean().optional(),
  }),
]);

export type SceneLight = z.infer<typeof SceneLightSchema>;

const SceneNodeBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  children: z.array(z.string()),
  transform: TransformSchema,
  assetRef: AssetRefSchema.optional(),
  materialRef: MaterialRefSchema.optional(),
  light: SceneLightSchema.optional(),
});

export const SceneNodeSchema = SceneNodeBaseSchema.extend({
  type: NodeTypeSchema,
  visible: z.boolean(),
  metadata: MetadataSchema,
  semanticRole: SemanticRoleSchema.optional(),
  semanticGroupId: z.string().min(1).optional(),
  behaviors: InteractionBehaviorSchema.optional(),
});

const LegacySceneNodeSchema = SceneNodeBaseSchema.extend({
  type: NodeTypeSchema.optional(),
  visible: z.boolean().default(true),
  metadata: MetadataSchema.default({}),
});

export type SceneNode = z.infer<typeof SceneNodeSchema>;

type GraphShape = {
  rootId: string;
  nodes: Record<string, { id: string; children: string[] }>;
  selection: string | null;
};

const graphStructuralRefinements = (
  val: GraphShape,
  ctx: z.RefinementCtx,
) => {
  const { rootId, nodes, selection } = val;
  const ids = new Set(Object.keys(nodes));

  if (!ids.has(rootId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'rootId missing from nodes' });
    return;
  }

  for (const [id, node] of Object.entries(nodes)) {
    if (node.id !== id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `node key/id mismatch for ${id}`,
      });
    }
    const seenChild = new Set<string>();
    for (const c of node.children) {
      if (seenChild.has(c)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate child ref ${c} on node ${id}`,
        });
      }
      seenChild.add(c);
      if (!ids.has(c)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `missing child ${c} on node ${id}`,
        });
      }
    }
  }

  const root = nodes[rootId];
  if (!root || root.id !== rootId) return;

  for (const [, node] of Object.entries(nodes)) {
    if (node.children.includes(rootId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'root cannot appear as a child',
      });
    }
  }

  const parentOf = new Map<string, string>();
  for (const [pid, node] of Object.entries(nodes)) {
    for (const c of node.children) {
      if (parentOf.has(c)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `multiple parents for child ${c}`,
        });
      }
      parentOf.set(c, pid);
    }
  }

  parentOf.delete(rootId);

  for (const id of ids) {
    if (id === rootId) continue;
    if (!parentOf.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `orphan node ${id}`,
      });
    }
  }

  const visited = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (visited.has(id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `cycle or duplicate visit at ${id}` });
      return;
    }
    visited.add(id);
    const n = nodes[id];
    if (!n) continue;
    for (const c of n.children) stack.push(c);
  }

  for (const id of ids) {
    if (!visited.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `unreachable node ${id}`,
      });
    }
  }

  if (selection !== null && !ids.has(selection)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'selection references missing node',
    });
  }
};

const graphRootTypeRefinement = (
  val: { rootId: string; nodes: Record<string, SceneNode> },
  ctx: z.RefinementCtx,
) => {
  const root = val.nodes[val.rootId];
  if (root && root.type !== 'root') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'rootId node must have type root',
    });
  }
  for (const [id, node] of Object.entries(val.nodes)) {
    if (id !== val.rootId && node.type === 'root') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `non-root node ${id} cannot have type root`,
      });
    }
  }
};

const currentGraphRefinements = (
  val: { rootId: string; nodes: Record<string, SceneNode>; selection: string | null },
  ctx: z.RefinementCtx,
) => {
  graphStructuralRefinements(val, ctx);
  graphRootTypeRefinement(val, ctx);
};

const SceneGraphBaseSchema = z.object({
  rootId: z.string().min(1),
  nodes: z.record(z.string(), SceneNodeSchema),
  selection: z.string().nullable().default(null),
});

const LegacySceneGraphBaseSchema = z.object({
  rootId: z.string().min(1),
  nodes: z.record(z.string(), LegacySceneNodeSchema),
  selection: z.string().nullable().default(null),
});

export const SceneGraphSchema = SceneGraphBaseSchema.superRefine(currentGraphRefinements);

export type Scene = z.infer<typeof SceneGraphSchema>;

export const SCENE_DOCUMENT_FORMAT = 'diorama-scene' as const;
export const SCENE_LEGACY_DATA_VERSION = 1 as const;
export const SCENE_DATA_VERSION = 2 as const;

export const SceneDocumentSchema = z.object({
  format: z.literal(SCENE_DOCUMENT_FORMAT),
  version: z.literal(SCENE_DATA_VERSION),
  data: SceneGraphSchema,
});

export type SceneDocument = z.infer<typeof SceneDocumentSchema>;

export const LegacySceneGraphSchema = LegacySceneGraphBaseSchema.superRefine(
  graphStructuralRefinements,
);

export const LegacySceneDocumentSchema = z.object({
  format: z.literal(SCENE_DOCUMENT_FORMAT),
  version: z.literal(SCENE_LEGACY_DATA_VERSION),
  data: LegacySceneGraphSchema,
});
