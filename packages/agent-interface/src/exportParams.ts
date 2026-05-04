import { z } from 'zod';

const R3fExportOptionsSchema = z
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

/** Options for {@link AgentSession.exportScene}. */
export const ExportSceneParamsSchema = z
  .object({
    format: z.enum(['json', 'r3f']),
    r3f: R3fExportOptionsSchema.optional(),
  })
  .strict();

export type ExportSceneParams = z.infer<typeof ExportSceneParamsSchema>;

export type ExportMediaType = 'application/json' | 'text/jsx';

export const mediaTypeForFormat = (format: ExportSceneParams['format']): ExportMediaType =>
  format === 'json' ? 'application/json' : 'text/jsx';
