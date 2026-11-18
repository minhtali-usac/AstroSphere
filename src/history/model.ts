// Mô hình bầu trời xưa: từ (ngày lịch, giờ địa phương trung bình, nơi quan sát, ba công tắc hiệu chỉnh) tới vị trí chân trời
// của sao. Không DOM — kiểm thử được (model.test.ts).

import { catalogArrays } from '../data/catalog';
import { properMotionOf } from '../data/motion';
import {
  calendarOf,
  calendarToJd,
  decimalYear,
  deltaT,
  jdToCalendar,
  localMeanToUtJd,
  meanObliquity,
  poleOfDate,
  precessionMatrix,
  type CalendarDate,
} from '../astro/history';
import { DEG, type Mat3, type Vec3 } from '../astro/math';
import { gmstDeg, J2000 } from '../astro/time';

export interface Settings {
  /** Năm thiên văn (0 = 1 TCN). */
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  lat: number;
  lon: number;
  precession: boolean;
  motion: boolean;
  deltaT: boolean;
}

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export interface Moment {
  calendar: CalendarDate;
  jdLocal: number;
  jdUt: number;
  /** ΔT đã dùng (giây): 0 khi người dùng tắt ΔT. */
  dt: number;
  /** ΔT thật theo mô hình (giây), để hiển thị. */
  dtReal: number;
  jdTt: number;
  /** Số năm Julius từ J2000 (dùng cho chuyển động riêng). */
  years: number;
  gmst: number;
  lst: number;
  /** Ma trận J2000 → xích đạo trung bình của thời điểm (đơn vị khi tắt tuế sai). */
  rot: Mat3;
  /** Độ nghiêng hoàng đạo (độ): của thời điểm, hoặc J2000 khi tắt tuế sai. */
  eps: number;
}

export function momentOf(s: Settings): Moment {
  const cal = calendarOf(s.year, s.month, Math.floor(s.day));
  // calendarToJd trả về JD của 0h (nửa đêm); giờ địa phương trung bình cộng thêm phần ngày.
  const jdLocal = calendarToJd(s.year, s.month, s.day, cal) + (s.hour + s.minute / 60) / 24;
  const jdUt = localMeanToUtJd(jdLocal, s.lon);
  const dtReal = deltaT(decimalYear(jdUt));
  const dt = s.deltaT ? dtReal : 0;
  const jdTt = jdUt + dt / 86400;
  const gmst = gmstDeg(jdUt);
  return {
    calendar: jdToCalendar(jdLocal),
    jdLocal,
    jdUt,
    dt,
    dtReal,
    jdTt,
    years: (jdTt - J2000) / 365.25,
    gmst,
    lst: (((gmst + s.lon) % 360) + 360) % 360,
    rot: s.precession ? precessionMatrix(jdTt) : IDENTITY,
    eps: s.precession ? meanObliquity(jdTt) : meanObliquity(J2000),
  };
}

/** Giới hạn cấp sao nhìn thấy theo độ cao Mặt Trời (độ): ban ngày không thấy sao, hoàng hôn thiên văn thấy hết. */
export function limitingMagnitude(sunAlt: number): number {
  const stops: readonly (readonly [number, number])[] = [
    [0, -3],
    [-6, 1],
    [-12, 3.4],
    [-18, 6],
  ];
  if (sunAlt >= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [a1, m1] = stops[i];
    if (sunAlt >= a1) {
      const [a0, m0] = stops[i - 1];
      return m0 + ((m1 - m0) * (sunAlt - a0)) / (a1 - a0);
    }
  }
  return stops[stops.length - 1][1];
}

export type SunState = 'day' | 'civil' | 'nautical' | 'astro' | 'night';
export function sunStateOf(alt: number): SunState {
  return alt > 0 ? 'day' : alt > -6 ? 'civil' : alt > -12 ? 'nautical' : alt > -18 ? 'astro' : 'night';
}

const ARCSEC_RAD = DEG / 3600;

/**
 * Tập sao: vị trí J2000 và vận tốc riêng (rad/năm) của từng sao; tính vị trí chân trời cho một thời điểm mà không cấp phát
 * (mảng đầu ra dùng lại). Dùng cho danh mục sao và cho các đỉnh của hình chòm sao.
 */
export class StarSet {
  readonly n: number;
  readonly p0: Float64Array;
  readonly vel: Float64Array;
  readonly moving: Uint8Array;
  readonly alt: Float64Array;
  readonly az: Float64Array;
  /** Vector xích đạo của thời điểm (đã chuẩn hóa), để hiển thị tọa độ. */
  readonly vec: Float64Array;

