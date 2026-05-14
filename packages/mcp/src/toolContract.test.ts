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

    expect(fixture.version).toBe(3);
    expect(fixture.tools.map((tool) => tool.name)).toEqual([
      'get_project_status',
      'load_scene',
      'get_scene',
      'register_asset',
      'import_glb_asset',
      'update_transform',
      'write_scene_to_file',
      'reload_scene_from_file',
      'export_r3f',
      'sync_code',
    ]);

    for (const tool of fixture.tools) {
      if (tool.runtimeMethod === 'bridge') continue;
      expect(runtimeKeys, `${tool.name} -> ${tool.runtimeMethod}`).toContain(tool.runtimeMethod);
    }
  });

  it('keeps write tools on validated command or scene-load paths', () => {
    const writeTools = fixture.tools.filter((tool) => tool.type === 'write');

    expect(writeTools.map((tool) => tool.name)).toEqual([
      'load_scene',
      'register_asset',
      'import_glb_asset',
      'update_transform',
      'write_scene_to_file',
      'reload_scene_from_file',
    ]);
    expect(writeTools.map((tool) => tool.runtimeMethod)).toEqual([
      'loadScene',
      'applyCommand',
      'applyCommand',
      'applyCommand',
      'bridge',
      'bridge',
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
