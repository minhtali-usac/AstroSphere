// Tính chất vật lý suy ra từ số liệu quan sát (dùng để vẽ sao và ngoại hành tinh trong «Bay vào vũ trụ»).
// Mọi giá trị ở đây là ước tính theo phương pháp nêu trong từng hàm, không phải số đo trực tiếp.

/** Nhiệt độ hiệu dụng của Mặt Trời (K, IAU 2015 B3). */
export const T_SUN = 5772;
/** Cấp sao tuyệt đối bolometric của Mặt Trời (IAU 2015 B2). */
export const MBOL_SUN = 4.74;
export const R_SUN_KM = 695700;
export const PC_KM = 3.0856775814913673e13;
export const LY_PER_PC = 3.261563777;

/** Chỉ số màu B−V → nhiệt độ hiệu dụng (K), công thức Ballesteros (2012, EPL 97, 34008). */
export function bvToTeff(bv: number): number {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

// Hệ số hiệu chỉnh bolometric BC_V(T) của Flower (1996) theo bản sửa của Torres (2010, AJ 140, 1158).
const BC_COOL = [-0.190537291496456e5, 0.155144866764412e5, -0.421278819301717e4, 0.381476328422343e3];
const BC_MID = [-0.370510203809015e5, 0.385672629965804e5, -0.150651486316025e5, 0.261724637119416e4, -0.170623810323864e3];
const BC_HOT = [
  -0.118115450538963e6, 0.137145973583929e6, -0.636233812100225e5, 0.147412923562646e5, -0.170587278406872e4,
  0.78873172180499e2,
];

/** Hiệu chỉnh bolometric BC_V theo nhiệt độ (Flower 1996 / Torres 2010). */
export function bolometricCorrection(teff: number): number {
  const lt = Math.log10(teff);
  const c = lt < 3.7 ? BC_COOL : lt < 3.9 ? BC_MID : BC_HOT;
  let bc = 0;
  for (let i = c.length - 1; i >= 0; i--) bc = bc * lt + c[i];
  return bc;
}

/** Cấp sao tuyệt đối từ cấp sao biểu kiến và thị sai (mili giây cung). */
export function absoluteMagnitude(mag: number, plxMas: number): number {
  return mag + 5 * Math.log10(plxMas) - 10;
}

export interface StarPhysics {
  teff: number;
  /** Độ trưng (lần Mặt Trời). */
  luminosity: number;
  /** Bán kính (lần Mặt Trời): R = √L · (T☉/T)², định luật Stefan–Boltzmann. */
  radius: number;
}

/** Ước tính nhiệt độ, độ trưng và bán kính của một sao từ cấp sao, B−V và thị sai. */
export function starPhysics(mag: number, bv: number, plxMas: number): StarPhysics {
  const teff = bvToTeff(bv);
  const mbol = absoluteMagnitude(mag, plxMas) + bolometricCorrection(teff);
  const luminosity = 10 ** (-0.4 * (mbol - MBOL_SUN));
  const radius = Math.sqrt(luminosity) * (T_SUN / teff) ** 2;
  return { teff, luminosity, radius };
}

/**
 * Nhiệt độ cân bằng của hành tinh (K): T_eq = T★ · √(R★ / 2a) · (1 − A)^¼,
 * giả sử nhiệt phân bố đều trên toàn hành tinh; suất phản chiếu A mặc định 0,3 (gần giá trị của Trái Đất).
 */
export function equilibriumTemp(teff: number, radiusSun: number, aAU: number, albedo = 0.3): number {
  const rStarAU = (radiusSun * R_SUN_KM) / 149597870.7;
  return teff * Math.sqrt(rStarAU / (2 * aAU)) * (1 - albedo) ** 0.25;
}

export type PlanetClass = 'rocky' | 'subNeptune' | 'iceGiant' | 'gasGiant';

/**
 * Loại hành tinh để chọn kiểu vẽ: theo bán kính (lần Trái Đất) khi có, nếu không thì theo khối lượng.
 * Ngưỡng 1,6 R⊕ (Rogers 2015) tách hành tinh đá; 4 R⊕ và 10 R⊕ tách sao Hải Vương nhỏ, băng khổng lồ, khí khổng lồ.
 */
export function planetClass(radiusEarth: number | null, massEarth: number | null): PlanetClass {
  if (radiusEarth != null) {
    if (radiusEarth < 1.6) return 'rocky';
    if (radiusEarth < 4) return 'subNeptune';
    if (radiusEarth < 10) return 'iceGiant';
    return 'gasGiant';
  }
  const m = massEarth ?? 300;
  if (m < 5) return 'rocky';
  if (m < 20) return 'subNeptune';
  if (m < 80) return 'iceGiant';
  return 'gasGiant';
}

/**
 * Màu hiển thị của một sao theo nhiệt độ: xấp xỉ màu vật đen (Tanner Helland, 2012), trả về r, g, b trong [0, 1].
 */
export function blackbodyRgb(teff: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, teff)) / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * (t - 60) ** -0.1332047592;
    g = 288.1221695283 * (t - 60) ** -0.0755148492;
    b = 255;
  }
  out[0] = Math.min(255, Math.max(0, r)) / 255;
  out[1] = Math.min(255, Math.max(0, g)) / 255;
  out[2] = Math.min(255, Math.max(0, b)) / 255;
  return out;
}

/** Hạt giống số nguyên ổn định từ một chuỗi (FNV-1a 32 bit). */
export function seedOf(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Bộ sinh số giả ngẫu nhiên mulberry32: cùng hạt giống cho cùng dãy số trong [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
