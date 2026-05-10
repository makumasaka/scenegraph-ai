import { describe, expect, it } from 'vitest';
import { applyCommand, createEmptyScene } from '@diorama/core';
import { ingestAsset } from './ingest';

describe('ingestAsset', () => {
  it('returns replayable commands and warnings for generated assets', () => {
    const result = ingestAsset(
      {
        id: 'asset-chair',
        provider: 'mock',
        prompt: 'modern chair display',
        format: 'glb',
        localPath: '/tmp/chair.glb',
        uri: '/assets/generated/chair.glb',
      },
      { parentId: 'root', nodeId: 'chair-node' },
    );

    expect(result.warnings).toEqual([]);
    expect(result.commands.map((command) => command.type)).toEqual([
      'REGISTER_ASSET',
      'ADD_NODE',
    ]);
  });

  it('can be reduced into a valid scene using core commands', () => {
    const initial = createEmptyScene();
    const result = ingestAsset(
      {
        provider: 'mock',
        prompt: 'chair',
        format: 'glb',
        localPath: '/tmp/chair.glb',
        uri: '/assets/generated/chair.glb',
      },
      { parentId: initial.rootId },
    );

    const next = result.commands.reduce((scene, command) => applyCommand(scene, command), initial);
    const addedNodeId = Object.keys(next.nodes).find((id) => id !== initial.rootId);
    expect(addedNodeId).toBeDefined();
    expect(next.assets).toBeDefined();
    expect(Object.values(next.assets ?? {}).length).toBe(1);
    expect(next.nodes[addedNodeId as string]?.semantics?.role).toBe('product');
    expect(next.nodes[addedNodeId as string]?.semantics?.source).toBe('import');
    expect(next.nodes[addedNodeId as string]?.metadata.source).toBe('generator');
    expect(next.nodes[addedNodeId as string]?.metadata.provider).toBe('mock');
  });

  it('warns and returns no commands for invalid local path input', () => {
    const result = ingestAsset({
      localPath: '',
      format: 'glb',
    });
    expect(result.commands).toEqual([]);
    expect(result.warnings).toEqual(['ingestAsset requires a non-empty localPath']);
  });
});
