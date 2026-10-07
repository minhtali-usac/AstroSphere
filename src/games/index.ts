// Thử thách SGK — phần tải lười, mở từ ô "Thử thách SGK" trong USACodex (src/codex/ui.ts).
//
// Ba màn trong cùng một khung:
//   1. Bảng chọn: giáo viên đánh dấu hoạt động (theo Bài 4 / Bài 5 của SGK) và tùy chọn (gợi ý, xáo trộn, số câu đố),
//      rồi "Bắt đầu"; mỗi dòng cũng có nút "Chơi ngay" để chơi riêng một hoạt động.
//   2. Chơi: các hoạt động chạy lần lượt; sau mỗi hoạt động có thẻ "Hoàn thành" với số sao.
//   3. Bảng điểm cuối cùng.
// Trò chơi chỉ đọc dữ liệu của ứng dụng (sao, chòm sao), không đổi trạng thái của mô phỏng.

import './games.css';
import { h } from '../ui/dom';
import { dipperGame } from './gDipper';
import { modelsGame } from './gModels';
import { moonGame } from './gMoon';
import { polarisGame } from './gPolaris';
import { quiz4Game, quiz5Game } from './gQuiz';
import { seasonsGame } from './gSeasons';
import { solarGame } from './gSolar';
import { sunPathGame } from './gSunPath';
import { venusGame } from './gVenus';
import { GAME_IDS, loadSgk, saveSgk, type GameId, type SgkState } from './progress';
import { POINTS_PER_ROUND, type GameDef, type GameEnv, type Play, type SayKind } from './shell';
import { fmt, G } from './text';

export const GAMES: Record<GameId, GameDef> = {
  dipper: dipperGame,
  polaris: polarisGame,
  quiz4: quiz4Game,
  solar: solarGame,
  sunpath: sunPathGame,
  moon: moonGame,
  venus: venusGame,
  models: modelsGame,
  seasons: seasonsGame,
  quiz5: quiz5Game,
};

const INFO = G.games;

/** Biểu tượng nhỏ cho từng hoạt động (20 × 20, nét theo màu chữ). */
const ICON: Record<GameId, string> = {
  dipper: '<path d="M3 13l4-1 3 2 4-1 3-6"/><circle cx="3" cy="13" r="1.4"/><circle cx="7" cy="12" r="1.4"/><circle cx="10" cy="14" r="1.4"/><circle cx="14" cy="13" r="1.4"/><circle cx="17" cy="7" r="1.4"/>',
  polaris: '<circle cx="10" cy="10" r="6.5"/><path d="M10 1.5v4M10 14.5v4M1.5 10h4M14.5 10h4"/><path d="M10 7.6l.8 1.6 1.6.8-1.6.8-.8 1.6-.8-1.6-1.6-.8 1.6-.8z"/>',
  quiz4: '<path d="M7 7.5a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.9V13"/><circle cx="10" cy="16" r=".8"/>',
  solar: '<circle cx="10" cy="10" r="2.6"/><ellipse cx="10" cy="10" rx="8" ry="4.2"/><circle cx="17.2" cy="11.8" r="1.2"/>',
  sunpath: '<path d="M2 15h16"/><path d="M3.5 15a6.5 6.5 0 0 1 13 0"/><circle cx="10" cy="8.5" r="1.8"/>',
  moon: '<path d="M13.5 3.5a7 7 0 1 0 3 9.5 5.6 5.6 0 0 1-3-9.5z"/>',
  venus: '<circle cx="6" cy="12" r="3"/><path d="M14.5 4.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"/><path d="M2 17h16"/>',
  models: '<circle cx="10" cy="10" r="1.8"/><circle cx="10" cy="10" r="4.6"/><circle cx="10" cy="10" r="8"/>',
  seasons: '<ellipse cx="10" cy="10" rx="8" ry="4.5"/><circle cx="10" cy="10" r="1.8"/><circle cx="2" cy="10" r="1.5"/><path d="M1.4 7.8l1.2 4.4"/>',
  quiz5: '<path d="M7 7.5a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.9V13"/><circle cx="10" cy="16" r=".8"/>',
};

const icon = (id: GameId) => {
  const el = h('span', { class: 'sgk-icon', 'aria-hidden': 'true' });
  el.innerHTML = `<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICON[id]}</svg>`;
  return el;
};

const starsOf = (pct: number) => (pct >= 90 ? 3 : pct >= 60 ? 2 : pct > 0 ? 1 : 0);

