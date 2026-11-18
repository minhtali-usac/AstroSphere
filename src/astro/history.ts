// Lõi tính toán cho «Bầu trời xưa»: nhìn bầu trời ở một thời điểm bất kỳ trong quá khứ (hoặc tương lai).
//
// Bốn việc cần làm khi lùi xa hàng nghìn năm, và mỗi việc là một hàm thuần ở đây (không DOM, không three.js):
//   1. Lịch: trước 15/10/1582 người xưa dùng lịch Julius, sau đó lịch Gregory (Meeus, «Astronomical Algorithms», ch. 7),
//      năm theo cách đánh số thiên văn (năm 0 = 1 TCN, năm −1 = 2 TCN).
//   2. ΔT = TT − UT: Trái Đất quay chậm dần nên đồng hồ quay của Trái Đất (UT) tụt dần so với đồng hồ đều của cơ học
//      thiên thể (TT). Đa thức của Espenak & Meeus (NASA, dựa trên Stephenson & Morrison 2004) cho −1999…+3000.
//   3. Tuế sai: ma trận tuế sai IAU 2006 (Capitaine, Wallace & Chapront 2003; IERS Conventions 2010, eq. 5.40) từ
//      xích đạo trung bình J2000 sang xích đạo trung bình của thời điểm đó; độ nghiêng trục theo Laskar (1986).
//   4. Chuyển động riêng: dịch tuyến tính trên mặt phẳng tiếp tuyến của thiên cầu (bỏ vận tốc xuyên tâm, đủ tốt
//      cho mắt thường trong vài nghìn năm).
//
// Độ chính xác giảm dần khi xa hiện tại: đa thức tuế sai là khai triển bậc 5 quanh J2000, và ΔT quá khứ xa chỉ biết
// qua ghi chép nhật nguyệt thực cổ (sai số hàng trăm giây ở thời Hy Lạp cổ đại).

import { DEG, norm360, type Mat3, type Vec3 } from './math';
import { J2000, SIDEREAL_RATE_DEG_PER_S } from './time';

/** JD của 15/10/1582 (Gregory) lúc 0h = ngày đầu tiên của lịch Gregory. */
export const GREGORIAN_START_JD = 2299160.5;

export type Calendar = 'julian' | 'gregorian';

export interface CalendarDate {
  /** Năm theo cách đánh số thiên văn (0 = 1 TCN). */
  year: number;
  month: number;
  /** Ngày trong tháng, kèm phần lẻ của ngày. */
  day: number;
  calendar: Calendar;
}

/** Lịch được dùng ở một ngày (năm, tháng, ngày): trước 15/10/1582 là Julius, từ đó là Gregory. */
export function calendarOf(year: number, month: number, day: number): Calendar {
  if (year !== 1582) return year < 1582 ? 'julian' : 'gregorian';
  if (month !== 10) return month < 10 ? 'julian' : 'gregorian';
  return day < 15 ? 'julian' : 'gregorian';
}

// 4800 năm = 12 chu kỳ Gregory (1 753 164 ngày) = 1 753 200 ngày Julius: dịch năm để công thức của Meeus (chỉ đúng từ
// năm −4712) dùng được tới −9000.
const SHIFT_YEARS = 4800;
const SHIFT_DAYS_GREGORIAN = 1753164;
const SHIFT_DAYS_JULIAN = 1753200;

/** Ngày Julius (JD, theo thang thời gian của ngày tháng đưa vào) của một ngày lịch, kể cả phần lẻ của ngày. */
export function calendarToJd(year: number, month: number, day: number, calendar: Calendar = calendarOf(year, month, day)): number {
  let y = year + SHIFT_YEARS;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = calendar === 'gregorian' ? 2 - a + Math.floor(a / 4) : 0;
  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
  return jd - (calendar === 'gregorian' ? SHIFT_DAYS_GREGORIAN : SHIFT_DAYS_JULIAN);
}

