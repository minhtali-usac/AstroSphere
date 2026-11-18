import { describe, expect, it } from 'vitest';
import { applyProperMotion, separationDeg, unitVector } from '../astro/history';
import { catalogArrays, catalogIndexByHip, getCatalogStar, nameOf } from './catalog';
import { CURATED, MOTION_SOURCE, motionCount, properMotionOf } from './motion';

describe('Chuyển động riêng của sao (src/data/motion.ts)', () => {
  it('mọi sao trong bảng chọn lọc có thật trong danh mục và đúng tên (bắt gõ nhầm số HIP)', () => {
    for (const [hip, name] of CURATED) {
      expect(catalogIndexByHip(hip), `HIP ${hip}`).toBeDefined();
      const n = nameOf(hip);
      expect([n.short, n.designation], `HIP ${hip} ${name}`).toContain(name);
    }
  });

  it('không có HIP lặp, mọi số hữu hạn và nhỏ hơn 5000 mas/năm', () => {
    expect(new Set(CURATED.map((r) => r[0])).size).toBe(CURATED.length);
    for (const [hip, , a, d] of CURATED) {
      expect(Number.isFinite(a) && Number.isFinite(d), String(hip)).toBe(true);
      expect(Math.hypot(a, d), String(hip)).toBeLessThan(5000);
    }
    expect(motionCount).toBeGreaterThanOrEqual(CURATED.length);
    expect(['hipparcos', 'curated']).toContain(MOTION_SOURCE);
  });

  it('chuyển động riêng toàn phần của các sao nổi tiếng đúng cỡ đã biết (″/năm)', () => {
    const total = (hip: number) => Math.hypot(...(properMotionOf(hip) as [number, number])) / 1000;
    expect(total(32349)).toBeCloseTo(1.34, 1); // Sirius
    expect(total(69673)).toBeCloseTo(2.28, 1); // Arcturus
    expect(total(91262)).toBeCloseTo(0.35, 1); // Vega
    expect(total(11767)).toBeCloseTo(0.046, 2); // Polaris
    expect(total(71683)).toBeCloseTo(3.71, 1); // α Cen A
  });

  it('Thuban (α Dra) ở gần cực Bắc thiên cầu nhất vào khoảng năm 2800 TCN', async () => {
    const { calendarToJd, deltaT, poleOfDate } = await import('../astro/history');
    const i = catalogIndexByHip(68756)!;
    const star = getCatalogStar(i);
    const [pa, pd] = properMotionOf(68756)!;
    const sep = (year: number) => {
      const jd = calendarToJd(year, 7, 1);
      const p = applyProperMotion(star.ra, star.dec, pa, pd, year - 2000);
      return separationDeg(unitVector(p.ra, p.dec), poleOfDate(jd + deltaT(year) / 86400));
    };
    expect(sep(-2787)).toBeLessThan(0.5);
    expect(sep(-2787)).toBeLessThan(sep(-1500));
    expect(sep(-2787)).toBeLessThan(sep(-4500));
    // Polaris hiện nay cách cực chưa tới 1°.
    const pol = getCatalogStar(catalogIndexByHip(11767)!);
    const jd = calendarToJd(2020, 1, 1);
    expect(separationDeg(unitVector(pol.ra, pol.dec), poleOfDate(jd))).toBeLessThan(0.8);
    expect(catalogArrays().hip.length).toBeGreaterThan(1000);
  });

  it('Arcturus đã dịch hơn 1° so với thời Hipparchus (≈ 2150 năm trước)', () => {
    const [a, d] = properMotionOf(69673)!;
    const s = getCatalogStar(catalogIndexByHip(69673)!);
    const old = applyProperMotion(s.ra, s.dec, a, d, -2150);
    const sep = separationDeg(unitVector(s.ra, s.dec), unitVector(old.ra, old.dec));
    expect(sep).toBeGreaterThan(1.2);
    expect(sep).toBeLessThan(1.5);
  });
});
