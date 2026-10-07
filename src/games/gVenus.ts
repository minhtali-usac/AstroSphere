// Bài 5 · Mục IV và VI — "Sao Hôm – Sao Mai" (Hình 5.19).
//
// Nhìn từ phía trên cực Bắc: Mặt Trời ở giữa, Trái Đất ở phía dưới. Người chơi kéo Kim tinh (rồi Thủy tinh) quanh
// quỹ đạo tròn; hình đo góc ly giác ε giữa Mặt Trời và hành tinh khi nhìn từ Trái Đất. Hành tinh ở bên trái đường
// Trái Đất – Mặt Trời thì ở phía Đông của Mặt Trời trên bầu trời → lặn sau Mặt Trời → Sao Hôm.
// Bán kính quỹ đạo theo tỉ lệ thật (Kim tinh 0,723 AU, Thủy tinh 0,387 AU), nên ε lớn nhất ≈ 46° và ≈ 23°.

import { h } from '../ui/dom';
import { round, sequence, type GameDef, type Play } from './shell';
import { arrowHead, deg, draggable, norm360, rad, s, sliderKeys, svgRoot } from './svg';
import { fmt, G, num } from './text';

const T = G.games.venus;
const W = 600;
const H = 420;
const SX = 300;
const SY = 196;
const RE = 168;
const EX = SX;
const EY = SY + RE;
/** Dưới góc này hành tinh chìm trong ánh sáng Mặt Trời. */
export const GLARE = 10;
export const ORBIT = { venus: 0.723, mercury: 0.387 } as const;
type Planet = keyof typeof ORBIT;

/** Góc ly giác lớn nhất (độ) của hành tinh trong có bán kính quỹ đạo `r` (AU), quỹ đạo tròn. */
export const maxElongation = (r: number) => deg(Math.asin(r));

/** Góc ly giác (độ) và phía (Đông = bên trái hình) của hành tinh ở góc `th` trên quỹ đạo bán kính `r` (AU). */
export function elongation(r: number, th: number): { e: number; east: boolean; behind: boolean } {
  const px = r * Math.cos(rad(th));
  const py = r * Math.sin(rad(th));
  // Trái Đất ở (0, 1) (y hướng xuống), Mặt Trời ở gốc.
  const ux = 0;
  const uy = -1;
  const wx = px;
  const wy = py - 1;
  const e = deg(Math.acos((ux * wx + uy * wy) / Math.hypot(wx, wy)));
  return { e, east: ux * wy - uy * wx < 0, behind: Math.hypot(wx, wy) > 1 };
}

type Task = 'evening' | 'morning' | 'hidden' | 'mercury';