function starRow(n: number): HTMLElement {
  return h(
    'span',
    { class: 'sgk-stars', role: 'img', 'aria-label': fmt(G.play.starsAria, { n }) },
    ...[0, 1, 2].map((i) => h('span', { class: `sgk-stars__s${i < n ? ' is-on' : ''}`, text: '★', 'aria-hidden': 'true' })),
  );
}

interface Opts {
  onBack: () => void;
  onChange: () => void;
}

interface Hub {
  root: HTMLElement;
  focus: () => void;
}

const hubs = new WeakMap<HTMLElement, Hub>();

/** Gắn Thử thách SGK vào `host` (một lần); lần sau chỉ đưa tiêu điểm về màn đang mở. */
export function mountGames(host: HTMLElement, opts: Opts): void {
  const existing = hubs.get(host);
  if (existing) {
    existing.focus();
    return;
  }
  const hub = createHub(opts);
  host.replaceChildren(hub.root);
  hubs.set(host, hub);
  hub.focus();
}

function createHub(opts: Opts): Hub {
  let state: SgkState = loadSgk();
  const root = h('div', { class: 'sgk' });
  let focusEl: HTMLElement | null = null;
  let cleanup: (() => void) | void;

  const save = () => {
    saveSgk(state);
    opts.onChange();
  };
  const env = (): GameEnv => ({ hints: state.hints, shuffle: state.shuffle, quizCount: state.quizCount });
  const show = (view: HTMLElement, focus: HTMLElement) => {
    if (typeof cleanup === 'function') cleanup();
    cleanup = undefined;
    root.replaceChildren(view);
    root.scrollTop = 0;
    focusEl = focus;
    focus.focus({ preventScroll: true });
  };

  // ------------------------------------------------------------ Bảng chọn
  function menu(): void {
    const title = h('h3', { class: 'sgk-hub__title', tabindex: '-1', text: G.hub.title });
    const summary = h('p', { class: 'sgk-hub__summary', 'aria-live': 'polite' });
    const startBtn = h('button', { type: 'button', class: 'btn btn--primary sgk-start', text: `${G.hub.start} ▶`, onclick: () => start(state.picked as GameId[]) });
    const boxes = new Map<GameId, HTMLInputElement>();
    const sync = () => {
      const picked = GAME_IDS.filter((id) => boxes.get(id)!.checked);
      state.picked = picked;
      save();
      const mins = picked.reduce((a, id) => a + INFO[id].minutes, 0);
      summary.textContent = picked.length ? fmt(G.hub.summary, { n: picked.length, m: mins }) : G.hub.summaryNone;
      startBtn.disabled = !picked.length;
      for (const [lesson, b] of lessonBtns) {
        const all = GAME_IDS.filter((id) => GAMES[id].lesson === lesson).every((id) => boxes.get(id)!.checked);
        b.textContent = all ? G.hub.pickNone : G.hub.pickAll;
      }
    };
    const lessonBtns = new Map<number, HTMLButtonElement>();
    const lessons = ([4, 5] as const).map((lesson) => {
      const ids = GAME_IDS.filter((id) => GAMES[id].lesson === lesson);
      const toggle = h('button', {
        type: 'button',
        class: 'btn btn--ghost btn--small',
        onclick: () => {
          const all = ids.every((id) => boxes.get(id)!.checked);
          for (const id of ids) boxes.get(id)!.checked = !all;
          sync();
        },
      });
      lessonBtns.set(lesson, toggle);
      return h(
        'section',
        { class: 'sgk-lesson', 'aria-labelledby': `sgk-lesson-${lesson}` },
        h('header', { class: 'sgk-lesson__head' }, h('h4', { id: `sgk-lesson-${lesson}`, text: G.hub.lessons[lesson] }), toggle),
        h(
          'ul',
          { class: 'sgk-rows', role: 'list' },
          ...ids.map((id) => {
            const info = INFO[id];
            const box = h('input', { type: 'checkbox', checked: state.picked.includes(id), onchange: sync });
            boxes.set(id, box);
            const best = state.best[id];
            const rounds = GAMES[id].rounds(env());
            return h(
              'li',
              { class: 'sgk-row' },
              h(
                'label',
                { class: 'sgk-row__pick' },
                box,
                icon(id),
                h(
                  'span',
                  { class: 'sgk-row__text' },
                  h('strong', { text: info.title }),
                  h('span', { class: 'sgk-row__desc', text: info.desc }),
                  h('span', { class: 'sgk-row__meta', text: `${info.ref} · ${fmt(G.hub.rounds, { n: rounds })} · ${fmt(G.hub.minutes, { n: info.minutes })}` }),
                ),
              ),
              h(
                'span',
                { class: 'sgk-row__side' },
                best ? h('span', { class: 'sgk-row__best' }, starRow(starsOf(best)), h('span', { text: fmt(G.hub.best, { pct: best }) })) : null,
                h('button', { type: 'button', class: 'btn btn--small', text: `▶ ${G.hub.playOne}`, 'aria-label': fmt(G.hub.playOneAria, { name: info.title }), onclick: () => start([id]) }),
              ),
            );
          }),
        ),
      );
    });

    const optCheck = (label: string, checked: boolean, set: (v: boolean) => void) =>
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked, onchange: (e: Event) => (set((e.target as HTMLInputElement).checked), save()) }), h('span', { text: label }));
    const quizSel = h(
      'select',
      {
        class: 'sgk-select',
        onchange: (e: Event) => {
          state.quizCount = Number((e.target as HTMLSelectElement).value);
          save();
          menu();
        },
      },
      ...[5, 8, 0].map((n) => h('option', { value: String(n), selected: state.quizCount === n, text: n ? String(n) : G.hub.optQuizAll })),
    );
    const view = h(
      'section',
      { class: 'sgk-hub', 'aria-labelledby': 'sgk-hub-title' },
      h(
        'header',
        { class: 'sgk-hub__head' },
        h('button', { type: 'button', class: 'btn btn--ghost sgk-back', text: G.hub.back, 'aria-label': G.hub.backAria, onclick: opts.onBack }),
        title,
        h('p', { class: 'sgk-hub__sub', text: G.hub.sub }),
      ),
      h('section', { class: 'sgk-teacher' }, h('h4', { text: G.hub.teacherTitle }), h('p', { text: G.hub.teacherBody })),
      ...lessons,
      h(
        'section',
        { class: 'sgk-opts', 'aria-labelledby': 'sgk-opts-h' },
        h('h4', { id: 'sgk-opts-h', text: G.hub.optionsTitle }),
        optCheck(G.hub.optHints, state.hints, (v) => (state.hints = v)),
        optCheck(G.hub.optShuffle, state.shuffle, (v) => (state.shuffle = v)),
        h('label', { class: 'sgk-opts__row' }, h('span', { text: G.hub.optQuiz }), quizSel),
      ),
      h('footer', { class: 'sgk-hub__foot' }, summary, startBtn),
    );
    title.id = 'sgk-hub-title';
    sync();
    show(view, title);
  }

  // ------------------------------------------------------------ Chơi
  interface Result {
    id: GameId;
    pts: number;
    max: number;
  }
  let playlist: GameId[] = [];
  let results: Result[] = [];

  function start(ids: GameId[]): void {
    if (!ids.length) return;
    playlist = GAME_IDS.filter((id) => ids.includes(id));
    results = [];
    runGame(0);
  }

  function runGame(i: number): void {
    const id = playlist[i];
    const def = GAMES[id];
    const e = env();
    const max = def.rounds(e) * POINTS_PER_ROUND;
    let pts = 0;
    const info = INFO[id];
    const title = h('h3', { class: 'sgk-run__title', tabindex: '-1', text: info.title });
    const roundEl = h('span', { class: 'sgk-pill' });
    const scoreEl = h('span', { class: 'sgk-pill sgk-pill--score', text: `★ ${fmt(G.play.score, { n: 0 })}` });
    const taskText = h('strong', { class: 'sgk-task__main' });
    const taskSub = h('span', { class: 'sgk-task__sub' });
    const stage = h('div', { class: 'sgk-stage' });
    const say = h('p', { class: 'sgk-say', role: 'status' });
    const controls = h('div', { class: 'sgk-controls' });
    const view = h(
      'section',
      { class: 'sgk-run', 'aria-labelledby': 'sgk-run-title' },
      h(
        'header',
        { class: 'sgk-run__head' },
        h('button', { type: 'button', class: 'btn btn--ghost sgk-exit', text: G.play.exit, 'aria-label': G.play.exitAria, onclick: menu }),
        h('div', { class: 'sgk-run__titles' }, h('p', { class: 'sgk-run__ref', text: `${info.ref}${playlist.length > 1 ? ` · ${fmt(G.play.activity, { i: i + 1, n: playlist.length })}` : ''}` }), title),
        h('div', { class: 'sgk-run__meta' }, roundEl, scoreEl),
      ),
      h('p', { class: 'sgk-task' }, taskText, taskSub),
      stage,
      say,
      controls,
    );
    title.id = 'sgk-run-title';
    let finished = false;
    const play: Play = {
      env: e,
      stage,
      task(text, sub) {
        taskText.textContent = text;
        taskSub.textContent = sub ?? '';
        taskSub.hidden = !sub;
      },
      say(kind: SayKind, text: string) {
        say.dataset.kind = kind;
        say.textContent = text;
      },
      clearSay() {
        delete say.dataset.kind;
        say.textContent = '';
      },
      controls(...els) {
        controls.replaceChildren(...els.filter((x): x is HTMLElement => !!x));
      },
      progress(n, total) {
        roundEl.textContent = fmt(G.play.round, { i: n, n: total });
      },
      award(p) {
        pts += p;
        scoreEl.textContent = `★ ${fmt(G.play.score, { n: pts })}`;
        scoreEl.classList.remove('is-bump');
        void scoreEl.offsetWidth;
        scoreEl.classList.add('is-bump');
      },
      done() {
        if (finished) return;
        finished = true;
        results.push({ id, pts, max });
        const pct = Math.round((100 * pts) / Math.max(1, max));
        if (pct > (state.best[id] ?? 0)) {
          state.best[id] = pct;
          save();
        }
        doneCard(i, pts, max);
      },
    };
    show(view, title);
    cleanup = def.run(play);
  }

  function doneCard(i: number, pts: number, max: number): void {
    const id = playlist[i];
    const n = starsOf(Math.round((100 * pts) / Math.max(1, max)));
    const title = h('h3', { class: 'sgk-done__title', tabindex: '-1', text: fmt(G.play.doneTitle, { name: INFO[id].title }) });
    const more = i + 1 < playlist.length;
    const nextBtn = h('button', {
      type: 'button',
      class: 'btn btn--primary',
      text: more ? fmt(G.play.nextActivity, { name: INFO[playlist[i + 1]].title }) : G.play.toResults,
      onclick: () => (more ? runGame(i + 1) : summary()),
    });
    const view = h(
      'section',
      { class: 'sgk-done', 'aria-labelledby': 'sgk-done-title' },
      h('div', { class: 'sgk-done__badge' }, icon(id)),
      title,
      starRow(n),
      h('p', { class: 'sgk-done__score', text: fmt(G.play.doneScore, { n: pts, max }) }),
      h('p', { class: 'sgk-done__praise', text: G.play.praise[Math.max(0, n - 1)] }),
      h('div', { class: 'sgk-done__actions' }, h('button', { type: 'button', class: 'btn btn--ghost', text: G.play.toMenu, onclick: menu }), nextBtn),
    );
    title.id = 'sgk-done-title';
    show(view, title);
  }

  function summary(): void {
    const total = results.reduce((a, r) => a + r.pts, 0);
    const max = results.reduce((a, r) => a + r.max, 0);
    const title = h('h3', { class: 'sgk-done__title', tabindex: '-1', text: G.play.resultsTitle });
    const view = h(
      'section',
      { class: 'sgk-done sgk-results', 'aria-labelledby': 'sgk-res-title' },
      title,
      starRow(starsOf(Math.round((100 * total) / Math.max(1, max)))),
      h('p', { class: 'sgk-done__score', text: fmt(G.play.resultsTotal, { n: total, max }) }),
      h(
        'ul',
        { class: 'sgk-results__list', role: 'list' },
        ...results.map((r) => {
          const bar = h('span', { class: 'sgk-results__bar', 'aria-hidden': 'true' });
          bar.style.setProperty('--p', String(r.pts / Math.max(1, r.max)));
          return h(
            'li',
            { class: 'sgk-results__row' },
            icon(r.id),
            h('span', { class: 'sgk-results__name', text: INFO[r.id].title }),
            bar,
            h('span', { class: 'sgk-results__pts', text: `${r.pts}/${r.max}` }),
          );
        }),
      ),
      h(
        'div',
        { class: 'sgk-done__actions' },
        h('button', { type: 'button', class: 'btn btn--ghost', text: G.play.toMenu, onclick: menu }),
        h('button', { type: 'button', class: 'btn btn--primary', text: G.play.again, onclick: () => start(results.map((r) => r.id)) }),
      ),
    );
    title.id = 'sgk-res-title';
    show(view, title);
  }

  menu();
  return { root, focus: () => focusEl?.focus({ preventScroll: true }) };
}
