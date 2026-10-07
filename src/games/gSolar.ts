// Bài 5 · Mục I — "Xếp Hệ Mặt Trời": lượt 1 xếp tám hành tinh theo thứ tự từ Mặt Trời, lượt 2 phân loại hành tinh
// đá / hành tinh khí.

import { h } from '../ui/dom';
import { placer, type PlaceItem } from './place';
import { round, sequence, shuffled, type GameDef, type Play } from './shell';
import { fmt, G } from './text';

const T = G.games.solar;
export const PLANETS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const;
const ROCKY = new Set(['mercury', 'venus', 'earth', 'mars']);

const items = (): PlaceItem[] => shuffled(PLANETS.map((id) => ({ id, label: T.planets[id], color: `--sgk-${id}` })));

function orderRound(play: Play, next: () => void): void {
  play.task(T.orderTask, T.orderSub);
  const answer = Object.fromEntries(PLANETS.map((id, i) => [id, `o${i + 1}`]));
  const p = placer({ items: items(), answer, onPick: (n) => play.say('info', fmt(G.place.pick, { name: n })) });
  const row = h(
    'div',
    { class: 'sgk-orbitrow' },
    h('div', { class: 'sgk-sunbadge', text: T.sun }),
    h('div', { class: 'sgk-orbitrow__slots' }, ...PLANETS.map((_, i) => p.slot(`o${i + 1}`, fmt(T.slot, { n: i + 1 }), 'sgk-slot--orbit'))),
  );
  play.stage.replaceChildren(h('div', { class: 'sgk-place' }, row, p.tray));
  round(play, { hint: T.orderHint, check: p.check, reveal: p.reveal, lock: p.lock, explain: () => T.orderExplain, next });
}

function kindRound(play: Play, next: () => void): void {
  play.task(T.kindTask, T.orderSub);
  const answer = Object.fromEntries(PLANETS.map((id) => [id, ROCKY.has(id) ? 'rocky' : 'gas']));
  const p = placer({ items: items(), answer, multi: true, onPick: (n) => play.say('info', fmt(G.place.pick, { name: n })) });
  play.stage.replaceChildren(
    h('div', { class: 'sgk-place' }, h('div', { class: 'sgk-bins' }, p.slot('rocky', T.rocky, 'sgk-slot--bin'), p.slot('gas', T.gas, 'sgk-slot--bin')), p.tray),
  );
  round(play, { hint: T.kindHint, check: p.check, reveal: p.reveal, lock: p.lock, explain: () => T.kindExplain, next });
}

export const solarGame: GameDef = {
  id: 'solar',
  lesson: 5,
  rounds: () => 2,
  run(play) {
    sequence(play, 2, (i, next) => (i === 0 ? orderRound(play, next) : kindRound(play, next)));
  },
};