/** Ngược lại: ngày lịch của một JD (Julius trước 15/10/1582, Gregory từ đó). */
export function jdToCalendar(jd: number): CalendarDate {
  const julian = jd < GREGORIAN_START_JD;
  const x = julian ? jd + SHIFT_DAYS_JULIAN : jd;
  const z = Math.floor(x + 0.5);
  const f = x + 0.5 - z;
  let a = z;
  if (!julian) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e) + f;
  const month = e < 14 ? e - 1 : e - 13;
  const y = month > 2 ? c - 4716 : c - 4715;
  return { year: julian ? y - SHIFT_YEARS : y, month, day, calendar: julian ? 'julian' : 'gregorian' };
}

/** Năm thập phân (dùng cho các đa thức ΔT): 2000,0 ứng với JD 2451544,5. */
export function decimalYear(jd: number): number {
  return 2000 + (jd - 2451544.5) / 365.2425;
}

const poly = (c: readonly number[], x: number): number => {
  let r = 0;
  for (let i = c.length - 1; i >= 0; i--) r = r * x + c[i];
  return r;
};

/**
 * ΔT = TT − UT (giây) theo đa thức của Espenak & Meeus (NASA, «Five Millennium Canon of Solar Eclipses»), dựa trên
 * Stephenson & Morrison (2004) cho thời cổ và các quan sát thiên văn hiện đại. Tin cậy trong −1999…+2150; ngoài đó
 * là parabol dài hạn ΔT = −20 + 32u² (u tính theo thế kỷ từ 1820).
 */
export function deltaT(year: number): number {
  const y = year;
  if (y < -500) return -20 + 32 * ((y - 1820) / 100) ** 2;
  if (y < 500) return poly([10583.6, -1014.41, 33.78311, -5.952053, -0.1798452, 0.022174192, 0.0090316521], y / 100);
  if (y < 1600) return poly([1574.2, -556.01, 71.23472, 0.319781, -0.8503463, -0.005050998, 0.0083572073], (y - 1000) / 100);
  if (y < 1700) {
    const t = y - 1600;
    return 120 - 0.9808 * t - 0.01532 * t * t + (t * t * t) / 7129;
  }
  if (y < 1800) {
    const t = y - 1700;
    return 8.83 + 0.1603 * t - 0.0059285 * t * t + 0.00013336 * t ** 3 - t ** 4 / 1174000;
  }
  if (y < 1860) return poly([13.72, -0.332447, 0.0068612, 0.0041116, -0.00037436, 0.0000121272, -0.0000001699, 0.000000000875], y - 1800);
  if (y < 1900) {
    const t = y - 1860;
    return 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  }
  if (y < 1920) return poly([-2.79, 1.494119, -0.0598939, 0.0061966, -0.000197], y - 1900);
  if (y < 1941) return poly([21.2, 0.84493, -0.0761, 0.0020936], y - 1920);
  if (y < 1961) {
    const t = y - 1950;
    return 29.07 + 0.407 * t - (t * t) / 233 + t ** 3 / 2547;
  }
  if (y < 1986) {
    const t = y - 1975;
    return 45.45 + 1.067 * t - (t * t) / 260 - t ** 3 / 718;
  }
  if (y < 2005) return poly([63.86, 0.3345, -0.060374, 0.0017275, 0.000651814, 0.00002373599], y - 2000);
  if (y < 2050) return poly([62.92, 0.32217, 0.005589], y - 2000);
  if (y < 2150) return -20 + 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y);
  return -20 + 32 * ((y - 1820) / 100) ** 2;
}

// Độ bất định của ΔT (giây): các mốc trong bảng «Uncertainty in ΔT» của Espenak (NASA), nội suy tuyến tính.
const DT_SIGMA: readonly (readonly [number, number])[] = [
  [-500, 430],
  [0, 260],
  [500, 140],
  [1000, 55],
  [1500, 20],
  [1600, 5],
  [1700, 1],
  [1900, 0.2],
  [2020, 0.1],
];

