import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SCENE_DOCUMENT_FORMAT,
  SCENE_LEGACY_DATA_VERSION,
  parseSceneJson,
  serializeScene,
  stableStringify,
  validateScene,
  type Scene,
  type SceneNode,
} from '@diorama/schema';
import {
  defaultFixtureScene,
  galleryScene,
  livingSpaceScene,
  showroomScene,
} from './fixtures';

const transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
} satisfies SceneNode['transform'];

const node = (
  id: string,
  type: SceneNode['type'],
  children: string[] = [],
): SceneNode => ({
  id,
  name: id,
  type,
  children,
  transform,
  visible: true,
  metadata: {},
});

const validScene = (): Scene => ({
  rootId: 'root',
  selection: null,
  nodes: {
    root: node('root', 'root', ['child']),
    child: node('child', 'mesh'),
  },
});

const clone = (scene: Scene): Scene => JSON.parse(JSON.stringify(scene)) as Scene;

const legacyDocument = (data: unknown): string =>
  JSON.stringify({
    format: SCENE_DOCUMENT_FORMAT,
    version: SCENE_LEGACY_DATA_VERSION,
    data,
  });

describe('Milestone 2 scene contract', () => {
  describe('valid scenes', () => {
    const fixtures: Array<[string, Scene]> = [
      ['default', defaultFixtureScene],
      ['showroom', showroomScene],
      ['gallery', galleryScene],
      ['living', livingSpaceScene],
    ];

    it.each(fixtures)('validates the %s fixture', (_, scene) => {
      expect(validateScene(scene)).toBe(true);
    });

    it.each(fixtures)('keeps the %s example JSON in parity with its fixture', (id, scene) => {
      const text = readFileSync(
        new URL(`../../examples/scenes/${id}.json`, import.meta.url),
        'utf8',
      );
      const parsed = parseSceneJson(text);

      expect(parsed).not.toBeNull();
      expect(validateScene(parsed)).toBe(true);
      expect(parsed).toEqual(scene);
    });
  });

  describe('invalid scenes', () => {
    const invalidCases: Array<[string, () => unknown]> = [
      [
        'missing root',
        () => {
          const scene = clone(validScene()) as Partial<Scene>;
          delete scene.rootId;
          return scene;
        },
      ],
      [
        'rootId points to missing node',
        () => ({
          ...clone(validScene()),
          rootId: 'missing-root',
        }),
      ],
      [
        'rootId points to non-root type',
        () => {
          const scene = clone(validScene());
          scene.nodes.root = { ...scene.nodes.root, type: 'mesh' };
          return scene;
        },
      ],
      [
        'non-root node has type root',
        () => {
          const scene = clone(validScene());
          scene.nodes.child = { ...scene.nodes.child, type: 'root' };
          return scene;
        },
      ],
      [
        'root appears as child',
        () => {
          const scene = clone(validScene());
          scene.nodes.child = { ...scene.nodes.child, children: ['root'] };
          return scene;
        },
      ],
      [
        'missing child reference',
        () => {
          const scene = clone(validScene());
          scene.nodes.root = { ...scene.nodes.root, children: ['child', 'missing-child'] };
          return scene;
        },
      ],
      [
        'duplicate child reference',
        () => {
          const scene = clone(validScene());
          scene.nodes.root = { ...scene.nodes.root, children: ['child', 'child'] };
          return scene;
        },
      ],
      [
        'orphan node',
        () => {
          const scene = clone(validScene());
          scene.nodes.orphan = node('orphan', 'mesh');
          return scene;
        },
      ],
      [
        'cycle',
        () => ({
          rootId: 'root',
          selection: null,
          nodes: {
            root: node('root', 'root', ['a']),
            a: node('a', 'group', ['b']),
            b: node('b', 'mesh', ['a']),
          },
        }),
      ],
      [
        'node has multiple parents',
        () => ({
          rootId: 'root',
          selection: null,
          nodes: {
            root: node('root', 'root', ['a', 'b']),
            a: node('a', 'group', ['shared']),
            b: node('b', 'group', ['shared']),
            shared: node('shared', 'mesh'),
          },
        }),
      ],
      [
        'node id does not match map key',
        () => {
          const scene = clone(validScene());
          scene.nodes.child = { ...scene.nodes.child, id: 'other-id' };
          return scene;
        },
      ],
      [
        'selection points to missing node',
        () => ({
          ...clone(validScene()),
          selection: 'missing-selection',
        }),
      ],
    ];

    it.each(invalidCases)('rejects a scene with %s', (_, makeScene) => {
      expect(validateScene(makeScene())).toBe(false);
    });
  });

  describe('migration and defaulting', () => {
    it('defaults type, visible, and metadata for v1 scene nodes', () => {
      const parsed = parseSceneJson(
        legacyDocument({
          rootId: 'root',
          selection: null,
          nodes: {
            root: {
              id: 'root',
              name: 'Root',
              children: ['child'],
              transform,
            },
            child: {
              id: 'child',
              name: 'Child',
              children: [],
              transform,
            },
          },
        }),
      );

      expect(parsed).not.toBeNull();
      expect(parsed?.nodes.root?.type).toBe('root');
      expect(parsed?.nodes.child?.type).toBe('mesh');
      expect(parsed?.nodes.child?.visible).toBe(true);
      expect(parsed?.nodes.child?.metadata).toEqual({});
      expect(validateScene(parsed)).toBe(true);
    });

    it('accepts legacy bare scene objects while that path is retained', () => {
      const parsed = parseSceneJson(
        JSON.stringify({
          rootId: 'root',
          nodes: {
            root: {
              id: 'root',
              name: 'Root',
              children: [],
              transform,
            },
          },
        }),
      );

      expect(parsed).not.toBeNull();
      expect(parsed?.rootId).toBe('root');
      expect(parsed?.selection).toBe(null);
      expect(parsed?.nodes.root?.type).toBe('root');
      expect(validateScene(parsed)).toBe(true);
    });

    it('rejects unsupported document versions', () => {
      const text = JSON.stringify({
        format: SCENE_DOCUMENT_FORMAT,
        version: 999,
        data: validScene(),
      });

      expect(parseSceneJson(text)).toBeNull();
    });
  });

  describe('serialization', () => {
    it('uses deterministic key ordering in canonical JSON', () => {
      const a = stableStringify({ version: 2, data: { z: 1, a: 2 }, format: 'x' });
      const b = stableStringify({ format: 'x', data: { a: 2, z: 1 }, version: 2 });
      const doc = JSON.parse(serializeScene(defaultFixtureScene)) as Record<string, unknown>;

      expect(a).toBe(b);
      expect(Object.keys(doc)).toEqual(['data', 'format', 'version']);
    });

    it('is stable across parse, serialize, and parse', () => {
      const once = serializeScene(galleryScene);
      const parsed = parseSceneJson(once);
      const twice = serializeScene(parsed!);
      const reparsed = parseSceneJson(twice);

      expect(parsed).not.toBeNull();
      expect(twice).toBe(once);
      expect(reparsed).toEqual(parsed);
    });

    it('preserves child order across serialization', () => {
      const parsed = parseSceneJson(serializeScene(showroomScene));

      expect(parsed?.nodes['showroom-root']?.children).toEqual([
        'showroom-floor',
        'showroom-accent',
      ]);
      expect(parsed?.nodes['showroom-floor']?.children).toEqual([
        'showroom-pedestal-west',
        'showroom-pedestal-east',
      ]);
    });
  });
});
