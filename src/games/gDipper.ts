// Bài 4 · Mục II–IV — "Nối sao thành chòm": trên bản đồ sao thật vùng trời phía Bắc (đã quay một góc ngẫu nhiên, như
// ở một giờ bất kỳ trong đêm), người chơi bấm lần lượt các sao để kẻ hình Gấu Lớn, Thiên Hậu, Gấu Bé.

import { h } from '../ui/dom';
import { round, sequence, shuffled, type GameDef, type Play } from './shell';
import { ASTERISM_HIPS, CAS, DIPPER, UMI, backgroundStars, fit, project, starRadius, type Asterism, type SkyStar } from './sky';
import { keyActivate, s, svgPoint, svgRoot } from './svg';
import { fmt, G } from './text';

const W = 600;
const H = 400;
const T = G.games.dipper;

const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function buildRound(play: Play, ast: Asterism, next: () => void): void {
  const tt = T.targets[ast.id];
  play.task(fmt(T.task, { name: tt.name }), T.taskSub);
  const rot = Math.random() * 360;
  const field: SkyStar[] = [...backgroundStars(25, 4.4, ASTERISM_HIPS), ...DIPPER.stars, ...CAS.stars, ...UMI.stars];
  const target = ast.stars.map((st) => project(st.ra, st.dec, rot));
  // Khung: ôm chòm cần nối, chừa thêm khoảng 35 % mỗi phía để thấy các sao xung quanh.
  const xs = target.map((p) => p.x);
  const ys = target.map((p) => p.y);
  const m = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.35;
  const frame = fit(
    [
      { x: Math.min(...xs) - m, y: Math.min(...ys) - m },
      { x: Math.max(...xs) + m, y: Math.max(...ys) + m },
    ],
    W,
    H,
    10,
  );
  const pos = new Map<number, { x: number; y: number }>();
  for (const st of field) pos.set(st.hip, frame.to(project(st.ra, st.dec, rot)));
  const inView = field.filter((st) => {
    const p = pos.get(st.hip)!;
    return p.x > 4 && p.x < W - 4 && p.y > 4 && p.y < H - 4;
  });

  const svg = svgRoot(W, H, T.mapAria, 'sgk-map');
  const linesG = s('g', { class: 'sgk-lines' });
  const rubber = s('line', { class: 'sgk-rubber', x1: 0, y1: 0, x2: 0, y2: 0, visibility: 'hidden' });
  const starsG = s('g');
  const labelsG = s('g', { class: 'sgk-greek' });
  svg.append(s('rect', { class: 'sgk-map__sky', x: 0, y: 0, width: W, height: H, rx: 12 }), linesG, rubber, starsG, labelsG);

  const segs: [number, number][] = [];
  let pen: number | null = null;
  let locked = false;
  const starEl = new Map<number, SVGGElement>();

  // Thứ tự Tab: từ trái sang phải.
  const ordered = [...inView].sort((a, b) => pos.get(a.hip)!.x - pos.get(b.hip)!.x);
  ordered.forEach((st, i) => {
    const p = pos.get(st.hip)!;
    const g = s(
      'g',
      { class: 'sgk-star', tabindex: 0, role: 'button', 'aria-label': fmt(T.starAria, { i: i + 1 }) },
      s('circle', { class: 'sgk-star__halo', cx: p.x, cy: p.y, r: 13 }),
      s('circle', { class: 'sgk-star__dot', cx: p.x, cy: p.y, r: starRadius(st.mag) * 1.25 }),
    );
    keyActivate(g, () => tap(st.hip));
    starEl.set(st.hip, g);
    starsG.append(g);
  });

  const drawLines = (correct?: Set<string>) => {
    linesG.replaceChildren(
      ...segs.map(([a, b]) => {
        const p = pos.get(a)!;
        const q = pos.get(b)!;
        const state = correct ? (correct.has(key(a, b)) ? ' is-ok' : ' is-err') : '';
        return s('line', { class: `sgk-line${state}`, x1: p.x, y1: p.y, x2: q.x, y2: q.y });
      }),
    );
    for (const [hip, g] of starEl) g.classList.toggle('is-pen', hip === pen);
    if (pen === null) rubber.setAttribute('visibility', 'hidden');
  };

  function tap(hip: number | null) {
    if (locked) return;
    if (hip === null || hip === pen) pen = null;
    else if (pen === null) pen = hip;
    else {
      if (!segs.some(([a, b]) => key(a, b) === key(pen!, hip))) segs.push([pen, hip]);
      pen = hip;
    }
    drawLines();
  }

  svg.addEventListener('click', (e) => {
    if (locked) return;
    const p = svgPoint(svg, e);
    let best: number | null = null;
    let bd = 26;
    for (const st of inView) {
      const q = pos.get(st.hip)!;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd) {
        bd = d;
        best = st.hip;
      }
    }
    tap(best);
  });
  svg.addEventListener('pointermove', (e) => {
    if (pen === null || locked || e.pointerType !== 'mouse') return;
    const p = svgPoint(svg, e);
    const q = pos.get(pen)!;
    rubber.setAttribute('x1', String(q.x));
    rubber.setAttribute('y1', String(q.y));
    rubber.setAttribute('x2', String(p.x));
    rubber.setAttribute('y2', String(p.y));
    rubber.setAttribute('visibility', 'visible');
  });
  svg.addEventListener('pointerleave', () => rubber.setAttribute('visibility', 'hidden'));

  const targetKeys = new Set(ast.segs.map(([i, j]) => key(ast.stars[i].hip, ast.stars[j].hip)));
  const showGreek = () => {
    labelsG.replaceChildren(
      ...ast.stars.map((st, i) => {
        const p = pos.get(st.hip)!;
        return s('text', { class: 'sgk-t sgk-t--greek', x: p.x + 9, y: p.y - 8, text: ast.greek[i] });
      }),
    );
  };

  play.stage.replaceChildren(h('div', { class: 'sgk-figure' }, svg));

  const undo = h('button', {
    type: 'button',
    class: 'btn btn--ghost',
    text: T.undo,
    onclick: () => {
      if (locked) return;
      const last = segs.pop();
      pen = last ? last[0] : null;
      drawLines();
    },
  });
  const clearBtn = h('button', {
    type: 'button',
    class: 'btn btn--ghost',
    text: T.clear,
    onclick: () => {
      if (locked) return;
      segs.length = 0;
      pen = null;
      drawLines();
    },
  });

  round(play, {
    tools: [undo, clearBtn],
    hint: tt.hint,
    check: () => {
      const drawn = new Set(segs.map(([a, b]) => key(a, b)));
      const missing = [...targetKeys].filter((k) => !drawn.has(k)).length;
      const extra = [...drawn].filter((k) => !targetKeys.has(k)).length;
      drawLines(targetKeys);
      if (!missing && !extra) return { ok: true };
      return { ok: false, msg: [extra ? fmt(T.extra, { n: extra }) : '', missing ? fmt(T.missing, { n: missing }) : ''].filter(Boolean).join(' ') };
    },
    reveal: () => {
      segs.length = 0;
      for (const [i, j] of ast.segs) segs.push([ast.stars[i].hip, ast.stars[j].hip]);
      pen = null;
      drawLines(targetKeys);
    },
    lock: () => {
      locked = true;
      pen = null;
      drawLines(targetKeys);
      showGreek();
      svg.classList.add('is-locked');
      for (const st of ast.stars) starEl.get(st.hip)?.classList.add('is-target');
      undo.disabled = true;
      clearBtn.disabled = true;
    },
    explain: () => tt.fact,
    next,
  });
}

export const dipperGame: GameDef = {
  id: 'dipper',
  lesson: 4,
  rounds: () => 3,
  run(play) {
    const list = play.env.shuffle ? shuffled([DIPPER, CAS, UMI]) : [DIPPER, CAS, UMI];
    sequence(play, list.length, (i, next) => buildRound(play, list[i], next));
  },
};
