// Chế độ học tập: các nhiệm vụ ngắn, chấm điểm tự động, có gợi ý và giải thích.

import { parseNum } from '../astro';
import { TASKS, type Task } from '../data/tasks';
import { t } from '../i18n';
import type { Actions, Store } from '../state';
import { button, clear, h, newId } from './dom';
import { isPlainObject, readJson, writeJson } from './storage';

export interface TaskProgress {
  attempts: number;
  correct: boolean;
  hinted: boolean;
}

export interface Progress {
  [taskId: string]: TaskProgress;
}

const STORAGE_KEY = 'thien-cau.hoc-tap.v1';

const isTaskProgress = (v: unknown): v is TaskProgress =>
  isPlainObject(v) && typeof v.attempts === 'number' && Number.isFinite(v.attempts) && typeof v.correct === 'boolean' && typeof v.hinted === 'boolean';

/** Giữ lại các mục đúng dạng {attempts, correct, hinted}; bỏ mọi thứ khác (dữ liệu hỏng, null, mảng…). */
export function sanitizeProgress(v: unknown): Progress {
  const out: Progress = {};
  if (!isPlainObject(v)) return out;
  for (const [id, p] of Object.entries(v)) if (isTaskProgress(p)) out[id] = { attempts: p.attempts, correct: p.correct, hinted: p.hinted };
  return out;
}

function loadProgress(): Progress {
  return sanitizeProgress(readJson(STORAGE_KEY, isPlainObject, {}));
}

function saveProgress(p: Progress): void {
  writeJson(STORAGE_KEY, p);
}

/** Điểm: đúng ngay lần đầu và không xem gợi ý = 2 điểm; đúng sau đó = 1 điểm. */
export function points(p: TaskProgress | undefined): number {
  if (!p?.correct) return 0;
  return p.attempts <= 1 && !p.hinted ? 2 : 1;
}

/** Ghi nhận việc xem gợi ý. Xem gợi ý sau khi đã làm đúng không trừ điểm. */
export function withHint(p: TaskProgress | undefined): TaskProgress {
  const cur = p ?? { attempts: 0, correct: false, hinted: false };
  return cur.correct ? cur : { ...cur, hinted: true };
}

export interface LearningOptions {
  /** Phần tử nhận lại tiêu điểm khi đóng ngăn (thường là nút đã mở nó). */
  returnFocus?: () => HTMLElement | null;
}

