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
