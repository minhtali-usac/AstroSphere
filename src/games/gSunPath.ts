// Bài 5 · Mục II — "Đường đi của Mặt Trời" (Hình 5.4, 5.5).
//
// Hình bầu trời nhìn nghiêng như SGK: mặt đất là hình elip, Nam bên trái, Bắc bên phải, Đông ở phía trước, Tây ở
// phía sau (xoay thêm VIEW độ để đường đi của Mặt Trời không bị nhìn gần như thẳng cạnh). Người quan sát ở vĩ độ 35° Bắc (vĩ độ trung bình để Mặt Trời giữa trưa luôn ở phía Nam, đúng như SGK
// mô tả; ghi chú riêng cho Việt Nam).
//   Lượt 1–3: ngày xuân phân, kéo Mặt Trời tới lúc bình minh / giữa trưa / hoàng hôn.
//   Lượt 4–6: ba đường đi (hạ chí, xuân/thu phân, đông chí) — bấm chọn đường đúng.

import { h } from '../ui/dom';
import { round, sequence, shuffled, type GameDef, type Play } from './shell';
import { deg, draggable, keyActivate, rad, s, sliderKeys, svgRoot } from './svg';
import { fmt, G, num } from './text';

const T = G.games.sunpath;
export const LAT = 35;
const OBLIQUITY = 23.44;
const W = 600;
const H = 372;
const CX = 300;
const CY = 262;
const VIEW = 28;
const R = 235;
const K = 0.3; // độ dẹt của mặt đất
const Q = 0.85; // chiều cao vòm
/** Sai số cho phép khi kéo Mặt Trời (góc giờ, độ): 10° ≈ 40 phút. */
export const SUN_TOLERANCE = 10;

/** Độ cao h và phương vị A (từ Bắc qua Đông) của Mặt Trời có xích vĩ `dec`, góc giờ `ha`, tại vĩ độ `lat`. */
export function sunAltAz(dec: number, ha: number, lat: number): { alt: number; az: number } {
  const d = rad(dec);
  const t = rad(ha);
  const f = rad(lat);
  const alt = Math.asin(Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(t));
  const az = Math.atan2(-Math.cos(d) * Math.sin(t), Math.sin(d) * Math.cos(f) - Math.cos(d) * Math.cos(t) * Math.sin(f));
  return { alt: deg(alt), az: (deg(az) + 360) % 360 };
}

/** Góc giờ lúc mọc/lặn (độ). */
export function riseHa(dec: number, lat: number): number {
  return deg(Math.acos(Math.max(-1, Math.min(1, -Math.tan(rad(lat)) * Math.tan(rad(dec))))));
}

/** Hướng (8 hướng) theo phương vị. */
export const dirName = (az: number) => T.dirs[Math.round(az / 45) % 8];

function screen(alt: number, az: number): { x: number; y: number } {
  const a = rad(alt);
  const z = rad(az + VIEW);
  const n = Math.cos(a) * Math.cos(z);
  const e = Math.cos(a) * Math.sin(z);
  return { x: CX + R * n, y: CY + R * (K * e - Q * Math.sin(a)) };
}

