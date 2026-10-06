// Nhịp "đã chọn" của vòng chọn (quyết định của chủ dự án 2026-10-05, review-2 A1): một phần thưởng lặng lẽ khi người
// dùng chọn một thiên thể. Vòng phóng 1 → 1,35 → 1 và mờ 1 → 0,5 → 1 trong 300 ms, giảm tốc (ease-out), không nảy.
// Hàm thuần (không three.js, không cấp phát): SkyLayer gọi mỗi khung hình trong lúc nhịp chạy.

/** Thời lượng một nhịp (ms). */
export const SEL_PULSE_MS = 300;
/** Hệ số phóng lớn nhất của vòng. */
export const SEL_PULSE_SCALE = 1.35;
/** Độ đục nhỏ nhất của vòng. */
export const SEL_PULSE_OPACITY = 0.5;
/** Phần thời gian để lên đỉnh (90 ms); phần còn lại (210 ms) là lúc lắng về nghỉ. */
const PEAK = 0.3;

/**
 * Biên độ nhịp (0 = nghỉ, 1 = đỉnh) tại tiến độ `u` ∈ [0, 1]. Cả pha lên và pha về đều ease-out (bậc ba): nhanh lúc
 * đầu, chậm dần khi tới nơi, không vượt quá đỉnh và không vượt quá 0 khi về (không nảy).
 */
export function selPulseAmount(u: number): number {
  if (!(u > 0) || u >= 1) return 0;
  if (u < PEAK) {
    const x = 1 - u / PEAK;
    return 1 - x * x * x;
  }
  const x = (u - PEAK) / (1 - PEAK);
  const r = 1 - x;
  return r * r * r;
}