function buildRound(play: Play, task: Task, next: () => void): void {
  play.task(T.tasks[task], T.taskSub);
  const planet: Planet = task === 'mercury' ? 'mercury' : 'venus';
  const rp = ORBIT[planet];
  const max = maxElongation(rp);
  const svg = svgRoot(W, H, fmt(T.planetAria, { name: T[planet] }), 'sgk-orbit');
  const glare = s('path', { class: 'sgk-glare' });
  const sightSun = s('line', { class: 'sgk-sight', x1: EX, y1: EY, x2: SX, y2: 8 });
  const sightP = s('line', { class: 'sgk-sight is-planet' });
  const arc = s('path', { class: 'sgk-angle' });
  const angleText = s('text', { class: 'sgk-t sgk-t--key' });
  const hit = s('circle', { class: 'sgk-hit', cx: SX, cy: SY, r: rp * RE });
  const handle = s(
    'g',
    { class: 'sgk-handle', tabindex: 0, role: 'slider', 'aria-label': fmt(T.planetAria, { name: T[planet] }), 'aria-valuemin': 0, 'aria-valuemax': 359 },
    s('circle', { class: 'sgk-handle__ring', r: 20 }),
    s('circle', { class: 'sgk-planet', r: planet === 'venus' ? 11 : 8, style: `fill: var(--sgk-${planet})` }),
  );
  const planetLabel = s('text', { class: 'sgk-t', 'text-anchor': 'middle', text: T[planet] });
  // Vùng chói quanh Mặt Trời (±GLARE° nhìn từ Trái Đất).
  const gl = (sign: number) => ({ x: EX + Math.sin(rad(GLARE)) * sign * 400, y: EY - Math.cos(rad(GLARE)) * 400 });
  const g1 = gl(-1);
  const g2 = gl(1);
  glare.setAttribute('d', `M${EX} ${EY}L${g1.x.toFixed(1)} ${g1.y.toFixed(1)}L${g2.x.toFixed(1)} ${g2.y.toFixed(1)}Z`);
  const ea = rad(-60);
  const ep = { x: SX + RE * Math.cos(ea), y: SY + RE * Math.sin(ea) };
  svg.append(
    glare,
    s('circle', { class: 'sgk-orbit__path is-faint', cx: SX, cy: SY, r: RE }),
    s('path', { class: 'sgk-orbit__dir', d: `M${(SX + RE * Math.cos(rad(-25))).toFixed(1)} ${(SY + RE * Math.sin(rad(-25))).toFixed(1)}A${RE} ${RE} 0 0 0 ${ep.x.toFixed(1)} ${ep.y.toFixed(1)}${arrowHead(ep.x, ep.y, Math.sin(ea), -Math.cos(ea))}` }),
    s('circle', { class: 'sgk-orbit__path', cx: SX, cy: SY, r: rp * RE }),
    sightSun,
    sightP,
    arc,
    s('circle', { class: 'sgk-sun', cx: SX, cy: SY, r: 22 }),
    s('text', { class: 'sgk-t sgk-t--key', x: SX + 28, y: SY - 22, text: T.sun }),
    s('circle', { class: 'sgk-earth__night', cx: EX, cy: EY, r: 13 }),
    s('path', { class: 'sgk-earth__day', d: `M${EX - 13} ${EY}A13 13 0 0 1 ${EX + 13} ${EY}Z` }),
    s('text', { class: 'sgk-t sgk-t--key', x: EX + 20, y: EY + 20, text: T.earth }),
    angleText,
    hit,
    handle,
    planetLabel,
  );
  const note = h('p', { class: 'sgk-figure__note', 'aria-live': 'off' });

  let th = task === 'hidden' ? 160 : task === 'morning' ? 200 : task === 'mercury' ? 260 : 330;
  let locked = false;
  const stateOf = (x: ReturnType<typeof elongation>) => (x.e < GLARE ? T.state.glare : x.east ? T.state.evening : T.state.morning);
  const draw = () => {
    const px = SX + rp * RE * Math.cos(rad(th));
    const py = SY + rp * RE * Math.sin(rad(th));
    handle.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
    planetLabel.setAttribute('x', px.toFixed(1));
    planetLabel.setAttribute('y', (py + (py > SY ? 34 : -26)).toFixed(1));
    const len = Math.hypot(px - EX, py - EY);
    const ux = (px - EX) / len;
    const uy = (py - EY) / len;
    sightP.setAttribute('x1', String(EX));
    sightP.setAttribute('y1', String(EY));
    sightP.setAttribute('x2', (EX + ux * 380).toFixed(1));
    sightP.setAttribute('y2', (EY + uy * 380).toFixed(1));
    const x = elongation(rp, th);
    const ar = 54;
    const ax = EX + ux * ar;
    const ay = EY + uy * ar;
    arc.setAttribute('d', `M${EX} ${EY - ar}A${ar} ${ar} 0 0 ${x.east ? 0 : 1} ${ax.toFixed(1)} ${ay.toFixed(1)}`);
    const mid = rad(-90 + (x.east ? -1 : 1) * x.e * 0.5);
    angleText.setAttribute('x', (EX + Math.cos(mid) * (ar + 20)).toFixed(1));
    angleText.setAttribute('y', (EY + Math.sin(mid) * (ar + 20) + 4).toFixed(1));
    angleText.setAttribute('text-anchor', x.east ? 'end' : 'start');
    angleText.textContent = fmt(T.angle, { a: num(x.e) });
    const text = `${fmt(T.angle, { a: num(x.e) })} · ${stateOf(x)}`;
    note.textContent = text;
    handle.setAttribute('aria-valuenow', String(Math.round(th)));
    handle.setAttribute('aria-valuetext', text);
  };
  const setTh = (v: number) => {
    th = norm360(v);
    draw();
  };
  draggable(svg, handle, (p) => setTh(deg(Math.atan2(p.y - SY, p.x - SX))), () => locked, hit);
  sliderKeys(handle, (dv) => !locked && setTh(th - dv), undefined, 2, 20);
  draw();
  play.stage.replaceChildren(h('div', { class: 'sgk-figure' }, svg), note);

  // Góc trên quỹ đạo cho đáp án: tiếp điểm của đường nhìn từ Trái Đất (ly giác lớn nhất), hoặc phía sau Mặt Trời.
  const tangent = (east: boolean) => {
    for (let t = 0; t < 360; t += 0.5) {
      const x = elongation(rp, t);
      if (x.east === east && x.e >= max - 0.3 && !x.behind) return t;
    }
    return 0;
  };
  round(play, {
    hint: T.hints[task],
    check: () => {
      const x = elongation(rp, th);
      const bad = { ok: false, msg: fmt(T.notYet, { a: num(x.e), state: stateOf(x) }) };
      const notMax = { ok: false, msg: fmt(T.notMax, { a: num(x.e) }) };
      if (task === 'hidden') return x.e < GLARE && x.behind ? { ok: true } : bad;
      if (task === 'mercury') return x.e >= max - 2 ? { ok: true } : x.e >= GLARE ? notMax : bad;
      const want = task === 'evening';
      if (x.e < GLARE || x.east !== want) return bad;
      return x.e >= max - 3 ? { ok: true } : notMax;
    },
    reveal: () => setTh(task === 'hidden' ? 270 : tangent(task !== 'morning')),
    lock: () => {
      locked = true;
      svg.classList.add('is-locked');
      handle.setAttribute('aria-disabled', 'true');
    },
    explain: () => fmt(T.explain[task], { max: num(max) }),
    next,
  });
}

export const venusGame: GameDef = {
  id: 'venus',
  lesson: 5,
  rounds: () => 4,
  run(play) {
    const tasks: Task[] = ['evening', 'morning', 'hidden', 'mercury'];
    sequence(play, tasks.length, (i, next) => buildRound(play, tasks[i], next));
  },
};
