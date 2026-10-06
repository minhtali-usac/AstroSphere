// Bố cục tập trung của chế độ Đầy đủ trên màn hình rộng (quyết định của chủ dự án 2026-10-05,
// docs/redesign-2/focus-layout.md).
//
// - Giản đồ chân trời chiếm phần lớn màn hình; dải số liệu và bảng điều khiển nằm sau hai nút bật/tắt.
// - Dải số liệu thu gọn vẫn giữ φ và độ cao thiên cực (đẳng thức cốt lõi luôn thấy được), cùng LST.
// - Trạng thái mở/đóng ghi trong sessionStorage (`astrosphere.focus.v1`), qua storage.ts.
// - `body.focus-data-open` / `body.focus-panels-open` phản chiếu trạng thái; CSS chỉ dùng chúng trong
//   `@media (min-width: 1101px)` ở chế độ Đầy đủ, ngoài trình chiếu. Ở mọi chỗ khác hai nút ẩn và hai vùng hiện như cũ.

import { t } from '../i18n';
import { guide, h } from './dom';
import { chevronIcon } from './icons';
import { isPlainObject, readJson, writeJson } from './storage';

export const FOCUS_STORAGE_KEY = 'astrosphere.focus.v1';

/** Vùng nào đang mở. Mặc định cả hai đóng: giản đồ chân trời được nhiều chỗ nhất. */
export interface FocusState {
  data: boolean;
  panels: boolean;
}

export const DEFAULT_FOCUS: FocusState = { data: false, panels: false };

export const isFocusState = (v: unknown): v is FocusState =>
  isPlainObject(v) && typeof v.data === 'boolean' && typeof v.panels === 'boolean';

/** Trạng thái đã lưu trong phiên (sessionStorage); thiếu, hỏng hoặc bị chặn → cả hai đóng. */
export function readFocusState(): FocusState {
  return { ...readJson(FOCUS_STORAGE_KEY, isFocusState, DEFAULT_FOCUS, 'session') };
}

/** Bề rộng tối thiểu của bố cục tập trung (khớp với @media trong styles.css). */
export const FOCUS_MIN_WIDTH = 1101;

type Area = keyof FocusState;

const BODY_CLASS: Record<Area, string> = { data: 'focus-data-open', panels: 'focus-panels-open' };

/**
 * Hai nút bật/tắt (44 px, aria-expanded/aria-controls) cho dải số liệu và bảng điều khiển.
 * `onChange` chạy sau mỗi lần đổi (ghi bù số liệu cho vùng vừa hiện).
 */
export function focusLayout(opts: { data: HTMLElement; panels: HTMLElement; onChange: () => void }) {
  const state = readFocusState();

  const toggle = (area: Area, label: string, tip: string, controls: HTMLElement) =>
    h(
      'button',
      {
        type: 'button',
        class: `focus-toggle focus-toggle--${area}`,
        'aria-controls': controls.id,
        title: tip,
        onclick: () => set(area, !state[area]),
      },
      h('span', { class: 'focus-toggle__text', text: label }),
      chevronIcon(),
    ) as HTMLButtonElement;

  const buttons: Record<Area, HTMLButtonElement> = {
    data: guide('focusData', toggle('data', t('focus.data'), t('focus.dataTip'), opts.data)),
    panels: guide('focusPanels', toggle('panels', t('focus.panels'), t('focus.panelsTip'), opts.panels)),
  };

  function apply(area: Area): void {
    buttons[area].setAttribute('aria-expanded', String(state[area]));
    document.body.classList.toggle(BODY_CLASS[area], state[area]);
  }

  function set(area: Area, open: boolean): void {
    if (state[area] === open) return;
    state[area] = open;
    apply(area);
    writeJson(FOCUS_STORAGE_KEY, state, 'session');
    opts.onChange();
  }

  apply('data');
  apply('panels');

  /** Dải dưới khung nhìn: [Số liệu] dải số liệu … [Bảng điều khiển]. Ngoài bố cục tập trung: display: contents. */
  const bar = h('div', { class: 'focusbar' }, buttons.data, opts.data, buttons.panels);

  return {
    bar,
    buttons,
    isOpen: (area: Area) => state[area],
    set,
  };
}

