import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  defaultFixtureScene,
  galleryScene,
  livingSpaceScene,
  showroomScene,
} from '@diorama/core';
import {
  SCENE_DATA_VERSION,
  parseSceneJson,
  serializeScene,
  type Scene,
} from '@diorama/schema';
import { exportSceneToR3fJsx } from './r3f';

const examples = [
  ['default', defaultFixtureScene],
  ['showroom', showroomScene],
  ['gallery', galleryScene],
  ['living', livingSpaceScene],
] as const;

const readExample = (id: string): string =>
  readFileSync(new URL(`../../examples/scenes/${id}.json`, import.meta.url), 'utf8');

const parseExample = (id: string): Scene => {
  const parsed = parseSceneJson(readExample(id));
  if (!parsed) throw new Error(`example ${id} did not parse`);
  return parsed;
};

describe('Milestone 5 export loop lock', () => {
  describe('JSON roundtrip', () => {
    it.each(examples)('parses %s and serializes deterministically', (id) => {
      const text = readExample(id);
      const parsed = parseSceneJson(text);
      expect(parsed).not.toBeNull();
      const serialized = serializeScene(parsed!);
      const reparsed = parseSceneJson(serialized);

      expect(serializeScene(reparsed!)).toBe(serialized);
      expect(reparsed).toEqual(parsed);
    });

    it('preserves child order through parse and serialize', () => {
      const showroom = parseExample('showroom');
      const roundtripped = parseSceneJson(serializeScene(showroom));

      expect(roundtripped?.nodes['showroom-root']?.children).toEqual([
        'showroom-floor',
        'showroom-accent',
      ]);
      expect(roundtripped?.nodes['showroom-floor']?.children).toEqual([
        'showroom-pedestal-west',
        'showroom-pedestal-east',
      ]);
    });

    it.each(examples)('emits v2 fields for %s after parse and serialize', (id) => {
      const doc = JSON.parse(serializeScene(parseExample(id))) as {
        version: number;
        data: Scene;
      };

      expect(doc.version).toBe(SCENE_DATA_VERSION);
      for (const [nodeId, node] of Object.entries(doc.data.nodes)) {
        expect(node.id).toBe(nodeId);
        expect(node.type).toBeDefined();
        expect(node.visible).toEqual(expect.any(Boolean));
        expect(node.metadata).toEqual(expect.any(Object));
      }
    });
  });

  describe('examples parity', () => {
    it.each(examples)('%s checked-in JSON matches serialized core fixture', (id, fixture) => {
      expect(readExample(id).trim()).toBe(serializeScene(fixture).trim());
    });

    it.each(examples)('%s example JSON sorts every object key lexicographically', (id) => {
      const doc = JSON.parse(readExample(id)) as unknown;
      const visit = (val: unknown, path: string): void => {
        if (val === null || typeof val !== 'object') return;
        if (Array.isArray(val)) {
          val.forEach((item, idx) => visit(item, `${path}[${idx}]`));
          return;
        }
        const keys = Object.keys(val);
        const sorted = [...keys].sort();
        expect(keys, `unsorted keys at ${path || '<root>'}`).toEqual(sorted);
        for (const key of keys) {
          visit((val as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
        }
      };
      visit(doc, '');
    });

    it.each(examples)('%s example JSON includes every required v2 node field', (id) => {
      const doc = JSON.parse(readExample(id)) as {
        format: string;
        version: number;
        data: Scene;
      };
      expect(doc.format).toBe('diorama-scene');
      expect(doc.version).toBe(SCENE_DATA_VERSION);
      for (const [nodeId, node] of Object.entries(doc.data.nodes)) {
        expect(node.id).toBe(nodeId);
        expect(typeof node.name).toBe('string');
        expect(node.type).toBeDefined();
        expect(typeof node.visible).toBe('boolean');
        expect(node.metadata).toBeTypeOf('object');
        expect(Array.isArray(node.children)).toBe(true);
        expect(Array.isArray(node.transform.position)).toBe(true);
        expect(Array.isArray(node.transform.rotation)).toBe(true);
        expect(Array.isArray(node.transform.scale)).toBe(true);
      }
    });
  });

  describe('export exclusions', () => {
    it('does not leak editor-only state or local filesystem paths into R3F output', () => {
      const sceneWithEditorState = {
        ...defaultFixtureScene,
        selection: 'default-cube-1',
        commandLog: [
          {
            type: 'UPDATE_TRANSFORM',
            nodeId: 'default-cube-1',
            patch: { position: [1, 2, 3] },
          },
        ],
        past: [showroomScene],
        future: [galleryScene],
        gizmoMode: 'translate',
        nodes: {
          ...defaultFixtureScene.nodes,
          'default-cube-1': {
            ...defaultFixtureScene.nodes['default-cube-1']!,
            metadata: { sourcePath: '/Users/example/secret-scene.glb' },
            assetRef: { kind: 'uri', uri: 'file:///Users/example/secret-scene.glb' },
          },
        },
      } as Scene & {
        commandLog: unknown[];
        past: Scene[];
        future: Scene[];
        gizmoMode: string;
      };

      const out = exportSceneToR3fJsx(sceneWithEditorState);

      expect(out).not.toContain('"selection"');
      expect(out).not.toContain('"commandLog"');
      expect(out).not.toContain('UPDATE_TRANSFORM');
      expect(out).not.toContain('"past"');
      expect(out).not.toContain('"future"');
      expect(out).not.toContain('"gizmoMode"');
      expect(out).not.toContain('/Users/');
      expect(out).not.toContain('file:///');
    });
  });

  describe('options surface', () => {
    it('exposes a non-throwing studio-lights toggle as the preferred option', () => {
      const off = exportSceneToR3fJsx(defaultFixtureScene);
      const on = exportSceneToR3fJsx(defaultFixtureScene, {
        includeStudioLights: true,
      });
      expect(off).not.toContain('Studio fill');
      expect(on).toContain('Studio fill');
    });

    it('keeps the deprecated includeLights alias byte-equal to the preferred option', () => {
      const preferred = exportSceneToR3fJsx(defaultFixtureScene, {
        includeStudioLights: true,
      });
      const legacy = exportSceneToR3fJsx(defaultFixtureScene, {
        includeLights: true,
      });
      expect(legacy).toBe(preferred);
    });
  });

  describe('canvas/export parity', () => {
    it('exports the root group and local hierarchy consistently with viewport traversal', () => {
      const scene: Scene = {
        rootId: 'root',
        selection: null,
        nodes: {
          root: {
            id: 'root',
            name: 'Root',
            type: 'root',
            children: ['parent'],
            transform: {
              position: [10, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
            },
            visible: true,
            metadata: {},
          },
          parent: {
            id: 'parent',
            name: 'Parent',
            type: 'group',
            children: ['child'],
            transform: {
              position: [0, 2, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
            },
            visible: true,
            metadata: {},
          },
          child: {
            id: 'child',
            name: 'Child',
            type: 'mesh',
            children: [],
            transform: {
              position: [0, 0, 3],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
            },
            visible: true,
            metadata: {},
          },
        },
      };

      const out = exportSceneToR3fJsx(scene);

      expect(out).toContain(
        '<group name="Root" position={[10, 0, 0]} rotation={[0, 0, 0]} scale={[1, 1, 1]}>',
      );
      expect(out).toContain(
        '<group name="Parent" position={[0, 2, 0]} rotation={[0, 0, 0]} scale={[1, 1, 1]}>',
      );
      expect(out).toContain(
        '<group name="Child" position={[0, 0, 3]} rotation={[0, 0, 0]} scale={[1, 1, 1]}>',
      );
      expect(out.indexOf('/* root - Root */')).toBeLessThan(out.indexOf('/* parent - Parent */'));
      expect(out.indexOf('/* parent - Parent */')).toBeLessThan(
        out.indexOf('/* child - Child */'),
      );
    });
  });
});
