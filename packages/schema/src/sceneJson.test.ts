import { describe, expect, it } from 'vitest';
import {
  parseSceneJson,
  SCENE_DATA_VERSION,
  SCENE_DOCUMENT_FORMAT,
  SCENE_LEGACY_DATA_VERSION,
  serializeScene,
  stableStringify,
  validateScene,
  type Scene,
  type SceneNode,
  type Transform,
} from './index';

const transform: Transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

const canonicalScene = (): Scene => ({
  rootId: 'root',
  selection: null,
  nodes: {
    root: {
      id: 'root',
      name: 'Root',
      type: 'root',
      children: ['mesh'],
      transform,
      visible: true,
      metadata: {},
    },
    mesh: {
      id: 'mesh',
      name: 'Mesh',
      type: 'mesh',
      children: [],
      transform,
      visible: true,
      metadata: {},
    },
  },
});

const clone = (scene: Scene): Scene => JSON.parse(JSON.stringify(scene)) as Scene;

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

const legacyDocument = (data: unknown): string =>
  JSON.stringify({
    format: SCENE_DOCUMENT_FORMAT,
    version: SCENE_LEGACY_DATA_VERSION,
    data,
  });

describe('scene JSON contract', () => {
  it('exports only canonical v2 scene documents', () => {
    const text = serializeScene(canonicalScene());
    const doc = JSON.parse(text) as { format: string; version: number };

    expect(doc.format).toBe(SCENE_DOCUMENT_FORMAT);
    expect(doc.version).toBe(SCENE_DATA_VERSION);
    expect(doc.version).toBe(2);
  });

  it('migrates v1 documents with legacy type, visibility, and metadata defaults', () => {
    const parsed = parseSceneJson(
      legacyDocument({
        rootId: 'root',
        nodes: {
          root: {
            id: 'root',
            name: 'Root',
            children: ['group', 'light-node', 'leaf'],
            transform,
          },
          group: {
            id: 'group',
            name: 'Group',
            children: ['child'],
            transform,
          },
          child: {
            id: 'child',
            name: 'Child',
            children: [],
            transform,
          },
          'light-node': {
            id: 'light-node',
            name: 'Light',
            children: [],
            transform,
            light: { kind: 'ambient' },
          },
          leaf: {
            id: 'leaf',
            name: 'Leaf',
            children: [],
            transform,
          },
        },
      }),
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.nodes.root?.type).toBe('root');
    expect(parsed?.nodes.group?.type).toBe('group');
    expect(parsed?.nodes['light-node']?.type).toBe('light');
    expect(parsed?.nodes.leaf?.type).toBe('mesh');
    expect(parsed?.nodes.leaf?.visible).toBe(true);
    expect(parsed?.nodes.leaf?.metadata).toEqual({});
    expect(validateScene(parsed)).toBe(true);
  });

  it('migrates legacy bare scenes through the compatibility path', () => {
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

    expect(parsed?.rootId).toBe('root');
    expect(parsed?.selection).toBe(null);
    expect(parsed?.nodes.root?.type).toBe('root');
    expect(validateScene(parsed)).toBe(true);
  });

  it('rejects v2 documents with missing required node contract fields', () => {
    const parsed = parseSceneJson(
      JSON.stringify({
        format: SCENE_DOCUMENT_FORMAT,
        version: SCENE_DATA_VERSION,
        data: {
          rootId: 'root',
          selection: null,
          nodes: {
            root: {
              id: 'root',
              name: 'Root',
              children: [],
              transform,
            },
          },
        },
      }),
    );

    expect(parsed).toBeNull();
  });

  it('enforces root node type exclusivity in canonical scenes', () => {
    const rootIsMesh = canonicalScene();
    rootIsMesh.nodes.root = { ...rootIsMesh.nodes.root, type: 'mesh' };

    const childIsRoot = canonicalScene();
    childIsRoot.nodes.mesh = { ...childIsRoot.nodes.mesh, type: 'root' };

    expect(validateScene(rootIsMesh)).toBe(false);
    expect(validateScene(childIsRoot)).toBe(false);
  });

  const invalidScenes: Array<[string, () => unknown]> = [
    [
      'missing root',
      () => {
        const scene = clone(canonicalScene()) as Partial<Scene>;
        delete scene.rootId;
        return scene;
      },
    ],
    [
      'rootId points to missing node',
      () => ({ ...clone(canonicalScene()), rootId: 'missing-root' }),
    ],
    [
      'rootId points to non-root type',
      () => {
        const scene = clone(canonicalScene());
        scene.nodes.root = { ...scene.nodes.root, type: 'mesh' };
        return scene;
      },
    ],
    [
      'non-root node has type root',
      () => {
        const scene = clone(canonicalScene());
        scene.nodes.mesh = { ...scene.nodes.mesh, type: 'root' };
        return scene;
      },
    ],
    [
      'root appears as child',
      () => {
        const scene = clone(canonicalScene());
        scene.nodes.mesh = { ...scene.nodes.mesh, children: ['root'] };
        return scene;
      },
    ],
    [
      'missing child reference',
      () => {
        const scene = clone(canonicalScene());
        scene.nodes.root = { ...scene.nodes.root, children: ['mesh', 'missing-child'] };
        return scene;
      },
    ],
    [
      'duplicate child reference',
      () => {
        const scene = clone(canonicalScene());
        scene.nodes.root = { ...scene.nodes.root, children: ['mesh', 'mesh'] };
        return scene;
      },
    ],
    [
      'orphan node',
      () => {
        const scene = clone(canonicalScene());
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
      'selection points to missing node',
      () => ({ ...clone(canonicalScene()), selection: 'missing-selection' }),
    ],
    [
      'node id does not match map key',
      () => {
        const scene = clone(canonicalScene());
        scene.nodes.mesh = { ...scene.nodes.mesh, id: 'other-id' };
        return scene;
      },
    ],
  ];

  it.each(invalidScenes)('rejects invalid graph: %s', (_, makeScene) => {
    expect(validateScene(makeScene())).toBe(false);
  });

  it('rejects unsupported document versions intentionally', () => {
    const parsed = parseSceneJson(
      JSON.stringify({
        format: SCENE_DOCUMENT_FORMAT,
        version: 999,
        data: canonicalScene(),
      }),
    );

    expect(parsed).toBeNull();
  });

  it('is stable across parse, serialize, and parse', () => {
    const once = serializeScene(canonicalScene());
    const parsed = parseSceneJson(once);
    const twice = serializeScene(parsed!);
    const reparsed = parseSceneJson(twice);

    expect(parsed).not.toBeNull();
    expect(twice).toBe(once);
    expect(reparsed).toEqual(parsed);
  });

  it('preserves child order across serialization', () => {
    const scene = clone(canonicalScene());
    scene.nodes.root = { ...scene.nodes.root, children: ['b-child', 'a-child'] };
    scene.nodes['b-child'] = node('b-child', 'mesh');
    scene.nodes['a-child'] = node('a-child', 'mesh');
    delete scene.nodes.mesh;

    const parsed = parseSceneJson(serializeScene(scene));

    expect(parsed?.nodes.root?.children).toEqual(['b-child', 'a-child']);
  });

  it('emits stable serialized output for equivalent scene objects', () => {
    const a = stableStringify({ version: 2, data: { z: 1, a: 2 }, format: 'x' });
    const b = stableStringify({ format: 'x', data: { a: 2, z: 1 }, version: 2 });
    const once = serializeScene(canonicalScene());
    const twice = serializeScene(clone(canonicalScene()));

    expect(a).toBe(b);
    expect(twice).toBe(once);
  });
});
