import { describe, expect, it } from 'vitest';
import { applyCommand, showroomScene } from '@diorama/core';
import type { Scene } from '@diorama/schema';
import { exportSceneToR3fJsx, exportSceneToR3fModule } from './r3f';

const forbiddenInExport = [
  '"selection"',
  'commandLog',
  '"past"',
  '"future"',
  'gizmoMode',
  'UPDATE_TRANSFORM',
  'SET_SELECTION',
  'command_batch',
  '/Users/',
  'file:///',
  '\\Users\\',
] as const;

const assertCleanArtifact = (code: string): void => {
  for (const needle of forbiddenInExport) {
    expect(code, `unexpected leak: ${needle}`).not.toContain(needle);
  }
};

describe('MCP-lite showroom → R3F export validation', () => {
  const messy = showroomScene;

  const structured = applyCommand(messy, {
    type: 'STRUCTURE_SCENE',
    preset: 'showroom',
  });

  const interactive = applyCommand(structured, { type: 'MAKE_INTERACTIVE', targetRole: 'product' });

  const arranged = applyCommand(interactive, {
    type: 'ARRANGE_NODES',
    nodeIds: ['product_01', 'product_02', 'product_03'],
    layout: 'line',
    options: { spacing: 1.25, axis: 'x' },
  });

  const fullWorkflow = applyCommand(
    applyCommand(
      applyCommand(showroomScene, { type: 'STRUCTURE_SCENE', preset: 'showroom' }),
      { type: 'MAKE_INTERACTIVE', targetRole: 'product' },
    ),
    {
      type: 'ARRANGE_NODES',
      nodeIds: ['product_01', 'product_02', 'product_03'],
      layout: 'line',
      options: { spacing: 1.25, axis: 'x' },
    },
  );

  it('01 messy showroom (before STRUCTURE_SCENE) — fragment snapshot', () => {
    const out = exportSceneToR3fJsx(messy);
    assertCleanArtifact(out);
    expect(out).not.toMatch(/Semantic groups:/);
    expect(out).toMatchSnapshot('01-messy-fragment');
  });

  it('02 after STRUCTURE_SCENE — semantic groups + traits in comments', () => {
    const out = exportSceneToR3fJsx(structured);
    assertCleanArtifact(out);
    expect(out).toContain('Semantic groups:');
    expect(out).toContain('semantics: role=product');
    expect(out).toContain('traits=');
    expect(out).toMatchSnapshot('02-structured-fragment');
  });

  it('03 after MAKE_INTERACTIVE — behavior refs + behavior header', () => {
    const out = exportSceneToR3fJsx(interactive);
    assertCleanArtifact(out);
    expect(out).toContain('Behaviors:');
    expect(out).toContain('"behaviorRefs"');
    expect(out).toContain('product_click_select');
    expect(out).toMatchSnapshot('03-interactive-fragment');
  });

  it('04 after ARRANGE_NODES — positions change; semantics preserved', () => {
    const out = exportSceneToR3fJsx(arranged);
    assertCleanArtifact(out);
    expect(out).toContain('position={[-1.25, 0.5, 0]}');
    expect(out).toContain('semantics: role=product');
    expect(out).toMatchSnapshot('04-arranged-fragment');
  });

  it('05 full workflow — deterministic duplicate export', () => {
    const a = exportSceneToR3fJsx(fullWorkflow);
    const b = exportSceneToR3fJsx(fullWorkflow);
    expect(a).toBe(b);
    assertCleanArtifact(a);
    expect(a).toMatchSnapshot('05-workflow-fragment');
  });

  it('05 full workflow — module: semantic components + handler scaffolding', () => {
    const { code } = exportSceneToR3fModule(fullWorkflow, {
      componentName: 'McpLiteShowroom',
      includeStudioLights: false,
      behaviorScaffold: 'handlers',
      semanticComponents: true,
    });
    assertCleanArtifact(code);
    expect(code).toContain('handleHoverStart');
    expect(code).toContain('TODO: anchor_point');
    expect(code).toMatchSnapshot('05-workflow-module');
  });

  it('rejects editor/agent envelope fields injected onto the scene object', () => {
    const poisoned = {
      ...interactive,
      selection: 'product_01',
      commandLog: [{ op: 'fake' }],
      past: [messy],
      future: [],
      gizmoMode: 'rotate',
    } as Scene & {
      commandLog: unknown[];
      past: Scene[];
      future: Scene[];
      gizmoMode: string;
    };

    poisoned.nodes = {
      ...poisoned.nodes,
      product_01: {
        ...poisoned.nodes.product_01!,
        metadata: {
          ...poisoned.nodes.product_01!.metadata,
          sourcePath: 'C:\\secret\\blueprint.diorama',
          uri: 'file:///C:/secret/model.glb',
        },
        assetRef: { kind: 'uri', uri: 'file:///C:/secret/model.glb' },
      },
    };

    const out = exportSceneToR3fJsx(poisoned);
    assertCleanArtifact(out);
    expect(out).not.toContain('secret');
    expect(out).not.toContain('file:///');
    expect(out).not.toContain('C:\\\\');
  });
});
