import type { Vec3 } from './types';

export type ArrangeLayout = 'line' | 'grid' | 'circle';

export interface ArrangeOptions {
  spacing?: number;
  cols?: number;
  radius?: number;
  axis?: 'x' | 'y' | 'z';
}

const vecOnAxis = (axis: 'x' | 'y' | 'z', t: number, yDefault = 0.5): Vec3 => {
  switch (axis) {
    case 'x':
      return [t, yDefault, 0];
    case 'y':
      return [0, t, 0];
    case 'z':
      return [0, yDefault, t];
    default:
      return [t, yDefault, 0];
  }
};

/** Returns `count` world-space positions for the given layout (Y defaults to 0.5 for ground). */
export const computeArrangement = (
  count: number,
  layout: ArrangeLayout,
  options: ArrangeOptions = {},
): Vec3[] => {
  if (count <= 0) return [];

  const spacing = options.spacing ?? 1.25;
  const cols = Math.max(1, options.cols ?? Math.ceil(Math.sqrt(count)));
  const radius = options.radius ?? Math.max(2, count * 0.4);
  const axis = options.axis ?? 'x';

  const out: Vec3[] = [];

  for (let i = 0; i < count; i += 1) {
    if (layout === 'line') {
      const t = (i - (count - 1) / 2) * spacing;
      out.push(vecOnAxis(axis, t, 0.5));
    } else if (layout === 'grid') {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const rows = Math.ceil(count / cols);
      const cx = (col - (cols - 1) / 2) * spacing;
      const cz = (row - (rows - 1) / 2) * spacing;
      out.push([cx, 0.5, cz]);
    } else {
      const angle = (i / Math.max(count, 1)) * Math.PI * 2;
      out.push([Math.cos(angle) * radius, 0.5, Math.sin(angle) * radius]);
    }
  }

  return out;
};
