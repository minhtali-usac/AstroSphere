// Bản đồ thế giới (phép chiếu trụ đều) để bấm/kéo chọn vị trí quan sát. Dữ liệu nội bộ, không cần mạng.

import { fmtLat, fmtLon } from '../astro';
import { drawLand, landRings, loadLand } from '../data/land';
import { VN_PLACES } from '../data/places';
import { t } from '../i18n';
import { h } from './dom';

/** Giá trị một token màu trong :root (styles.css); `fallback` khi chưa có CSS (vd. kiểm thử). */
function cssToken(name: string, fallback: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
}

export class WorldMap {
  readonly el: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private base: HTMLCanvasElement;
  private lat = 0;
  private lon = 0;
  private dragging = false;
  private equatorColor = '';
  private onPick: (lat: number, lon: number) => void;

  constructor(onPick: (lat: number, lon: number) => void) {
    this.onPick = onPick;
    this.canvas = h('canvas', {
      class: 'worldmap__canvas',
      tabIndex: 0,
      role: 'slider',
      'aria-label': t('panel.location.mapAria'),
      'aria-valuetext': '',
    });
    this.el = h('div', { class: 'worldmap' }, this.canvas);
    this.base = this.renderBase();
    // Lục địa tải động: vẽ biển + lưới trước, vẽ lại nền khi dữ liệu tới.
    if (!landRings()) {
      loadLand().then(
        () => {
          this.base = this.renderBase();
          this.draw(this.lat, this.lon);
        },
        (err) => console.error(err),
      );
    }

    const pick = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
      const y = Math.min(Math.max(e.clientY - r.top, 0), r.height);
      const lon = (x / r.width) * 360 - 180;
      const lat = 90 - (y / r.height) * 180;
      this.onPick(lat, lon);
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.canvas.setPointerCapture(e.pointerId);
      pick(e);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.dragging) pick(e);
    });
    const stop = () => (this.dragging = false);
    this.canvas.addEventListener('pointerup', stop);
    this.canvas.addEventListener('pointercancel', stop);
    this.canvas.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 1;
      let { lat, lon } = this;
      if (e.key === 'ArrowUp') lat += step;
      else if (e.key === 'ArrowDown') lat -= step;
      else if (e.key === 'ArrowLeft') lon -= step;
      else if (e.key === 'ArrowRight') lon += step;
      else return;
      e.preventDefault();
      e.stopPropagation();
      if (lon > 180) lon -= 360;
      if (lon < -180) lon += 360;
      this.onPick(Math.max(-90, Math.min(90, lat)), lon);
    });
    new ResizeObserver(() => this.draw(this.lat, this.lon)).observe(this.el);
  }

  private renderBase(): HTMLCanvasElement {
    const w = 1440;
    const hh = 720;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = hh;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#0f2744';
    ctx.fillRect(0, 0, w, hh);
    drawLand(ctx, w, hh, '#2f6b45', '#5fae7a');
    const y = (lat: number) => ((90 - lat) / 180) * hh;
    const x = (lon: number) => ((lon + 180) / 360) * w;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    for (let lon = -150; lon <= 150; lon += 30) {
      ctx.beginPath();
      ctx.moveTo(x(lon), 0);
      ctx.lineTo(x(lon), hh);
      ctx.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y(lat));
      ctx.lineTo(w, y(lat));
      ctx.stroke();
    }
    // Chí tuyến và vòng cực
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(147,197,253,0.35)';
    for (const lat of [23.44, -23.44, 66.56, -66.56]) {
      ctx.beginPath();
      ctx.moveTo(0, y(lat));
      ctx.lineTo(w, y(lat));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Các địa điểm Việt Nam: chấm trắng trung tính (token --text) viền tối, nhỏ hơn ghim vị trí hiện tại (trắng viền
    // đỏ). Không còn hồng: hồng là màu vòng thẳng đứng và độ cao trong cảnh (fix-3 #9).
    ctx.fillStyle = cssToken('--text', '#f2f2f2');
    ctx.strokeStyle = cssToken('--bg', '#0a0a0a');
    ctx.lineWidth = 2;
    for (const p of VN_PLACES) {
      ctx.beginPath();
      ctx.arc(x(p.lon!), y(p.lat), 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }
    return c;
  }

  draw(lat: number, lon: number): void {
    this.lat = lat;
    this.lon = lon;
    this.canvas.setAttribute('aria-valuetext', `${fmtLat(lat)}, ${fmtLon(lon)}`);
    const cssW = this.el.clientWidth;
    if (cssW === 0) return;
    const cssH = cssW / 2;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(cssW * dpr);
    const H = Math.round(cssH * dpr);
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
      this.canvas.style.height = `${cssH}px`;
    }
    const ctx = this.canvas.getContext('2d')!;
    ctx.drawImage(this.base, 0, 0, W, H);
    // Xích đạo Trái Đất vẽ ở độ phân giải thật của canvas (không thu nhỏ từ ảnh nền 1440 px, nơi nét mảnh lúc
    // hiện lúc mất tùy bề rộng): xám trung tính nét đứt (--map-equator), vì vàng là xích đạo trời (review-4 #10).
    this.equatorColor ||= cssToken('--map-equator', '#a3a3a3');
    ctx.strokeStyle = this.equatorColor;
    ctx.lineWidth = 1.5 * dpr;
    ctx.setLineDash([8 * dpr, 5 * dpr]);
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    const x = ((lon + 180) / 360) * W;
    const y = ((90 - lat) / 180) * H;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1 * dpr;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5 * dpr;
    ctx.beginPath();
    ctx.arc(x, y, 5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
