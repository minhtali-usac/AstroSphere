// Bài 5 · Mục III và VI — "Pha Mặt Trăng" (Hình 5.9, 5.16).
//
// Nhìn từ phía trên cực Bắc: Trái Đất ở giữa, ánh sáng Mặt Trời tới từ bên trái. Mặt Trăng luôn được chiếu sáng nửa
// bên trái; người chơi kéo nó quanh quỹ đạo (ngược chiều kim đồng hồ) và xem ngay hình Trăng nhìn từ Trái Đất.
// Tuổi Trăng `a` (độ): 0 = không Trăng (vị trí 1, bên trái), 90 = bán nguyệt đầu tháng (vị trí 3, phía dưới),
// 180 = Trăng tròn (vị trí 5, bên phải), 270 = bán nguyệt cuối tháng (vị trí 7, phía trên) — khớp Hình 5.16.

import { h } from '../ui/dom';
import { round, sequence, shuffled, type GameDef, type Play } from './shell';
import { angDiff, arrowHead, deg, draggable, norm360, rad, s, sliderKeys, svgRoot } from './svg';
import { fmt, G } from './text';

const T = G.games.moon;
const W = 600;
const H = 360;
const EX = 215;
const EY = 185;
const OR = 118;
const WHY = ['new', 'waxCrescent', 'firstQuarter', 'waxGibbous', 'full', 'wanGibbous', 'lastQuarter', 'wanCrescent'] as const;
/** Sai số cho phép: nửa khoảng giữa hai vị trí liền nhau trong Hình 5.16. */
export const MOON_TOLERANCE = 22.5;

/** Vị trí (0…7) trong Hình 5.16 gần tuổi Trăng `a` nhất. */
export const phaseIndex = (a: number) => Math.round(norm360(a) / 45) % 8;

/** Đường bao phần sáng của đĩa Trăng nhìn từ Trái Đất (bán cầu Bắc). Rỗng khi không Trăng. */
export function litPath(cx: number, cy: number, r: number, a: number): string {
  const t = norm360(a);
  if (t < 2 || t > 358) return '';
  if (Math.abs(t - 180) < 2) return `M${cx} ${cy - r}A${r} ${r} 0 1 1 ${cx} ${cy + r}A${r} ${r} 0 1 1 ${cx} ${cy - r}Z`;
  const rx = Math.abs(Math.cos(rad(t))) * r;
  const top = `${cx} ${cy - r}`;
  const bottom = `${cx} ${cy + r}`;
  if (t < 180) return `M${top}A${r} ${r} 0 0 1 ${bottom}A${rx.toFixed(2)} ${r} 0 0 ${t < 90 ? 0 : 1} ${top}Z`;
  return `M${top}A${r} ${r} 0 0 0 ${bottom}A${rx.toFixed(2)} ${r} 0 0 ${t > 270 ? 1 : 0} ${top}Z`;
}

function disc(cx: number, cy: number, r: number): { g: SVGGElement; set: (a: number) => void } {
  const lit = s('path', { class: 'sgk-moon__lit' });
  const g = s('g', null, s('circle', { class: 'sgk-moon__dark', cx, cy, r }), lit);
  return { g, set: (a) => lit.setAttribute('d', litPath(cx, cy, r, a)) };
}

/** Vị trí trên hình theo tuổi Trăng. */
const orbitXY = (a: number, r = OR) => ({ x: EX + r * Math.cos(rad(180 - a)), y: EY + r * Math.sin(rad(180 - a)) });