export function learningDrawer(store: Store, actions: Actions, opts: LearningOptions = {}) {
  let progress = loadProgress();
  const score = h('p', { class: 'learn__score', 'aria-live': 'polite' });
  const list = h('ol', { class: 'learn__list' });

  const updateScore = () => {
    const total = TASKS.reduce((acc, task) => acc + points(progress[task.id]), 0);
    const done = TASKS.filter((task) => progress[task.id]?.correct).length;
    score.textContent = t('learn.score', { p: total, max: TASKS.length * 2, done, n: TASKS.length });
  };

  const renderTask = (task: Task, index: number) => {
    const st = () => progress[task.id];
    const feedback = h('p', { class: 'learn__feedback', role: 'status', 'aria-live': 'polite' });
    const hintEl = h('p', { class: 'learn__hint', hidden: true, text: `💡 ${task.hint}` });
    const explainEl = h('p', { class: 'learn__explain', hidden: true, text: task.explain });
    const badge = h('span', { class: 'learn__badge' });

    const record = (ok: boolean) => {
      const p = progress[task.id] ?? { attempts: 0, correct: false, hinted: false };
      if (!p.correct) p.attempts += 1;
      p.correct = p.correct || ok;
      progress[task.id] = p;
      saveProgress(progress);
      feedback.textContent = ok ? t('learn.correct') : t('learn.wrong');
      feedback.dataset.kind = ok ? 'ok' : 'err';
      if (ok) explainEl.hidden = false;
      refreshBadge();
      updateScore();
    };

    const refreshBadge = () => {
      const p = st();
      badge.textContent = p?.correct ? '✓' : p?.attempts ? '…' : '';
      badge.dataset.kind = p?.correct ? 'ok' : p?.attempts ? 'try' : '';
      badge.setAttribute('aria-label', p?.correct ? t('learn.doneAria') : '');
    };

    let answerUi: HTMLElement;
    let check: () => void;
    const a = task.answer;
    if (a.type === 'number') {
      const id = newId('ans');
      const input = h('input', { type: 'text', inputmode: 'decimal', id, class: 'num', 'aria-label': t('learn.answerAria') });
      check = () => {
        const v = parseNum(input.value);
        if (!Number.isFinite(v)) {
          feedback.textContent = t('learn.needNumber');
          feedback.dataset.kind = 'err';
          return;
        }
        record(a.check(v));
      };
      input.addEventListener('keydown', (e) => e.key === 'Enter' && check());
      answerUi = h('div', { class: 'row' }, input, h('span', { class: 'unit', text: a.unit }));
    } else if (a.type === 'choice') {
      const name = newId('ch');
      const radios = a.options.map((opt, i) => {
        const id = newId('opt');
        const input = h('input', { type: 'radio', name, id, value: String(i) });
        return { input, el: h('label', { class: 'radio', htmlFor: id }, input, h('span', { text: opt })) };
      });
      check = () => {
        const chosen = radios.findIndex((r) => r.input.checked);
        if (chosen < 0) {
          feedback.textContent = t('learn.needChoice');
          feedback.dataset.kind = 'err';
          return;
        }
        record(chosen === a.correct);
      };
      answerUi = h('div', { class: 'radios radios--col', role: 'radiogroup' }, ...radios.map((r) => r.el));
    } else {
      check = () => record(a.check(store.state));
      answerUi = h('p', { class: 'hint', text: t('learn.stateHint') });
    }

    refreshBadge();
    if (st()?.correct) explainEl.hidden = false;

    return h(
      'li',
      { class: 'learn__task' },
      h('h3', null, h('span', { class: 'learn__num', text: `${index + 1}.` }), task.title, badge),
      h('p', { class: 'learn__q', text: task.question }),
      task.setup ? button(t('learn.setup'), () => task.setup!({ store, actions }), { cls: 'btn--ghost', title: t('learn.setupTip') }) : null,
      answerUi,
      h(
        'div',
        { class: 'row row--wrap' },
        button(t('learn.check'), () => check(), { cls: 'btn--primary' }),
        button(t('learn.hint'), () => {
          hintEl.hidden = false;
          progress[task.id] = withHint(progress[task.id]);
          saveProgress(progress);
          updateScore();
        }),
      ),
      feedback,
      hintEl,
      explainEl,
    );
  };

  const render = () => {
    clear(list);
    TASKS.forEach((task, i) => list.append(renderTask(task, i)));
    updateScore();
  };

  const closeBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('learn.close'), title: t('learn.close'), text: '×' });
  const el = h(
    'aside',
    { class: 'learn', id: 'learn', 'aria-labelledby': 'learn-title', hidden: true },
    h('header', { class: 'learn__head' }, h('h2', { id: 'learn-title', tabindex: '-1', text: t('learn.title') }), closeBtn),
    h('p', { class: 'hint', text: t('learn.intro') }),
    score,
    list,
    h(
      'div',
      { class: 'row' },
      button(t('learn.reset'), () => {
        progress = {};
        saveProgress(progress);
        render();
      }, { cls: 'btn--danger' }),
    ),
  );

  const open = (v: boolean) => {
    const wasOpen = !el.hidden;
    el.hidden = !v;
    document.body.classList.toggle('learn-open', v);
    if (v) (el.querySelector('h2') as HTMLElement)?.focus?.();
    else if (wasOpen) opts.returnFocus?.()?.focus();
    window.dispatchEvent(new Event('resize'));
  };
  closeBtn.addEventListener('click', () => open(false));
  render();
  return { el, open, toggle: () => open(el.hidden !== false) };
}
