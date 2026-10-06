// Chuyển đổi giữa hệ tọa độ xích đạo (α, δ, H) và hệ chân trời (A, h).
// Quy ước: vĩ độ φ dương về Bắc; phương vị A tính từ Bắc qua Đông, trong [0°, 360°).

import {
  asinD,
  atan2D,
  cosD,
  mat3Apply,
  mat3Mul,
  norm180,
  norm360,
  rotZ,
  sinD,
  type Mat3,
  type Vec3,
} from './math';

export interface Horizontal {
  /** Độ cao h (độ), −90..90 */
  alt: number;
  /** Phương vị A (độ), 0..360, từ Bắc qua Đông */
  az: number;
}

export interface Equatorial {
  /** Xích kinh α (độ), 0..360 */
  ra: number;
  /** Xích vĩ δ (độ), −90..90 */
  dec: number;
}

/**
 * Hệ xích đạo → hệ chân trời.
 *   sin h = sin φ · sin δ + cos φ · cos δ · cos H
 *   A = atan2(−cos δ · sin H, sin δ · cos φ − cos δ · cos H · sin φ)
 */
export function equatorialToHorizontal(
  ra: number,
  dec: number,
  lat: number,
  lst: number,
): Horizontal & { ha: number } {
  const ha = norm180(lst - ra);
  return { ...hourAngleToHorizontal(ha, dec, lat), ha };
}

/**
 * Như equatorialToHorizontal nhưng ghi (h, A) vào `out` — không cấp phát, dùng trong đường cập nhật mỗi khung hình
 * của cảnh 3D (AGENTS.md: không cấp phát trong update()/frame()).
 */
export function equatorialToHorizontalInto(ra: number, dec: number, lat: number, lst: number, out: Horizontal): Horizontal {
  const ha = norm180(lst - ra);
  const sd = sinD(dec);
  const cd = cosD(dec);
  const sp = sinD(lat);
  const cp = cosD(lat);
  const ch = cosD(ha);
  out.alt = asinD(sp * sd + cp * cd * ch);
  out.az = norm360(atan2D(-cd * sinD(ha), sd * cp - cd * ch * sp));
  return out;
}

export function hourAngleToHorizontal(ha: number, dec: number, lat: number): Horizontal {
  const sd = sinD(dec);
  const cd = cosD(dec);
  const sp = sinD(lat);
  const cp = cosD(lat);
  const ch = cosD(ha);
  const alt = asinD(sp * sd + cp * cd * ch);
  const az = norm360(atan2D(-cd * sinD(ha), sd * cp - cd * ch * sp));
  return { alt, az };
}

/** Hệ chân trời → hệ xích đạo (phép biến đổi ngược, cùng dạng công thức). */
export function horizontalToEquatorial(
  alt: number,
  az: number,
  lat: number,
  lst: number,
): Equatorial & { ha: number } {
  const sh = sinD(alt);
  const chh = cosD(alt);
  const sp = sinD(lat);
  const cp = cosD(lat);
  const ca = cosD(az);
  const dec = asinD(sp * sh + cp * chh * ca);
  const ha = norm180(atan2D(-chh * sinD(az), sh * cp - chh * ca * sp));
  return { ra: norm360(lst - ha), dec, ha };
}

/** Vectơ đơn vị trong hệ xích đạo: x → điểm xuân phân, z → thiên cực Bắc. */
export function equatorialToVector(ra: number, dec: number): Vec3 {
  const cd = cosD(dec);
  return [cd * cosD(ra), cd * sinD(ra), sinD(dec)];
}

export function vectorToEquatorial(v: Vec3): Equatorial {
  const r = Math.hypot(v[0], v[1], v[2]);
  return { ra: norm360(atan2D(v[1], v[0])), dec: asinD(v[2] / r) };
}

/**
 * Hệ góc giờ (x′ → giao điểm xích đạo trời với kinh tuyến trên, y′ → điểm Đông, z′ → thiên cực Bắc)
 * nhận được bằng cách quay hệ xích đạo quanh trục z một góc −LST.
 */
export function equatorialToHourFrame(lst: number): Mat3 {
  return rotZ(-lst);
}

/**
 * Hệ góc giờ → hệ chân trời (Bắc, Đông, Thiên đỉnh): quay quanh trục Đông–Tây một góc (90° − φ).
 *   N = −sin φ · x′ + cos φ · z′
 *   E = y′
 *   U =  cos φ · x′ + sin φ · z′
 */
export function hourFrameToHorizon(lat: number): Mat3 {
  const s = sinD(lat);
  const c = cosD(lat);
  return [-s, 0, c, 0, 1, 0, c, 0, s];
}

/** Ma trận tổng hợp: vectơ xích đạo → vectơ chân trời (N, E, U). */
export function equatorialToHorizonMatrix(lat: number, lst: number): Mat3 {
  return mat3Mul(hourFrameToHorizon(lat), equatorialToHourFrame(lst));
}

/** Vectơ chân trời (N, E, U) → (A, h). */
export function horizonVectorToHorizontal(v: Vec3): Horizontal {
  const r = Math.hypot(v[0], v[1], v[2]);
  return { alt: asinD(v[2] / r), az: norm360(atan2D(v[1], v[0])) };
}

/** (A, h) → vectơ chân trời (N, E, U). */
export function horizontalToVector(alt: number, az: number): Vec3 {
  const ch = cosD(alt);
  return [ch * cosD(az), ch * sinD(az), sinD(alt)];
}

/** Cách tính bằng ma trận quay (dùng cho hiển thị 3D) — phải trùng với công thức lượng giác. */
export function equatorialToHorizontalViaMatrix(ra: number, dec: number, lat: number, lst: number): Horizontal {
  return horizonVectorToHorizontal(mat3Apply(equatorialToHorizonMatrix(lat, lst), equatorialToVector(ra, dec)));
}

/** Góc ở tâm giữa hai hướng (độ). */
export function angularSeparation(a: Equatorial, b: Equatorial): number {
  const va = equatorialToVector(a.ra, a.dec);
  const vb = equatorialToVector(b.ra, b.dec);
  const dot = va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2];
  const cross = Math.hypot(va[1] * vb[2] - va[2] * vb[1], va[2] * vb[0] - va[0] * vb[2], va[0] * vb[1] - va[1] * vb[0]);
  return atan2D(cross, dot);
}
