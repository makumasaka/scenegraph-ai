import type { Scene, SceneNode } from '@diorama/schema';

export type InspectorField = {
  label: string;
  value: string;
  mono?: boolean;
};

export type HierarchyItem = {
  id: string;
  name: string;
  depth: number;
  type: SceneNode['type'];
  visible: boolean;
  selected: boolean;
  childCount: number;
};

export const inspectorFieldsForNode = (
  scene: Scene,
  nodeId: string,
): InspectorField[] => {
  const node = scene.nodes[nodeId];
  if (!node) return [];
  const role = node.semantics?.role ?? node.semanticRole ?? 'unknown';
  const groupId = node.semantics?.groupId ?? node.semanticGroupId ?? '-';
  const assetUri = node.assetRef?.kind === 'uri' ? node.assetRef.uri : '-';
  return [
    { label: 'Name', value: node.name },
    { label: 'ID', value: node.id, mono: true },
    { label: 'Type', value: node.type },
    { label: 'Visible', value: node.visible ? 'yes' : 'no' },
    { label: 'Role', value: role },
    { label: 'Group', value: groupId, mono: groupId !== '-' },
    { label: 'Asset', value: assetUri, mono: assetUri !== '-' },
  ];
};

export const sceneHierarchyItems = (scene: Scene): HierarchyItem[] => {
  const items: HierarchyItem[] = [];
  const visit = (nodeId: string, depth: number): void => {
    const node = scene.nodes[nodeId];
    if (!node) return;
    items.push({
      id: node.id,
      name: node.name,
      depth,
      type: node.type,
      visible: node.visible,
      selected: scene.selection === node.id,
      childCount: node.children.length,
    });
    for (const childId of node.children) visit(childId, depth + 1);
  };
  visit(scene.rootId, 0);
  return items;
};
