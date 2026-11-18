// «Bầu trời xưa» — phần tải ngay, giữ thật nhỏ: nút trên thanh trên cùng, hộp thoại toàn màn hình và openHistory().
// Bầu trời, dữ liệu chuyển động riêng và lõi tính toán thiên thể (astronomy-engine) chỉ tải khi mở lần đầu
// (src/history/index.ts).
//
// Hộp thoại là <dialog> gốc: trình duyệt tự giữ tiêu điểm bên trong và đóng bằng Esc. Esc lần lượt: dừng chạy thời gian
// đang diễn ra → đóng. Khi đóng: tiếp tục vẽ hai khung nhìn chính, trả tiêu điểm về nút đã mở.

import { t } from '../i18n';
import type { Guide } from '../guide/boot';
import type { Store } from '../state';
import { button, h, setText } from './dom';
import { historyIcon } from './icons';

export interface HistorySessionLike {
  escape(): boolean;
  dispose(): void;
}

interface HistoryContext {
  store: Store;
  /** Usui-chan: vào hộp thoại để chế độ giải thích dùng được trong lúc xem bầu trời xưa. */
  guide: Guide;
  /** Tạm dừng / tiếp tục vẽ hai khung nhìn chính khi hộp thoại mở / đóng. */
  suspend(on: boolean): void;
}

let ctx: HistoryContext | null = null;
let dlg: HTMLDialogElement | null = null;
let host: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let session: HistorySessionLike | null = null;
let opener: HTMLElement | null = null;

export function initHistory(c: HistoryContext): void {
  ctx = c;
}

export const isHistoryOpen = (): boolean => !!dlg?.open;

function buildDialog(): HTMLDialogElement {
  statusEl = h('p', { class: 'hsky-dlg__status', role: 'status' });
  host = h('div', { class: 'hsky-dlg__body' });
  const closeBtn = button(t('history.close'), () => dlg?.close(), { cls: 'btn--top hsky-dlg__close', icon: '←', title: t('history.closeTip'), guide: 'historyClose' });
  const d = h(
    'dialog',
    { id: 'dlg-history', class: 'hsky-dlg', 'aria-labelledby': 'hsky-title' },
    h(
      'header',
      { class: 'hsky-dlg__head' },
      h('h2', { id: 'hsky-title', class: 'hsky-dlg__title', text: t('history.title') }),
      h('p', { class: 'hsky-dlg__hint', text: t('history.hint') }),
      closeBtn,
    ),
    host,
    statusEl,
  );
  d.addEventListener('cancel', (e) => {
    // Esc: dừng chạy thời gian → thoát chế độ giải thích của Usui-chan → đóng.
    if (session?.escape() || ctx?.guide.escape()) e.preventDefault();
  });
  d.addEventListener('close', () => {
    session?.dispose();
    session = null;
    ctx?.guide.close();
    ctx?.guide.dock(null);
    ctx?.suspend(false);
    document.body.classList.remove('history-open');
    const back = opener?.isConnected ? opener : document.querySelector<HTMLElement>('.btn--top-history');
    back?.focus();
  });
  document.body.append(d);
  return d;
}

export function openHistory(): void {
  if (!ctx) return;
  dlg ??= buildDialog();
  if (dlg.open) return;
  const a = document.activeElement;
  opener = a instanceof HTMLElement && a !== document.body ? a : null;
  dlg.showModal();
  ctx.guide.dock(dlg);
  document.body.classList.add('history-open');
  ctx.suspend(true);
  setText(statusEl!, t('history.wait'));
  statusEl!.hidden = false;
  const c = ctx;
  const d = dlg;
  void import('../history')
    .then((m) => {
      // Người dùng đã đóng hộp thoại trong lúc đang tải: không dựng gì cả.
      if (!d.open) return null;
      const s = m.startHistory({ dialog: d, host: host!, store: c.store });
      session = s;
      statusEl!.hidden = true;
      return s;
    })
    .catch((err: unknown) => {
      console.error(err);
      setText(statusEl!, t('history.failed'));
      return null;
    });
}

/** Nút trên thanh trên cùng. */
export function historyButton(): HTMLButtonElement {
  const b = button(t('top.history'), () => openHistory(), { cls: 'btn--top btn--top-aux btn--top-history', icon: '⌛', title: t('top.historyTip'), guide: 'history' });
  b.querySelector('.btn__icon')?.replaceChildren(historyIcon());
  return b;
}
