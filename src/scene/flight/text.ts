// Chữ của «Bay vào vũ trụ» (src/i18n/flight.vi.json) — chỉ chunk tải lười của chế độ bay nhập tệp này, để các chuỗi
// không nằm trong gói khởi động. Các chuỗi cần có trước khi chunk tải (nút, tiêu đề hộp thoại, lời giải thích của
// Usui-chan) vẫn ở vi.json.

import strings from '../../i18n/flight.vi.json';

type Dict = { [k: string]: string | Dict };
const dict = strings as unknown as Dict;

/** Lấy chuỗi theo khóa (vd. 'row.radius'), thay {tham_số}. Khóa thiếu trả về chính khóa. */
export function ft(key: string, params?: Record<string, string | number>): string {
  let cur: string | Dict | undefined = dict;
  for (const part of key.split('.')) cur = cur && typeof cur === 'object' ? cur[part] : undefined;
  if (typeof cur !== 'string') return key;
  return params ? cur.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`)) : cur;
}
