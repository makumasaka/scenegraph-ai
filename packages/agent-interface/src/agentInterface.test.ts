import { describe, expect, it } from 'vitest';
import { createNode, createEmptyScene } from '@diorama/core';
import {
  cloneSceneFromJson,
  parseSceneJson,
  serializeScene,
  validateScene,
} from '@diorama/schema';
import { createAgentSession } from './session';

describe('createAgentSession', () => {
  it('getScene returns a detached clone (no hidden shared mutation)', () => {
    const session = createAgentSession(createEmptyScene());
    const a = session.getScene();
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const rootId = a.data.scene.rootId;
    a.data.scene.nodes[rootId]!.name = 'Tampered';
    const b = session.getScene();
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.data.scene.nodes[rootId]!.name).toBe('Root');
  });

  it('applyCommand rejects invalid payloads with structured issues', () => {
    const session = createAgentSession(createEmptyScene());
    const r = session.applyCommand({ type: 'UPDATE_TRANSFORM', nodeId: 'nope', patch: {} });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('VALIDATION_ERROR');
    expect(r.error.issues?.length).toBeGreaterThan(0);
  });

  it('applyCommand rejects malformed transform patches before core reducer execution', () => {
    const session = createAgentSession(createEmptyScene());
    const empty = session.applyCommand({
      type: 'UPDATE_TRANSFORM',
      nodeId: 'anything',
      patch: {},
    });
    const malformed = session.applyCommand({
      type: 'UPDATE_TRANSFORM',
      nodeId: 'anything',
      patch: { position: [0, 0] },
    });
    const nonFinite = session.applyCommand({
      type: 'UPDATE_TRANSFORM',
      nodeId: 'anything',
      patch: { scale: [1, Number.NaN, 1] },
    });

    for (const result of [empty, malformed, nonFinite]) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.issues?.length).toBeGreaterThan(0);
    }
  });

  it('applyCommand reports core command rejections as structured errors', () => {
    const session = createAgentSession(createEmptyScene());
    const r = session.applyCommand({ type: 'DELETE_NODE', nodeId: 'missing' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('COMMAND_REJECTED');
    expect(r.error.message).toBe('DELETE_NODE nodeId does not exist');
  });

  it('applyCommand dryRun does not persist while reporting changed', () => {
    const session = createAgentSession(createEmptyScene());
    const root = session.getScene();
    expect(root.ok).toBe(true);
    if (!root.ok) return;
    const rootId = root.data.scene.rootId;
    const cmd = {
      type: 'ADD_NODE' as const,
      parentId: rootId,
      node: createNode({ id: 'box', name: 'Box' }),
    };
    const preview = session.applyCommand(cmd, { dryRun: true });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.data.dryRun).toBe(true);
    expect(preview.data.changed).toBe(true);
    expect(preview.data.scene.nodes.box).toBeDefined();
    const after = session.getScene();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.data.scene.nodes.box).toBeUndefined();
    const commit = session.applyCommand(cmd);
    expect(commit.ok).toBe(true);
    if (!commit.ok) return;
    expect(commit.data.dryRun).toBe(false);
    const committed = session.getScene();
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(committed.data.scene.nodes.box?.name).toBe('Box');
  });

  it('dryRunCommand is an explicit no-mutation preview with command metadata', () => {
    const session = createAgentSession(createEmptyScene());
    const root = session.getScene();
    expect(root.ok).toBe(true);
    if (!root.ok) return;
    const preview = session.dryRunCommand({
      type: 'ADD_NODE',
      parentId: root.data.scene.rootId,
      node: createNode({ id: 'preview-box', name: 'Preview Box' }),
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.data.dryRun).toBe(true);
    expect(preview.data.changed).toBe(true);
    expect(preview.data.summary.title).toBe('Add node');
    expect(preview.data.scene.nodes['preview-box']).toBeDefined();
    const after = session.getScene();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.data.scene.nodes['preview-box']).toBeUndefined();
    const log = session.getCommandLog();
    expect(log.ok).toBe(true);
    if (!log.ok) return;
    expect(log.data.entries).toEqual([]);
  });

  it('applyCommand logs committed commands with source and cloned payloads', () => {
    const session = createAgentSession(createEmptyScene());
    const root = session.getScene();
    expect(root.ok).toBe(true);
    if (!root.ok) return;
    const r = session.applyCommand(
      {
        type: 'ADD_NODE',
        parentId: root.data.scene.rootId,
        node: createNode({ id: 'logged-box', name: 'Logged Box' }),
      },
      { source: 'ui' },
    );
    expect(r.ok).toBe(true);
    const log = session.getCommandLog();
    expect(log.ok).toBe(true);
    if (!log.ok) return;
    expect(log.data.entries).toHaveLength(1);
    expect(log.data.entries[0]).toMatchObject({
      sequence: 1,
      source: 'ui',
      operation: 'command',
      dryRun: false,
      changed: true,
    });
    log.data.entries[0]!.changed = false;
    const reread = session.getCommandLog();
    expect(reread.ok).toBe(true);
    if (!reread.ok) return;
    expect(reread.data.entries[0]!.changed).toBe(true);
  });

  it('dryRunCommandBatch previews sequential changes without mutation', () => {
    const session = createAgentSession(createEmptyScene());
    const root = session.getScene();
    expect(root.ok).toBe(true);
    if (!root.ok) return;
    const preview = session.dryRunCommandBatch([
      {
        type: 'ADD_NODE',
        parentId: root.data.scene.rootId,
        node: createNode({ id: 'a', name: 'A' }),
      },
      { type: 'SET_SELECTION', nodeId: 'a' },
    ]);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.data.dryRun).toBe(true);
    expect(preview.data.changed).toBe(true);
    expect(preview.data.appliedCommandCount).toBe(0);
    expect(preview.data.results).toHaveLength(2);
    expect(preview.data.scene.selection).toBe('a');
    const after = session.getScene();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.data.scene.nodes.a).toBeUndefined();
    expect(after.data.scene.selection).toBeNull();
  });

  it('applyCommandBatch validates every payload before mutation', () => {
    const session = createAgentSession(createEmptyScene());
    const root = session.getScene();
    expect(root.ok).toBe(true);
    if (!root.ok) return;
    const r = session.applyCommandBatch([
      {
        type: 'ADD_NODE',
        parentId: root.data.scene.rootId,
        node: createNode({ id: 'a', name: 'A' }),
      },
      { type: 'UPDATE_TRANSFORM', nodeId: 'a', patch: {} },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('VALIDATION_ERROR');
    expect(r.error.issues?.some((issue) => issue.path[0] === 1)).toBe(true);
    const after = session.getScene();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.data.scene.nodes.a).toBeUndefined();
  });

  it('applyCommandBatch is atomic and stops on first semantic failure', () => {
    const session = createAgentSession(createEmptyScene());
    const root = session.getScene();
    expect(root.ok).toBe(true);
    if (!root.ok) return;
    const r = session.applyCommandBatch([
      {
        type: 'ADD_NODE',
        parentId: root.data.scene.rootId,
        node: createNode({ id: 'a', name: 'A' }),
      },
      { type: 'DELETE_NODE', nodeId: 'missing' },
      {
        type: 'ADD_NODE',
        parentId: root.data.scene.rootId,
        node: createNode({ id: 'b', name: 'B' }),
      },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.changed).toBe(false);
    expect(r.data.appliedCommandCount).toBe(0);
    expect(r.data.failedCommandIndex).toBe(1);
    expect(r.data.errors).toEqual([
      {
        index: 1,
        code: 'COMMAND_REJECTED',
        message: 'DELETE_NODE nodeId does not exist',
      },
    ]);
    expect(r.data.results).toHaveLength(1);
    expect(r.data.scene.nodes.a).toBeUndefined();
    const after = session.getScene();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.data.scene.nodes.a).toBeUndefined();
    expect(after.data.scene.nodes.b).toBeUndefined();
  });

  it('applyCommandBatch commits successful batches and logs one action', () => {
    const session = createAgentSession(createEmptyScene());
    const root = session.getScene();
    expect(root.ok).toBe(true);
    if (!root.ok) return;
    const r = session.applyCommandBatch(
      [
        {
          type: 'ADD_NODE',
          parentId: root.data.scene.rootId,
          node: createNode({ id: 'a', name: 'A' }),
        },
        { type: 'SET_SELECTION', nodeId: 'a' },
      ],
      { source: 'system' },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.appliedCommandCount).toBe(2);
    expect(r.data.scene.selection).toBe('a');
    const log = session.getCommandLog();
    expect(log.ok).toBe(true);
    if (!log.ok) return;
    expect(log.data.entries).toHaveLength(1);
    expect(log.data.entries[0]).toMatchObject({
      sequence: 1,
      source: 'system',
      operation: 'command_batch',
      dryRun: false,
      changed: true,
    });
    expect(log.data.entries[0]!.results).toHaveLength(2);
  });

  it('batch dry-run reports duplicate warnings without committing', () => {
    const session = createAgentSession(createEmptyScene());
    const root = session.getScene();
    expect(root.ok).toBe(true);
    if (!root.ok) return;
    const added = session.applyCommand({
      type: 'ADD_NODE',
      parentId: root.data.scene.rootId,
      node: createNode({ id: 'a', name: 'A' }),
    });
    expect(added.ok).toBe(true);
    const preview = session.dryRunCommandBatch([
      { type: 'DUPLICATE_NODE', nodeId: 'a', includeSubtree: false },
    ]);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.data.warnings).toEqual(['DUPLICATE_NODE without idMap uses generated ids']);
    expect(preview.data.results[0]!.warnings).toEqual([
      'DUPLICATE_NODE without idMap uses generated ids',
    ]);
    const log = session.getCommandLog();
    expect(log.ok).toBe(true);
    if (!log.ok) return;
    expect(log.data.entries).toHaveLength(1);
  });

  it('getSelection tracks SET_SELECTION', () => {
    const session = createAgentSession(createEmptyScene());
    const root = session.getScene();
    expect(root.ok).toBe(true);
    if (!root.ok) return;
    const rootId = root.data.scene.rootId;
    session.applyCommand({
      type: 'ADD_NODE',
      parentId: rootId,
      node: createNode({ id: 'a', name: 'A' }),
    });
    session.applyCommand({ type: 'SET_SELECTION', nodeId: 'a' });
    const sel = session.getSelection();
    expect(sel.ok).toBe(true);
    if (!sel.ok) return;
    expect(sel.data.selection).toBe('a');
  });

  it('loadScene roundtrips canonical JSON', () => {
    const base = createEmptyScene();
    const json = serializeScene(base);
    const session = createAgentSession();
    const loaded = session.loadScene({ kind: 'json', json });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(validateScene(loaded.data.scene)).toBe(true);
    const exported = session.exportScene({ format: 'json' });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(exported.data.content).toBe(json);
    expect(exported.data.mediaType).toBe('application/json');
  });

  it('loadScene reports PARSE_ERROR for garbage JSON', () => {
    const session = createAgentSession();
    const r = session.loadScene({ kind: 'json', json: 'not-json {{{' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('exportScene produces r3f jsx with media type', () => {
    const session = createAgentSession(createEmptyScene());
    const r = session.exportScene({ format: 'r3f' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.content).toContain('<group');
    expect(r.data.mediaType).toBe('text/jsx');
  });

  it('loadScene accepts embedded scene object', () => {
    const scene = cloneSceneFromJson(createEmptyScene());
    const session = createAgentSession();
    const r = session.loadScene({ kind: 'scene', scene });
    expect(r.ok).toBe(true);
  });

  /**
   * Coverage note: DUPLICATE_NODE `idMap` correctness is enforced in core
   * (`duplicate.ts`); this surface only validates shape before calling the reducer.
   */
});

describe('parseSceneJson roundtrip via agent session', () => {
  it('re-parses exported document JSON', () => {
    const session = createAgentSession(createEmptyScene());
    const ex = session.exportScene({ format: 'json' });
    expect(ex.ok).toBe(true);
    if (!ex.ok) return;
    const round = parseSceneJson(ex.data.content);
    expect(round).not.toBeNull();
    expect(validateScene(round!)).toBe(true);
  });
});
