// Thị sai Hipparcos và hành tinh ngoài hệ Mặt Trời cho chế độ bay. Dữ liệu do scripts/fetch-sky-data.mjs lấy lúc build
// (src/data/fetched/*.json); ở đây chỉ nạp lười bằng import() để hai file JSON thành chunk riêng, không vào entry chunk.

export interface FetchedMeta {
  retrieved: string;
  service: string;
  catalogue: string;
  query: string;
  licence: string;
  citation: string;
}

/** Hipparcos New Reduction (I/311): parallel arrays sorted by HIP, parallaxes in milliarcseconds. */
export interface ParallaxData {
  meta: FetchedMeta;
  hip: number[];
  plx: number[];
  ePlx: number[];
}

export interface ExoPlanet {
  name: string;
  host: string;
  hip: number;
  /** Semi-major axis, AU. */
  a: number;
  /** Orbital period, days. */
  per: number;
  ecc: number | null;
  /** Orbital inclination, degrees. */
  incl: number | null;
  /** Radius, Earth radii. */
  rade: number | null;
  /** True when the archive computed the radius from the mass, or no measured radius exists for a non-transiting planet. */
  radeEstimated: boolean;
  /** Mass, Earth masses. */
  masse: number | null;
  /** True when the mass is M·sin i (a lower limit). */
  massIsMinimum: boolean;
  method: string | null;
  year: number | null;
  /** Equilibrium temperature, K. */
  eqt: number | null;
  hostTeff: number | null;
  /** Host radius, solar radii. */
  hostRad: number | null;
  /** Distance to the system, pc. */
  hostDist: number | null;
}

export interface ExoData {
  meta: FetchedMeta & { acknowledgement: string };
  planets: ExoPlanet[];
}

export interface FlightData {
  parallax: ParallaxData;
  exo: ExoData;
  /** Distance in parsecs from the Hipparcos parallax, or null when there is none or it is not positive. */
  distancePc(hip: number): number | null;
  /** True when there is no parallax, Plx ≤ 0, or e_Plx / Plx > 0.2. */
  distanceUncertain(hip: number): boolean;
}

let cached: Promise<FlightData> | null = null;

export function loadFlightData(): Promise<FlightData> {
  cached ??= Promise.all([import('./fetched/hip-parallax.json'), import('./fetched/exoplanets.json')]).then(
    ([p, e]) => {
      const parallax = p.default as ParallaxData;
      const exo = e.default as ExoData;
      const byHip = new Map<number, number>();
      parallax.hip.forEach((h, i) => byHip.set(h, i));
      return {
        parallax,
        exo,
        distancePc(hip) {
          const i = byHip.get(hip);
          if (i === undefined) return null;
          const plx = parallax.plx[i];
          return plx > 0 ? 1000 / plx : null;
        },
        distanceUncertain(hip) {
          const i = byHip.get(hip);
          if (i === undefined) return true;
          const plx = parallax.plx[i];
          return !(plx > 0) || parallax.ePlx[i] / plx > 0.2;
        },
      };
    },
  );
  return cached;
}
