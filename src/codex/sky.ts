// Codex › ảnh bầu trời thu nhỏ (SVG dựng lúc chạy, chỉ trong chunk lười của Codex) cho mục sao, chòm sao và thiên
// thể sâu. Dữ liệu thật: vị trí, cấp sao và màu B − V từ danh mục sao sáng (data/catalog.ts), hình chòm từ
// TEMPLATE_FIGURES (16 mẫu), thiên thể sâu từ data/deepSky.ts. Phép chiếu nổi (stereographic) quanh tâm khung,
// hướng như khi ngẩng nhìn trời: Bắc ở trên, Đông bên trái. Chấm càng to sao càng sáng (cùng quy ước với cảnh 3D).

import { bvToRgb, catalogArrays, nameOf } from '../data/catalog';
import type { ConstellationFigure } from '../data/constellations';
import { COLORS } from '../scene/colors';

const D = Math.PI / 180;
const r1 = (x: number) => Math.round(x * 10) / 10;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export interface SkyPoint {
  ra: number;
  dec: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SkyOptions {
  /** Hình chòm sao (đường nối) vẽ trong khung, nếu có. */
  figure?: ConstellationFigure;
  /** Điểm được làm nổi: vòng tròn và nhãn. */
  mark?: SkyPoint & { label: string; ring?: number; color?: string };
  /** Bán kính tối thiểu của vùng trời (độ) quanh tâm khi không có hình chòm. */
  radius?: number;
  /** Ghi tên các sao sáng nhất trong hình chòm (tối đa n sao). */
  labelBright?: number;
  /** Ghi tên các sao có tên riêng sáng hơn cấp này trong khung (khi không có hình chòm). */
  labelField?: number;
  /** Ghi tên phía dưới khung (ảnh nhỏ nhiều khung). */
  title?: string;
}

/** Vectơ đơn vị của (α, δ) tính theo độ. */
function vec(p: SkyPoint): [number, number, number] {
  const ca = Math.cos(p.ra * D);
  const sa = Math.sin(p.ra * D);
  const cd = Math.cos(p.dec * D);
  return [cd * ca, cd * sa, Math.sin(p.dec * D)];
}

/** Tâm của một tập điểm trên mặt cầu (trung bình vectơ, chuẩn hóa). */
function centroid(points: SkyPoint[]): SkyPoint {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    const v = vec(p);
    x += v[0];
    y += v[1];
    z += v[2];
  }
  const n = Math.hypot(x, y, z) || 1;
  return { ra: Math.atan2(y, x) / D, dec: Math.asin(z / n) / D };
}

/** Chiếu nổi quanh tâm c: trả về (x, y) theo radian xấp xỉ, x dương về phía Đông (vẽ sang trái). */
function project(c: SkyPoint, p: SkyPoint): [number, number, number] {
  const d0 = c.dec * D;
  const d = p.dec * D;
  const da = (p.ra - c.ra) * D;
  const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(da);
  const k = 2 / (1 + cosc);
  return [k * Math.cos(d) * Math.sin(da), k * (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(da)), cosc];
}

/** Bán kính chấm sao (px) theo cấp sao — sao càng sáng chấm càng to. */
export const starRadius = (mag: number): number => Math.min(4.6, Math.max(0.65, 0.55 + (4.9 - mag) * 0.62));

const rgb = (bv: number) => {
  const [r, g, b] = bvToRgb(Number.isFinite(bv) ? bv : 0.6);
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
};

