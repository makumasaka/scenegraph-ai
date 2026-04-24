import { z } from 'zod';
import { SceneGraphSchema } from '@diorama/schema';

/** Payload for {@link AgentSession.loadScene}: either JSON text or an already-parsed graph. */
export const LoadSceneInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('json'),
    json: z.string().min(1),
  }),
  z.object({
    kind: z.literal('scene'),
    scene: SceneGraphSchema,
  }),
]);

export type LoadSceneInput = z.infer<typeof LoadSceneInputSchema>;
