import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createAgentSession } from './index';

type FutureTool = {
  name: string;
  runtimeMethod: string;
  type: 'read' | 'write';
};

type ToolContractFixture = {
  version: number;
  tools: FutureTool[];
  forbiddenCapabilities: string[];
};

const fixture = JSON.parse(
  readFileSync(new URL('../../../docs/evals/fixtures/m7/mcp-tools.json', import.meta.url), 'utf8'),
) as ToolContractFixture;

describe('Milestone 7 future MCP tool contract', () => {
  it('maps future tool names to the agent runtime surface', () => {
    const session = createAgentSession();
    const runtimeKeys = Object.keys(session).sort();

    expect(fixture.version).toBe(2);
    expect(fixture.tools.map((tool) => tool.name)).toEqual([
      'get_scene',
      'get_semantic_groups',
      'get_behaviors',
      'get_selected_nodes',
      'structure_scene',
      'set_node_semantics',
      'create_semantic_group',
      'assign_to_semantic_group',
      'add_behavior',
      'remove_behavior',
      'make_interactive',
      'arrange_nodes',
      'apply_command',
      'apply_command_batch',
      'load_scene',
      'export_json',
      'export_r3f',
    ]);

    for (const tool of fixture.tools) {
      expect(runtimeKeys, `${tool.name} -> ${tool.runtimeMethod}`).toContain(tool.runtimeMethod);
    }
  });

  it('keeps write tools on validated command or scene-load paths', () => {
    const writeTools = fixture.tools.filter((tool) => tool.type === 'write');

    expect(writeTools.map((tool) => tool.name)).toEqual([
      'structure_scene',
      'set_node_semantics',
      'create_semantic_group',
      'assign_to_semantic_group',
      'add_behavior',
      'remove_behavior',
      'make_interactive',
      'arrange_nodes',
      'apply_command',
      'apply_command_batch',
      'load_scene',
    ]);
    expect(writeTools.map((tool) => tool.runtimeMethod)).toEqual([
      'applyCommand',
      'applyCommand',
      'applyCommand',
      'applyCommand',
      'applyCommand',
      'applyCommand',
      'applyCommand',
      'applyCommand',
      'applyCommand',
      'applyCommandBatch',
      'loadScene',
    ]);
  });

  it('forbids hidden mutation and arbitrary execution capabilities', () => {
    const exposedToolNames = new Set(fixture.tools.map((tool) => tool.name));
    const session = createAgentSession();

    for (const forbidden of fixture.forbiddenCapabilities) {
      expect(exposedToolNames.has(forbidden), `${forbidden} should not be a tool`).toBe(false);
      expect(forbidden in session, `${forbidden} should not be a runtime method`).toBe(false);
    }
  });
});
