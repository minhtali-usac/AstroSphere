// Bài 5 · Mục V — "Địa tâm hay Nhật tâm?": lượt 1 phân loại các ý theo mô hình của Ptolemy / Copernicus / cả hai,
// lượt 2 dựng lại mô hình địa tâm (thứ tự các vòng quanh Trái Đất, Hình 5.13).

import { h } from '../ui/dom';
import { placer } from './place';
import { round, sequence, shuffled, type GameDef, type Play } from './shell';
import { fmt, G } from './text';

const T = G.games.models;

export const MODEL_ANSWER: Record<keyof typeof T.cards, 'geo' | 'helio' | 'both'> = {
  earthCenter: 'geo',
  sunCenter: 'helio',
  sunAroundEarth: 'geo',
  earthSpins: 'helio',
  moonAroundEarth: 'both',
  fixedStars: 'both',
  thousandYears: 'geo',
  galileo: 'helio',
};

export const PTOLEMY = ['moon', 'mercury', 'venus', 'sun', 'mars', 'jupiter', 'saturn'] as const;

function sortRound(play: Play, next: () => void): void {
  play.task(T.sortTask, T.sortSub);
  const ids = Object.keys(MODEL_ANSWER) as (keyof typeof T.cards)[];
  const p = placer({
    items: shuffled(ids.map((id) => ({ id, label: T.cards[id] }))),
    answer: MODEL_ANSWER,
    multi: true,
    onPick: (n) => play.say('info', fmt(G.place.pick, { name: n })),
  });
  play.stage.replaceChildren(
    h(
      'div',
      { class: 'sgk-place sgk-place--cards' },
      h('div', { class: 'sgk-bins sgk-bins--3' }, p.slot('geo', T.bins.geo, 'sgk-slot--bin'), p.slot('both', T.bins.both, 'sgk-slot--bin'), p.slot('helio', T.bins.helio, 'sgk-slot--bin')),
      p.tray,
    ),
  );
  round(play, { hint: T.sortHint, check: p.check, reveal: p.reveal, lock: p.lock, explain: () => T.sortExplain, next });
}

function orderRound(play: Play, next: () => void): void {
  play.task(T.orderTask, T.orderSub);
  const color: Record<string, string> = { moon: '--sgk-moon', sun: '--sgk-sun' };
  const p = placer({
    items: shuffled(PTOLEMY.map((id) => ({ id, label: T.bodies[id], color: color[id] ?? `--sgk-${id}` }))),
    answer: Object.fromEntries(PTOLEMY.map((id, i) => [id, `r${i + 1}`])),
    onPick: (n) => play.say('info', fmt(G.place.pick, { name: n })),
  });
  play.stage.replaceChildren(
    h(
      'div',
      { class: 'sgk-place' },
      h(
        'div',
        { class: 'sgk-rings' },
        h('div', { class: 'sgk-rings__center' }, h('span', { class: 'sgk-chip__dot', style: { background: 'var(--sgk-earth)' }, 'aria-hidden': 'true' }), T.earth),
        ...PTOLEMY.map((_, i) => p.slot(`r${i + 1}`, fmt(T.ring, { n: i + 1 }), 'sgk-slot--ring')),
      ),
      p.tray,
    ),
  );
  round(play, { hint: T.orderHint, check: p.check, reveal: p.reveal, lock: p.lock, explain: () => T.orderExplain, next });
}

export const modelsGame: GameDef = {
  id: 'models',
  lesson: 5,
  rounds: () => 2,
  run(play) {
    sequence(play, 2, (i, next) => (i === 0 ? sortRound(play, next) : orderRound(play, next)));
  },
};
