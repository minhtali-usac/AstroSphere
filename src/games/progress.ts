// Lựa chọn của giáo viên và điểm tốt nhất của Thử thách SGK (localStorage `astrosphere.sgk.v1`, qua storage.ts).
// Tệp nhỏ, không kéo chữ hay mã trò chơi: USACodex nhập nó để hiện số hoạt động đã hoàn thành trên ô danh mục.

import { isPlainObject, readJson, writeJson } from '../ui/storage';

export const SGK_KEY = 'astrosphere.sgk.v1';

/** Thứ tự hiển thị: Bài 4 rồi Bài 5, theo thứ tự các mục trong SGK. */
export const GAME_IDS = ['dipper', 'polaris', 'quiz4', 'solar', 'sunpath', 'moon', 'venus', 'models', 'seasons', 'quiz5'] as const;
export type GameId = (typeof GAME_IDS)[number];

export interface SgkState {
  picked: string[];
  hints: boolean;
  shuffle: boolean;
  /** Số câu đố nhanh mỗi bài, 0 = tất cả. */
  quizCount: number;
  /** Điểm tốt nhất (phần trăm 0–100) theo hoạt động. */
  best: Record<string, number>;
}

export const DEFAULT_SGK: SgkState = { picked: [...GAME_IDS], hints: true, shuffle: true, quizCount: 5, best: {} };

export function isSgkState(v: unknown): v is SgkState {
  return (
    isPlainObject(v) &&
    Array.isArray(v.picked) &&
    v.picked.every((x) => typeof x === 'string') &&
    typeof v.hints === 'boolean' &&
    typeof v.shuffle === 'boolean' &&
    typeof v.quizCount === 'number' &&
    isPlainObject(v.best) &&
    Object.values(v.best).every((x) => typeof x === 'number')
  );
}

export function loadSgk(): SgkState {
  const s = readJson(SGK_KEY, isSgkState, DEFAULT_SGK);
  return { ...s, picked: s.picked.filter((id) => (GAME_IDS as readonly string[]).includes(id)), best: { ...s.best } };
}

export function saveSgk(s: SgkState): void {
  writeJson(SGK_KEY, s);
}

/** Số hoạt động đã chơi xong ít nhất một lần (có điểm tốt nhất > 0). */
export function completedCount(): number {
  const best = loadSgk().best;
  return GAME_IDS.filter((id) => (best[id] ?? 0) > 0).length;
}
