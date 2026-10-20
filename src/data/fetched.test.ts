import { describe, expect, it } from 'vitest';
import stars from './generated/stars.json';
import parallax from './fetched/hip-parallax.json';
import exo from './fetched/exoplanets.json';
import type { ExoData, ParallaxData } from './flightData';

const plx = parallax as ParallaxData;
const ex = exo as ExoData;
const catalogueHips = new Set<number>(stars.hip);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

describe('fetched Hipparcos parallaxes (scripts/fetch-sky-data.mjs)', () => {
  it('carries provenance metadata with a retrieval date', () => {
    expect(plx.meta.retrieved).toMatch(DATE);
    for (const k of ['service', 'catalogue', 'query', 'licence', 'citation'] as const) expect(plx.meta[k]).toBeTruthy();
  });

  it('has parallel arrays of equal length, sorted by HIP', () => {
    expect(plx.plx.length).toBe(plx.hip.length);
    expect(plx.ePlx.length).toBe(plx.hip.length);
    expect(plx.hip.length).toBeGreaterThanOrEqual(1000);
    for (let i = 1; i < plx.hip.length; i++) expect(plx.hip[i]).toBeGreaterThan(plx.hip[i - 1]);
  });

  it('every HIP resolves to a catalogue star and every parallax is finite', () => {
    plx.hip.forEach((h, i) => {
      expect(catalogueHips.has(h), String(h)).toBe(true);
      expect(Number.isFinite(plx.plx[i]), String(h)).toBe(true);
    });
  });
});

describe('fetched exoplanets (NASA Exoplanet Archive, pscomppars)', () => {
  it('carries provenance metadata, the archive acknowledgement and a retrieval date', () => {
    expect(ex.meta.retrieved).toMatch(DATE);
    for (const k of ['service', 'catalogue', 'query', 'licence', 'citation'] as const) expect(ex.meta[k]).toBeTruthy();
    expect(ex.meta.acknowledgement).toContain('NASA Exoplanet Archive');
  });

  it('every planet host resolves to a catalogue star', () => {
    expect(ex.planets.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ex.planets.map((p) => p.hip)).size).toBeGreaterThanOrEqual(30);
    for (const p of ex.planets) expect(catalogueHips.has(p.hip), p.name).toBe(true);
  });

  it('is sorted by HIP, then by planet name', () => {
    for (let i = 1; i < ex.planets.length; i++) {
      const a = ex.planets[i - 1];
      const b = ex.planets[i];
      expect(a.hip < b.hip || (a.hip === b.hip && a.name < b.name), `${a.name} / ${b.name}`).toBe(true);
    }
  });

  it('has a positive semi-major axis and period for every planet', () => {
    for (const p of ex.planets) {
      expect(p.a, p.name).toBeGreaterThan(0);
      expect(p.per, p.name).toBeGreaterThan(0);
    }
  });

  it('marks the radius as estimated for every radial-velocity planet without a measured radius', () => {
    const rv = ex.planets.filter((p) => p.method === 'Radial Velocity');
    expect(rv.length).toBeGreaterThan(0);
    // pscomppars has no measured radius for a non-transiting RV planet: any radius it lists is calculated.
    for (const p of rv) expect(p.radeEstimated, p.name).toBe(true);
    for (const p of ex.planets) if (p.rade === null && p.method !== 'Transit') expect(p.radeEstimated, p.name).toBe(true);
  });

  it('uses null, never 0, for missing values', () => {
    const fields = ['a', 'per', 'incl', 'rade', 'masse', 'year', 'eqt', 'hostTeff', 'hostRad', 'hostDist'] as const;
    for (const p of ex.planets) for (const f of fields) expect(p[f], `${p.name}.${f}`).not.toBe(0);
  });
});
