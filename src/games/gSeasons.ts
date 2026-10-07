// Bài 5 · Mục VI — "Bốn mùa trên quỹ đạo" (Hình 5.15).
//
// Quỹ đạo nhìn nghiêng, Trái Đất đi ngược chiều kim đồng hồ: Xuân phân ở trên, Hạ chí bên trái, Thu phân ở dưới,
// Đông chí bên phải. Trục Trái Đất luôn nghiêng 23,4° về cùng một hướng (đầu Bắc ngả sang phải), nên ở bên trái
// đầu Bắc ngả về phía Mặt Trời (hạ chí), ở bên phải ngả ra xa (đông chí).
//   Lượt 1: gắn bốn ngày vào bốn vị trí (đánh số 1–4 theo chiều kim đồng hồ để thứ tự số không lộ đáp án).
//   Lượt 2–4: bấm vào vị trí Trái Đất đúng với câu hỏi.

import { h } from '../ui/dom';
import { placer } from './place';
import { round, sequence, shuffled, type GameDef, type Play } from './shell';
import { arrowHead, deg, keyActivate, rad, s, svgRoot } from './svg';
import { fmt, G } from './text';

const T = G.games.seasons;
const W = 600;
const H = 360;
const CX = 300;
const CY = 180;
const RX = 228;
const RY = 116;
const TILT = 23.44;

export type DateId = 'march' | 'june' | 'september' | 'december';
/** Vị trí 1–4 (theo chiều kim đồng hồ từ trên xuống) → ngày đúng. */
export const SPOTS: { n: number; date: DateId; x: number; y: number }[] = [
  { n: 1, date: 'march', x: CX, y: CY - RY },
  { n: 2, date: 'december', x: CX + RX, y: CY },
  { n: 3, date: 'september', x: CX, y: CY + RY },
  { n: 4, date: 'june', x: CX - RX, y: CY },
];

function figure(labels: Set<DateId>, onPick?: (date: DateId, g: SVGGElement) => void): { svg: SVGSVGElement; groups: Map<DateId, SVGGElement> } {
  const svg = svgRoot(W, H, T.placeTask, 'sgk-orbit');
  const groups = new Map<DateId, SVGGElement>();
  const at = rad(28);
  const a2 = { x: CX + RX * Math.cos(at), y: CY + RY * Math.sin(at) };
  const at0 = rad(62);
  const a1 = { x: CX + RX * Math.cos(at0), y: CY + RY * Math.sin(at0) };
  // Tiếp tuyến khi góc tham số giảm (ngược chiều kim đồng hồ trên màn hình).
  const tx = RX * Math.sin(at);
  const ty = -RY * Math.cos(at);
  const tl = Math.hypot(tx, ty);
  svg.append(
    s('ellipse', { class: 'sgk-orbit__path', cx: CX, cy: CY, rx: RX, ry: RY }),
    s('path', { class: 'sgk-orbit__dir', d: `M${a1.x.toFixed(1)} ${a1.y.toFixed(1)}A${RX} ${RY} 0 0 0 ${a2.x.toFixed(1)} ${a2.y.toFixed(1)}${arrowHead(a2.x, a2.y, tx / tl, ty / tl)}` }),
    s('circle', { class: 'sgk-sun', cx: CX, cy: CY, r: 26 }),
    s('text', { class: 'sgk-t sgk-t--key', x: CX, y: CY + 46, 'text-anchor': 'middle', text: T.sun }),
  );
  for (const sp of SPOTS) {
    const r = 22;
    const toSun = deg(Math.atan2(CY - sp.y, CX - sp.x));
    const ax = Math.sin(rad(TILT)) * 36;
    const ay = Math.cos(rad(TILT)) * 36;
    const g = s(
      'g',
      onPick ? { class: 'sgk-earthpick', tabindex: 0, role: 'button', 'aria-pressed': 'false', 'aria-label': fmt(T.earthAria, { n: sp.n }) } : { class: 'sgk-earthpos' },
      s('circle', { class: 'sgk-handle__ring', cx: sp.x, cy: sp.y, r: r + 8 }),
      s('circle', { class: 'sgk-earth__night', cx: sp.x, cy: sp.y, r }),
      s('path', { class: 'sgk-earth__day', d: `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}Z`, transform: `translate(${sp.x} ${sp.y}) rotate(${toSun.toFixed(1)})` }),
      s('line', { class: 'sgk-earth__eq', x1: sp.x - ay * 0.62, y1: sp.y - ax * 0.62, x2: sp.x + ay * 0.62, y2: sp.y + ax * 0.62 }),
      s('line', { class: 'sgk-earth__axis', x1: sp.x - ax, y1: sp.y + ay, x2: sp.x + ax, y2: sp.y - ay }),
      s('text', { class: 'sgk-t sgk-t--small', x: sp.x + ax + 4, y: sp.y - ay - 2, text: T.north }),
      s('text', { class: 'sgk-t sgk-t--num', x: sp.x + (sp.x < CX ? -40 : sp.x > CX ? 40 : -44), y: sp.y + (sp.y < CY ? -14 : sp.y > CY ? 26 : 5), 'text-anchor': 'middle', text: String(sp.n) }),
      labels.has(sp.date)
        ? s('text', { class: 'sgk-t sgk-t--muted', x: sp.x, y: sp.y + (sp.y > CY ? 46 : sp.y < CY ? -36 : 52), 'text-anchor': 'middle', text: T.dates[sp.date] })
        : null,
    );
    if (onPick) {
      const pick = () => onPick(sp.date, g);
      g.addEventListener('click', pick);
      keyActivate(g, pick);
    }
    groups.set(sp.date, g);
    svg.append(g);
  }
  return { svg, groups };
}

