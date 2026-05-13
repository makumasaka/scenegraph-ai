import {
  parseSceneJson,
  serializeScene,
  type Scene,
} from '@diorama/schema';
import { sanitizeIdentifier } from './semanticMapper';
import type { R3fExportResult, R3fSyncModuleExportOptions } from './types';

export const DIORAMA_GENERATED_MARKER = '// @diorama-generated';
export const DIORAMA_SCENE_BLOCK_START = '// @diorama-scene-start';
export const DIORAMA_SCENE_BLOCK_END = '// @diorama-scene-end';

export type R3fSyncModuleSceneParseResult =
  | { ok: true; scene: Scene; json: string }
  | {
      ok: false;
      error: {
        code: 'SCENE_BLOCK_NOT_FOUND' | 'SCENE_BLOCK_INVALID';
        message: string;
      };
    };

const safeComponentName = (value: string | undefined): string =>
  sanitizeIdentifier(value ?? 'DioramaScene', 'DioramaScene');

const renderSyncModule = (
  sceneJson: string,
  componentName: string,
  includeStudioLights: boolean,
): string =>
  `/* eslint-disable */\n` +
  `${DIORAMA_GENERATED_MARKER}\n` +
  `/* This file is owned by Diorama. Edit dioramaScene for MVP code -> runtime sync. */\n` +
  `import { Suspense, useMemo } from 'react';\n` +
  `import { useGLTF } from '@react-three/drei';\n\n` +
  `type Vec3 = readonly [number, number, number];\n` +
  `type DioramaNode = {\n` +
  `  id: string;\n` +
  `  name: string;\n` +
  `  type: 'root' | 'group' | 'mesh' | 'light' | 'empty';\n` +
  `  visible: boolean;\n` +
  `  children: readonly string[];\n` +
  `  transform: { position: Vec3; rotation: Vec3; scale: Vec3 };\n` +
  `  metadata: Record<string, unknown>;\n` +
  `  assetRef?: { kind: 'none' } | { kind: 'uri'; uri: string };\n` +
  `  light?: { kind: 'ambient'; intensity?: number } | { kind: 'directional'; intensity?: number; castShadow?: boolean };\n` +
  `};\n` +
  `type DioramaSceneData = { rootId: string; nodes: Record<string, DioramaNode> };\n` +
  `type DioramaSceneDocument = { format: 'diorama-scene'; version: 2; data: DioramaSceneData };\n\n` +
  `export const dioramaScene = (\n` +
  `${DIORAMA_SCENE_BLOCK_START}\n` +
  `${sceneJson}\n` +
  `${DIORAMA_SCENE_BLOCK_END}\n` +
  `) as const satisfies DioramaSceneDocument;\n\n` +
  `function vec3(value: Vec3): [number, number, number] {\n` +
  `  return [value[0], value[1], value[2]];\n` +
  `}\n\n` +
  `function isRenderableAssetUri(uri: string | undefined): string | undefined {\n` +
  `  if (!uri || !/\\.(glb|gltf)(\\?|#|$)/i.test(uri)) return undefined;\n` +
  `  if (uri.startsWith('file://') || uri.startsWith('http://') || uri.startsWith('https://')) return undefined;\n` +
  `  if (uri.includes('/Users/') || uri.includes('\\\\Users\\\\')) return undefined;\n` +
  `  if (/^[a-zA-Z]:\\\\/.test(uri)) return undefined;\n` +
  `  if (uri.startsWith('/assets/') || uri.startsWith('assets/') || uri.startsWith('./') || uri.startsWith('../')) return uri;\n` +
  `  return undefined;\n` +
  `}\n\n` +
  `function AssetModel({ uri }: { uri: string }) {\n` +
  `  const gltf = useGLTF(uri);\n` +
  `  const object = useMemo(() => gltf.scene.clone(true), [gltf.scene]);\n` +
  `  return <primitive object={object} />;\n` +
  `}\n\n` +
  `function ProxyMesh() {\n` +
  `  return (\n` +
  `    <mesh castShadow receiveShadow>\n` +
  `      <boxGeometry args={[1, 1, 1]} />\n` +
  `      <meshStandardMaterial color="#94a3b8" />\n` +
  `    </mesh>\n` +
  `  );\n` +
  `}\n\n` +
  `function SceneNode({ scene, nodeId }: { scene: DioramaSceneData; nodeId: string }) {\n` +
  `  const node = scene.nodes[nodeId];\n` +
  `  if (!node || node.visible === false) return null;\n` +
  `  const hasLight = node.light !== undefined || node.type === 'light';\n` +
  `  const inspectOnly = node.metadata.renderMode === 'gltf-inspect-only';\n` +
  `  const assetUri = isRenderableAssetUri(node.assetRef?.kind === 'uri' ? node.assetRef.uri : undefined);\n` +
  `  const showMesh = node.type === 'mesh' && !hasLight && !inspectOnly;\n` +
  `  const showAsset = showMesh && assetUri !== undefined;\n` +
  `  const showProxy = showMesh && !showAsset;\n` +
  `  return (\n` +
  `    <group\n` +
  `      name={node.name}\n` +
  `      position={vec3(node.transform.position)}\n` +
  `      rotation={vec3(node.transform.rotation)}\n` +
  `      scale={vec3(node.transform.scale)}\n` +
  `      userData={{ dioramaId: node.id, sourceId: node.id }}\n` +
  `    >\n` +
  `      {hasLight && node.light?.kind === 'ambient' ? <ambientLight intensity={node.light.intensity ?? 0.4} /> : null}\n` +
  `      {hasLight && node.light?.kind === 'directional' ? <directionalLight intensity={node.light.intensity ?? 1} castShadow={node.light.castShadow} /> : null}\n` +
  `      {showAsset ? (\n` +
  `        <Suspense fallback={<ProxyMesh />}>\n` +
  `          <AssetModel uri={assetUri} />\n` +
  `        </Suspense>\n` +
  `      ) : null}\n` +
  `      {showProxy ? <ProxyMesh /> : null}\n` +
  `      {node.children.map((childId) => <SceneNode key={childId} scene={scene} nodeId={childId} />)}\n` +
  `    </group>\n` +
  `  );\n` +
  `}\n\n` +
  `export function ${componentName}() {\n` +
  `  const scene = dioramaScene.data;\n` +
  `  return (\n` +
  `    <>\n` +
  (includeStudioLights
    ? `      <ambientLight intensity={0.4} />\n` +
      `      <directionalLight castShadow position={[5, 8, 5]} intensity={1.1} />\n`
    : '') +
  `      <SceneNode scene={scene} nodeId={scene.rootId} />\n` +
  `    </>\n` +
  `  );\n` +
  `}\n`;

