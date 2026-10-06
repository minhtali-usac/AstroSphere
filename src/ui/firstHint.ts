// Gợi ý thao tác: MỘT dòng chú thích nằm dưới khung nhìn chính (không phải lớp nổi che cảnh — review-1 B4, E3).
// Dòng này luôn nhỏ, màu phụ (review-2 A2: không ngang hàng với dòng ý chính φ = độ cao thiên cực). Lớp `is-new`
// đánh dấu "chưa tương tác lần nào": trên điện thoại gợi ý chỉ hiện khi còn `is-new`. Sau lần đầu người dùng kéo
// hoặc bấm vào một khung nhìn 3D (đã làm đúng điều gợi ý) trạng thái được nhớ (`astrosphere.hint.v1`).

import { readJson, writeJson } from './storage';

export const HINT_KEY = 'astrosphere.hint.v1';

const isTrue = (v: unknown): v is boolean => v === true;

export function hintSeen(): boolean {
  return readJson(HINT_KEY, isTrue, false);
}

/**
 * `caption`: dòng gợi ý dưới khung nhìn. `canvases`: chạm vào một trong các vùng này = đã hiểu gợi ý.
 * Lớp `is-new` giữ tới lần tương tác đầu tiên (điện thoại: gợi ý chỉ hiện khi còn lớp này).
 */
export function bindHintCaption(caption: HTMLElement, canvases: HTMLElement[]): void {
  if (hintSeen()) return;
  caption.classList.add('is-new');
  const done = () => {
    writeJson(HINT_KEY, true);
    caption.classList.remove('is-new');
    for (const c of canvases) c.removeEventListener('pointerdown', done);
  };
  for (const c of canvases) c.addEventListener('pointerdown', done);
}
