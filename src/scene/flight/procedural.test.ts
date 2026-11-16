import { describe, expect, it } from 'vitest';
import { buildSurface, geometryHash } from './procedural';

describe('Thiên thể đa giác thấp', () => {
  it('cùng hạt giống cho cùng hình, khác hạt giống cho hình khác', () => {
    const a = geometryHash(buildSurface({ id: 'mars', look: 'rocky', palette: ['#c1623f', '#8a3f26'], detail: 6 }));
    const b = geometryHash(buildSurface({ id: 'mars', look: 'rocky', palette: ['#c1623f', '#8a3f26'], detail: 6 }));
    const c = geometryHash(buildSurface({ id: 'mercury', look: 'rocky', palette: ['#c1623f', '#8a3f26'], detail: 6 }));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('số mặt theo độ chia nhỏ: 20 · (n + 1)²', () => {
    for (const detail of [2, 6, 10]) {
      const g = buildSurface({ id: 'x', look: 'gasGiant', palette: ['#fff', '#000'], detail });
      expect(g.getAttribute('position').count / 3).toBe(20 * (detail + 1) ** 2);
    }
  });
});
