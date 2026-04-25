export const EXAMPLE_SCENE_IDS = [
  'default',
  'showroom',
  'gallery',
  'living',
] as const;

export type ExampleSceneId = (typeof EXAMPLE_SCENE_IDS)[number];

export const exampleScenePath = (id: ExampleSceneId): string =>
  `packages/examples/scenes/${id}.json`;
