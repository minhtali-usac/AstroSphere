import { describe, expect, it } from 'vitest';
import { catalogArrays, catalogCount, nameOf, VI_STAR_NAMES } from './catalog';

describe('star catalogue', () => {
  it('is sorted by magnitude (brightest first), so a magnitude limit is a prefix', () => {
    // skyLayer.setCatalogMagLimit dùng geometry.setDrawRange(0, n) và chỉ cho chọn n sao đầu.
    const { mag } = catalogArrays();
    expect(mag.length).toBe(catalogCount);
    for (let i = 1; i < mag.length; i++) expect(mag[i]).toBeGreaterThanOrEqual(mag[i - 1]);
  });

  it('has parallel arrays of equal length', () => {
    const c = catalogArrays();
    for (const arr of [c.ra, c.dec, c.bv, c.hip]) expect(arr.length).toBe(c.mag.length);
  });

  it('keeps a useful number of stars under the reduced-quality limit of 4.0', () => {
    const { mag } = catalogArrays();
    const n = mag.filter((m) => m <= 4.0).length;
    expect(n).toBeGreaterThan(300);
    expect(n).toBeLessThan(mag.length);
  });
});

describe('star names (ux-brief §7: international name first, Vietnamese only as a secondary line)', () => {
  it('Polaris: label and short name in English, Vietnamese name kept separately', () => {
    expect(nameOf(11767)).toEqual({ label: 'Polaris', short: 'Polaris', designation: 'α UMi', viName: 'Sao Bắc Cực' });
    expect(nameOf(32349).label).toBe('Sirius');
    expect(nameOf(32349).viName).toBe('Thiên Lang');
  });

  it('falls back to the designation, then to "HIP n"', () => {
    expect(nameOf(122)).toEqual({ label: 'θ Oct', short: '', designation: 'θ Oct', viName: undefined });
    expect(nameOf(999999999).label).toBe('HIP 999999999');
  });

  it('no label carries a Vietnamese folk name', () => {
    const vi = new Set(Object.values(VI_STAR_NAMES));
    for (const hip of catalogArrays().hip) expect(vi.has(nameOf(hip).label), String(hip)).toBe(false);
  });
});
