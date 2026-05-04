import type { SceneLight, Vec3 } from '@diorama/schema';

/**
 * Stable numeric formatting. Integers render without a decimal point; finite
 * non-integers use the default `String` representation. JSON.stringify already
 * normalises `-0` to `0`, and `String(-0) === '0'`, so deterministic byte
 * output is preserved.
 */
export const fmtNum = (n: number): string => String(n);

export const fmtVec = (v: Vec3): string =>
  `[${fmtNum(v[0])}, ${fmtNum(v[1])}, ${fmtNum(v[2])}]`;

export const indent = (depth: number): string => '  '.repeat(depth);

export const escapeAttr = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');

export const escapeStringLiteral = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ');

export const escapeComment = (s: string): string => s.replace(/\*\//g, '* /');

/** Neutral primitive proxy used for `mesh` nodes. Keeps export readable. */
export const placeholderMesh = (baseIndent: string): string =>
  `${baseIndent}<mesh castShadow receiveShadow>\n` +
  `${baseIndent}  <boxGeometry args={[1, 1, 1]} />\n` +
  `${baseIndent}  <meshStandardMaterial color="#9ca3af" />\n` +
  `${baseIndent}</mesh>\n`;

export const emitLight = (light: SceneLight, baseIndent: string): string => {
  if (light.kind === 'ambient') {
    const attrs =
      light.intensity !== undefined ? ` intensity={${fmtNum(light.intensity)}}` : '';
    return `${baseIndent}<ambientLight${attrs} />\n`;
  }
  const parts: string[] = [];
  if (light.intensity !== undefined) parts.push(`intensity={${fmtNum(light.intensity)}}`);
  if (light.castShadow === true) parts.push('castShadow');
  const tail = parts.length > 0 ? ` ${parts.join(' ')}` : '';
  return `${baseIndent}<directionalLight${tail} />\n`;
};

export const attr = (name: string, value: string | undefined): string =>
  value === undefined ? '' : ` ${name}="${escapeAttr(value)}"`;