/** Sai số ước tính của ΔT (giây, 1σ); ngoài −500 mở rộng gần đúng theo khoảng cách tới mốc ấy, sau 2020 tăng dần. */
export function deltaTUncertainty(year: number): number {
  if (year <= DT_SIGMA[0][0]) return DT_SIGMA[0][1] * (1 + (DT_SIGMA[0][0] - year) / 1000);
  for (let i = 1; i < DT_SIGMA.length; i++) {
    const [y0, s0] = DT_SIGMA[i - 1];
    const [y1, s1] = DT_SIGMA[i];
    if (year <= y1) return s0 + ((s1 - s0) * (year - y0)) / (y1 - y0);
  }
  return DT_SIGMA[DT_SIGMA.length - 1][1] + 0.5 * ((year - 2020) / 100) ** 2 * 10;
}

/** JD của thang thời gian đều TT ứng với JD của thời gian quay Trái Đất UT. */
export const utToTt = (jdUt: number, dtSeconds = deltaT(decimalYear(jdUt))): number => jdUt + dtSeconds / 86400;

/**
 * Góc (độ) mà Trái Đất đã quay "trễ" so với một Trái Đất quay đều như hiện nay: ΔT giây × tốc độ quay hiện tại.
 * Với ΔT ≈ 10 580 s (năm 0) là ≈ 44°: một sự kiện tính theo đồng hồ đều sẽ rơi vào kinh độ lệch 44° so với dự đoán thô.
 */
export const earthRotationLagDeg = (dtSeconds: number): number => dtSeconds * SIDEREAL_RATE_DEG_PER_S;

/** Giờ địa phương trung bình (theo Mặt Trời trung bình tại kinh độ λ, Đông dương) → JD của UT. */
export const localMeanToUtJd = (jdLocal: number, lonDeg: number): number => jdLocal - lonDeg / 360;

const ARCSEC = DEG / 3600;

export interface PrecessionAngles {
  zeta: number;
  z: number;
  theta: number;
}

/** Ba góc tuế sai xích đạo ζ_A, z_A, θ_A (radian) của IAU 2006 tại thời điểm TT `jdTt`. */
export function precessionAngles(jdTt: number): PrecessionAngles {
  const t = (jdTt - J2000) / 36525;
  return {
    zeta: poly([2.650545, 2306.083227, 0.2988499, 0.01801828, -0.000005971, -0.0000003173], t) * ARCSEC,
    z: poly([-2.650545, 2306.077181, 1.0927348, 0.01826837, -0.000028596, -0.0000002904], t) * ARCSEC,
    theta: poly([0, 2004.191903, -0.4294934, -0.04182264, -0.000007089, -0.0000001274], t) * ARCSEC,
  };
}

/**
 * Ma trận quay vector xích đạo trung bình J2000 sang xích đạo trung bình của thời điểm `jdTt`
 * (Meeus 21.4: quay ζ quanh trục z, θ quanh trục y, rồi z). Ma trận chuyển vị làm ngược lại.
 */
export function precessionMatrix(jdTt: number): Mat3 {
  const { zeta, z, theta } = precessionAngles(jdTt);
  const [cz, sz] = [Math.cos(zeta), Math.sin(zeta)];
  const [cZ, sZ] = [Math.cos(z), Math.sin(z)];
  const [ct, st] = [Math.cos(theta), Math.sin(theta)];
  // v1 = Rz(ζ) v;  v2 = Ry(θ) v1;  v3 = Rz(z) v2   (Rz theo nghĩa quay vector ngược chiều kim đồng hồ)
  const a: Mat3 = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  const b: Mat3 = [ct, 0, -st, 0, 1, 0, st, 0, ct];
  const c: Mat3 = [cZ, -sZ, 0, sZ, cZ, 0, 0, 0, 1];
  const mul = (p: Mat3, q: Mat3): Mat3 => {
    const r = new Array(9) as Mat3;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = p[i * 3] * q[j] + p[i * 3 + 1] * q[3 + j] + p[i * 3 + 2] * q[6 + j];
    return r;
  };
  return mul(c, mul(b, a));
}

