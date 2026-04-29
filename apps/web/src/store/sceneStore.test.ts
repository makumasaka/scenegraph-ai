import { describe, expect, it, beforeEach } from 'vitest';
import { exportSceneToR3fJsx } from '@diorama/export-r3f';
import { getStarterScene, parseSceneJson } from '@diorama/core';
import { useSceneStore } from './sceneStore';

describe('sceneStore — history + command log regression', () => {
  beforeEach(() => {
    useSceneStore.getState().reset();
  });

  it('does not append SET_SELECTION to the command log', () => {
    const root = useSceneStore.getState().scene.rootId;
    useSceneStore.getState().select(root);
    expect(useSceneStore.getState().commandLog).toHaveLength(0);
  });

  it('clears history and command log on REPLACE_SCENE', () => {
    const cube = useSceneStore.getState().scene.nodes[
      useSceneStore.getState().scene.rootId
    ]!.children[0]!;
    useSceneStore.getState().dispatch({
      type: 'UPDATE_TRANSFORM',
      nodeId: cube,
      patch: { position: [0, 2, 0] },
    });
    expect(useSceneStore.getState().commandLog.length).toBeGreaterThan(0);
    useSceneStore.getState().dispatch({
      type: 'REPLACE_SCENE',
      scene: getStarterScene('showroom'),
    });
    expect(useSceneStore.getState().commandLog).toHaveLength(0);
    expect(useSceneStore.getState().past).toHaveLength(0);
    expect(useSceneStore.getState().future).toHaveLength(0);
  });

  it('resets to the default scene as a session boundary', () => {
    useSceneStore.getState().dispatch({
      type: 'REPLACE_SCENE',
      scene: getStarterScene('gallery'),
    });
    const child = useSceneStore.getState().scene.nodes[
      useSceneStore.getState().scene.rootId
    ]!.children[0]!;
    useSceneStore.getState().dispatch({
      type: 'UPDATE_TRANSFORM',
      nodeId: child,
      patch: { position: [4, 0, 0] },
    });

    useSceneStore.getState().reset();

    expect(useSceneStore.getState().scene.rootId).toBe('default-root');
    expect(useSceneStore.getState().commandLog).toHaveLength(0);
    expect(useSceneStore.getState().past).toHaveLength(0);
    expect(useSceneStore.getState().future).toHaveLength(0);
  });

  it('coalesces consecutive UPDATE_TRANSFORM for the same node into one past entry', () => {
    const cube = useSceneStore.getState().scene.nodes[
      useSceneStore.getState().scene.rootId
    ]!.children[0]!;
    useSceneStore.getState().dispatch({
      type: 'UPDATE_TRANSFORM',
      nodeId: cube,
      patch: { position: [0, 1.5, 0] },
    });
    const pastAfterFirst = useSceneStore.getState().past.length;
    useSceneStore.getState().dispatch({
      type: 'UPDATE_TRANSFORM',
      nodeId: cube,
      patch: { position: [0, 2.5, 0] },
    });
    expect(useSceneStore.getState().past.length).toBe(pastAfterFirst);
    useSceneStore.getState().undo();
    const y = useSceneStore.getState().scene.nodes[cube]!.transform.position[1];
    expect(y).toBe(0.5);
  });

  it('undo/redo restores scene snapshots', () => {
    const cube = useSceneStore.getState().scene.nodes[
      useSceneStore.getState().scene.rootId
    ]!.children[0]!;
    useSceneStore.getState().dispatch({
      type: 'UPDATE_TRANSFORM',
      nodeId: cube,
      patch: { position: [3, 0, 0] },
    });
    useSceneStore.getState().undo();
    expect(useSceneStore.getState().scene.nodes[cube]!.transform.position[0]).toBe(0);
    useSceneStore.getState().redo();
    expect(useSceneStore.getState().scene.nodes[cube]!.transform.position[0]).toBe(3);
  });

  it('importSceneJson dispatches REPLACE_SCENE', () => {
    const text = JSON.stringify({
      format: 'diorama-scene',
      version: 1,
      data: getStarterScene('gallery'),
    });
    const ok = useSceneStore.getState().importSceneJson(text);
    expect(ok).toBe(true);
    expect(useSceneStore.getState().scene.rootId).toBe('gallery-root');
  });

  it('exportSceneJson roundtrips through parseSceneJson', () => {
    const text = useSceneStore.getState().exportSceneJson();
    const parsed = parseSceneJson(text);
    expect(parsed).toEqual(useSceneStore.getState().scene);
  });

  it('export R3F string is stable for the current scene graph', () => {
    const jsx = exportSceneToR3fJsx(useSceneStore.getState().scene);
    expect(jsx).toContain('<group name="Root"');
    expect(jsx).toContain('/* Auto-generated for React Three Fiber');
  });
});
