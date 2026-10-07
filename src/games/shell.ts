// Khung chung của một hoạt động: nhiệm vụ, sân chơi, lời phản hồi, hàng nút và nhịp "Kiểm tra → Tiếp tục".
//
// Chấm điểm giống nhau ở mọi hoạt động: mỗi lượt tối đa 2 điểm — đúng ngay lần kiểm tra đầu được 2, đúng ở lần sau
// được 1, bấm "Xem đáp án" được 0. Nút "Xem đáp án" chỉ hiện sau hai lần kiểm tra chưa đúng.

import { h } from '../ui/dom';
import { G } from './text';

export interface GameEnv {
  hints: boolean;
  shuffle: boolean;
  /** Số câu đố nhanh mỗi bài (0 = tất cả). */
  quizCount: number;
}

export type SayKind = 'ok' | 'err' | 'info';

export interface Play {
  env: GameEnv;
  /** Sân chơi: hoạt động tự dựng nội dung (mỗi lượt có thể dựng lại). */
  stage: HTMLElement;
  task(text: string, sub?: string): void;
  say(kind: SayKind, text: string): void;
  clearSay(): void;
  controls(...els: (HTMLElement | null)[]): void;
  progress(i: number, n: number): void;
  award(points: number): void;
  done(): void;
}

export interface GameDef {
  id: string;
  lesson: 4 | 5;
  /** Số lượt (mỗi lượt tối đa 2 điểm). */
  rounds(env: GameEnv): number;
  /** Chạy hoạt động; trả về hàm dọn dẹp nếu cần. */
  run(play: Play): void | (() => void);
}

export const POINTS_PER_ROUND = 2;

export interface Verdict {
  ok: boolean;
  msg?: string;
}

export interface RoundOpts {
  check: () => Verdict;
  reveal: () => void;
  /** Lời giải thích hiện sau khi đúng hoặc sau khi xem đáp án. */
  explain: () => string;
  /** Khóa sân chơi khi lượt đã xong. */
  lock: () => void;
  next: () => void;
  tools?: (HTMLElement | null)[];
  hint?: string;
}

export function btn(label: string, onClick: () => void, cls = '', aria?: string): HTMLButtonElement {
  return h('button', { type: 'button', class: `btn ${cls}`.trim(), text: label, 'aria-label': aria, onclick: onClick });
}

/** Nhịp chuẩn của một lượt: [công cụ…] [Gợi ý] [Xem đáp án] [Kiểm tra] → [Tiếp tục]. */
export function round(play: Play, o: RoundOpts): void {
  let tries = 0;
  const finish = () => {
    o.lock();
    const next = btn(G.play.next, o.next, 'btn--primary sgk-next');
    play.controls(next);
    next.focus({ preventScroll: true });
    bringIntoView(next);
  };
  const reveal = btn(G.play.reveal, () => {
    o.reveal();
    play.say('info', `${G.play.answer} ${o.explain()}`);
    finish();
  }, 'btn--ghost');
  reveal.hidden = true;
  const hint =
    play.env.hints && o.hint
      ? btn(G.play.hint, () => play.say('info', o.hint!), 'btn--ghost')
      : null;
  const check = btn(G.play.check, () => {
    const v = o.check();
    tries++;
    if (v.ok) {
      const pts = tries === 1 ? 2 : 1;
      play.award(pts);
      play.say('ok', `${pts === 2 ? G.play.ok2 : G.play.ok1} ${o.explain()}`);
      finish();
    } else {
      if (v.msg) play.say('err', v.msg);
      bringIntoView(check);
      if (tries >= 2) reveal.hidden = false;
    }
  }, 'btn--primary');
  play.controls(...(o.tools ?? []), hint, reveal, check);
}

/** Cuộn cho phần tử hiện trong khung (mượt, trừ khi người dùng giảm chuyển động). */
export function bringIntoView(el: HTMLElement): void {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
}

/** Xáo trộn (Fisher–Yates), trả về mảng mới. */
export function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Lặp qua các lượt: gọi `build(i)` cho lượt i, `play.done()` khi hết. Trả về hàm chuyển lượt. */
export function sequence(play: Play, n: number, build: (i: number, next: () => void) => void): void {
  let i = 0;
  const next = () => {
    i++;
    go();
  };
  const go = () => {
    if (i >= n) {
      play.done();
      return;
    }
    play.clearSay();
    play.progress(i + 1, n);
    build(i, next);
  };
  go();
}