  constructor(ra: ArrayLike<number>, dec: ArrayLike<number>, hip: ArrayLike<number>) {
    const n = ra.length;
    this.n = n;
    this.p0 = new Float64Array(3 * n);
    this.vel = new Float64Array(3 * n);
    this.moving = new Uint8Array(n);
    this.alt = new Float64Array(n);
    this.az = new Float64Array(n);
    this.vec = new Float64Array(3 * n);
    const k = 1e-3 * ARCSEC_RAD; // mas → rad
    for (let i = 0; i < n; i++) {
      const a = ra[i] * DEG;
      const d = dec[i] * DEG;
      const [ca, sa, cd, sd] = [Math.cos(a), Math.sin(a), Math.cos(d), Math.sin(d)];
      this.p0[3 * i] = cd * ca;
      this.p0[3 * i + 1] = cd * sa;
      this.p0[3 * i + 2] = sd;
      const pm = hip[i] ? properMotionOf(hip[i]) : undefined;
      if (!pm) continue;
      const [mA, mD] = [pm[0] * k, pm[1] * k];
      // μα*·(hướng Đông) + μδ·(hướng Bắc)
      this.vel[3 * i] = -mA * sa - mD * sd * ca;
      this.vel[3 * i + 1] = mA * ca - mD * sd * sa;
      this.vel[3 * i + 2] = mD * cd;
      this.moving[i] = 1;
    }
  }

  /** Vector J2000 đã tính chuyển động riêng của sao i (đã chuẩn hóa), ghi vào out. */
  at(i: number, years: number, motion: boolean, out: Vec3): Vec3 {
    const k = motion && this.moving[i] ? years : 0;
    const x = this.p0[3 * i] + k * this.vel[3 * i];
    const y = this.p0[3 * i + 1] + k * this.vel[3 * i + 1];
    const z = this.p0[3 * i + 2] + k * this.vel[3 * i + 2];
    const r = Math.hypot(x, y, z);
    out[0] = x / r;
    out[1] = y / r;
    out[2] = z / r;
    return out;
  }

  /** Tính độ cao và phương vị của mọi sao cho thời điểm m ở vĩ độ lat và với công tắc `motion`. */
  compute(m: Moment, lat: number, motion: boolean): void {
    const sinT = Math.sin(m.lst * DEG);
    const cosT = Math.cos(m.lst * DEG);
    const sinP = Math.sin(lat * DEG);
    const cosP = Math.cos(lat * DEG);
    const R = m.rot;
    const { p0, vel, moving, vec, alt, az } = this;
    for (let i = 0; i < this.n; i++) {
      const k = motion && moving[i] ? m.years : 0;
      const x0 = p0[3 * i] + k * vel[3 * i];
      const y0 = p0[3 * i + 1] + k * vel[3 * i + 1];
      const z0 = p0[3 * i + 2] + k * vel[3 * i + 2];
      const inv = 1 / Math.hypot(x0, y0, z0);
      const x = (R[0] * x0 + R[1] * y0 + R[2] * z0) * inv;
      const y = (R[3] * x0 + R[4] * y0 + R[5] * z0) * inv;
      const z = (R[6] * x0 + R[7] * y0 + R[8] * z0) * inv;
      vec[3 * i] = x;
      vec[3 * i + 1] = y;
      vec[3 * i + 2] = z;
      const X = x * cosT + y * sinT;
      const Y = x * sinT - y * cosT;
      alt[i] = Math.asin(Math.max(-1, Math.min(1, sinP * z + cosP * X))) / DEG;
      let a = Math.atan2(-Y, z * cosP - X * sinP) / DEG;
      if (a < 0) a += 360;
      az[i] = a;
    }
  }
}

export interface PoleStar {
  index: number;
  sepDeg: number;
}

/** Cấp sao tối đa để một sao được coi là "sao Bắc Cực" (Thuban cấp 3,65; sao mờ hơn không ai dùng làm mốc). */
export const POLE_STAR_MAG = 3.7;

/** Sao sáng (cấp ≤ magLimit) gần cực Bắc thiên cầu của thời điểm nhất, có tính chuyển động riêng nếu bật. */
export function nearestToPole(set: StarSet, m: Moment, motion: boolean, mag: ArrayLike<number>, magLimit = POLE_STAR_MAG): PoleStar {
  const pole: Vec3 = m.rot === IDENTITY ? [0, 0, 1] : poleOfDate(m.jdTt);
  const v: Vec3 = [0, 0, 0];
  let best = -1;
  let bestDot = -2;
  for (let i = 0; i < set.n; i++) {
    if (mag[i] > magLimit) continue;
    set.at(i, m.years, motion, v);
    const d = v[0] * pole[0] + v[1] * pole[1] + v[2] * pole[2];
    if (d > bestDot) {
      bestDot = d;
      best = i;
    }
  }
  return { index: best, sepDeg: Math.acos(Math.max(-1, Math.min(1, bestDot))) / DEG };
}

let catalogSet: StarSet | null = null;

/** Tập sao của danh mục sáng (≈1300 sao), dựng một lần. */
export function catalogStars(): StarSet {
  if (!catalogSet) {
    const c = catalogArrays();
    catalogSet = new StarSet(c.ra, c.dec, c.hip);
  }
  return catalogSet;
}