function buildRound(play: Play, target: number, next: () => void): void {
  const idx = phaseIndex(target);
  play.task(fmt(T.task, { name: T.phases[idx] }), T.taskSub);
  const svg = svgRoot(W, H, T.moonAria, 'sgk-orbit');
  // Ánh sáng Mặt Trời từ bên trái.
  for (let i = 0; i < 5; i++) {
    const y = 70 + i * 55;
    svg.append(s('path', { class: 'sgk-ray', d: `M14 ${y}H62M54 ${y - 5}l8 5-8 5` }));
  }
  svg.append(s('text', { class: 'sgk-t sgk-t--muted', x: 14, y: 30, text: T.sunlight }));
  svg.append(s('circle', { class: 'sgk-orbit__path', cx: EX, cy: EY, r: OR }));
  // Mũi tên chiều quay (ngược chiều kim đồng hồ khi nhìn từ phía Bắc).
  const ir = OR - 16;
  const a1 = orbitXY(105, ir);
  const a2 = orbitXY(150, ir);
  const ta = rad(180 - 150);
  svg.append(
    s('path', {
      class: 'sgk-orbit__dir',
      d: `M${a1.x.toFixed(1)} ${a1.y.toFixed(1)}A${ir} ${ir} 0 0 0 ${a2.x.toFixed(1)} ${a2.y.toFixed(1)}${arrowHead(a2.x, a2.y, Math.sin(ta), -Math.cos(ta))}`,
    }),
  );
  for (let i = 0; i < 8; i++) {
    const p = orbitXY(i * 45, OR + 26);
    svg.append(s('text', { class: 'sgk-t sgk-t--muted sgk-t--small', x: p.x, y: p.y + 4, 'text-anchor': 'middle', text: String(i + 1) }));
  }
  svg.append(
    s('circle', { class: 'sgk-earth__night', cx: EX, cy: EY, r: 24 }),
    s('path', { class: 'sgk-earth__day', d: `M${EX} ${EY - 24}A24 24 0 0 0 ${EX} ${EY + 24}Z` }),
    s('text', { class: 'sgk-t sgk-t--key', x: EX, y: EY + 44, 'text-anchor': 'middle', text: T.earth }),
  );
  const moonLit = s('path', { class: 'sgk-moon__lit', d: 'M0 -15A15 15 0 0 0 0 15Z' });
  const handle = s(
    'g',
    { class: 'sgk-handle', tabindex: 0, role: 'slider', 'aria-label': T.moonAria, 'aria-valuemin': 0, 'aria-valuemax': 359 },
    s('circle', { class: 'sgk-handle__ring', r: 22 }),
    s('circle', { class: 'sgk-moon__dark', r: 15 }),
    moonLit,
  );
  const hit = s('circle', { class: 'sgk-hit', cx: EX, cy: EY, r: OR });
  svg.append(hit, handle);

  const tgt = disc(480, 108, 44);
  const seen = disc(480, 268, 44);
  tgt.set(target);
  svg.append(
    s('rect', { class: 'sgk-panel', x: 405, y: 28, width: 150, height: 316, rx: 12 }),
    s('text', { class: 'sgk-t sgk-t--muted', x: 480, y: 52, 'text-anchor': 'middle', text: T.target }),
    tgt.g,
    s('text', { class: 'sgk-t sgk-t--muted', x: 480, y: 212, 'text-anchor': 'middle', text: T.seen }),
    seen.g,
  );

  let a = norm360(target + 135 + Math.random() * 90);
  let locked = false;
  const draw = () => {
    const p = orbitXY(a);
    handle.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    seen.set(a);
    const pos = phaseIndex(a) + 1;
    handle.setAttribute('aria-valuenow', String(Math.round(a)));
    handle.setAttribute('aria-valuetext', fmt(T.moonText, { pos }));
  };
  const setA = (v: number) => {
    a = norm360(v);
    draw();
  };
  draggable(svg, handle, (p) => setA(180 - deg(Math.atan2(p.y - EY, p.x - EX))), () => locked, hit);
  sliderKeys(handle, (dv) => !locked && setA(a + dv), undefined, 5, 45);
  draw();
  play.stage.replaceChildren(h('div', { class: 'sgk-figure' }, svg));

  const explainAt = (v: number) => {
    const i = phaseIndex(v);
    return fmt(T.explain, { pos: i + 1, name: T.phases[i], why: T.why[WHY[i]] });
  };
  round(play, {
    hint: T.hint,
    check: () => (Math.abs(angDiff(a, target)) <= MOON_TOLERANCE ? { ok: true } : { ok: false, msg: fmt(T.notYet, { name: T.phases[phaseIndex(a)] }) }),
    reveal: () => setA(target),
    lock: () => {
      locked = true;
      svg.classList.add('is-locked');
      handle.setAttribute('aria-disabled', 'true');
    },
    explain: () => explainAt(target),
    next,
  });
}

export const moonGame: GameDef = {
  id: 'moon',
  lesson: 5,
  rounds: () => 5,
  run(play) {
    const base = [180, 0, 90, 45, 225];
    const targets = play.env.shuffle ? shuffled(base) : base;
    sequence(play, targets.length, (i, next) => buildRound(play, targets[i], next));
  },
};
