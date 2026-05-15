import { describe, expect, it } from 'vitest';
import {
  DIORAMA_MCP_FORBIDDEN_CAPABILITIES,
  DIORAMA_MCP_TOOL_NAMES,
} from './index';

describe('Diorama MCP P0 tool contract', () => {
  it('keeps MCP as a narrow local-bridge control plane', () => {
    expect(DIORAMA_MCP_TOOL_NAMES).toEqual([
      'get_project_status',
      'get_scene',
      'load_scene',
      'register_asset',
      'import_glb_asset',
      'update_transform',
      'write_scene_to_file',
      'reload_scene_from_file',
      'export_r3f',
      'sync_code',
    ]);
  });

  it('does not expose generation, shell, filesystem, or generic mutation tools', () => {
    for (const forbidden of DIORAMA_MCP_FORBIDDEN_CAPABILITIES) {
      expect(DIORAMA_MCP_TOOL_NAMES).not.toContain(forbidden);
    }
  });
});
