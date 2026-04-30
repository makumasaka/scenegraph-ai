import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createAgentSession } from './index';

type FutureTool = {
  name: string;
  runtimeMethod: string;
  type: 'read' | 'preview' | 'write';
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

    expect(fixture.version).toBe(1);
    expect(fixture.tools.map((tool) => tool.name)).toEqual([
      'get_scene_graph',
      'get_selected_nodes',
      'select_nodes',
      'dry_run_command',
      'apply_command',
      'dry_run_command_batch',
      'apply_command_batch',
      'update_transform',
      'duplicate_node',
      'set_parent',
      'arrange_nodes',
      'load_scene',
      'export_json',
      'export_r3f',
      'get_command_log',
    ]);

    for (const tool of fixture.tools) {
      expect(runtimeKeys, `${tool.name} -> ${tool.runtimeMethod}`).toContain(tool.runtimeMethod);
    }
  });

  it('keeps write tools on validated command or scene-load paths', () => {
    const writeTools = fixture.tools.filter((tool) => tool.type === 'write');

    expect(writeTools.map((tool) => tool.name)).toEqual([
      'select_nodes',
      'apply_command',
      'apply_command_batch',
      'update_transform',
      'duplicate_node',
      'set_parent',
      'arrange_nodes',
      'load_scene',
    ]);
    expect(writeTools.map((tool) => tool.runtimeMethod)).toEqual([
      'applyCommand',
      'applyCommand',
      'applyCommandBatch',
      'applyCommand',
      'applyCommand',
      'applyCommand',
      'applyCommand',
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
