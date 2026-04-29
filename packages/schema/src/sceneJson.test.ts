import { describe, expect, it } from 'vitest';
import {
  parseSceneJson,
  SCENE_DATA_VERSION,
  SCENE_DOCUMENT_FORMAT,
  SCENE_LEGACY_DATA_VERSION,
  serializeScene,
  validateScene,
  type Scene,
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
});
