// "Đố nhanh Bài 4 / Bài 5": trắc nghiệm bốn lựa chọn. Chọn đúng ngay được 2 điểm; chọn sai thì hiện đáp án đúng và
// lời giải thích (0 điểm). Trong games.vi.json đáp án đúng luôn đứng đầu mảng `a`; thứ tự hiển thị được xáo trộn
// khi giáo viên bật "Xáo trộn", nếu không thì xoay vòng theo số câu để đáp án đúng không luôn ở ô đầu.

import { h } from '../ui/dom';
import { bringIntoView, btn, sequence, shuffled, type GameDef, type GameEnv, type Play } from './shell';
import { fmt, G } from './text';

interface Question {
  q: string;
  a: string[];
  why: string;
}

const BANK: Record<'quiz4' | 'quiz5', Question[]> = { quiz4: G.quiz.b4, quiz5: G.quiz.b5 };

const count = (id: 'quiz4' | 'quiz5', env: GameEnv) => (env.quizCount > 0 ? Math.min(env.quizCount, BANK[id].length) : BANK[id].length);

function ask(play: Play, q: Question, n: number, next: () => void): void {
  play.task(q.q, G.quiz.task);
  const order = play.env.shuffle ? shuffled(q.a.map((_, i) => i)) : q.a.map((_, i) => (i + n) % q.a.length);
  let done = false;
  const opts = order.map((i) =>
    h('button', {
      type: 'button',
      class: 'sgk-option',
      'data-i': i,
      text: q.a[i],
      onclick: () => {
        if (done) return;
        done = true;
        const right = i === 0;
        for (const b of opts) {
          b.setAttribute('aria-disabled', 'true');
          const k = Number(b.dataset.i);
          if (k === 0) b.classList.add('is-ok');
          else if (k === i) b.classList.add('is-err');
        }
        if (right) {
          play.award(2);
          play.say('ok', `${G.quiz.right} ${q.why}`);
        } else play.say('err', `${fmt(G.quiz.wrongIs, { a: q.a[0] })} ${q.why}`);
        const nx = btn(G.play.next, next, 'btn--primary sgk-next');
        play.controls(nx);
        nx.focus({ preventScroll: true });
        bringIntoView(nx);
      },
    }),
  );
  play.stage.replaceChildren(h('div', { class: 'sgk-options', role: 'group', 'aria-label': q.q }, ...opts));
  play.controls();
}

function quiz(id: 'quiz4' | 'quiz5', lesson: 4 | 5): GameDef {
  return {
    id,
    lesson,
    rounds: (env) => count(id, env),
    run(play) {
      const all = play.env.shuffle ? shuffled(BANK[id]) : BANK[id];
      const list = all.slice(0, count(id, play.env));
      sequence(play, list.length, (i, next) => ask(play, list[i], i, next));
    },
  };
}

export const quiz4Game = quiz('quiz4', 4);
export const quiz5Game = quiz('quiz5', 5);
