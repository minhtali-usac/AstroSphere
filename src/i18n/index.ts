// Bảng chuỗi giao diện. Toàn bộ chữ hiển thị lấy từ vi.json / en.json (cùng bộ khóa).
//
// Chỉ bảng của ngôn ngữ đang dùng được tải: src/boot.ts gọi loadDictionary() TRƯỚC khi nhập phần còn lại của ứng
// dụng. Không dùng top-level await ở đây: nó làm bundler chẻ nhỏ gói khởi động. Chữ của Trợ giúp, Giới thiệu và
// Danh mục thiên thể (dialogs.*.json) đi cùng chunk hộp thoại và được ghép vào bằng addStrings().

import { LANG } from './locale';

type Dict = { [k: string]: string | string[] | Dict };

const dict: Dict = {};

export function addStrings(more: object): void {
  Object.assign(dict, more);
}

export async function loadDictionary(): Promise<void> {
  addStrings((await (LANG === 'en' ? import('./en.json') : import('./vi.json'))).default);
}

function lookup(key: string): string | string[] | Dict | undefined {
  let cur: string | string[] | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) cur = cur[part];
    else return undefined;
  }
  return cur;
}

/** Lấy chuỗi theo khóa, thay thế {tham_số}. */
export function t(key: string, params?: Record<string, string | number>): string {
  const v = lookup(key);
  if (typeof v !== 'string') {
    if (import.meta.env?.DEV) console.warn(`[i18n] thiếu khóa: ${key}`);
    return key;
  }
  return params ? v.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)) : v;
}

/** Lấy mảng chuỗi (ví dụ các đoạn hướng dẫn). */
export function tList(key: string): string[] {
  const v = lookup(key);
  return Array.isArray(v) ? v : [];
}
