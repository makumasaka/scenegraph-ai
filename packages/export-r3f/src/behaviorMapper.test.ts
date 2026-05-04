import { describe, expect, it } from 'vitest';
import { createNode } from '@diorama/core';
import type { Scene } from '@diorama/schema';
import { resolveBehaviorRequirements } from './behaviorMapper';

const root = createNode({
  id: 'root',
  name: 'Root',
  type: 'root',
  children: ['product'],
});

const baseProduct = createNode({
  id: 'product',
  name: 'Product',
  semantics: {
    role: 'product',
    traits: ['clickable', 'hoverable', 'displayable', 'focusable'],
  },
});

const sceneForProduct = (node = baseProduct): Scene => ({
  rootId: root.id,
  selection: null,
  nodes: { [root.id]: root, [node.id]: node },
});

describe('behavior mapper', () => {
  it('maps explicit behavior refs before trait hints', () => {
    const node = {
      ...baseProduct,
      behaviorRefs: ['product_hover', 'product_info'],
    };
    const scene: Scene = {
      ...sceneForProduct(node),
      behaviors: {
        product_hover: {
          id: 'product_hover',
          type: 'hover_highlight',
          nodeIds: ['product'],
        },
        product_info: {
          id: 'product_info',
          type: 'show_info',
          nodeIds: ['product'],
          params: { title: 'Product info', description: 'Details' },
        },
      },
    };

    const requirements = resolveBehaviorRequirements(scene, node);
    expect(requirements.map((r) => r.type)).toEqual([
      'hover_highlight',
      'show_info',
      'click_select',
      'focus_camera',
    ]);
    expect(requirements.find((r) => r.type === 'show_info')?.title).toBe('Product info');
  });

  it('maps legacy behavior fields to requirements', () => {
    const node = createNode({
      id: 'legacy',
      name: 'Legacy Product',
      behaviors: {
        hoverHighlight: true,
        clickSelect: true,
        focusOnClick: true,
        info: { title: 'Legacy info' },
      },
    });
    const scene = sceneForProduct(node);
    const requirements = resolveBehaviorRequirements(scene, node);
    expect(requirements.map((r) => r.type)).toEqual([
      'hover_highlight',
      'click_select',
      'focus_camera',
      'show_info',
    ]);
  });

  it('maps traits to behavior hints without creating fake behavior ids', () => {
    const node = createNode({
      id: 'trait-only',
      name: 'Trait only',
      semantics: { traits: ['clickable', 'hoverable', 'displayable'] },
    });
    const requirements = resolveBehaviorRequirements(sceneForProduct(node), node);
    expect(requirements).toEqual([
      { type: 'click_select', source: 'trait' },
      { type: 'hover_highlight', source: 'trait' },
      { type: 'show_info', source: 'trait' },
    ]);
  });

  it('keeps advanced behaviors as requirements for TODO scaffolds', () => {
    const node = { ...baseProduct, behaviorRefs: ['product_url', 'product_spin'] };
    const scene: Scene = {
      ...sceneForProduct(node),
      behaviors: {
        product_url: {
          id: 'product_url',
          type: 'open_url',
          nodeIds: ['product'],
          params: { url: 'https://example.com' },
        },
        product_spin: {
          id: 'product_spin',
          type: 'rotate_idle',
          nodeIds: ['product'],
        },
      },
    };
    expect(resolveBehaviorRequirements(scene, node).map((r) => r.type)).toEqual([
      'open_url',
      'rotate_idle',
      'click_select',
      'hover_highlight',
      'show_info',
      'focus_camera',
    ]);
  });
});
