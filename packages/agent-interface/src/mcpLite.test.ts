import { describe, expect, it } from 'vitest';
import { parseSceneJson, type Scene } from '@diorama/schema';
import { showroomScene } from '@diorama/core';
import { createMcpLiteRuntime } from './mcpLite';

const expectOk = <T>(result: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected AgentResult ok');
  return result.data;
};

const sceneWithUnsafeMetadata = (): Scene => ({
  ...showroomScene,
  nodes: {
    ...showroomScene.nodes,
    product_01: {
      ...showroomScene.nodes.product_01!,
      metadata: {
        sourcePath: 'file:///Users/example/private.glb',
        scriptLike: '(() => console.log("do not emit"))()',
      },
      assetRef: { kind: 'uri', uri: 'file:///Users/example/private.glb' },
    },
  },
});

describe('createMcpLiteRuntime', () => {
  it('reads cloned scene state, semantic groups, and behaviors', () => {
    const runtime = createMcpLiteRuntime(showroomScene);

    const scene = expectOk(runtime.getScene()).scene;
    scene.nodes.product_01!.name = 'Tampered Product';

    expect(expectOk(runtime.getScene()).scene.nodes.product_01!.name).toBe('Product 01');
    expect(expectOk(runtime.getSemanticGroups()).semanticGroups).toEqual({});
    expect(expectOk(runtime.getBehaviors()).behaviors).toEqual({});

    expectOk(runtime.structureScene());
    expect(Object.keys(expectOk(runtime.getSemanticGroups()).semanticGroups)).toContain('display_area');
  });

  it('structureScene dry-run previews without persisting and apply persists', () => {
    const runtime = createMcpLiteRuntime(showroomScene);

    const preview = expectOk(runtime.structureScene({ preset: 'showroom', dryRun: true }));
    expect(preview.changed).toBe(true);
    expect(preview.dryRun).toBe(true);
    expect(preview.scene.semanticGroups?.display_area).toBeDefined();
    expect(expectOk(runtime.getSemanticGroups()).semanticGroups).toEqual({});

    const applied = expectOk(runtime.structureScene({ preset: 'showroom' }));
    expect(applied.changed).toBe(true);
    expect(applied.dryRun).toBe(false);
    expect(expectOk(runtime.getSemanticGroups()).semanticGroups.display_area).toBeDefined();
    expect(expectOk(runtime.getScene()).scene.nodes.product_01!.semantics?.role).toBe('product');
  });

  it('makeInteractive dry-run previews behavior refs and apply persists behavior definitions', () => {
    const runtime = createMcpLiteRuntime(showroomScene);
    expectOk(runtime.structureScene());

    const preview = expectOk(runtime.makeInteractive({ targetRole: 'product', dryRun: true }));
    expect(preview.changed).toBe(true);
    expect(preview.dryRun).toBe(true);
    expect(preview.scene.behaviors?.product_click_select).toBeDefined();
    expect(expectOk(runtime.getBehaviors()).behaviors).toEqual({});

    const applied = expectOk(runtime.makeInteractive({ targetRole: 'product' }));
    expect(applied.changed).toBe(true);
    expect(expectOk(runtime.getBehaviors()).behaviors.product_click_select).toBeDefined();
    expect(expectOk(runtime.getScene()).scene.nodes.product_01!.behaviorRefs).toContain(
      'product_click_select',
    );
  });

  it('arrangeNodes supports dry-run and apply through validated commands', () => {
    const runtime = createMcpLiteRuntime(showroomScene);
    const input = {
      nodeIds: ['product_01', 'product_02', 'product_03'],
      layout: 'line',
      options: { spacing: 1.5, axis: 'x' },
    };

    const before = expectOk(runtime.getScene()).scene.nodes.product_01!.transform.position;
    const preview = expectOk(runtime.arrangeNodes({ ...input, dryRun: true }));
    expect(preview.changed).toBe(true);
    expect(preview.dryRun).toBe(true);
    expect(expectOk(runtime.getScene()).scene.nodes.product_01!.transform.position).toEqual(before);

    const applied = expectOk(runtime.arrangeNodes(input));
    expect(applied.changed).toBe(true);
    expect(expectOk(runtime.getScene()).scene.nodes.product_01!.transform.position).not.toEqual(before);
  });

  it('dry-runs and applies command batches atomically', () => {
    const runtime = createMcpLiteRuntime(showroomScene);
    const commands = [
      { type: 'STRUCTURE_SCENE', preset: 'showroom' },
      { type: 'MAKE_INTERACTIVE', targetRole: 'product' },
    ];

    const preview = expectOk(runtime.dryRunCommandBatch(commands));
    expect(preview.changed).toBe(true);
    expect(preview.dryRun).toBe(true);
    expect(preview.scene.behaviors?.product_click_select).toBeDefined();
    expect(expectOk(runtime.getBehaviors()).behaviors).toEqual({});

    const failed = expectOk(runtime.applyCommandBatch([...commands, { type: 'DELETE_NODE', nodeId: 'missing' }]));
    expect(failed.errors[0]?.message).toBe('DELETE_NODE nodeId does not exist');
    expect(expectOk(runtime.getSemanticGroups()).semanticGroups).toEqual({});

    const applied = expectOk(runtime.applyCommandBatch(commands));
    expect(applied.errors).toEqual([]);
    expect(applied.appliedCommandCount).toBe(2);
    expect(expectOk(runtime.getBehaviors()).behaviors.product_click_select).toBeDefined();
  });

  it('exports canonical JSON and structured R3F module output', () => {
    const runtime = createMcpLiteRuntime(showroomScene);
    expectOk(runtime.structureScene());
    expectOk(runtime.makeInteractive({ targetRole: 'product' }));

    const json = expectOk(runtime.exportJSON());
    expect(json.format).toBe('json');
    expect(parseSceneJson(json.content)).not.toBeNull();

    const r3f = expectOk(
      runtime.exportR3F({ mode: 'module', componentName: 'McpLiteShowroom' }),
    );
    expect(r3f.format).toBe('r3f');
    expect(r3f.content).toContain('function Product');
    expect(r3f.content).toContain('function DisplaySurface');
    expect(r3f.content).toContain('handleSelect');
    expect(r3f.content).toContain('handleHoverStart');
    expect(r3f.content).not.toContain('commandLog');
    expect(r3f.content).not.toContain('actionLog');
  });

  it('returns validation errors for invalid helper payloads', () => {
    const runtime = createMcpLiteRuntime(showroomScene);
    const invalidStructure = runtime.structureScene({ preset: 'gallery' });
    const invalidArrange = runtime.arrangeNodes({ nodeIds: [], layout: 'spiral' });
    const invalidExport = runtime.exportR3F({ mode: 'server' });

    for (const result of [invalidStructure, invalidArrange, invalidExport]) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('does not expose unsafe capabilities or leak local paths into R3F output', () => {
    const runtime = createMcpLiteRuntime(sceneWithUnsafeMetadata());
    expectOk(runtime.structureScene());
    expectOk(runtime.makeInteractive({ targetRole: 'product' }));

    const exposedKeys = Object.keys(runtime).sort();
    expect(exposedKeys).not.toContain('filesystem');
    expect(exposedKeys).not.toContain('shell');
    expect(exposedKeys).not.toContain('zustand');
    expect(exposedKeys).not.toContain('r3fObject');
    expect(exposedKeys).not.toContain('mutateCode');

    const r3f = expectOk(runtime.exportR3F({ mode: 'module' }));
    expect(r3f.content).not.toContain('file:///');
    expect(r3f.content).not.toContain('/Users/example/private.glb');
    expect(r3f.content).not.toContain('console.log("do not emit")');
  });
});
