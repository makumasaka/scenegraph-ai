import { describe, expect, it } from 'vitest';
import {
  componentNameForRole,
  sanitizeIdentifier,
  wrapperNameForGroup,
} from './semanticMapper';

describe('semantic mapper', () => {
  it('maps semantic roles to stable component names', () => {
    expect(componentNameForRole('product', 'mesh')).toBe('Product');
    expect(componentNameForRole('display', 'mesh')).toBe('DisplaySurface');
    expect(componentNameForRole('seating', 'mesh')).toBe('SeatingElement');
    expect(componentNameForRole('environment', 'mesh')).toBe('EnvironmentGroup');
    expect(componentNameForRole('lighting', 'light')).toBe('SceneLight');
  });

  it('falls back by node type when role is missing or unknown', () => {
    expect(componentNameForRole(undefined, 'mesh')).toBe('SceneMesh');
    expect(componentNameForRole(undefined, 'group')).toBe('SceneGroup');
    expect(componentNameForRole(undefined, 'light')).toBe('SceneLight');
    expect(componentNameForRole('unknown', 'empty')).toBe('SceneEmpty');
  });

  it('sanitizes labels into deterministic identifiers', () => {
    expect(sanitizeIdentifier('display area')).toBe('DisplayArea');
    expect(sanitizeIdentifier('123 product zone')).toBe('_123ProductZone');
    expect(sanitizeIdentifier('***', 'SceneSection')).toBe('SceneSection');
  });

  it('maps semantic group roles to wrapper names', () => {
    expect(wrapperNameForGroup('display', 'Display Area')).toBe('DisplayArea');
    expect(wrapperNameForGroup('seating', 'Seats')).toBe('SeatingArea');
    expect(wrapperNameForGroup('unknown', 'custom zone')).toBe('CustomZone');
  });
});