const clock = (ha: number) => {
  const mins = Math.round((12 + ha / 15) * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
};

/** Các điểm của đường đi phía trên chân trời (bước 1°). */
function path(dec: number): { ha: number; x: number; y: number }[] {
  const h0 = riseHa(dec, LAT);
  const out = [];
  for (let ha = -h0; ha <= h0 + 1e-9; ha += Math.min(1, h0 / 60)) {
    const { alt, az } = sunAltAz(dec, ha, LAT);
    out.push({ ha, ...screen(Math.max(0, alt), az) });
  }
  return out;
}

const d = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');

/** Khung chung: vòm trời, mặt đất, bốn hướng, thiên đỉnh, sao Bắc Cực, người quan sát. */
function sceneBase(label: string): SVGSVGElement {
  const svg = svgRoot(W, H, label, 'sgk-dome');
  const ry = R * Math.hypot(K, Q);
  const zen = screen(90, 0);
  const pol = screen(LAT, 0);
  const [pn, pe, ps, pw] = [0, 90, 180, 270].map((az) => screen(0, az));
  const out = (p: { x: number; y: number }, k: number) => ({ x: CX + (p.x - CX) * k, y: CY + (p.y - CY) * k });
  const meridian = [];
  for (let a = 0; a <= 180; a += 3) meridian.push(screen(a <= 90 ? a : 180 - a, a <= 90 ? 0 : 180));
  svg.append(
    s('path', { class: 'sgk-dome__sky', d: `M${CX - R} ${CY} A${R} ${ry} 0 0 1 ${CX + R} ${CY} A${R} ${R * K} 0 0 1 ${CX - R} ${CY}Z` }),
    s('ellipse', { class: 'sgk-dome__ground', cx: CX, cy: CY, rx: R, ry: R * K }),
    s('path', { class: 'sgk-dome__meridian', d: d(meridian) }),
    s('line', { class: 'sgk-dome__ns', x1: pn.x, y1: pn.y, x2: ps.x, y2: ps.y }),
    s('line', { class: 'sgk-dome__ns', x1: pe.x, y1: pe.y, x2: pw.x, y2: pw.y }),
    s('circle', { class: 'sgk-dome__zenith', cx: zen.x, cy: zen.y, r: 3 }),
    s('text', { class: 'sgk-t sgk-t--muted', x: zen.x + 8, y: zen.y - 6, text: T.zenith }),
    s('path', { class: 'sgk-polaris', d: star(pol.x, pol.y, 7) }),
    s('text', { class: 'sgk-t sgk-t--muted', x: pol.x + 12, y: pol.y - 8, text: T.polaris }),
    s('text', { class: 'sgk-t sgk-t--dir', ...out(ps, 1.08), dy: 5, 'text-anchor': 'middle', text: T.dirShort.s }),
    s('text', { class: 'sgk-t sgk-t--dir', ...out(pn, 1.08), dy: 5, 'text-anchor': 'middle', text: T.dirShort.n }),
    s('text', { class: 'sgk-t sgk-t--dir', ...out(pe, 1.3), dy: 8, 'text-anchor': 'middle', text: T.dirShort.e }),
    s('text', { class: 'sgk-t sgk-t--dir', ...out(pw, 1.12), dy: -6, 'text-anchor': 'middle', text: T.dirShort.w }),
    s('path', { class: 'sgk-person', d: `M${CX} ${CY - 26}v14M${CX - 6} ${CY}l6-12 6 12M${CX - 7} ${CY - 20}h14` }),
    s('circle', { class: 'sgk-person', cx: CX, cy: CY - 30, r: 4 }),
  );
  return svg;
}

/** Ngôi sao 5 cánh. */
function star(x: number, y: number, r: number): string {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = rad(-90 + i * 36);
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(x + rr * Math.cos(a)).toFixed(1)} ${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

function sunIcon(): SVGGElement {
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const a = rad(i * 45);
    rays.push(`M${(19 * Math.cos(a)).toFixed(1)} ${(19 * Math.sin(a)).toFixed(1)}L${(25 * Math.cos(a)).toFixed(1)} ${(25 * Math.sin(a)).toFixed(1)}`);
  }
  return s('g', null, s('path', { class: 'sgk-sun__rays', d: rays.join('') }), s('circle', { class: 'sgk-sun', r: 14 }));
}

type DayTask = 'rise' | 'noon' | 'set';

function dayRound(play: Play, task: DayTask, next: () => void): void {
  play.task(T.dayTasks[task], T.daySub);
  const svg = sceneBase(T.observer);
  const pts = path(0);
  const h0 = riseHa(0, LAT);
  const track = s('path', { class: 'sgk-dome__path is-track', d: d(pts) });
  const trackHit = s('path', { class: 'sgk-hit', d: d(pts) });
  const handle = s('g', { class: 'sgk-handle', tabindex: 0, role: 'slider', 'aria-label': T.sunAria, 'aria-valuemin': Math.round(-h0), 'aria-valuemax': Math.round(h0) }, sunIcon());
  svg.append(track, trackHit, handle);
  const note = h('p', { class: 'sgk-figure__note', 'aria-live': 'off' });
  let ha = task === 'rise' ? 35 : task === 'noon' ? -65 : -25;
  let locked = false;
  const readout = () => {
    const { alt, az } = sunAltAz(0, ha, LAT);
    return fmt(T.readout, { time: clock(ha), alt: num(Math.max(0, alt)), dir: dirName(az) });
  };
  const draw = () => {
    const { alt, az } = sunAltAz(0, ha, LAT);
    const p = screen(Math.max(0, alt), az);
    handle.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    handle.setAttribute('aria-valuenow', String(Math.round(ha)));
    const text = readout();
    handle.setAttribute('aria-valuetext', text);
    note.textContent = text;
  };
  const setHa = (v: number) => {
    ha = Math.max(-h0, Math.min(h0, v));
    draw();
  };
  draggable(
    svg,
    handle,
    (p) => {
      let best = pts[0];
      for (const q of pts) if (Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y)) best = q;
      setHa(best.ha);
    },
    () => locked,
    trackHit,
  );
  sliderKeys(handle, (dv) => !locked && setHa(ha + dv), (end) => !locked && setHa(end * h0), 1, 15);
  draw();
  play.stage.replaceChildren(h('div', { class: 'sgk-figure' }, svg), note);
  const target = task === 'rise' ? -h0 : task === 'noon' ? 0 : h0;
  round(play, {
    hint: T.dayHints[task],
    check: () => (Math.abs(ha - target) <= SUN_TOLERANCE ? { ok: true } : { ok: false, msg: fmt(T.notYet, { readout: readout() }) }),
    reveal: () => setHa(target),
    lock: () => {
      locked = true;
      svg.classList.add('is-locked');
      handle.setAttribute('aria-disabled', 'true');
    },
    explain: () => T.dayExplain[task],
    next,
  });
}

