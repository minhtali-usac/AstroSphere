import { afterEach, describe, expect, it } from 'vitest';
import vi from '../i18n/vi.json';
import { DEFAULT_FOCUS, FOCUS_STORAGE_KEY, isFocusState, readFocusState } from './focusLayout';

type Dict = { [k: string]: unknown };
const has = (key: string): boolean => {
  let cur: unknown = vi;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Dict)) cur = (cur as Dict)[part];
    else return false;
  }
  return typeof cur === 'string';
};

/** Cửa sổ giả (môi trường kiểm thử là Node) với sessionStorage trong bộ nhớ. */
function fakeWindow(stored?: string, throwing = false) {
  const data = new Map<string, string>();
  if (stored !== undefined) data.set(FOCUS_STORAGE_KEY, stored);
  const sessionStorage = {
    getItem: (k: string) => {
      if (throwing) throw new Error('blocked');
      return data.get(k) ?? null;
    },
    setItem: (k: string, v: string) => void data.set(k, v),
  };
  (globalThis as Dict).window = { sessionStorage };
}

afterEach(() => {
  delete (globalThis as Dict).window;
});

describe('Bố cục tập trung (Đầy đủ, màn hình rộng)', () => {
  it('mặc định cả dải số liệu và bảng điều khiển đều đóng', () => {
    expect(DEFAULT_FOCUS).toEqual({ data: false, panels: false });
    fakeWindow();
    expect(readFocusState()).toEqual(DEFAULT_FOCUS);
  });

  it('đọc lại trạng thái hợp lệ đã lưu trong phiên', () => {
    fakeWindow(JSON.stringify({ data: true, panels: false }));
    expect(readFocusState()).toEqual({ data: true, panels: false });
  });

  it('bỏ qua dữ liệu hỏng, sai dạng hoặc bộ nhớ bị chặn', () => {
    for (const bad of ['{', '[]', '{"data":1,"panels":true}', '{"data":true}', 'null']) {
      fakeWindow(bad);
      expect(readFocusState(), bad).toEqual(DEFAULT_FOCUS);
    }
    fakeWindow('{"data":true,"panels":true}', true);
    expect(readFocusState()).toEqual(DEFAULT_FOCUS);
  });

  it('kiểu dữ liệu được kiểm chặt', () => {
    expect(isFocusState({ data: false, panels: true })).toBe(true);
    expect(isFocusState({ data: 'yes', panels: true })).toBe(false);
    expect(isFocusState(null)).toBe(false);
  });

  it('có đủ chuỗi giao diện cho hai nút', () => {
    for (const k of ['focus.data', 'focus.dataTip', 'focus.panels', 'focus.panelsTip', 'guide.tip.focusData', 'guide.tip.focusPanels']) expect(has(k), k).toBe(true);
  });
});
