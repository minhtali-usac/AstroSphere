// Biểu đồ nhìn quanh cực hoàng đạo: cực Bắc thiên cầu đi một vòng tròn mất ≈ 25 770 năm (tuế sai). Khung cố định theo J2000;
// vòng tròn có bán kính bằng độ nghiêng trục, các chấm là cực ở từng thời đại, chấm cam là cực ở thời điểm đang chọn.

import { J2000 } from '../astro/time';
import { DEG, type Vec3 } from '../astro/math';
import { poleOfDate, meanObliquity } from '../astro/history';
import { bvToRgb, catalogArrays, nameOf } from '../data/catalog';
import { COLORS } from '../scene/colors';
import type { Moment, StarSet } from './model';
import { fmt, H } from './text';

const SPAN = 42; // bán kính biểu đồ (độ)
const EPS0 = 23.43928 * DEG;

/** Đổi vector J2000 → (góc từ cực hoàng đạo, góc phương vị) trong khung biểu đồ. */
function chartAngles(v: Vec3): { theta: number; phi: number } {
  // Cực hoàng đạo k = (0, −sin ε, cos ε); x̂ = (1,0,0); ŷ = k × x̂ = (0, cos ε, sin ε).
  const dk = -Math.sin(EPS0) * v[1] + Math.cos(EPS0) * v[2];
  const dx = v[0];
  const dy = Math.cos(EPS0) * v[1] + Math.sin(EPS0) * v[2];
  return { theta: Math.acos(Math.max(-1, Math.min(1, dk))) / DEG, phi: Math.atan2(dy, dx) };
}

const jdOfYear = (year: number): number => J2000 + (year - 2000) * 365.25;

const css = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#999';

export class PoleChart {
  private ctx: CanvasRenderingContext2D;
  private size = 240;
  private dpr = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    const c = canvas.getContext('2d');
    if (!c) throw new Error('canvas 2D không khả dụng');
    this.ctx = c;
  }

  resize(css: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = Math.max(160, Math.floor(css));
    this.canvas.width = Math.round(this.size * this.dpr);
    this.canvas.height = Math.round(this.size * this.dpr);
  }

  draw(stars: StarSet, m: Moment, motion: boolean, year: number, poleStar: number): void {
    const { ctx, size, dpr } = this;
    const c = size / 2;
    const R = c - 22;
    const px = (v: Vec3): [number, number] => {
      const { theta, phi } = chartAngles(v);
      const r = (theta / SPAN) * R;
      return [c + r * Math.cos(phi), c - r * Math.sin(phi)];
    };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const text = css('--text');
    const muted = css('--muted');
    const accent = css('--accent');
    const halo = css('--label-halo');
    const grid = css('--border-control');

    // Khung tròn bán kính SPAN và vòng 10°, 20°, 30°.
    ctx.lineWidth = 1;
    ctx.strokeStyle = grid;
    ctx.globalAlpha = 0.5;
    for (const d of [10, 20, 30, SPAN]) {
      ctx.beginPath();
      ctx.arc(c, c, (d / SPAN) * R, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Sao sáng trong khung.
    const cat = catalogArrays();
    const v: Vec3 = [0, 0, 0];
    ctx.font = '11px Arial, Helvetica, sans-serif';
    const named: { x: number; y: number; t: string }[] = [];
    for (let i = 0; i < stars.n; i++) {
      if (cat.mag[i] > 4.2) continue;
      stars.at(i, m.years, motion, v);
      if (chartAngles(v).theta > SPAN) continue;
      const [x, y] = px(v);
      const [r, g, b] = bvToRgb(cat.bv[i]);
      ctx.fillStyle = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, 2.6 - 0.4 * cat.mag[i]), 0, Math.PI * 2);
      ctx.fill();
      const n = nameOf(cat.hip[i]);
      if ((cat.mag[i] < 2.6 && n.short) || i === poleStar) named.push({ x: x + 4, y: y - 4, t: n.short || n.designation });
    }

    // Vòng tuế sai: cực Bắc thiên cầu đi quanh cực hoàng đạo.
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(c, c, (meanObliquity(J2000) / SPAN) * R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Các thời đại (cách 1000 năm); nhãn mỗi 4000 năm.
    const pole: Vec3 = [0, 0, 0];
    ctx.fillStyle = COLORS.axis;
    // Mốc theo năm lịch: 10000 … 1000 TCN (năm thiên văn 1 − n) và 1000 … 6000 SCN.
    for (let k = -10; k <= 6; k++) {
      if (k === 0) continue;
      const n = Math.abs(k) * 1000;
      const y = k < 0 ? 1 - n : n;
      const labelled = k < 0 ? n % 4000 === 0 : n === 2000 || n === 6000;
      const [x, yy] = px(poleOfDate(jdOfYear(y), pole));
      ctx.beginPath();
      ctx.arc(x, yy, labelled ? 2.8 : 1.8, 0, Math.PI * 2);
      ctx.fill();
      if (labelled) named.push({ x: x + 5, y: yy + 11, t: fmt(H.pole.ticks, { n, era: k < 0 ? H.era.bc : H.era.ad }) });
    }

    // Cực ở thời điểm đang chọn (nếu nằm trong khoảng vẽ).
    const cur = px(poleOfDate(jdOfYear(year), pole));
    ctx.fillStyle = accent;
    ctx.strokeStyle = halo;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cur[0], cur[1], 5.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();

    // Cực hoàng đạo ở tâm.
    ctx.strokeStyle = COLORS.ecliptic;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(c - 5, c);
    ctx.lineTo(c + 5, c);
    ctx.moveTo(c, c - 5);
    ctx.lineTo(c, c + 5);
    ctx.stroke();
    named.push({ x: c + 7, y: c + 4, t: H.pole.label });

    ctx.lineJoin = 'round';
    for (const l of named) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = halo;
      ctx.strokeText(l.t, l.x, l.y);
      ctx.fillStyle = l.t === H.pole.label ? COLORS.ecliptic : muted;
      ctx.fillText(l.t, l.x, l.y);
    }
    void text;
  }
}
