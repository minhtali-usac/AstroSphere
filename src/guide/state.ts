// Usui-chan (redesign-2 R4): trạng thái lưu trong trình duyệt. Chỉ một cờ: đã chào lần đầu hay chưa.
// Đọc/ghi qua ui/storage.ts (luôn có try/catch); dữ liệu sai dạng coi như chưa chào.

import { isPlainObject, readJson, writeJson } from '../ui/storage';

export const GUIDE_KEY = 'astrosphere.guide.v1';

export interface GuideState {
  hello: boolean;
}

/** Dạng lưu hợp lệ: {hello: boolean}. */
export const isGuideState = (v: unknown): v is GuideState => isPlainObject(v) && typeof v.hello === 'boolean';

/** Usui-chan đã chào ở một lần mở trang trước chưa. */
export function helloSeen(): boolean {
  return readJson<GuideState>(GUIDE_KEY, isGuideState, { hello: false }).hello;
}

/** Ghi nhớ: đã chào. Ghi NGAY khi lời chào hiện ra, để tải lại trang không chào lần nữa. */
export function markHelloSeen(): void {
  writeJson(GUIDE_KEY, { hello: true } satisfies GuideState);
}
