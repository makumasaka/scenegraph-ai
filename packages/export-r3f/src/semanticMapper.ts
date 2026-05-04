import type { NodeType, SemanticRole } from '@diorama/schema';

const ROLE_COMPONENTS: Record<SemanticRole, string> = {
  product: 'Product',
  display: 'DisplaySurface',
  seating: 'SeatingElement',
  lighting: 'SceneLight',
  light: 'SceneLight',
  environment: 'EnvironmentGroup',
  navigation: 'NavigationMarker',
  decor: 'DecorElement',
  container: 'SceneSection',
  unknown: 'SceneMesh',
};

const TYPE_FALLBACK_COMPONENTS: Record<NodeType, string> = {
  root: 'SceneGroup',
  group: 'SceneGroup',
  mesh: 'SceneMesh',
  light: 'SceneLight',
  empty: 'SceneEmpty',
};

const GROUP_WRAPPERS: Partial<Record<SemanticRole, string>> = {
  product: 'ProductGroup',
  display: 'DisplayArea',
  seating: 'SeatingArea',
  lighting: 'LightingZone',
  light: 'LightingZone',
  environment: 'EnvironmentGroup',
  navigation: 'NavigationArea',
  decor: 'DecorGroup',
  container: 'SceneSection',
};

export const sanitizeIdentifier = (raw: string, fallback = 'GeneratedComponent'): string => {
  const words = raw
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const pascal = words
    .map((word) => `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`)
    .join('');
  const candidate = pascal || fallback;
  return /^[A-Za-z_]/.test(candidate) ? candidate : `_${candidate}`;
};

export const componentNameForRole = (
  role: SemanticRole | undefined,
  nodeType: NodeType,
): string => {
  if (role && role !== 'unknown') return ROLE_COMPONENTS[role];
  return TYPE_FALLBACK_COMPONENTS[nodeType];
};

export const wrapperNameForGroup = (role: SemanticRole, name: string): string =>
  GROUP_WRAPPERS[role] ?? sanitizeIdentifier(name, 'SceneSection');
