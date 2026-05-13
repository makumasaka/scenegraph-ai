import { describe, expect, it } from 'vitest';
import { applyCommand, createNode, defaultFixtureScene } from '@diorama/core';
import { parseSceneJson, serializeScene, type Scene } from '@diorama/schema';
import {
  DIORAMA_GENERATED_MARKER,
  DIORAMA_SCENE_BLOCK_END,
  DIORAMA_SCENE_BLOCK_START,
  exportSceneToR3fSyncModule,
  extractSceneJsonFromR3fSyncModule,
  parseSceneFromR3fSyncModule,
} from './syncModule';

describe('R3F sync module export', () => {
  it('embeds a parseable canonical scene block and stable node identity metadata', () => {
    const result = exportSceneToR3fSyncModule(defaultFixtureScene, {
      includeStudioLights: true,
    });

    expect(result.code).toContain(DIORAMA_GENERATED_MARKER);
    expect(result.code).toContain(DIORAMA_SCENE_BLOCK_START);
    expect(result.code).toContain(DIORAMA_SCENE_BLOCK_END);
    expect(result.code).toContain('export const dioramaScene = (');
    expect(result.code).toContain('userData={{ dioramaId: node.id, sourceId: node.id }}');
    expect(result.code).toContain('export function DioramaScene()');

    const json = extractSceneJsonFromR3fSyncModule(result.code);
    expect(json).toBe(serializeScene(defaultFixtureScene));
    expect(parseSceneJson(json ?? '')).toEqual(defaultFixtureScene);
  });

  it('roundtrips edits to the embedded scene block without evaluating code', () => {
    const module = exportSceneToR3fSyncModule(defaultFixtureScene).code;
    const edited = module.replace(
      '"position": [\n            0,\n            0.5,\n            0\n          ]',
      '"position": [\n            7,\n            8,\n            9\n          ]',
    );

    const parsed = parseSceneFromR3fSyncModule(edited);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.scene.nodes['default-cube-1']?.transform.position).toEqual([7, 8, 9]);
  });

  it('emits GLB runtime scaffolding while preserving canonical asset refs', () => {
    const product = createNode({
      id: 'product',
      name: 'Product',
      assetRef: { kind: 'uri', uri: '/assets/diorama/product.glb' },
    });
    const root = createNode({
      id: 'root',
      name: 'Root',
      type: 'root',
      children: [product.id],
    });
    const scene: Scene = {
      rootId: root.id,
      selection: null,
      nodes: {
        [root.id]: root,
        [product.id]: product,
      },
      assets: {
        product: {
          id: 'product',
          name: 'Product',
          kind: 'glb',
          uri: '/assets/diorama/product.glb',
          source: 'manual',
        },
      },
    };

    const out = exportSceneToR3fSyncModule(scene).code;

    expect(out).toContain("import { useGLTF } from '@react-three/drei';");
    expect(out).toContain('function AssetModel');
    expect(out).toContain('/assets/diorama/product.glb');
    expect(parseSceneFromR3fSyncModule(out)).toEqual({
      ok: true,
      scene,
      json: serializeScene(scene),
    });
  });

  it('returns structured parse errors for missing or invalid scene blocks', () => {
    expect(parseSceneFromR3fSyncModule('export const nope = 1')).toEqual({
      ok: false,
      error: {
        code: 'SCENE_BLOCK_NOT_FOUND',
        message: 'Generated Diorama scene block was not found.',
      },
    });

    const invalid =
      `${DIORAMA_SCENE_BLOCK_START}\n` +
      `{"format":"diorama-scene","version":2,"data":{"rootId":"missing","nodes":{}}}\n` +
      `${DIORAMA_SCENE_BLOCK_END}`;

    expect(parseSceneFromR3fSyncModule(invalid)).toEqual({
      ok: false,
      error: {
        code: 'SCENE_BLOCK_INVALID',
        message: 'Generated Diorama scene block failed JSON parsing or schema validation.',
      },
    });
  });

  it('is deterministic after canonical transform commands', () => {
    const transformed = applyCommand(defaultFixtureScene, {
      type: 'UPDATE_TRANSFORM',
      nodeId: 'default-cube-1',
      patch: { position: [2, 3, 4] },
    });

    expect(exportSceneToR3fSyncModule(transformed).code).toBe(
      exportSceneToR3fSyncModule(transformed).code,
    );
  });
});
