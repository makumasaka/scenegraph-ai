import { describe, expect, it } from 'vitest';
import { applyCommand, replayCommands, type Command } from './index';
import { createEmptyScene, createNode } from './scene';

describe('replayCommands', () => {
  it('replays commands in order from the provided base scene', () => {
    const base = createEmptyScene();
    const root = base.rootId;
    const commands: Command[] = [
      {
        type: 'ADD_NODE',
        parentId: root,
        node: createNode({ id: 'cube-a', name: 'Cube A' }),
      },
      {
        type: 'UPDATE_TRANSFORM',
        nodeId: 'cube-a',
        patch: { position: [2, 1, 0] },
      },
      {
        type: 'ARRANGE_NODES',
        nodeIds: ['cube-a'],
        layout: 'line',
      },
    ];

    const replayed = replayCommands(base, commands);
    const sequential = commands.reduce((scene, command) => applyCommand(scene, command), base);

    expect(replayed).toEqual(sequential);
    expect(replayed).not.toBe(base);
  });
});
