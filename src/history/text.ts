// Chữ của «Bầu trời xưa» (src/i18n/history.vi.json) — chỉ phần tải lười nhập tệp này.

import { DECIMAL, LANG } from '../i18n/locale';
import en from '../i18n/history.en.json';
import vi from '../i18n/history.vi.json';

// Cả hai ngôn ngữ nằm trong chunk tải lười (vài kB): top-level await ở đây làm gói khởi động bị chẻ nhỏ.
const strings: typeof vi = LANG === 'en' ? en : vi;

export const H = strings;

/** Thay {tham_số} trong chuỗi. */
export function fmt(str: string, params: Record<string, string | number> = {}): string {
  return str.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
}

/** Số thập phân kiểu Việt Nam (dấu phẩy, dấu trừ thật). */
export function num(x: number, digits = 0): string {
  return x.toFixed(digits).replace('.', DECIMAL).replace('-', '−');
}