export const exportSceneToR3fSyncModule = (
  scene: Scene,
  options: R3fSyncModuleExportOptions = {},
): R3fExportResult => ({
  code: renderSyncModule(
    serializeScene(scene),
    safeComponentName(options.componentName),
    options.includeStudioLights === true || options.includeLights === true,
  ),
  diagnostics: [],
});

export const extractSceneJsonFromR3fSyncModule = (code: string): string | null => {
  const start = code.indexOf(DIORAMA_SCENE_BLOCK_START);
  const end = code.indexOf(DIORAMA_SCENE_BLOCK_END);
  if (start < 0 || end < 0 || end <= start) return null;
  return code.slice(start + DIORAMA_SCENE_BLOCK_START.length, end).trim();
};

export const parseSceneFromR3fSyncModule = (
  code: string,
): R3fSyncModuleSceneParseResult => {
  const json = extractSceneJsonFromR3fSyncModule(code);
  if (json === null) {
    return {
      ok: false,
      error: {
        code: 'SCENE_BLOCK_NOT_FOUND',
        message: 'Generated Diorama scene block was not found.',
      },
    };
  }
  const scene = parseSceneJson(json);
  if (scene === null) {
    return {
      ok: false,
      error: {
        code: 'SCENE_BLOCK_INVALID',
        message: 'Generated Diorama scene block failed JSON parsing or schema validation.',
      },
    };
  }
  return { ok: true, scene, json };
};