function placeRound(play: Play, next: () => void): void {
  play.task(T.placeTask, T.placeSub);
  const ids = Object.keys(T.dates) as DateId[];
  const p = placer({
    items: shuffled(ids.map((id) => ({ id, label: T.dates[id] }))),
    answer: Object.fromEntries(SPOTS.map((sp) => [sp.date, `p${sp.n}`])),
    onPick: (n) => play.say('info', fmt(G.place.pick, { name: n })),
  });
  const { svg } = figure(new Set());
  play.stage.replaceChildren(
    h('div', { class: 'sgk-figure' }, svg),
    h('div', { class: 'sgk-place' }, h('div', { class: 'sgk-bins sgk-bins--4' }, ...SPOTS.map((sp) => p.slot(`p${sp.n}`, fmt(T.slotAria, { n: sp.n }), 'sgk-slot--spot'))), p.tray),
  );
  round(play, { hint: T.placeHint, check: p.check, reveal: p.reveal, lock: p.lock, explain: () => T.placeExplain, next });
}

type Ask = keyof typeof T.clickTasks;
const ASK_OK: Record<Ask, DateId[]> = { longest: ['june'], equal: ['march', 'september'], southSummer: ['december'] };

function clickRound(play: Play, ask: Ask, next: () => void): void {
  play.task(T.clickTasks[ask], T.clickSub);
  let chosen: DateId | null = null;
  let locked = false;
  const { svg, groups } = figure(new Set(Object.keys(T.dates) as DateId[]), (date) => {
    if (locked) return;
    chosen = date;
    for (const [k, g] of groups) {
      g.classList.toggle('is-chosen', k === date);
      g.classList.remove('is-err');
      g.setAttribute('aria-pressed', String(k === date));
    }
    play.clearSay();
  });
  play.stage.replaceChildren(h('div', { class: 'sgk-figure' }, svg));
  round(play, {
    hint: T.clickHints[ask],
    check: () => {
      if (!chosen) return { ok: false, msg: T.pickEarth };
      if (ASK_OK[ask].includes(chosen)) return { ok: true };
      groups.get(chosen)!.classList.add('is-err');
      return { ok: false, msg: fmt(T.wrongEarth, { name: T.dates[chosen] }) };
    },
    reveal: () => undefined,
    lock: () => {
      locked = true;
      svg.classList.add('is-locked');
      for (const [k, g] of groups) {
        g.classList.remove('is-err');
        g.classList.toggle('is-ok', ASK_OK[ask].includes(k));
      }
    },
    explain: () => T.clickExplain[ask],
    next,
  });
}

export const seasonsGame: GameDef = {
  id: 'seasons',
  lesson: 5,
  rounds: () => 4,
  run(play) {
    const asks: Ask[] = play.env.shuffle ? shuffled(['longest', 'equal', 'southSummer']) : ['longest', 'equal', 'southSummer'];
    sequence(play, 4, (i, next) => (i === 0 ? placeRound(play, next) : clickRound(play, asks[i - 1], next)));
  },
};
