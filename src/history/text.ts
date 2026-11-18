// Chữ của «Bầu trời xưa» (src/i18n/history.vi.json) — chỉ phần tải lười nhập tệp này.

import strings from '../i18n/history.vi.json';

export const H = strings;

/** Thay {tham_số} trong chuỗi. */
export function fmt(str: string, params: Record<string, string | number> = {}): string {
  return str.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
}

/** Số thập phân kiểu Việt Nam (dấu phẩy, dấu trừ thật). */
export function num(x: number, digits = 0): string {
  return x.toFixed(digits).replace('.', ',').replace('-', '−');
}
