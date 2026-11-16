// «Bay vào vũ trụ» — phần tải ngay, giữ thật nhỏ: nút trên thanh trên cùng, hộp thoại toàn màn hình và openFlight().
// Cảnh 3D, dữ liệu (thị sai, ngoại hành tinh) và bảng điều khiển chỉ tải khi mở lần đầu (src/scene/flight/boot.ts).
//
// Hộp thoại là <dialog> gốc: trình duyệt tự giữ tiêu điểm bên trong và đóng bằng Esc. Esc lần lượt: dừng chuyến bay
// đang diễn ra → đóng chế độ bay. Khi đóng: hủy renderer, tiếp tục vẽ hai khung nhìn chính, trả tiêu điểm về nút đã mở.

import { t } from '../i18n';
import type { Store } from '../state';
import { button, h, setText } from './dom';
import { orbitIcon } from './icons';

/** Nơi bay tới ngay khi mở: một sao trong danh mục, Mặt Trời, hoặc không (bắt đầu phía trên người quan sát). */
export type FlightTarget = { kind: 'catalog'; index: number } | { kind: 'sun' } | null;

export interface FlightSession {
  /** Xử lý Esc bên trong chế độ bay; true nếu đã dùng phím (không đóng hộp thoại). */
  escape(): boolean;
  flyTo(target: FlightTarget): void;
  dispose(): void;
}

interface FlightContext {
  store: Store;
  /** Tạm dừng / tiếp tục vẽ hai khung nhìn chính khi chế độ bay mở / đóng. */
  suspend(on: boolean): void;
}

let ctx: FlightContext | null = null;
let dlg: HTMLDialogElement | null = null;
let host: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let session: FlightSession | null = null;
let opener: HTMLElement | null = null;

export function initFlight(c: FlightContext): void {
  ctx = c;
}

export const isFlightOpen = (): boolean => !!dlg?.open;

function buildDialog(): HTMLDialogElement {
  statusEl = h('p', { class: 'flight__status', role: 'status' });
  host = h('div', { class: 'flight__view', role: 'img', 'aria-label': t('flight.viewAria'), 'data-guide': 'flightView' });
  const closeBtn = button(t('flight.close'), () => dlg?.close(), { cls: 'btn--top flight__close', icon: '←', title: t('flight.closeTip'), guide: 'flightClose' });
  const d = h(
    'dialog',
    { id: 'dlg-flight', class: 'flight', 'aria-labelledby': 'flight-title' },
    h(
      'header',
      { class: 'flight__head' },
      h('h2', { id: 'flight-title', class: 'flight__title', text: t('flight.title') }),
      h('p', { class: 'flight__hint', text: t('flight.hint') }),
      closeBtn,
    ),
    host,
    statusEl,
  );
  d.addEventListener('cancel', (e) => {
    if (session?.escape()) e.preventDefault();
  });
  d.addEventListener('close', () => {
    session?.dispose();
    session = null;
    ctx?.suspend(false);
    document.body.classList.remove('flight-open');
    const back = opener?.isConnected ? opener : document.querySelector<HTMLElement>('.btn--top-flight');
    back?.focus();
  });
  document.body.append(d);
  return d;
}

export function openFlight(target: FlightTarget = null): void {
  if (!ctx) return;
  dlg ??= buildDialog();
  if (dlg.open) {
    session?.flyTo(target);
    return;
  }
  const a = document.activeElement;
  opener = a instanceof HTMLElement && a !== document.body ? a : null;
  dlg.showModal();
  document.body.classList.add('flight-open');
  ctx.suspend(true);
  setText(statusEl!, t('flight.wait'));
  statusEl!.hidden = false;
  const c = ctx;
  const d = dlg;
  void import('../scene/flight/boot')
    .then((m) => m.startFlight({ dialog: d, host: host!, store: c.store, target }))
    .then((s) => {
      // Người dùng đã đóng hộp thoại trong lúc đang tải: hủy ngay.
      if (!d.open) {
        s.dispose();
        return null;
      }
      session = s;
      statusEl!.hidden = true;
      return s;
    })
    .catch((err: unknown) => {
      console.error(err);
      setText(statusEl!, t('flight.failed'));
      return null;
    });
}

/** Nút trên thanh trên cùng (ẩn ở chế độ Cơ bản). */
export function flightButton(): HTMLButtonElement {
  const b = button(t('top.flight'), () => openFlight(), { cls: 'btn--top btn--top-aux btn--top-flight', icon: '◎', title: t('top.flightTip'), guide: 'flight' });
  b.querySelector('.btn__icon')?.replaceChildren(orbitIcon());
  return b;
}
