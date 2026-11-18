// Khung nhìn bầu trời của «Bầu trời xưa»: bản đồ phương vị đẳng cự nhìn lên từ mặt đất (tâm = thiên đỉnh, rìa = chân trời),
// phía Bắc ở trên và phía Đông ở bên trái như tấm bản đồ sao cầm ngửa lên trời. Vẽ bằng canvas 2D, không dùng three.js.

import { bvToRgb, catalogArrays, nameOf } from '../data/catalog';
import { DEG } from '../astro/math';
import { COLORS } from '../scene/colors';
import type { BodyId, BodyState } from './bodies';
import { limitingMagnitude, type Moment, type StarSet } from './model';
import { H } from './text';

export interface FigureLines {
  set: StarSet;
  /** Cặp chỉ số đỉnh (phẳng: a0, b0, a1, b1, …). */
  segs: Uint32Array;
}

export interface Layers {
  lines: boolean;
  names: boolean;
  ecliptic: boolean;
  equator: boolean;
  bodies: boolean;
  daylight: boolean;
}

export type Pick = { kind: 'star'; index: number } | { kind: 'body'; id: BodyId } | { kind: 'marker' };

export interface Scene {
  m: Moment;
  lat: number;
  stars: StarSet;
  figures: FigureLines | null;
  bodies: BodyState[];
  layers: Layers;
  /** Điểm đánh dấu thêm (ví dụ khách tinh 1054), đã tính chân trời. */
  marker: { alt: number; az: number; label: string } | null;
  /** Chỉ số sao gần cực nhất (được đánh dấu). */
  poleStar: number;
  selected: Pick | null;
}

interface Palette {
  sky: Record<'night' | 'dusk' | 'day', [string, string]>;
  text: string;
  muted: string;
  border: string;
  accent: string;
  bodies: Record<BodyId, string>;
  halo: string;
}

const hex = (s: string): [number, number, number] => {
  const t = s.trim().replace('#', '');
  const f = t.length === 3 ? t.split('').map((c) => c + c).join('') : t;
  return [parseInt(f.slice(0, 2), 16) || 0, parseInt(f.slice(2, 4), 16) || 0, parseInt(f.slice(4, 6), 16) || 0];
};
const mix = (a: [number, number, number], b: [number, number, number], t: number): string =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;

let palette: Palette | null = null;
function readPalette(): Palette {
  if (palette) return palette;
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim() || '#888';
  palette = {
    sky: {
      night: [v('--hsky-zenith-night'), v('--hsky-horizon-night')],
      dusk: [v('--hsky-zenith-dusk'), v('--hsky-horizon-dusk')],
      day: [v('--hsky-zenith-day'), v('--hsky-horizon-day')],
    },
    text: v('--text'),
    muted: v('--muted'),
    border: v('--border-control'),
    accent: v('--accent-hi'),
    halo: v('--label-halo'),
    bodies: {
      sun: v('--sgk-sun'),
      moon: v('--sgk-moon'),
      mercury: v('--sgk-mercury'),
      venus: v('--sgk-venus'),
      mars: v('--sgk-mars'),
      jupiter: v('--sgk-jupiter'),
      saturn: v('--sgk-saturn'),
    },
  };
  return palette;
}

/** Màu nền trời ở thiên đỉnh và chân trời theo độ cao Mặt Trời (độ): đêm → hoàng hôn → ngày. */
export function skyColors(sunAlt: number): [string, string] {
  const p = readPalette();
  const pair = (k: 'night' | 'dusk' | 'day') => [hex(p.sky[k][0]), hex(p.sky[k][1])] as const;
  const [n, d, y] = [pair('night'), pair('dusk'), pair('day')];
  if (sunAlt <= -18) return [mix(n[0], n[0], 0), mix(n[1], n[1], 0)];
  if (sunAlt >= 6) return [mix(y[0], y[0], 0), mix(y[1], y[1], 0)];
  if (sunAlt < -6) {
    const t = (sunAlt + 18) / 12;
    return [mix(n[0], d[0], t), mix(n[1], d[1], t)];
  }
  const t = (sunAlt + 6) / 12;
  return [mix(d[0], y[0], t), mix(d[1], y[1], t)];
}

export interface ViewHandlers {
  onHover(p: Pick | null, x: number, y: number): void;
  onPick(p: Pick | null): void;
}

const MARGIN = 26;

