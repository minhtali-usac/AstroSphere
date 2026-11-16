import { describe, expect, it } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import { moonGeo, planetHelio, PLANET_IDS, type PlanetId } from './planets';
import type { Vec3 } from './math';

const BODY: Record<PlanetId, Astronomy.Body> = {
  mercury: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  earth: Astronomy.Body.EMB,
  mars: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturn: Astronomy.Body.Saturn,
  uranus: Astronomy.Body.Uranus,
  neptune: Astronomy.Body.Neptune,
};

const len = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
function angleDeg(a: Vec3, b: { x: number; y: number; z: number }): number {
  const dot = (a[0] * b.x + a[1] * b.y + a[2] * b.z) / (len(a) * Math.hypot(b.x, b.y, b.z));
  return (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
}

// 40 ngày trải đều 1800–2050 (lệch nhau một số ngày lẻ để không trùng chu kỳ).
const DATES = Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(1800, 0, 1) + i * 6.25 * 365.25 * 86400000 + i * 37 * 86400000));
const jdOf = (d: Date) => d.getTime() / 86400000 + 2440587.5;

describe('Vị trí hành tinh (JPL Approximate Positions) so với astronomy-engine', () => {
  for (const id of PLANET_IDS) {
    it(`${id}: hướng < 0,2°, khoảng cách < 1 % trong 1800–2050`, () => {
      let worstAngle = 0;
      let worstDist = 0;
      for (const d of DATES) {
        const ours = planetHelio(id, jdOf(d));
        const ref = Astronomy.HelioVector(BODY[id], d);
        worstAngle = Math.max(worstAngle, angleDeg(ours, ref));
        worstDist = Math.max(worstDist, Math.abs(len(ours) / ref.Length() - 1));
      }
      expect(worstAngle).toBeLessThan(0.2);
      expect(worstDist).toBeLessThan(0.01);
    });
  }
});

describe('Vị trí Mặt Trăng', () => {
  it('hướng địa tâm < 0,3°, khoảng cách < 1 % trong 1950–2050', () => {
    let worstAngle = 0;
    let worstDist = 0;
    for (let i = 0; i < 400; i++) {
      const d = new Date(Date.UTC(1950, 0, 1) + i * 91.3 * 86400000);
      const ours = moonGeo(jdOf(d));
      const ref = Astronomy.GeoMoon(d);
      worstAngle = Math.max(worstAngle, angleDeg(ours, ref));
      worstDist = Math.max(worstDist, Math.abs(len(ours) / ref.Length() - 1));
    }
    expect(worstAngle).toBeLessThan(0.3);
    expect(worstDist).toBeLessThan(0.01);
  });
});
