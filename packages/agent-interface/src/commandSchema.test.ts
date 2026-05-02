import { describe, expect, it } from 'vitest';
import { createEmptyScene, createNode, type Command } from '@diorama/core';
import type { Scene } from '@diorama/schema';
import { COMMAND_SCHEMA_PARITY, COMMAND_TYPES, CommandSchema } from './commandSchema';

const invalidScene = (): Scene => {
  const scene = createEmptyScene();
  return {
    ...scene,
    rootId: 'missing-root',
  };
};

const validPayloads: Record<Command['type'], unknown> = {
  ADD_NODE: {
    type: 'ADD_NODE',
    parentId: 'root',
    node: createNode({ id: 'box', name: 'Box' }),
  },
  DELETE_NODE: {
    type: 'DELETE_NODE',
    nodeId: 'box',
  },
  UPDATE_TRANSFORM: {
    type: 'UPDATE_TRANSFORM',
    nodeId: 'box',
    patch: { position: [1, 2, 3] },
  },
  CREATE_SEMANTIC_GROUP: {
    type: 'CREATE_SEMANTIC_GROUP',
    groupId: 'display_area',
    name: 'Display Area',
    role: 'display',
    nodeIds: ['box'],
  },
  SET_NODE_SEMANTICS: {
    type: 'SET_NODE_SEMANTICS',
    nodeIds: ['box'],
    semanticRole: 'product',
    semanticGroupId: 'display_area',
  },
  ADD_BEHAVIOR: {
    type: 'ADD_BEHAVIOR',
    nodeIds: ['box'],
    behavior: {
      hoverHighlight: true,
      clickSelect: true,
      info: { title: 'Box' },
    },
  },
  STRUCTURE_SHOWROOM_SCENE: {
    type: 'STRUCTURE_SHOWROOM_SCENE',
  },
  DUPLICATE_NODE: {
    type: 'DUPLICATE_NODE',
    nodeId: 'box',
    includeSubtree: true,
    idMap: { box: 'box-copy' },
  },
  SET_PARENT: {
    type: 'SET_PARENT',
    nodeId: 'box',
    parentId: 'root',
    preserveWorldTransform: true,
  },
  ARRANGE_NODES: {
    type: 'ARRANGE_NODES',
    nodeIds: ['a', 'b'],
    layout: 'grid',
    options: { spacing: 2, cols: 2 },
  },
  SET_SELECTION: {
    type: 'SET_SELECTION',
    nodeId: null,
  },
  REPLACE_SCENE: {
    type: 'REPLACE_SCENE',
    scene: createEmptyScene(),
  },
};

const invalidPayloads: Record<Command['type'], unknown> = {
  ADD_NODE: {
    type: 'ADD_NODE',
    parentId: '',
    node: createNode({ id: 'box', name: 'Box' }),
  },
  DELETE_NODE: {
    type: 'DELETE_NODE',
    nodeId: '',
  },
  UPDATE_TRANSFORM: {
    type: 'UPDATE_TRANSFORM',
    nodeId: 'box',
    patch: {},
  },
  CREATE_SEMANTIC_GROUP: {
    type: 'CREATE_SEMANTIC_GROUP',
    groupId: '',
    name: 'Display Area',
    role: 'display',
    nodeIds: ['box'],
  },
  SET_NODE_SEMANTICS: {
    type: 'SET_NODE_SEMANTICS',
    nodeIds: ['box'],
    semanticRole: 'hero-product',
  },
  ADD_BEHAVIOR: {
    type: 'ADD_BEHAVIOR',
    nodeIds: ['box'],
    behavior: { info: { title: 1 } },
  },
  STRUCTURE_SHOWROOM_SCENE: {
    type: 'STRUCTURE_SHOWROOM_SCENE',
    prompt: 'do AI things',
  },
  DUPLICATE_NODE: {
    type: 'DUPLICATE_NODE',
    nodeId: 'box',
    includeSubtree: 'yes',
  },
  SET_PARENT: {
    type: 'SET_PARENT',
    nodeId: 'box',
    parentId: '',
  },
  ARRANGE_NODES: {
    type: 'ARRANGE_NODES',
    nodeIds: ['a'],
    layout: 'spiral',
  },
  SET_SELECTION: {
    type: 'SET_SELECTION',
    nodeId: 3,
  },
  REPLACE_SCENE: {
    type: 'REPLACE_SCENE',
    scene: invalidScene(),
  },
};

describe('CommandSchema', () => {
  it('tracks the locked Milestone 3 command type set', () => {
    expect(COMMAND_TYPES).toEqual([
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
    ]);
    expect(Object.keys(COMMAND_SCHEMA_PARITY).sort()).toEqual([...COMMAND_TYPES].sort());
  });

  it.each(COMMAND_TYPES)('accepts a valid %s payload', (type) => {
    expect(CommandSchema.safeParse(validPayloads[type]).success).toBe(true);
  });

  it.each(COMMAND_TYPES)('rejects an invalid %s payload', (type) => {
    expect(CommandSchema.safeParse(invalidPayloads[type]).success).toBe(false);
  });

  it('rejects invalid Vec3 payloads', () => {
    const result = CommandSchema.safeParse({
      type: 'UPDATE_TRANSFORM',
      nodeId: 'box',
      patch: { position: [1, 2] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-finite numbers', () => {
    const result = CommandSchema.safeParse({
      type: 'UPDATE_TRANSFORM',
      nodeId: 'box',
      patch: { rotation: [0, Infinity, 0] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed idMap payloads', () => {
    const result = CommandSchema.safeParse({
      type: 'DUPLICATE_NODE',
      nodeId: 'box',
      includeSubtree: true,
      idMap: { box: '' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid layouts', () => {
    const result = CommandSchema.safeParse({
      type: 'ARRANGE_NODES',
      nodeIds: ['box'],
      layout: 'stack',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid scenes for REPLACE_SCENE', () => {
    const result = CommandSchema.safeParse({
      type: 'REPLACE_SCENE',
      scene: invalidScene(),
    });
    expect(result.success).toBe(false);
  });
});