export class SkyView {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private cx = 0;
  private cy = 0;
  private R = 0;
  private last: Scene | null = null;
  // Các điểm có thể trỏ tới (mảng gõ kiểu, dùng lại giữa các lần vẽ).
  private hitX: Float32Array;
  private hitY: Float32Array;
  private hitN = 0;
  private bodyHit: { id: BodyId; x: number; y: number }[] = [];
  private markerHit: { x: number; y: number } | null = null;
  private colors: string[];
  private readonly mags: ArrayLike<number>;
  private readonly hips: ArrayLike<number>;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly handlers: ViewHandlers,
  ) {
    const c = canvas.getContext('2d');
    if (!c) throw new Error('canvas 2D không khả dụng');
    this.ctx = c;
    const cat = catalogArrays();
    this.mags = cat.mag;
    this.hips = cat.hip;
    this.hitX = new Float32Array(cat.ra.length);
    this.hitY = new Float32Array(cat.ra.length);
    this.colors = cat.bv.map((bv) => {
      const [r, g, b] = bvToRgb(bv);
      return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
    });
    canvas.addEventListener('pointermove', (e) => this.pointer(e, false));
    canvas.addEventListener('pointerleave', () => handlers.onHover(null, 0, 0));
    canvas.addEventListener('click', (e) => this.pointer(e, true));
  }

  /** Đặt lại kích thước theo khung chứa (gọi khi đổi cỡ). */
  resize(cssW: number, cssH: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(120, Math.floor(cssW));
    this.h = Math.max(120, Math.floor(cssH));
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.cx = this.w / 2;
    this.cy = this.h / 2;
    this.R = Math.max(40, Math.min(this.w, this.h) / 2 - MARGIN);
    if (this.last) this.draw(this.last);
  }

  private xy(alt: number, az: number): [number, number] {
    const r = ((90 - alt) / 90) * this.R;
    const a = az * DEG;
    return [this.cx - r * Math.sin(a), this.cy - r * Math.cos(a)];
  }

  private pointer(e: PointerEvent | MouseEvent, click: boolean): void {
    const rect = this.canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * this.w;
    const py = ((e.clientY - rect.top) / rect.height) * this.h;
    const pick = this.hit(px, py);
    if (click) this.handlers.onPick(pick);
    else this.handlers.onHover(pick, e.clientX - rect.left, e.clientY - rect.top);
  }

  private hit(px: number, py: number): Pick | null {
    const reach = 16 * 16;
    let best: Pick | null = null;
    let bestD = reach;
    for (const b of this.bodyHit) {
      const d = (b.x - px) ** 2 + (b.y - py) ** 2;
      if (d < bestD) [best, bestD] = [{ kind: 'body', id: b.id }, d];
    }
    if (this.markerHit) {
      const d = (this.markerHit.x - px) ** 2 + (this.markerHit.y - py) ** 2;
      if (d < bestD) [best, bestD] = [{ kind: 'marker' }, d];
    }
    // Sao: ưu tiên sao sáng hơn khi hai sao cùng gần con trỏ.
    for (let i = 0; i < this.hitN; i++) {
      const idx = this.hitIdx[i];
      const d = (this.hitX[i] - px) ** 2 + (this.hitY[i] - py) ** 2 + this.mags[idx] * 0.5;
      if (d < bestD) [best, bestD] = [{ kind: 'star', index: idx }, d];
    }
    return best;
  }

  private hitIdx = new Uint32Array(0);

  draw(sc: Scene): void {
    this.last = sc;
    const { ctx, w, h, dpr, cx, cy, R } = this;
    const p = readPalette();
    const sun = sc.bodies[0];
    const sunAlt = sun ? sun.alt : -90;
    const limit = sc.layers.daylight ? 6 : limitingMagnitude(sunAlt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Nền trời.
    const [zen, hor] = skyColors(sunAlt);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, zen);
    g.addColorStop(1, hor);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();

    // Xích đạo và hoàng đạo của thời điểm.
    if (sc.layers.equator) this.drawCircle(sc, 0, COLORS.equator, 0.7, false);
    if (sc.layers.ecliptic) this.drawCircle(sc, sc.m.eps, COLORS.ecliptic, 0.8, true);

    // Đường nối chòm sao.
    if (sc.layers.lines && sc.figures) {
      const f = sc.figures;
      ctx.beginPath();
      for (let i = 0; i < f.segs.length; i += 2) {
        const a = f.segs[i];
        const b = f.segs[i + 1];
        if (f.set.alt[a] < 0 || f.set.alt[b] < 0) continue;
        const [x0, y0] = this.xy(f.set.alt[a], f.set.az[a]);
        const [x1, y1] = this.xy(f.set.alt[b], f.set.az[b]);
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
      ctx.strokeStyle = COLORS.figureSky;
      ctx.globalAlpha = sunAlt > -6 && !sc.layers.daylight ? 0.2 : 0.7;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Sao.
    const st = sc.stars;
    if (this.hitIdx.length < st.n) this.hitIdx = new Uint32Array(st.n);
    this.hitN = 0;
    const labels: { x: number; y: number; text: string; bold: boolean }[] = [];
    // Điện thoại: đĩa nhỏ, chỉ ghi tên các sao sáng nhất để nhãn không chồng lên nhau.
    const nameMag = this.R < 200 ? 1.5 : 2.3;
    for (let i = 0; i < st.n; i++) {
      const alt = st.alt[i];
      const mag = this.mags[i];
      if (alt < -0.5 || mag > limit + 0.4) continue;
      const [x, y] = this.xy(alt, st.az[i]);
      const fade = Math.min(1, Math.max(0, (limit + 0.4 - mag) / 1.2));
      const extinction = Math.min(1, 0.45 + alt / 14);
      const r = Math.max(0.8, 2.9 - 0.45 * mag) * (this.R > 260 ? 1.15 : 1);
      ctx.globalAlpha = Math.min(1, fade * extinction);
      ctx.fillStyle = this.colors[i];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      this.hitX[this.hitN] = x;
      this.hitY[this.hitN] = y;
      this.hitIdx[this.hitN++] = i;
      const isPole = i === sc.poleStar;
      if ((sc.layers.names && mag < nameMag && alt > 2) || isPole) {
        const n = nameOf(this.hips[i]);
        const text = n.short || n.designation;
        if (text) labels.push({ x: x + r + 3, y: y - r - 1, text, bold: isPole });
      }
    }
    ctx.globalAlpha = 1;

    // Cực thiên cầu nhìn thấy được.
    const [px, py] = this.xy(Math.abs(sc.lat), sc.lat >= 0 ? 0 : 180);
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.moveTo(px - 8, py);
    ctx.lineTo(px + 8, py);
    ctx.moveTo(px, py - 8);
    ctx.lineTo(px, py + 8);
    ctx.stroke();
    labels.push({ x: px + 10, y: py - 8, text: sc.lat >= 0 ? H.view.poleN : H.view.poleS, bold: false });

    // Điểm đánh dấu thêm.
    this.markerHit = null;
    if (sc.marker && sc.marker.alt > -0.5) {
      const [x, y] = this.xy(sc.marker.alt, sc.marker.az);
      this.markerHit = { x, y };
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ctx.moveTo(x + dx * 9, y + dy * 9);
        ctx.lineTo(x + dx * 14, y + dy * 14);
      }
      ctx.stroke();
      labels.push({ x: x + 16, y: y + 4, text: sc.marker.label, bold: true });
    }

    // Thiên thể.
    this.bodyHit = [];
    if (sc.layers.bodies) this.drawBodies(sc, labels);

    // Chọn / trỏ.
    if (sc.selected) this.drawSelected(sc);
    ctx.restore();

    // Nhãn (vẽ ngoài vùng cắt để không bị cụt ở mép).
    ctx.font = '12px Arial, Helvetica, sans-serif';
    ctx.textBaseline = 'alphabetic';
    for (const l of labels) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = p.halo;
      ctx.strokeText(l.text, l.x, l.y);
      ctx.fillStyle = l.bold ? p.text : p.muted;
      ctx.fillText(l.text, l.x, l.y);
    }

    // Viền chân trời và bốn phương.
    ctx.strokeStyle = COLORS.horizon;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 15px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const dirs: [string, number][] = [[H.cardinal.n, 0], [H.cardinal.e, 90], [H.cardinal.s, 180], [H.cardinal.w, 270]];
    ctx.fillStyle = p.text;
    for (const [t, az] of dirs) {
      const a = az * DEG;
      ctx.fillText(t, cx - (R + 14) * Math.sin(a), cy - (R + 14) * Math.cos(a));
    }
    ctx.textAlign = 'start';
  }

  /** Vòng lớn (xích đạo: eps = 0 → mặt phẳng xích đạo; hoàng đạo: nghiêng eps). */
  private drawCircle(sc: Scene, eps: number, color: string, alpha: number, dashed: boolean): void {
    const { ctx } = this;
    const ce = Math.cos(eps * DEG);
    const se = Math.sin(eps * DEG);
    const sinT = Math.sin(sc.m.lst * DEG);
    const cosT = Math.cos(sc.m.lst * DEG);
    const sinP = Math.sin(sc.lat * DEG);
    const cosP = Math.cos(sc.lat * DEG);
    ctx.beginPath();
    let pen = false;
    for (let k = 0; k <= 360; k += 2) {
      const l = k * DEG;
      const x = Math.cos(l);
      const y = Math.sin(l) * ce;
      const z = Math.sin(l) * se;
      const X = x * cosT + y * sinT;
      const Y = x * sinT - y * cosT;
      const alt = Math.asin(Math.max(-1, Math.min(1, sinP * z + cosP * X))) / DEG;
      if (alt < -0.5) {
        pen = false;
        continue;
      }
      let az = Math.atan2(-Y, z * cosP - X * sinP) / DEG;
      if (az < 0) az += 360;
      const [sx, sy] = this.xy(alt, az);
      if (pen) ctx.lineTo(sx, sy);
      else ctx.moveTo(sx, sy);
      pen = true;
    }
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.4;
    ctx.setLineDash(dashed ? [] : [6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  private drawBodies(sc: Scene, labels: { x: number; y: number; text: string; bold: boolean }[]): void {
    const { ctx } = this;
    const p = readPalette();
    const sunPos = sc.bodies[0];
    // Vẽ hành tinh trước, rồi Mặt Trăng, cuối cùng Mặt Trời.
    const order = [...sc.bodies].sort((a, b) => (a.id === 'sun' ? 1 : b.id === 'sun' ? -1 : a.id === 'moon' ? 1 : b.id === 'moon' ? -1 : 0));
    const sunLimit = limitingMagnitude(sunPos ? sunPos.alt : -90);
    for (const b of order) {
      if (b.alt < -0.5) continue;
      // Hành tinh: chỉ thấy khi đủ sáng so với nền trời.
      if (b.id !== 'sun' && b.id !== 'moon' && b.mag > sunLimit + 0.4 && !sc.layers.daylight) continue;
      const [x, y] = this.xy(b.alt, b.az);
      this.bodyHit.push({ id: b.id, x, y });
      const color = p.bodies[b.id];
      if (b.id === 'sun') {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 26);
        glow.addColorStop(0, color);
        glow.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.id === 'moon') {
        let toSun = 0;
        if (sunPos) {
          const [sx, sy] = this.xy(sunPos.alt, sunPos.az);
          toSun = Math.atan2(sy - y, sx - x);
        }
        this.drawMoon(x, y, 9, b.elongation, toSun, color);
      } else {
        const r = Math.max(2.2, Math.min(5, 3.4 - 0.55 * b.mag));
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      labels.push({ x: x + 12, y: y - 8, text: H.bodies[b.id], bold: b.id === 'sun' || b.id === 'moon' });
    }
  }

  /** Mặt Trăng với phần sáng quay về phía Mặt Trời (elong = độ lệch kinh độ so với Mặt Trời; 0 = non, 180 = tròn). */
  private drawMoon(x: number, y: number, r: number, elong: number, toSun: number, color: string): void {
    const { ctx } = this;
    const p = readPalette();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(toSun);
    ctx.fillStyle = p.border;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const cosE = Math.cos(elong * DEG);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    if (cosE > 0) ctx.ellipse(0, 0, Math.max(0.01, r * cosE), r, 0, Math.PI / 2, -Math.PI / 2, true);
    else ctx.ellipse(0, 0, Math.max(0.01, -r * cosE), r, 0, Math.PI / 2, (3 * Math.PI) / 2, false);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawSelected(sc: Scene): void {
    const sel = sc.selected;
    if (!sel) return;
    const { ctx } = this;
    const p = readPalette();
    let pos: [number, number] | null = null;
    if (sel.kind === 'star') {
      const a = sc.stars.alt[sel.index];
      if (a > -0.5) pos = this.xy(a, sc.stars.az[sel.index]);
    } else if (sel.kind === 'body') {
      const b = sc.bodies.find((x) => x.id === sel.id);
      if (b && b.alt > -0.5) pos = this.xy(b.alt, b.az);
    } else if (sc.marker && sc.marker.alt > -0.5) pos = this.xy(sc.marker.alt, sc.marker.az);
    if (!pos) return;
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos[0], pos[1], 13, 0, Math.PI * 2);
    ctx.stroke();
  }
}
