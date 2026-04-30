import { describe, expect, it } from 'vitest';
import {
  createEmptyScene,
  createNode,
  galleryScene,
  showroomScene,
  type Command,
} from '@diorama/core';
import { exportSceneToR3fJsx } from '@diorama/export-r3f';
import { parseSceneJson, serializeScene, type Scene } from '@diorama/schema';
import type { AgentError } from './errors';
import { createAgentSession } from './session';

const expectOk = <T>(result: { ok: true; data: T } | { ok: false }): T => {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected ok result');
  return result.data;
};

const expectErr = <T>(
  result: { ok: true; data: T } | { ok: false; error: AgentError },
): AgentError => {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected error result');
  return result.error;
};

const selectedScene = (): Scene => {
  const root = createNode({
    id: 'agent-root',
    name: 'Root',
    type: 'root',
    children: ['agent-box'],
  });
  const box = createNode({ id: 'agent-box', name: 'Agent box' });
  return {
    rootId: root.id,
    selection: 'agent-box',
    nodes: {
      [root.id]: root,
      [box.id]: box,
    },
  };
};

const addBoxCommand = (rootId: string, id = 'box'): Command => ({
  type: 'ADD_NODE',
  parentId: rootId,
  node: createNode({ id, name: id }),
});

describe('Milestone 6 agent-ready internal API', () => {
  describe('inspection', () => {
    it('getScene returns detached scene clones that cannot mutate session state', () => {
      const session = createAgentSession(selectedScene());
      const first = expectOk(session.getScene()).scene;
      first.nodes['agent-box']!.name = 'Tampered';
      first.nodes['agent-root']!.children.push('secret-node');

      const second = expectOk(session.getScene()).scene;

      expect(second.nodes['agent-box']?.name).toBe('Agent box');
      expect(second.nodes['agent-root']?.children).toEqual(['agent-box']);
      expect(second).not.toBe(first);
      expect(second.nodes['agent-box']).not.toBe(first.nodes['agent-box']);
    });

    it('getSelection returns the current selection', () => {
      const session = createAgentSession(selectedScene());

      expect(expectOk(session.getSelection()).selection).toBe('agent-box');

      expectOk(session.applyCommand({ type: 'SET_SELECTION', nodeId: null }));

      expect(expectOk(session.getSelection()).selection).toBe(null);
    });
  });

  describe('single command', () => {
    it('dryRunCommand previews a valid command without mutating state or action log', () => {
      const session = createAgentSession(createEmptyScene());
      const rootId = expectOk(session.getScene()).scene.rootId;
      const preview = expectOk(session.dryRunCommand(addBoxCommand(rootId)));

      expect(preview.dryRun).toBe(true);
      expect(preview.changed).toBe(true);
      expect(preview.scene.nodes.box).toBeDefined();
      expect(expectOk(session.getScene()).scene.nodes.box).toBeUndefined();
      expect(expectOk(session.getCommandLog()).entries).toHaveLength(0);
    });

    it('applyCommand mutates through the core reducer and records a deterministic action', () => {
      const session = createAgentSession(createEmptyScene());
      const rootId = expectOk(session.getScene()).scene.rootId;
      const result = expectOk(
        session.applyCommand(addBoxCommand(rootId), { source: 'agent' }),
      );

      expect(result.dryRun).toBe(false);
      expect(result.changed).toBe(true);
      expect(result.summary.title).toBe('Add node');
      expect(expectOk(session.getScene()).scene.nodes.box).toBeDefined();
      expect(expectOk(session.getCommandLog()).entries).toEqual([
        expect.objectContaining({
          sequence: 1,
          source: 'agent',
          operation: 'command',
          dryRun: false,
          changed: true,
          command: expect.objectContaining({ type: 'ADD_NODE' }),
        }),
      ]);
    });

    it('rejects invalid schema payloads before reducer entry', () => {
      const session = createAgentSession(createEmptyScene());
      const before = expectOk(session.getScene()).scene;
      const error = expectErr(
        session.applyCommand({
          type: 'ADD_NODE',
          parentId: before.rootId,
          node: createNode({ id: 'box', name: 'Box' }),
          shell: 'rm -rf .',
        }),
      );

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(expectOk(session.getScene()).scene).toEqual(before);
      expect(expectOk(session.getCommandLog()).entries).toHaveLength(0);
    });

    it('returns structured errors for schema-valid but semantically invalid commands', () => {
      const session = createAgentSession(createEmptyScene());
      const error = expectErr(session.applyCommand({ type: 'DELETE_NODE', nodeId: 'missing' }));

      expect(error.code).toBe('COMMAND_REJECTED');
      expect(error.message).toBe('DELETE_NODE nodeId does not exist');
      expect(expectOk(session.getCommandLog()).entries).toHaveLength(0);
    });

    it('surfaces warnings for nondeterministic duplicate ids', () => {
      const session = createAgentSession(createEmptyScene());
      const rootId = expectOk(session.getScene()).scene.rootId;
      expectOk(session.applyCommand(addBoxCommand(rootId, 'source')));

      const duplicate = expectOk(
        session.applyCommand({
          type: 'DUPLICATE_NODE',
          nodeId: 'source',
          includeSubtree: false,
        }),
      );

      expect(duplicate.warnings).toEqual(['DUPLICATE_NODE without idMap uses generated ids']);
      expect(expectOk(session.getCommandLog()).entries.at(-1)?.warnings).toEqual(
        duplicate.warnings,
      );
    });
  });

  describe('batch commands', () => {
    const batch = (rootId: string): Command[] => [
      addBoxCommand(rootId, 'box'),
      { type: 'SET_SELECTION', nodeId: 'box' },
      { type: 'UPDATE_TRANSFORM', nodeId: 'box', patch: { position: [1, 2, 3] } },
    ];

    it('dryRunCommandBatch returns per-command results without mutating', () => {
      const session = createAgentSession(createEmptyScene());
      const rootId = expectOk(session.getScene()).scene.rootId;
      const result = expectOk(session.dryRunCommandBatch(batch(rootId)));

      expect(result.dryRun).toBe(true);
      expect(result.changed).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.errors).toEqual([]);
      expect(result.appliedCommandCount).toBe(0);
      expect(result.scene.nodes.box?.transform.position).toEqual([1, 2, 3]);
      expect(expectOk(session.getScene()).scene.nodes.box).toBeUndefined();
      expect(expectOk(session.getCommandLog()).entries).toHaveLength(0);
    });

    it('applyCommandBatch applies a valid sequence and logs one batch action', () => {
      const session = createAgentSession(createEmptyScene());
      const rootId = expectOk(session.getScene()).scene.rootId;
      const result = expectOk(session.applyCommandBatch(batch(rootId)));

      expect(result.changed).toBe(true);
      expect(result.appliedCommandCount).toBe(3);
      expect(result.results.map((item) => item.index)).toEqual([0, 1, 2]);
      expect(expectOk(session.getScene()).scene.nodes.box?.transform.position).toEqual([1, 2, 3]);
      expect(expectOk(session.getSelection()).selection).toBe('box');
      expect(expectOk(session.getCommandLog()).entries).toEqual([
        expect.objectContaining({
          sequence: 1,
          operation: 'command_batch',
          dryRun: false,
          changed: true,
        }),
      ]);
    });

    it('uses all-or-nothing failure policy for semantic batch failures', () => {
      const session = createAgentSession(createEmptyScene());
      const rootId = expectOk(session.getScene()).scene.rootId;
      const result = expectOk(
        session.applyCommandBatch([
          addBoxCommand(rootId, 'box'),
          { type: 'DELETE_NODE', nodeId: 'missing' },
          { type: 'SET_SELECTION', nodeId: 'box' },
        ]),
      );

      expect(result.changed).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.errors).toEqual([
        {
          index: 1,
          code: 'COMMAND_REJECTED',
          message: 'DELETE_NODE nodeId does not exist',
        },
      ]);
      expect(result.appliedCommandCount).toBe(0);
      expect(result.failedCommandIndex).toBe(1);
      expect(expectOk(session.getScene()).scene.nodes.box).toBeUndefined();
      expect(expectOk(session.getCommandLog()).entries).toHaveLength(0);
    });

    it('reports schema-invalid commands in a batch clearly', () => {
      const session = createAgentSession(createEmptyScene());
      const rootId = expectOk(session.getScene()).scene.rootId;
      const error = expectErr(
        session.applyCommandBatch([
          addBoxCommand(rootId, 'box'),
          { type: 'UPDATE_TRANSFORM', nodeId: 'box', patch: {} },
        ]),
      );

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid command batch payload');
      expect(error.issues?.some((issue) => issue.path.includes(1))).toBe(true);
      expect(expectOk(session.getScene()).scene.nodes.box).toBeUndefined();
    });

    it('replays deterministic duplicate idMap batches exactly', () => {
      const initial = createEmptyScene();
      const replay = () => {
        const session = createAgentSession(initial);
        const rootId = expectOk(session.getScene()).scene.rootId;
        const result = expectOk(
          session.applyCommandBatch([
            addBoxCommand(rootId, 'source'),
            {
              type: 'DUPLICATE_NODE',
              nodeId: 'source',
              includeSubtree: false,
              idMap: { source: 'source-copy' },
            },
            { type: 'SET_SELECTION', nodeId: 'source-copy' },
          ]),
        );
        return result.scene;
      };

      expect(replay()).toEqual(replay());
    });
  });

  describe('load scene', () => {
    it('loads valid scene objects and JSON documents', () => {
      const session = createAgentSession();
      const loadedScene = expectOk(session.loadScene({ kind: 'scene', scene: showroomScene }));
      const loadedJson = expectOk(
        session.loadScene({ kind: 'json', json: serializeScene(galleryScene) }),
      );

      expect(loadedScene.scene.rootId).toBe('showroom-root');
      expect(loadedJson.scene.rootId).toBe('gallery-root');
      expect(expectOk(session.getScene()).scene.rootId).toBe('gallery-root');
    });

    it('rejects invalid scenes and invalid JSON without mutating current scene', () => {
      const session = createAgentSession(showroomScene);
      const invalidScene = { ...showroomScene, rootId: 'missing-root' };
      const invalidSceneError = expectErr(
        session.loadScene({ kind: 'scene', scene: invalidScene }),
      );
      const invalidJsonError = expectErr(session.loadScene({ kind: 'json', json: 'not json' }));

      expect(invalidSceneError.code).toBe('VALIDATION_ERROR');
      expect(invalidJsonError.code).toBe('PARSE_ERROR');
      expect(expectOk(session.getScene()).scene.rootId).toBe('showroom-root');
    });

    it('loadScene is logged as a session boundary action', () => {
      const session = createAgentSession(createEmptyScene());
      const rootId = expectOk(session.getScene()).scene.rootId;
      expectOk(session.applyCommand(addBoxCommand(rootId)));
      expectOk(session.loadScene({ kind: 'scene', scene: galleryScene }));

      expect(expectOk(session.getCommandLog()).entries).toEqual([
        expect.objectContaining({ sequence: 1, operation: 'command' }),
        expect.objectContaining({
          sequence: 2,
          source: 'import',
          operation: 'load_scene',
          dryRun: false,
          changed: true,
        }),
      ]);
    });
  });

  describe('export', () => {
    it('exportScene("json") uses canonical JSON serialization', () => {
      const session = createAgentSession(showroomScene);
      const exported = expectOk(session.exportScene({ format: 'json' }));

      expect(exported.mediaType).toBe('application/json');
      expect(exported.content).toBe(serializeScene(showroomScene));
      expect(parseSceneJson(exported.content)).toEqual(showroomScene);
    });

    it('exportScene("r3f") uses canonical R3F exporter', () => {
      const session = createAgentSession(showroomScene);
      const exported = expectOk(
        session.exportScene({ format: 'r3f', r3f: { includeStudioLights: true } }),
      );

      expect(exported.mediaType).toBe('text/jsx');
      expect(exported.content).toBe(
        exportSceneToR3fJsx(showroomScene, { includeStudioLights: true }),
      );
    });

    it('export after batch reflects the current scene', () => {
      const session = createAgentSession(createEmptyScene());
      const rootId = expectOk(session.getScene()).scene.rootId;
      expectOk(session.applyCommandBatch(batchWithTransform(rootId)));

      const exported = expectOk(session.exportScene({ format: 'json' }));
      const parsed = parseSceneJson(exported.content);

      expect(parsed?.nodes.box?.transform.position).toEqual([4, 5, 6]);
    });
  });

  describe('action log policy', () => {
    it('logs agent actions deterministically without timestamps', () => {
      const session = createAgentSession(createEmptyScene());
      const rootId = expectOk(session.getScene()).scene.rootId;
      expectOk(session.applyCommand(addBoxCommand(rootId), { source: 'agent' }));
      expectOk(session.applyCommandBatch([
        { type: 'SET_SELECTION', nodeId: 'box' },
        { type: 'UPDATE_TRANSFORM', nodeId: 'box', patch: { position: [1, 1, 1] } },
      ]));

      const entries = expectOk(session.getCommandLog()).entries;
      expect(entries.map((entry) => entry.sequence)).toEqual([1, 2]);
      expect(entries.every((entry) => !('timestamp' in entry))).toBe(true);
      expect(entries[0]).toEqual(expect.objectContaining({ operation: 'command' }));
      expect(entries[1]).toEqual(expect.objectContaining({ operation: 'command_batch' }));
    });

    it('does not log dry-run actions or rejected commands under the accepted policy', () => {
      const session = createAgentSession(createEmptyScene());
      const rootId = expectOk(session.getScene()).scene.rootId;
      expectOk(session.dryRunCommand(addBoxCommand(rootId)));
      expectErr(session.applyCommand({ type: 'DELETE_NODE', nodeId: 'missing' }));
      expectOk(
        session.dryRunCommandBatch([
          addBoxCommand(rootId),
          { type: 'SET_SELECTION', nodeId: 'box' },
        ]),
      );

      expect(expectOk(session.getCommandLog()).entries).toHaveLength(0);
    });

    it('getCommandLog returns safe copies', () => {
      const session = createAgentSession(createEmptyScene());
      const rootId = expectOk(session.getScene()).scene.rootId;
      expectOk(session.applyCommand(addBoxCommand(rootId)));

      const first = expectOk(session.getCommandLog()).entries;
      first[0]!.changed = false;
      first[0]!.command = { type: 'DELETE_NODE', nodeId: 'box' };

      const second = expectOk(session.getCommandLog()).entries;
      expect(second[0]?.changed).toBe(true);
      expect(second[0]?.command).toEqual(expect.objectContaining({ type: 'ADD_NODE' }));
    });
  });

  describe('safety surface', () => {
    it('does not expose filesystem, shell, eval, Zustand, or R3F object capabilities', () => {
      const session = createAgentSession();
      const keys = Object.keys(session).sort();

      expect(keys).toEqual([
        'applyCommand',
        'applyCommandBatch',
        'dryRunCommand',
        'dryRunCommandBatch',
        'exportScene',
        'getCommandLog',
        'getScene',
        'getSelection',
        'loadScene',
      ]);
      expect('readFile' in session).toBe(false);
      expect('writeFile' in session).toBe(false);
      expect('shell' in session).toBe(false);
      expect('exec' in session).toBe(false);
      expect('eval' in session).toBe(false);
      expect('setState' in session).toBe(false);
      expect('getObject3D' in session).toBe(false);
    });

    it('rejects arbitrary execution-shaped payloads through validation', () => {
      const session = createAgentSession();

      expectErr(session.applyCommand({ type: 'RUN_JS', code: 'globalThis.pwned = true' }));
      expectErr(session.loadScene({ kind: 'file', path: '/tmp/scene.json' }));
      expectErr(session.exportScene({ format: 'json', path: '/tmp/scene.json' }));

      expect((globalThis as { pwned?: boolean }).pwned).toBeUndefined();
    });
  });
});

const batchWithTransform = (rootId: string): Command[] => [
  addBoxCommand(rootId),
  { type: 'UPDATE_TRANSFORM', nodeId: 'box', patch: { position: [4, 5, 6] } },
];
