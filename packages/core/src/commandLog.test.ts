import { describe, expect, it } from 'vitest';
import type { Scene } from '@diorama/schema';
import { summarizeCommand } from './commandLog';
import type { Command } from './commands';
import { createNode } from './scene';

const sampleCommands = (): Command[] => {
  const rootNode = createNode({ id: 'cmd-log-root', name: 'Root' });
  const scene: Scene = {
    rootId: rootNode.id,
    selection: null,
    nodes: { [rootNode.id]: rootNode },
  };
  const root = scene.rootId;
  const node = createNode({ id: 'cmd-node', name: 'Sample' });
  return [
    { type: 'ADD_NODE', parentId: root, node } as const,
    { type: 'DELETE_NODE', nodeId: 'cmd-node' } as const,
    { type: 'UPDATE_TRANSFORM', nodeId: root, patch: { position: [1, 2, 3] } } as const,
    {
      type: 'CREATE_SEMANTIC_GROUP',
      groupId: 'display_area',
      name: 'Display Area',
      role: 'display',
      nodeIds: ['cmd-node'],
    } as const,
    {
      type: 'SET_NODE_SEMANTICS',
      nodeIds: ['cmd-node'],
      semanticRole: 'product',
      semanticGroupId: 'display_area',
    } as const,
    {
      type: 'ADD_BEHAVIOR',
      nodeIds: ['cmd-node'],
      behavior: { hoverHighlight: true, clickSelect: true },
    } as const,
    { type: 'STRUCTURE_SHOWROOM_SCENE' } as const,
    {
      type: 'DUPLICATE_NODE',
      nodeId: 'cmd-node',
      includeSubtree: true,
      newParentId: root,
      idMap: { 'cmd-node': 'cmd-node-2' },
    } as const,
    {
      type: 'SET_PARENT',
      nodeId: 'cmd-node',
      parentId: root,
      preserveWorldTransform: true,
    } as const,
    {
      type: 'ARRANGE_NODES',
      nodeIds: ['a', 'b'],
      layout: 'grid',
    } as const,
    { type: 'REPLACE_SCENE', scene } as const,
    { type: 'SET_SELECTION', nodeId: null } as const,
    { type: 'SET_SELECTION', nodeId: root } as const,
  ];
};

describe('summarizeCommand (command log regression)', () => {
  it('produces stable titles and details for every command variant', () => {
    expect(sampleCommands().map(summarizeCommand)).toMatchSnapshot();
  });

  it('abbreviates long ids in summaries without throwing', () => {
    const longId = 'x'.repeat(40);
    const s = summarizeCommand({
      type: 'DELETE_NODE',
      nodeId: longId,
    });
    expect(s.title).toBe('Delete node');
    expect(s.detail.length).toBeLessThan(longId.length);
    expect(s.detail).toContain('...');
  });
});
