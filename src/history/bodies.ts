// Mặt Trời, Mặt Trăng và các hành tinh nhìn thấy bằng mắt thường, qua astronomy-engine (VSOP87 và chuỗi Mặt Trăng).
// Đây là "lõi tính toán" nạp thêm: chỉ nằm trong gói tải lười của «Bầu trời xưa», không vào gói khởi động.
//
// astronomy-engine tự đổi UT → TT bằng một hàm ΔT; ta thay bằng hàm của ta (src/astro/history.ts) để mọi nơi trong
// ứng dụng dùng cùng một ΔT, và để công tắc "ΔT = 0" (Trái Đất quay đều) có hiệu lực cả với Mặt Trăng và hành tinh.

import { AstroTime, Body, Equator, Illumination, MoonPhase, Observer, SetDeltaTFunction } from 'astronomy-engine';
import { decimalYear, deltaT } from '../astro/history';
import { DEG, type Vec3 } from '../astro/math';
import { J2000 } from '../astro/time';
import { IDENTITY, type Moment } from './model';

export const BODY_IDS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const;
export type BodyId = (typeof BODY_IDS)[number];

const ENGINE_BODY: Record<BodyId, Body> = {
  sun: Body.Sun,
  moon: Body.Moon,
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
};

let zeroDeltaT = false;
SetDeltaTFunction((ut) => (zeroDeltaT ? 0 : deltaT(decimalYear(ut + J2000))));

export interface BodyState {
  id: BodyId;
  alt: number;
  az: number;
  /** Cấp sao biểu kiến. */
  mag: number;
  /** Chỉ Mặt Trăng: độ lệch kinh độ hoàng đạo so với Mặt Trời (0 = non, 180 = tròn), độ. */
  elongation: number;
  /** Chỉ Mặt Trăng: phần mặt được chiếu sáng, 0–1. */
  illum: number;
}

/**
 * Vị trí chân trời của bảy thiên thể. `zeroDt` = true tính như thể Trái Đất quay đều (TT = UT).
 * Tọa độ xích đạo J2000 từ engine được quay bằng `m.rot` (tuế sai) giống hệt các sao.
 */
export function computeBodies(m: Moment, lat: number, lon: number, out: BodyState[] = []): BodyState[] {
  zeroDeltaT = m.dt === 0;
  const time = new AstroTime(m.jdUt - J2000);
  const observer = new Observer(lat, lon, 0);
  const sinT = Math.sin(m.lst * DEG);
  const cosT = Math.cos(m.lst * DEG);
  const sinP = Math.sin(lat * DEG);
  const cosP = Math.cos(lat * DEG);
  const R = m.rot;
  const v: Vec3 = [0, 0, 0];
  out.length = 0;
  for (const id of BODY_IDS) {
    const eq = Equator(ENGINE_BODY[id], time, observer, false, true);
    const a = eq.ra * 15 * DEG;
    const d = eq.dec * DEG;
    v[0] = Math.cos(d) * Math.cos(a);
    v[1] = Math.cos(d) * Math.sin(a);
    v[2] = Math.sin(d);
    const x = R === IDENTITY ? v[0] : R[0] * v[0] + R[1] * v[1] + R[2] * v[2];
    const y = R === IDENTITY ? v[1] : R[3] * v[0] + R[4] * v[1] + R[5] * v[2];
    const z = R === IDENTITY ? v[2] : R[6] * v[0] + R[7] * v[1] + R[8] * v[2];
    const X = x * cosT + y * sinT;
    const Y = x * sinT - y * cosT;
    const alt = Math.asin(Math.max(-1, Math.min(1, sinP * z + cosP * X))) / DEG;
    let az = Math.atan2(-Y, z * cosP - X * sinP) / DEG;
    if (az < 0) az += 360;
    const ill = Illumination(ENGINE_BODY[id], time);
    out.push({
      id,
      alt,
      az,
      mag: ill.mag,
      elongation: id === 'moon' ? MoonPhase(time) : 0,
      illum: id === 'moon' ? ill.phase_fraction : 1,
    });
  }
  return out;
}
