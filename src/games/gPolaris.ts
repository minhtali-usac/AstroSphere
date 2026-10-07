// Bài 4 · Mục V — "Truy tìm sao Bắc Cực": sao Bắc Cực (và cả Gấu Bé) bị giấu. Người chơi dùng "thước" theo hai cách
// của SGK — kéo dài đoạn αβ của Gấu Lớn 5 lần, hoặc kẻ vuông góc với γδ của Thiên Hậu khoảng 7 lần — rồi bấm đặt dấu.
// Chấm theo khoảng cách thật tới sao Bắc Cực (≤ 4,5°), vì phép dựng của SGK chỉ gần đúng (xem RULER_RATIO).

import { h } from '../ui/dom';
import { round, sequence, type GameDef, type Play } from './shell';
import { ASTERISM_HIPS, CAS, DIPPER, POLARIS, UMI, backgroundStars, fit, project, starRadius, type Asterism } from './sky';
import { s, svgPoint, svgRoot } from './svg';
import { fmt, G, num } from './text';

const W = 600;
const H = 420;
const T = G.games.polaris;
/** Dấu cách sao Bắc Cực không quá 4,5° là đạt. */
export const POLARIS_TOLERANCE = 4.5;

type Method = 'dipper' | 'cas';
type Pt = { x: number; y: number };

export interface Ruler {
  base: Pt;
  dir: Pt;
  len: number;
  max: number;
}

/** Thước của một cách tìm, trong mặt phẳng chiếu (độ) khi bầu trời đã quay `rot`. */
export function ruler(method: Method, rot: number): Ruler {
  const P = (ast: Asterism, i: number) => project(ast.stars[i].ra, ast.stars[i].dec, rot);
  if (method === 'dipper') {
    const a = P(DIPPER, 0);
    const b = P(DIPPER, 1);
    const len = Math.hypot(a.x - b.x, a.y - b.y);
    return { base: a, dir: { x: (a.x - b.x) / len, y: (a.y - b.y) / len }, len, max: 7 };
  }
  const g = P(CAS, 2);
  const d = P(CAS, 3);
  const len = Math.hypot(d.x - g.x, d.y - g.y);
  const mid = { x: (g.x + d.x) / 2, y: (g.y + d.y) / 2 };
  let dir = { x: -(d.y - g.y) / len, y: (d.x - g.x) / len };
  // Về phía thiên cực (tâm phép chiếu).
  if (dir.x * -mid.x + dir.y * -mid.y < 0) dir = { x: -dir.x, y: -dir.y };
  return { base: mid, dir, len, max: 10 };
}

/** Khoảng cách từ đầu thước tới sao Bắc Cực, tính bằng số đoạn thước. */
export function rulerRatio(method: Method): number {
  const r = ruler(method, 0);
  const p = project(POLARIS.ra, POLARIS.dec, 0);
  return Math.hypot(p.x - r.base.x, p.y - r.base.y) / r.len;
}

