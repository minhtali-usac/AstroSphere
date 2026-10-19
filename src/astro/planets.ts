// Vị trí gần đúng của các hành tinh và Mặt Trăng (dùng cho chế độ «Bay vào vũ trụ»).
//
// Hành tinh: phần tử quỹ đạo Kepler của JPL, "Approximate Positions of the Planets" (E. M. Standish),
// Bảng 1, hiệu lực 1800–2050 (https://ssd.jpl.nasa.gov/planets/approx_pos.html).
// Mặt Trăng: chuỗi rút gọn của Astronomical Almanac (sai số cỡ 0,3° về hướng).
// Mọi vector trả về ở hệ xích đạo J2000 (cùng hệ với α, δ của danh mục sao), đơn vị AU.

import { cosD, DEG, norm360, sinD, type Vec3 } from './math';
import { J2000 } from './time';

export const PLANET_IDS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const;
export type PlanetId = (typeof PLANET_IDS)[number];

/** 1 AU tính bằng km (IAU 2012). */
export const AU_KM = 149597870.7;
/** Độ nghiêng hoàng đạo J2000 (độ). */
const EPS_J2000 = 23.43928;

// [a (AU), e, I (°), L (°), ϖ (°), Ω (°)] tại J2000 và tốc độ biến thiên mỗi thế kỷ Julius.
type Elements = readonly [number, number, number, number, number, number];
const ELEMENTS: Record<PlanetId, readonly [Elements, Elements]> = {
  mercury: [
    [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  ],
  venus: [
    [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  ],
  // Bảng của JPL cho tâm khối Trái Đất – Mặt Trăng; Trái Đất lệch khỏi điểm này ≈ 4700 km.
  earth: [
    [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  ],
  mars: [
    [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  ],
  jupiter: [
    [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  ],
  saturn: [
    [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  ],
  uranus: [
    [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503],
    [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  ],
  neptune: [
    [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
  ],
};

/** Giải phương trình Kepler M = E − e·sin E (M, E theo radian). */
export function solveKepler(M: number, e: number): number {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/** Hoàng đạo J2000 → xích đạo J2000 (quay quanh trục x một góc ε), ghi vào out. */
function eclipticToEquatorialVec(x: number, y: number, z: number, out: Vec3): Vec3 {
  const c = cosD(EPS_J2000);
  const s = sinD(EPS_J2000);
  out[0] = x;
  out[1] = c * y - s * z;
  out[2] = s * y + c * z;
  return out;
}

/**
 * Vị trí của một điểm trên quỹ đạo Kepler trong mặt phẳng tham chiếu (hoàng đạo hoặc mặt phẳng tùy chọn).
 * a theo đơn vị bất kỳ; các góc theo độ; M là dị thường trung bình (độ).
 */
export function orbitPoint(a: number, e: number, incl: number, node: number, argPeri: number, M: number, out: Vec3): Vec3 {
  const E = solveKepler(norm360(M) * DEG, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = cosD(argPeri);
  const sw = sinD(argPeri);
  const cO = cosD(node);
  const sO = sinD(node);
  const cI = cosD(incl);
  const sI = sinD(incl);
  out[0] = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  out[1] = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  out[2] = sw * sI * xp + cw * sI * yp;
  return out;
}

const scratch: Vec3 = [0, 0, 0];

/** Vị trí nhật tâm của hành tinh tại ngày Julius jd, hệ xích đạo J2000, đơn vị AU (ghi vào out). */
export function planetHelio(id: PlanetId, jd: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const [e0, rate] = ELEMENTS[id];
  const T = (jd - J2000) / 36525;
  const a = e0[0] + rate[0] * T;
  const e = e0[1] + rate[1] * T;
  const I = e0[2] + rate[2] * T;
  const L = e0[3] + rate[3] * T;
  const peri = e0[4] + rate[4] * T;
  const node = e0[5] + rate[5] * T;
  orbitPoint(a, e, I, node, peri - node, L - peri, scratch);
  return eclipticToEquatorialVec(scratch[0], scratch[1], scratch[2], out);
}

/** Phần tử quỹ đạo tại jd (để vẽ đường quỹ đạo): a, e, I, Ω, ω theo AU và độ. */
export function planetOrbit(id: PlanetId, jd: number): { a: number; e: number; incl: number; node: number; argPeri: number } {
  const [e0, rate] = ELEMENTS[id];
  const T = (jd - J2000) / 36525;
  const node = e0[5] + rate[5] * T;
  return {
    a: e0[0] + rate[0] * T,
    e: e0[1] + rate[1] * T,
    incl: e0[2] + rate[2] * T,
    node,
    argPeri: e0[4] + rate[4] * T - node,
  };
}

/** Điểm trên quỹ đạo của hành tinh ở dị thường trung bình M (độ), hệ xích đạo J2000, AU. */
export function planetOrbitPoint(orbit: ReturnType<typeof planetOrbit>, M: number, out: Vec3): Vec3 {
  orbitPoint(orbit.a, orbit.e, orbit.incl, orbit.node, orbit.argPeri, M, scratch);
  return eclipticToEquatorialVec(scratch[0], scratch[1], scratch[2], out);
}

/** Đổi điểm từ hoàng đạo J2000 sang xích đạo J2000 (dùng chung cho quỹ đạo). */
export function eclipticVecToEquatorial(v: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  return eclipticToEquatorialVec(v[0], v[1], v[2], out);
}

/** Bán kính xích đạo Trái Đất (km). */
export const EARTH_RADIUS_KM = 6378.137;

// Các số hạng lớn nhất của chuỗi Mặt Trăng trong Meeus, "Astronomical Algorithms", chương 47:
// [D, M, M′, F, hệ số] — kinh độ (10⁻⁶ độ, sin), khoảng cách (10⁻³ km, cos), vĩ độ (10⁻⁶ độ, sin).
const MOON_L: readonly (readonly number[])[] = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618],
  [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066],
  [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980],
  [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665],
];
const MOON_R: readonly (readonly number[])[] = [
  [0, 0, 1, 0, -20905355], [2, 0, -1, 0, -3699111], [2, 0, 0, 0, -2955968], [0, 0, 2, 0, -569925],
  [0, 1, 0, 0, 48888], [0, 0, 0, 2, -3149], [2, 0, -2, 0, 246158], [2, -1, -1, 0, -152138],
  [2, 0, 1, 0, -170733], [2, -1, 0, 0, -204586], [0, 1, -1, 0, -129620], [1, 0, 0, 0, 108743],
  [0, 1, 1, 0, 104755], [2, 0, 0, -2, 10321], [0, 0, 1, -2, 79661], [4, 0, -1, 0, -34782],
  [0, 0, 3, 0, -23210], [4, 0, -2, 0, -21636],
];
const MOON_B: readonly (readonly number[])[] = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324], [2, 0, 1, 1, 4200],
];

/**
 * Vị trí địa tâm của Mặt Trăng tại jd, hệ xích đạo J2000, đơn vị AU (ghi vào out).
 * Số hạng chính của Meeus chương 47 (kinh độ, vĩ độ hoàng đạo của ngày và khoảng cách),
 * rồi chuyển về điểm xuân phân J2000 bằng tuế sai tổng 1,39697° mỗi thế kỷ.
 */
export function moonGeo(jd: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const T = (jd - J2000) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const F = 93.272095 + 483202.0175233 * T;
  const E = 1 - 0.002516 * T;
  const arg = (t: readonly number[]) => t[0] * D + t[1] * M + t[2] * Mp + t[3] * F;
  const ecc = (t: readonly number[]) => (t[1] === 0 ? 1 : E);
  let sl = 0;
  for (const t of MOON_L) sl += t[4] * ecc(t) * sinD(arg(t));
  let sr = 0;
  for (const t of MOON_R) sr += t[4] * ecc(t) * cosD(arg(t));
  let sb = 0;
  for (const t of MOON_B) sb += t[4] * ecc(t) * sinD(arg(t));
  const lambda = Lp + sl / 1e6 - 1.39697 * T;
  const beta = sb / 1e6;
  const r = (385000.56 + sr / 1000) / AU_KM;
  const cb = cosD(beta);
  return eclipticToEquatorialVec(r * cb * cosD(lambda), r * cb * sinD(lambda), r * sinD(beta), out);
}
