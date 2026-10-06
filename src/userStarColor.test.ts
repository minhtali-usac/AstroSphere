import { describe, expect, it } from 'vitest';
import { COLORS } from './scene/colors';
import { Actions, createInitialState, Store, USER_STAR_COLOR } from './state';

/** sRGB hex → OKLab (Björn Ottosson's matrices, as in the color-theory skill's checks.py). */
function oklab(hex: string): [number, number, number] {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}
const deltaE = (a: string, b: string) => Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]));

// The neutral figure tones and the ground disc are not semantic codes; every other scene colour is.
const SEMANTIC = Object.entries(COLORS).filter(([k]) => !['figure', 'figureSky', 'ground'].includes(k));

describe('user star colour (owner decision 2026-10-05)', () => {
  it('is the neutral figure tone, at least ΔE 0,08 OKLab from every semantic scene colour', () => {
    expect(USER_STAR_COLOR).toBe(COLORS.figure);
    for (const [k, c] of SEMANTIC) expect(deltaE(USER_STAR_COLOR, c), k).toBeGreaterThanOrEqual(0.08);
  });

  it('random and manual stars both get it', () => {
    const store = new Store(createInitialState());
    const actions = new Actions(store);
    actions.addRandomStars(20);
    actions.addManualStar(100, -16.7, 'Sao A');
    const colors = new Set(store.state.stars.map((s) => s.color));
    expect([...colors]).toEqual([COLORS.figure]);
  });

  it('the ΔE helper reproduces known values (old palette collided with the vertical circle)', () => {
    expect(deltaE('#f472b6', COLORS.vertical)).toBe(0);
    expect(deltaE('#ffffff', '#000000')).toBeCloseTo(1, 3);
  });
});
