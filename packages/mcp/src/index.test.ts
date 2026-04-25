import { describe, expect, it } from 'vitest';
import { createAgentSession } from './index';

describe('@diorama/mcp adapter surface', () => {
  it('re-exports the agent session API for future MCP tools', () => {
    const session = createAgentSession();
    const scene = session.getScene();
    expect(scene.ok).toBe(true);
  });
});
