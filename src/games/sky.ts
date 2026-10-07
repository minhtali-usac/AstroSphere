// Bản đồ sao vùng trời phía Bắc cho "Nối sao thành chòm" và "Truy tìm sao Bắc Cực".
//
// Tọa độ thật: sao của ba chòm lấy từ hình mẫu chòm sao (d3-celestial, theo số HIP), sao nền lấy từ danh mục sao
// sáng của ứng dụng — cả hai đã nằm trong gói khởi động nên trò chơi không tải thêm dữ liệu.
//
// Phép chiếu: phương vị đẳng cự quanh thiên cực Bắc, như khi đứng quay mặt về hướng Bắc ngẩng lên trời. Khoảng cách
// tới tâm = 90° − δ; xích kinh tăng theo chiều kim đồng hồ (phía Đông ở bên phải sao Bắc Cực khi nhìn lên phía
// trên nó). Bầu trời quay ngược chiều kim đồng hồ quanh sao Bắc Cực: `rot` là góc đã quay.

import { catalogArrays } from '../data/catalog';
import { TEMPLATE_FIGURES } from '../data/constellations';
import { rad } from './svg';

export interface SkyStar {
  hip: number;
  ra: number;
  dec: number;
  mag: number;
}

export interface Asterism {
  id: 'dipper' | 'cas' | 'umi';
  stars: SkyStar[];
  /** Ký hiệu Hy Lạp, cùng thứ tự với `stars`. */
  greek: string[];
  /** Cặp chỉ số trong `stars` được nối. */
  segs: [number, number][];
}

function pick(abbr: string, hips: number[]): SkyStar[] {
  const fig = TEMPLATE_FIGURES[abbr];
  return hips.map((hip) => {
    const s = fig.stars.find((x) => x[3] === hip);
    if (!s) throw new Error(`thiếu sao HIP ${hip} trong ${abbr}`);
    return { hip, ra: s[0], dec: s[1], mag: s[2] };
  });
}

/** 7 sao chính của Gấu Lớn (cái gáo): α Dubhe, β Merak, γ Phecda, δ Megrez, ε Alioth, ζ Mizar, η Alkaid. */
export const DIPPER: Asterism = {
  id: 'dipper',
  stars: pick('UMa', [54061, 53910, 58001, 59774, 62956, 65378, 67301]),
  greek: ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η'],
  segs: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [3, 4],
    [4, 5],
    [5, 6],
  ],
};

/** 5 sao chữ W của Thiên Hậu: α Schedar, β Caph, γ, δ Ruchbah, ε Segin. */
export const CAS: Asterism = {
  id: 'cas',
  stars: pick('Cas', [3179, 746, 4427, 6686, 8886]),
  greek: ['α', 'β', 'γ', 'δ', 'ε'],
  segs: [
    [1, 0],
    [0, 2],
    [2, 3],
    [3, 4],
  ],
};

/** 7 sao của Gấu Bé: α Polaris, β Kochab, γ Pherkad, δ Yildun, ε, ζ, η. */
export const UMI: Asterism = {
  id: 'umi',
  stars: pick('UMi', [11767, 72607, 75097, 85822, 82080, 77055, 79822]),
  greek: ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η'],
  segs: [
    [0, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 2],
    [2, 1],
    [1, 5],
  ],
};

export const POLARIS = UMI.stars[0];

/** Sao nền: sao sáng (cấp ≤ magLimit) gần thiên cực Bắc, trừ sao của ba chòm trên. */
export function backgroundStars(minDec: number, magLimit: number, exclude: Set<number>): SkyStar[] {
  const d = catalogArrays();
  const out: SkyStar[] = [];
  for (let i = 0; i < d.ra.length; i++) {
    if (d.dec[i] < minDec || d.mag[i] > magLimit || exclude.has(d.hip[i])) continue;
    out.push({ hip: d.hip[i], ra: d.ra[i], dec: d.dec[i], mag: d.mag[i] });
  }
  return out;
}

export const ASTERISM_HIPS = new Set([...DIPPER.stars, ...CAS.stars, ...UMI.stars].map((s) => s.hip));

/** Chiếu (α, δ) lên mặt phẳng (đơn vị: độ, y hướng xuống như màn hình), bầu trời đã quay `rot` độ. */
export function project(ra: number, dec: number, rot: number): { x: number; y: number } {
  const r = 90 - dec;
  const a = rad(rot - ra);
  return { x: r * Math.cos(a), y: -r * Math.sin(a) };
}

export interface Frame {
  /** Tọa độ mặt phẳng (độ) → tọa độ hình. */
  to(p: { x: number; y: number }): { x: number; y: number };
  /** Tọa độ hình → tọa độ mặt phẳng (độ). */
  from(p: { x: number; y: number }): { x: number; y: number };
  /** Số đơn vị hình trên một độ. */
  scale: number;
}

/** Khung nhìn ôm trọn các điểm (độ) trong hình W × H, chừa lề `pad` (đơn vị hình). */
export function fit(points: { x: number; y: number }[], w: number, hgt: number, pad: number): Frame {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  const scale = Math.min((w - 2 * pad) / Math.max(x1 - x0, 1e-6), (hgt - 2 * pad) / Math.max(y1 - y0, 1e-6));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return {
    scale,
    to: (p) => ({ x: w / 2 + (p.x - cx) * scale, y: hgt / 2 + (p.y - cy) * scale }),
    from: (p) => ({ x: cx + (p.x - w / 2) / scale, y: cy + (p.y - hgt / 2) / scale }),
  };
}

/** Bán kính chấm sao theo cấp sao (sao sáng to hơn). */
export const starRadius = (mag: number) => Math.max(1.4, 5.2 - 0.95 * mag);
