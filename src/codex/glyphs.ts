// Codex › biểu tượng nội tuyến (SVG, currentColor): một biểu tượng cho mỗi danh mục và ba dấu trạng thái của mục.
// Trạng thái không dựa vào màu: ổ khóa (chưa khám phá) · chấm đặc (mới) · dấu tích (đã đọc). Chữ đi kèm nằm ở
// .cdx-item__state (trình đọc màn hình đọc được cả khi chữ bị ẩn bằng mắt).

/** Trạng thái hiển thị của một mục. */
export type EntryState = 'locked' | 'new' | 'read';

const svg = (box: number, body: string, cls: string) =>
  `<svg class="${cls}" viewBox="0 0 ${box} ${box}" width="${box}" height="${box}" aria-hidden="true" focusable="false">${body}</svg>`;

const line = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

/** Biểu tượng danh mục (20 × 20): hình học tối giản, đọc được ở 16 px. */
const CATEGORY: Readonly<Record<string, string>> = {
  // Nền tảng: quả cầu với một vòng lớn
  basics: `<circle cx="10" cy="10" r="7.5" ${line}/><ellipse cx="10" cy="10" rx="7.5" ry="2.6" ${line}/>`,
  // Hệ tọa độ: một góc đo từ đường nằm ngang tới một điểm
  coords: `<path d="M2.5 16.5h15M2.5 16.5 14 5.5M8.5 16.5a6 6 0 0 0-1.6-4.1" ${line}/><circle cx="14.5" cy="5" r="1.8" fill="currentColor"/>`,
  // Mọc – lặn: nửa đĩa trên đường chân trời, mũi tên đi lên
  riseSet: `<path d="M2 15.5h16M5.5 15.5a4.5 4.5 0 0 1 9 0M10 2.5v5.5M7.6 4.9 10 2.5l2.4 2.4" ${line}/>`,
  // Mở rộng: hoàng đạo (sóng) cắt xích đạo trời (thẳng)
  extra: `<path d="M2 10h16" ${line} stroke-opacity=".55"/><path d="M2 10c2.6-6.5 5.4-6.5 8 0s5.4 6.5 8 0" ${line}/>`,
  // Sao sáng: sao bốn cánh
  starsCat: `<path d="M10 1.8 11.9 8.1 18.2 10 11.9 11.9 10 18.2 8.1 11.9 1.8 10 8.1 8.1Z" fill="currentColor"/>`,
  // Chòm sao: bốn sao nối nhau
  constellations: `<path d="M3 15 7.5 8.5 12.5 11 17 4" ${line}/><g fill="currentColor"><circle cx="3" cy="15" r="1.9"/><circle cx="7.5" cy="8.5" r="1.6"/><circle cx="12.5" cy="11" r="1.6"/><circle cx="17" cy="4" r="1.9"/></g>`,
  // Thiên thể sâu: thiên hà nhìn nghiêng
  deep: `<ellipse cx="10" cy="10" rx="8.2" ry="3.4" transform="rotate(-28 10 10)" ${line}/><ellipse cx="10" cy="10" rx="4.2" ry="1.7" transform="rotate(-28 10 10)" ${line} stroke-opacity=".6"/><circle cx="10" cy="10" r="1.5" fill="currentColor"/>`,
};

export function categoryGlyph(id: string): string {
  return svg(20, CATEGORY[id] ?? '', 'cdx-glyph');
}

export const hasCategoryGlyph = (id: string): boolean => id in CATEGORY;

/** Dấu trạng thái (12 × 12). */
const STATE: Readonly<Record<EntryState, string>> = {
  locked: `<path d="M3.9 5.6V4.2a2.1 2.1 0 0 1 4.2 0v1.4" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="2.4" y="5.4" width="7.2" height="5.4" rx="1.1" fill="currentColor"/>`,
  new: `<circle cx="6" cy="6" r="4.2" fill="currentColor"/>`,
  read: `<path d="M2.3 6.4 4.9 9l4.8-5.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
};

export function stateGlyph(state: EntryState): string {
  return svg(12, STATE[state], 'cdx-mark');
}

/**
 * Ổ khóa lớn cho khoảnh khắc "mở khóa" (game feel, 2026-10-05): quai (.cdx-unlock__shackle) tách riêng để CSS xoay
 * nó mở quanh chân trái, rồi cả ổ mờ đi. Chỉ trang trí: aria-hidden, dòng chữ "Đã mở khóa" mang nghĩa.
 */
export function unlockGlyph(): string {
  return svg(
    24,
    `<path class="cdx-unlock__shackle" d="M8 11V7.6a4 4 0 0 1 8 0V11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="4.8" y="10.4" width="14.4" height="10.2" rx="2.2" fill="currentColor"/><circle cx="12" cy="15.2" r="1.6" class="cdx-unlock__hole"/>`,
    'cdx-unlock__svg',
  );
}
