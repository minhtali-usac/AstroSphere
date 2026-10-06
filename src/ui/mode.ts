// Chế độ giao diện Cơ bản / Đầy đủ (redesign-2 R2).
//
// - Lần đầu vào trang (chưa lưu gì): Cơ bản.
// - Lựa chọn của người dùng được nhớ trong localStorage (`astrosphere.mode.v1`, qua storage.ts).
// - `?mode=simple|full` ghi đè cho một lần mở trang và KHÔNG được lưu.
// - `body.mode-simple` / `body.mode-full` phản chiếu store; CSS ẩn/hiện các phần còn lại.

import { t } from '../i18n';
import { isUiMode, type Actions, type Store, type UiMode } from '../state';
import { h } from './dom';
import { readJson, writeJson } from './storage';

export const MODE_STORAGE_KEY = 'astrosphere.mode.v1';
export const DEFAULT_UI_MODE: UiMode = 'simple';

/** Chế độ ghi đè từ địa chỉ trang (`?mode=…`), hoặc null nếu không có / không hợp lệ. */
export function urlUiMode(search: string): UiMode | null {
  try {
    const v = new URLSearchParams(search).get('mode');
    return isUiMode(v) ? v : null;
  } catch {
    return null;
  }
}

/** Thứ tự ưu tiên: địa chỉ trang → giá trị đã lưu (hợp lệ) → Cơ bản. */
export function resolveUiMode(search: string, stored: unknown): UiMode {
  return urlUiMode(search) ?? (isUiMode(stored) ? stored : DEFAULT_UI_MODE);
}

/** Đọc chế độ khi khởi động (an toàn khi bộ nhớ trình duyệt bị chặn). */
export function initialUiMode(): UiMode {
  let search = '';
  try {
    search = window.location.search;
  } catch {
    /* không có location: bỏ qua */
  }
  const stored = readJson<UiMode | null>(MODE_STORAGE_KEY, (v): v is UiMode | null => isUiMode(v), null);
  return resolveUiMode(search, stored);
}

/**
 * Đồng bộ chế độ: lớp trên <body>, ghi nhớ lựa chọn MỚI của người dùng (chế độ lúc khởi động — kể cả ghi đè từ
 * địa chỉ trang — không được ghi), và gọi `onChange` để main.ts dọn dẹp (thoát trình chiếu, đóng ngăn Ôn tập…).
 */
export function bindUiMode(store: Store, onChange: (mode: UiMode) => void): void {
  const apply = (m: UiMode) => {
    document.body.classList.toggle('mode-simple', m === 'simple');
    document.body.classList.toggle('mode-full', m === 'full');
  };
  apply(store.state.uiMode);
  store.subscribe((s, prev) => {
    if (s.uiMode === prev.uiMode) return;
    apply(s.uiMode);
    writeJson(MODE_STORAGE_KEY, s.uiMode);
    onChange(s.uiMode);
  });
}

/**
 * Công tắc phân đoạn "Cơ bản | Đầy đủ" trên thanh trên cùng: nhóm radio gốc (phím mũi tên đổi lựa chọn, do trình
 * duyệt xử lý; phím tắt toàn cục bỏ qua mũi tên trong [role=radiogroup]).
 */
export function modeSwitch(store: Store, actions: Actions): HTMLElement {
  const name = 'ui-mode';
  const inputs = new Map<UiMode, HTMLInputElement>();
  const option = (m: UiMode) => {
    const input = h('input', {
      type: 'radio',
      name,
      value: m,
      class: 'modeswitch__input',
      checked: store.state.uiMode === m,
      onchange: () => actions.setUiMode(m),
    });
    inputs.set(m, input);
    return h('label', { class: 'modeswitch__opt', title: t(`mode.${m}Tip`) }, input, h('span', { text: t(`mode.${m}`) }));
  };
  const el = h(
    'div',
    { class: 'modeswitch', role: 'radiogroup', 'aria-labelledby': 'modeswitch-label', title: t('mode.tip'), 'data-guide': 'mode' },
    h('span', { class: 'modeswitch__label', id: 'modeswitch-label', text: t('mode.label') }),
    option('simple'),
    option('full'),
  );
  store.subscribe((s, prev) => {
    if (s.uiMode === prev.uiMode) return;
    for (const [m, input] of inputs) if (input.checked !== (m === s.uiMode)) input.checked = m === s.uiMode;
  });
  return el;
}
