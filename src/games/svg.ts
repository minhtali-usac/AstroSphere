// Tiện ích SVG cho Thử thách SGK: dựng phần tử, đổi tọa độ con trỏ sang tọa độ hình, kéo bằng con trỏ.

const NS = 'http://www.w3.org/2000/svg';

type Kid = Node | string | null | undefined | false;
type Attrs = Record<string, unknown>;

/** Dựng phần tử SVG. `text` là nội dung chữ, `on…` là trình nghe sự kiện, còn lại là thuộc tính. */
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...kids: Kid[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'text') el.textContent = String(v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

/** Khung SVG co giãn theo chiều ngang (viewBox cố định). */
export function svgRoot(w: number, h: number, label: string, cls = ''): SVGSVGElement {
  return s('svg', { viewBox: `0 0 ${w} ${h}`, class: `sgk-svg ${cls}`.trim(), role: 'group', 'aria-label': label });
}

/** Tọa độ con trỏ trong hệ tọa độ của hình. */
export function svgPoint(svg: SVGSVGElement, e: { clientX: number; clientY: number }): { x: number; y: number } {
  const m = svg.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

/**
 * Kéo bằng con trỏ (chuột, chạm, bút): bấm vào `handle` (hoặc vào `track` nếu có) rồi kéo; `move` nhận tọa độ hình.
 * `isLocked()` trả về true thì bỏ qua (lượt chơi đã xong).
 */
export function draggable(svg: SVGSVGElement, handle: Element, move: (p: { x: number; y: number }) => void, isLocked: () => boolean, track?: Element): void {
  let id = -1;
  const down = (e: Event) => {
    const pe = e as PointerEvent;
    if (isLocked() || (pe.pointerType === 'mouse' && pe.button !== 0)) return;
    pe.preventDefault();
    id = pe.pointerId;
    try {
      svg.setPointerCapture(id);
    } catch {
      /* trình duyệt không cho bắt con trỏ: vẫn kéo được khi con trỏ ở trong hình */
    }
    svg.classList.add('is-dragging');
    move(svgPoint(svg, pe));
  };
  handle.addEventListener('pointerdown', down);
  track?.addEventListener('pointerdown', down);
  svg.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    e.preventDefault();
    move(svgPoint(svg, e));
  });
  const up = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    svg.classList.remove('is-dragging');
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
}

/** Bấm phím Enter / Space trên một phần tử SVG có tabindex như bấm chuột. */
export function keyActivate(el: Element, fn: () => void): void {
  el.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      fn();
    }
  });
}

/** Phím cho "thanh trượt" SVG (role=slider): mũi tên ±step, PageUp/PageDown ±bigStep, Home/End về hai đầu. */
export function sliderKeys(el: Element, step: (delta: number) => void, ends?: (end: -1 | 1) => void, small = 1, big = 10): void {
  el.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    const d = k === 'ArrowRight' || k === 'ArrowUp' ? small : k === 'ArrowLeft' || k === 'ArrowDown' ? -small : k === 'PageUp' ? big : k === 'PageDown' ? -big : 0;
    if (d) {
      e.preventDefault();
      step(d);
    } else if (ends && (k === 'Home' || k === 'End')) {
      e.preventDefault();
      ends(k === 'Home' ? -1 : 1);
    }
  });
}

/** Đầu mũi tên (hai nét) tại (x, y), hướng theo vectơ đơn vị (ux, uy). */
export function arrowHead(x: number, y: number, ux: number, uy: number, size = 7): string {
  const w = size * 0.6;
  return `M${(x - ux * size - uy * w).toFixed(1)} ${(y - uy * size + ux * w).toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}L${(x - ux * size + uy * w).toFixed(1)} ${(y - uy * size - ux * w).toFixed(1)}`;
}

export const rad = (d: number) => (d * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;
/** Góc về khoảng [0, 360). */
export const norm360 = (a: number) => ((a % 360) + 360) % 360;
/** Hiệu hai góc, trong khoảng [−180, 180). */
export const angDiff = (a: number, b: number) => norm360(a - b + 180) - 180;
export const r1 = (x: number) => Math.round(x * 10) / 10;
