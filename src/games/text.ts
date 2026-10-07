// Chữ của Thử thách SGK (src/i18n/games.vi.json) — chỉ phần tải lười của trò chơi nhập tệp này.

import strings from '../i18n/games.vi.json';

export const G = strings;

/** Thay {tham_số} trong chuỗi. */
export function fmt(str: string, params: Record<string, string | number> = {}): string {
  return str.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
}

/** Số thập phân kiểu Việt Nam (dấu phẩy). */
export function num(x: number, digits = 0): string {
  return x.toFixed(digits).replace('.', ',');
}