function buildRound(play: Play, mode: Method | 'free', next: () => void): void {
  play.task(T.tasks[mode], T.taskSub);
  const rot = Math.random() * 360;
  const shown: Asterism[] = mode === 'dipper' ? [DIPPER] : mode === 'cas' ? [CAS] : [DIPPER, CAS];
  const methods: Method[] = mode === 'free' ? ['dipper', 'cas'] : [mode];
  const rulers = new Map(methods.map((m) => [m, ruler(m, rot)]));
  const pole = project(POLARIS.ra, POLARIS.dec, rot);

  const umiHips = new Set(UMI.stars.map((st) => st.hip));
  const field = [...backgroundStars(20, 4.2, ASTERISM_HIPS), ...shown.flatMap((a) => a.stars)];
  const pts = [pole, ...shown.flatMap((a) => a.stars.map((st) => project(st.ra, st.dec, rot)))];
  for (const r of rulers.values()) pts.push({ x: r.base.x + r.dir.x * r.len * r.max, y: r.base.y + r.dir.y * r.len * r.max });
  const frame = fit(pts, W, H, 34);

  const svg = svgRoot(W, H, T.mapAria, 'sgk-map sgk-map--aim');
  const starsG = s('g');
  for (const st of field) {
    if (umiHips.has(st.hip)) continue;
    const p = frame.to(project(st.ra, st.dec, rot));
    if (p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10) continue;
    starsG.append(s('circle', { class: 'sgk-star__dot', cx: p.x, cy: p.y, r: starRadius(st.mag) * 1.2 }));
  }
  const figG = s('g', { class: 'sgk-lines' });
  const greekG = s('g', { class: 'sgk-greek' });
  for (const a of shown) {
    const P = a.stars.map((st) => frame.to(project(st.ra, st.dec, rot)));
    for (const [i, j] of a.segs) figG.append(s('line', { class: 'sgk-line is-fig', x1: P[i].x, y1: P[i].y, x2: P[j].x, y2: P[j].y }));
    const label = a.id === 'dipper' ? [0, 1] : [2, 3];
    for (const i of label) greekG.append(s('text', { class: 'sgk-t sgk-t--greek', x: P[i].x + 9, y: P[i].y - 8, text: a.greek[i] }));
  }
  const rulerG = s('g', { class: 'sgk-ruler' });
  const answerG = s('g', { class: 'sgk-answer' });
  const markG = s('g', { class: 'sgk-mark' });
  svg.append(s('rect', { class: 'sgk-map__sky', x: 0, y: 0, width: W, height: H, rx: 12 }), figG, rulerG, starsG, greekG, answerG, markG);

  const counts = new Map<Method, number>(methods.map((m) => [m, 0]));
  const countText = h('span', { class: 'sgk-count', 'aria-live': 'polite' });
  const drawRuler = () => {
    rulerG.replaceChildren();
    const parts: string[] = [];
    for (const [m, r] of rulers) {
      const k = counts.get(m)!;
      parts.push(String(k));
      for (let j = 1; j <= k; j++) {
        const a = frame.to({ x: r.base.x + r.dir.x * r.len * (j - 1), y: r.base.y + r.dir.y * r.len * (j - 1) });
        const b = frame.to({ x: r.base.x + r.dir.x * r.len * j, y: r.base.y + r.dir.y * r.len * j });
        rulerG.append(
          s('line', { class: `sgk-ruler__seg${j % 2 ? '' : ' is-alt'}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y }),
          s('circle', { class: 'sgk-ruler__tick', cx: b.x, cy: b.y, r: 3.5 }),
          s('text', { class: 'sgk-t sgk-t--tick', x: b.x - r.dir.y * 14, y: b.y + r.dir.x * 14 + 4, text: String(j) }),
        );
      }
    }
    countText.textContent = fmt(T.count, { n: parts.join(' + ') });
  };
  drawRuler();

  let mark: Pt | null = null;
  let locked = false;
  const drawMark = () => {
    markG.replaceChildren();
    if (!mark) return;
    const p = frame.to(mark);
    markG.append(
      s('circle', { class: 'sgk-mark__ring', cx: p.x, cy: p.y, r: 11 }),
      s('path', { class: 'sgk-mark__cross', d: `M${p.x - 6} ${p.y}h12M${p.x} ${p.y - 6}v12` }),
    );
  };
  svg.addEventListener('click', (e) => {
    if (locked) return;
    mark = frame.from(svgPoint(svg, e));
    drawMark();
    play.clearSay();
  });

  const tools = methods.map((m) =>
    h('button', {
      type: 'button',
      class: 'btn',
      text: m === 'dipper' ? T.addDipper : T.addCas,
      onclick: () => {
        if (locked) return;
        counts.set(m, Math.min(rulers.get(m)!.max, counts.get(m)! + 1));
        drawRuler();
      },
    }),
  );
  const reset = h('button', {
    type: 'button',
    class: 'btn btn--ghost',
    text: T.resetRuler,
    onclick: () => {
      if (locked) return;
      for (const m of methods) counts.set(m, 0);
      drawRuler();
    },
  });

  const showAnswer = () => {
    const P = UMI.stars.map((st) => frame.to(project(st.ra, st.dec, rot)));
    for (const [i, j] of UMI.segs) answerG.append(s('line', { class: 'sgk-line is-hint', x1: P[i].x, y1: P[i].y, x2: P[j].x, y2: P[j].y }));
    UMI.stars.forEach((st, i) => answerG.append(s('circle', { class: `sgk-star__dot${i === 0 ? ' is-polaris' : ''}`, cx: P[i].x, cy: P[i].y, r: starRadius(st.mag) * 1.2 + (i === 0 ? 1.5 : 0) })));
    answerG.append(s('text', { class: 'sgk-t sgk-t--key', x: P[0].x + 12, y: P[0].y + 18, text: T.polaris }));
  };

  play.stage.replaceChildren(h('div', { class: 'sgk-figure' }, svg), h('p', { class: 'sgk-figure__note' }, countText));

  round(play, {
    tools: [...tools, reset],
    hint: T.hints[mode],
    check: () => {
      if (!mark) return { ok: false, msg: T.noMark };
      const d = Math.hypot(mark.x - pole.x, mark.y - pole.y);
      return d <= POLARIS_TOLERANCE ? { ok: true } : { ok: false, msg: fmt(T.far, { d: num(d) }) };
    },
    reveal: () => {
      for (const [m, r] of rulers) counts.set(m, Math.min(r.max, Math.round(rulerRatio(m))));
      drawRuler();
    },
    lock: () => {
      locked = true;
      svg.classList.add('is-locked');
      showAnswer();
      for (const b of [...tools, reset]) b.disabled = true;
    },
    explain: () => (mode === 'free' ? T.explain.free : fmt(T.explain[mode], { k: num(rulerRatio(mode), 1) })),
    next,
  });
}

export const polarisGame: GameDef = {
  id: 'polaris',
  lesson: 4,
  rounds: () => 3,
  run(play) {
    const modes = ['dipper', 'cas', 'free'] as const;
    sequence(play, modes.length, (i, next) => buildRound(play, modes[i], next));
  },
};