type Season = 'summer' | 'equinox' | 'winter';
const DEC: Record<Season, number> = { summer: OBLIQUITY, equinox: 0, winter: -OBLIQUITY };
/** Thứ tự cố định của ba đường trên hình (số 1, 2, 3 cho trình đọc màn hình và bàn phím). */
const PATHS: Season[] = ['winter', 'equinox', 'summer'];

function seasonRound(play: Play, task: Season, solved: Set<Season>, next: () => void): void {
  play.task(T.seasonTasks[task], T.seasonSub);
  const svg = sceneBase(T.observer);
  let chosen: Season | null = null;
  let locked = false;
  const groups = new Map<Season, SVGGElement>();
  PATHS.forEach((season, i) => {
    const pts = path(DEC[season]);
    const noon = pts.reduce((a, b) => (b.y < a.y ? b : a));
    const rise = pts[0];
    const g = s(
      'g',
      { class: 'sgk-pathpick', tabindex: 0, role: 'button', 'aria-pressed': 'false', 'aria-label': fmt(T.pathAria, { n: i + 1 }) },
      s('path', { class: 'sgk-hit', d: d(pts) }),
      s('path', { class: 'sgk-dome__path', d: d(pts) }),
      s('circle', { class: 'sgk-sun sgk-sun--small', cx: noon.x, cy: noon.y, r: 8 }),
      s('text', { class: 'sgk-t sgk-t--key', x: rise.x - 4, y: rise.y + 22, 'text-anchor': 'middle', text: String(i + 1) }),
      solved.has(season) ? s('text', { class: 'sgk-t sgk-t--muted', x: noon.x, y: noon.y - 14, 'text-anchor': 'middle', text: T.pathNames[season] }) : null,
    );
    const choose = () => {
      if (locked) return;
      chosen = season;
      for (const [k, el] of groups) {
        el.classList.toggle('is-chosen', k === season);
        el.setAttribute('aria-pressed', String(k === season));
      }
      play.clearSay();
    };
    g.addEventListener('click', choose);
    keyActivate(g, choose);
    groups.set(season, g);
    svg.append(g);
  });
  play.stage.replaceChildren(h('div', { class: 'sgk-figure' }, svg), h('p', { class: 'sgk-figure__note', text: T.vnNote }));
  const mark = () => {
    groups.get(task)!.classList.add('is-ok');
    const g = groups.get(task)!;
    const noon = g.querySelector('circle')!;
    if (!solved.has(task))
      g.append(s('text', { class: 'sgk-t sgk-t--muted', x: noon.getAttribute('cx'), y: Number(noon.getAttribute('cy')) - 14, 'text-anchor': 'middle', text: T.pathNames[task] }));
  };
  round(play, {
    hint: T.seasonHint,
    check: () => {
      if (!chosen) return { ok: false, msg: T.pickPath };
      if (chosen === task) return { ok: true };
      groups.get(chosen)!.classList.add('is-err');
      return { ok: false, msg: fmt(T.wrongPath, { name: T.pathNames[chosen] }) };
    },
    reveal: () => undefined,
    lock: () => {
      locked = true;
      svg.classList.add('is-locked');
      for (const el of groups.values()) el.classList.remove('is-err');
      mark();
      solved.add(task);
    },
    explain: () => T.seasonExplain[task],
    next,
  });
}

export const sunPathGame: GameDef = {
  id: 'sunpath',
  lesson: 5,
  rounds: () => 6,
  run(play) {
    const seasons: Season[] = play.env.shuffle ? shuffled(['summer', 'winter', 'equinox']) : ['summer', 'winter', 'equinox'];
    const days: DayTask[] = ['rise', 'noon', 'set'];
    const solved = new Set<Season>();
    sequence(play, 6, (i, next) => (i < 3 ? dayRound(play, days[i], next) : seasonRound(play, seasons[i - 3], solved, next)));
  },
};
