import { describe, expect, it } from 'vitest';
import type { Scene } from '@diorama/schema';
import { validateScene } from '@diorama/schema';
import { applyCommand, type Command } from './commands';
import { collectSubtreeBfsOrder } from './duplicate';
import { assertSceneGraphInvariants } from './sceneInvariants';
import { createEmptyScene, createNode } from './scene';

/** Deterministic PRNG (mulberry32). */
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return (): number => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = <T>(rng: () => number, items: T[]): T | null =>
  items.length === 0 ? null : items[Math.floor(rng() * items.length)]!;

const buildDuplicateIdMap = (
  scene: Scene,
  nodeId: string,
  includeSubtree: boolean,
  allocId: () => string,
): Record<string, string> | null => {
  const ordered = includeSubtree
    ? collectSubtreeBfsOrder(scene, nodeId)
    : [nodeId];
  const map: Record<string, string> = {};
  for (const id of ordered) map[id] = allocId();
  return map;
};

describe('scene graph invariants (property-style stress)', () => {
  it('validateScene + structural checks hold across seeded random command streams', () => {
    const rng = mulberry32(20260422);
    let scene = createEmptyScene();
    let seq = 0;
    const allocId = () => `prop-${++seq}`;

    for (let step = 0; step < 400; step += 1) {
      const cmd = nextCommand(scene, rng, allocId);
      if (!cmd) break;
      const next = applyCommand(scene, cmd);
      assertSceneGraphInvariants(next);
      expect(validateScene(next)).toBe(true);
      for (const [nid, node] of Object.entries(next.nodes)) {
        expect(node.id).toBe(nid);
        const seen = new Set<string>();
        for (const c of node.children) {
          expect(seen.has(c)).toBe(false);
          seen.add(c);
          expect(next.nodes[c]).toBeDefined();
        }
      }
      if (next.selection !== null) {
        expect(next.nodes[next.selection]).toBeDefined();
      }
      scene = next;
      if (Object.keys(scene.nodes).length > 48) break;
    }
  });
});

function nextCommand(scene: Scene, rng: () => number, allocId: () => string): Command | null {
  const roll = rng();
  const ids = Object.keys(scene.nodes);
  const nonRoot = ids.filter((id) => id !== scene.rootId);

  if (roll < 0.28) {
    const parentId = pick(rng, ids);
    if (!parentId) return null;
    const nid = allocId();
    const node = createNode({
      id: nid,
      name: `Node ${nid}`,
      transform: {
        position: [(rng() - 0.5) * 4, (rng() - 0.5) * 4, (rng() - 0.5) * 4],
      },
    });
    return { type: 'ADD_NODE', parentId, node };
  }

  if (roll < 0.44 && nonRoot.length > 0) {
    const nodeId = pick(rng, nonRoot)!;
    return {
      type: 'UPDATE_TRANSFORM',
      nodeId,
      patch: {
        position: [(rng() - 0.5) * 2, (rng() - 0.5) * 2, (rng() - 0.5) * 2],
        rotation: [(rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5],
      },
    };
  }

  if (roll < 0.58 && nonRoot.length > 1) {
    const nodeId = pick(rng, nonRoot)!;
    const parentId = pick(
      rng,
      ids.filter((id) => id !== nodeId),
    )!;
    return {
      type: 'SET_PARENT',
      nodeId,
      parentId,
      preserveWorldTransform: rng() > 0.5,
    };
  }

  if (roll < 0.72 && nonRoot.length > 0) {
    const nodeId = pick(rng, nonRoot)!;
    const includeSubtree = rng() > 0.65;
    const idMap = buildDuplicateIdMap(scene, nodeId, includeSubtree, allocId);
    if (!idMap) return null;
    return {
      type: 'DUPLICATE_NODE',
      nodeId,
      includeSubtree,
      idMap,
    };
  }

  if (roll < 0.82 && nonRoot.length > 0) {
    const nodeId = pick(rng, nonRoot)!;
    return { type: 'DELETE_NODE', nodeId };
  }

  if (roll < 0.9) {
    const nodeId = rng() > 0.5 ? pick(rng, ids) : null;
    if (nodeId !== null && !scene.nodes[nodeId]) return null;
    return { type: 'SET_SELECTION', nodeId };
  }

  if (nonRoot.length >= 2) {
    const shuffled = [...nonRoot].sort(() => rng() - 0.5);
    const k = 2 + Math.floor(rng() * Math.min(4, shuffled.length));
    const nodeIds = shuffled.slice(0, k);
    const layout = pick(rng, ['line', 'grid', 'circle'] as const)!;
    return { type: 'ARRANGE_NODES', nodeIds, layout };
  }

  return null;
}
