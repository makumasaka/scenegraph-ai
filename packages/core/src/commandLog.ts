import type { Command } from './commands';

export interface CommandSummary {
  title: string;
  detail: string;
}

const shortId = (id: string): string =>
  id.length <= 10 ? id : `${id.slice(0, 8)}…`;

export const summarizeCommand = (command: Command): CommandSummary => {
  switch (command.type) {
    case 'ADD_NODE':
      return {
        title: 'Add node',
        detail: `${command.node.name} → parent ${shortId(command.parentId)} · id ${shortId(command.node.id)}`,
      };
    case 'DELETE_NODE':
      return {
        title: 'Delete node',
        detail: `node ${shortId(command.nodeId)}`,
      };
    case 'SET_PARENT':
      return {
        title: 'Set parent',
        detail: `${shortId(command.nodeId)} → ${shortId(command.parentId)}${command.preserveWorldTransform ? ' · preserve world' : ''}`,
      };
    case 'UPDATE_TRANSFORM':
      return {
        title: 'Update transform',
        detail: `node ${shortId(command.nodeId)}`,
      };
    case 'DUPLICATE_NODE':
      return {
        title: 'Duplicate node',
        detail: `${shortId(command.nodeId)} · subtree=${command.includeSubtree}${command.newParentId ? ` → ${shortId(command.newParentId)}` : ''}`,
      };
    case 'ARRANGE_NODES':
      return {
        title: `Arrange (${command.layout})`,
        detail: `${command.nodeIds.length} node(s): ${command.nodeIds.slice(0, 4).map(shortId).join(', ')}${command.nodeIds.length > 4 ? '…' : ''}`,
      };
    case 'REPLACE_SCENE':
      return {
        title: 'Replace scene',
        detail: `root ${shortId(command.scene.rootId)} · ${Object.keys(command.scene.nodes).length} nodes`,
      };
    case 'SET_SELECTION':
      return {
        title: 'Selection',
        detail:
          command.nodeId === null
            ? 'clear'
            : `node ${shortId(command.nodeId)}`,
      };
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
};