/** Một khung bầu trời thu nhỏ (chuỗi SVG, không kèm thẻ <svg>). */
export function skyGroup(box: Box, opts: SkyOptions): string {
  const fig = opts.figure;
  const pts: SkyPoint[] = fig ? fig.stars.map(([ra, dec]) => ({ ra, dec })) : [];
  if (opts.mark) pts.push(opts.mark);
  const center = pts.length > 1 ? centroid(pts) : (opts.mark ?? { ra: 0, dec: 0 });
  // Khung vừa khít hình chòm (và điểm làm nổi), có lề; không có hình chòm thì vừa bán kính cho trước.
  const pad = 16;
  const titleH = opts.title ? 16 : 0;
  const innerW = box.w - 2 * pad;
  const innerH = box.h - 2 * pad - titleH;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const extend = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  for (const p of pts) {
    const [x, y] = project(center, p);
    extend(-x, -y);
  }
  const rad = (opts.radius ?? 0) * D;
  if (rad > 0) {
    extend(-rad, -rad * (innerH / innerW));
    extend(rad, rad * (innerH / innerW));
  }
  const spanX = Math.max(maxX - minX, 1e-3);
  const spanY = Math.max(maxY - minY, 1e-3);
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const ox = box.x + box.w / 2 - ((minX + maxX) / 2) * scale;
  const oy = box.y + (box.h - titleH) / 2 - ((minY + maxY) / 2) * scale;
  const toScreen = (p: SkyPoint): [number, number, boolean] => {
    const [x, y, cosc] = project(center, p);
    const sx = ox - x * scale;
    const sy = oy - y * scale;
    const inside = cosc > 0 && sx >= box.x + 2 && sx <= box.x + box.w - 2 && sy >= box.y + 2 && sy <= box.y + box.h - titleH - 2;
    return [sx, sy, inside];
  };
  const pxPerDeg = scale * D;

  let out = `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h - titleH}" rx="6" class="cdx-svg__sky"/>`;
  // Sao nền: mọi sao trong danh mục rơi vào khung (cấp ≤ 4,8).
  const data = catalogArrays();
  const field: string[] = [];
  const fieldNames: [number, number, number, string][] = [];
  for (let i = 0; i < data.ra.length; i++) {
    const [sx, sy, inside] = toScreen({ ra: data.ra[i], dec: data.dec[i] });
    if (!inside) continue;
    field.push(`<circle cx="${r1(sx)}" cy="${r1(sy)}" r="${r1(starRadius(data.mag[i]))}" fill="${rgb(data.bv[i])}"/>`);
    if (opts.labelField !== undefined && data.mag[i] < opts.labelField) {
      const name = nameOf(data.hip[i]).short;
      const isMark = opts.mark && Math.abs(opts.mark.ra - data.ra[i]) < 0.05 && Math.abs(opts.mark.dec - data.dec[i]) < 0.05;
      if (name && !isMark) fieldNames.push([sx, sy, data.mag[i], name]);
    }
  }
  // Hình chòm: đường nối phía dưới các chấm sao.
  if (fig) {
    let d = '';
    for (const [a, b] of fig.segs) {
      const [ax, ay] = toScreen({ ra: fig.stars[a][0], dec: fig.stars[a][1] });
      const [bx, by] = toScreen({ ra: fig.stars[b][0], dec: fig.stars[b][1] });
      d += `M${r1(ax)} ${r1(ay)}L${r1(bx)} ${r1(by)}`;
    }
    out += `<path d="${d}" fill="none" stroke="${COLORS.figure}" stroke-width="1.3" stroke-opacity=".75" stroke-linecap="round"/>`;
  }
  out += `<g class="cdx-svg__field">${field.join('')}</g>`;
  // Nhãn tên sao: thử bên phải / trái, rồi lệch lên / xuống một dòng, để hai nhãn không chồng lên nhau.
  const placed: [number, number, number, number][] = [];
  const starLabel = (sx: number, sy: number, mag: number, name: string): string => {
    const w = name.length * 7;
    const gap = starRadius(mag) + 4;
    const preferRight = sx < box.x + box.w * 0.62;
    const tries: [boolean, number][] = [
      [preferRight, 0],
      [!preferRight, 0],
      [preferRight, 12],
      [preferRight, -12],
      [!preferRight, 12],
    ];
    for (const [right, dy] of tries) {
      const x0 = right ? sx + gap : sx - gap - w;
      const y0 = sy + dy - 6;
      const hit = placed.some(([a, b, c, d]) => x0 < c && x0 + w > a && y0 < d && y0 + 12 > b);
      // Cả trên/dưới: nhãn 13 px (sàn cỡ chữ của USACodex) sát mép trên không bị cắt (vd. Shedar trong khung M31).
      const outside = x0 < box.x || x0 + w > box.x + box.w || y0 < box.y + 1 || y0 + 13 > box.y + box.h - titleH;
      if (hit || outside) continue;
      placed.push([x0, y0, x0 + w, y0 + 12]);
      return `<text x="${r1(right ? sx + gap : sx - gap)}" y="${r1(sy + dy + 4)}" class="cdx-svg__t cdx-svg__t--muted" text-anchor="${right ? 'start' : 'end'}">${esc(name)}</text>`;
    }
    return '';
  };
  // Tên các sao sáng nhất của hình chòm (tên riêng theo IAU).
  if (fig && opts.labelBright) {
    const named = fig.stars
      .filter(([, , , hip]) => hip && nameOf(hip).short)
      .sort((a, b) => a[2] - b[2])
      .slice(0, opts.labelBright);
    for (const [ra, dec, mag, hip] of named) {
      if (opts.mark && Math.abs(opts.mark.ra - ra) < 0.05 && Math.abs(opts.mark.dec - dec) < 0.05) continue;
      const [sx, sy, inside] = toScreen({ ra, dec });
      if (!inside) continue;
      out += starLabel(sx, sy, mag, nameOf(hip).short);
    }
  }
  for (const [sx, sy, mag, name] of fieldNames) {
    out += starLabel(sx, sy, mag, name);
  }
  if (opts.mark) {
    const [sx, sy] = toScreen(opts.mark);
    const ring = Math.max(7, (opts.mark.ring ?? 0) * pxPerDeg);
    out += `<circle cx="${r1(sx)}" cy="${r1(sy)}" r="${r1(ring)}" fill="none" stroke="${opts.mark.color ?? 'currentColor'}" stroke-width="1.6" class="cdx-svg__ring"/>`;
    const right = sx < box.x + box.w * 0.6;
    const ty = sy - ring - 6 < box.y + 14 ? sy + ring + 15 : sy - ring - 6;
    out += `<text x="${r1(right ? sx + ring * 0.4 : sx - ring * 0.4)}" y="${r1(ty)}" class="cdx-svg__t cdx-svg__t--key" text-anchor="${right ? 'start' : 'end'}">${esc(opts.mark.label)}</text>`;
  }
  if (opts.title) out += `<text x="${r1(box.x + box.w / 2)}" y="${r1(box.y + box.h - 3)}" class="cdx-svg__t cdx-svg__t--muted" text-anchor="middle">${esc(opts.title)}</text>`;
  return out;
}

/** Ảnh bầu trời một khung, kèm hướng B (trên) và Đ (trái) ở góc. */
export function skySvg(opts: SkyOptions, caption: string, dir: { north: string; east: string }, height = 210): string {
  const W = 300;
  const body = skyGroup({ x: 0, y: 0, w: W, h: height }, opts);
  const compass = `<g class="cdx-svg__compass"><rect x="${W - 54}" y="1" width="52" height="40" rx="5" class="cdx-svg__veil"/><path d="M${W - 22} 30V14M${W - 22} 30H${W - 38}" fill="none" stroke="currentColor" stroke-width="1.2"/>${`<text x="${W - 22}" y="11" text-anchor="middle" class="cdx-svg__t cdx-svg__t--dir">${esc(dir.north)}</text><text x="${W - 42}" y="34" text-anchor="end" class="cdx-svg__t cdx-svg__t--dir">${esc(dir.east)}</text>`}</g>`;
  return `<svg class="cdx-svg" viewBox="0 0 ${W} ${height}" role="img" aria-label="${esc(caption).replace(/"/g, '&quot;')}">${body}${compass}</svg>`;
}