/** Độ nghiêng trung bình của hoàng đạo ε (độ) theo Laskar (1986), đúng trong ±10 000 năm quanh J2000 (Meeus 22.3). */
export function meanObliquity(jdTt: number): number {
  const u = (jdTt - J2000) / 3652500;
  const arcsec = poly([84381.448, -4680.93, -1.55, 1999.25, -51.38, -249.67, -39.05, 7.12, 27.87, 5.79, 2.45], u);
  return arcsec / 3600;
}

/** Vector đơn vị (x, y, z) của (α, δ) theo độ. */
export function unitVector(raDeg: number, decDeg: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const a = raDeg * DEG;
  const d = decDeg * DEG;
  out[0] = Math.cos(d) * Math.cos(a);
  out[1] = Math.cos(d) * Math.sin(a);
  out[2] = Math.sin(d);
  return out;
}

/** (α, δ) theo độ của một vector; α trong [0°, 360°). */
export function vectorToRaDec(v: Vec3): { ra: number; dec: number } {
  const r = Math.hypot(v[0], v[1], v[2]);
  return { ra: norm360(Math.atan2(v[1], v[0]) / DEG), dec: Math.asin(Math.max(-1, Math.min(1, v[2] / r))) / DEG };
}

/** Vector (J2000) của hướng cực Bắc thiên cầu của thời điểm `jdTt`. */
export function poleOfDate(jdTt: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const p = precessionMatrix(jdTt);
  // Cực của thời điểm là trục z trong hệ ngày đó; hệ J2000 = chuyển vị của p.
  out[0] = p[6];
  out[1] = p[7];
  out[2] = p[8];
  return out;
}

/**
 * Chuyển động riêng: vị trí J2000 (α, δ độ) sau `years` năm với μα* = μα·cos δ và μδ (mili giây cung/năm).
 * Cộng tuyến tính trên mặt phẳng tiếp tuyến rồi chuẩn hóa; bỏ qua vận tốc xuyên tâm và thị sai.
 */
export function applyProperMotion(raDeg: number, decDeg: number, pmRaMas: number, pmDecMas: number, years: number): { ra: number; dec: number } {
  const a = raDeg * DEG;
  const d = decDeg * DEG;
  const k = years * 1e-3 * ARCSEC; // mas/năm × số năm → radian
  const dA = pmRaMas * k;
  const dD = pmDecMas * k;
  const x = Math.cos(d) * Math.cos(a) - dA * Math.sin(a) - dD * Math.sin(d) * Math.cos(a);
  const y = Math.cos(d) * Math.sin(a) + dA * Math.cos(a) - dD * Math.sin(d) * Math.sin(a);
  const z = Math.sin(d) + dD * Math.cos(d);
  return vectorToRaDec([x, y, z]);
}

/** Góc giữa hai vector đơn vị (độ). */
export function separationDeg(a: Vec3, b: Vec3): number {
  const cross = Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.atan2(cross, dot) / DEG;
}

/**
 * Xuân phân của thời điểm so với xuân phân J2000, đo dọc hoàng đạo J2000 (độ, âm = lùi về phía Tây): chính là
 * lượng tuế sai theo kinh độ (≈ −1,397° mỗi thế kỷ).
 */
export function equinoxShiftDeg(jdTt: number): number {
  const pT = precessionMatrix(jdTt);
  // Trục x của hệ ngày đó (hướng xuân phân) viết trong hệ J2000 = hàng đầu của ma trận.
  const eq: Vec3 = [pT[0], pT[1], pT[2]];
  // Hoàng đạo J2000: quay quanh trục x một góc ε0 từ xích đạo.
  const eps = 23.43928 * DEG;
  const lon = Math.atan2(Math.cos(eps) * eq[1] + Math.sin(eps) * eq[2], eq[0]) / DEG;
  return lon > 180 ? lon - 360 : lon;
}
