// Chất lượng hiển thị thích ứng: tự hạ độ phân giải / số sao nền khi khung hình chậm.
//
// Quy tắc (docs/redesign/perf.md):
//  - Bỏ qua 4 s đầu kể từ khung hình đầu tiên được đo (biên dịch shader, tải dữ liệu).
//  - Đo theo cửa sổ 90 khung hình đã vẽ. Hai cửa sổ liên tiếp có trung bình > 28 ms (≈ dưới 36 FPS)
//    → hạ một mức, rồi chờ ít nhất 5 s trước lần hạ kế tiếp. Không bao giờ tự nâng lại.
//  - L1: trần tỉ lệ điểm ảnh 1. L2: thêm giới hạn sao nền cấp ≤ 4,0.
//  - restore(): về L0, tắt tự động trong phiên (sessionStorage) và báo onChange(0, 'user').
//  - Tắt khi URL có ?quality=fixed hoặc người dùng đã khôi phục trong phiên này.

import { readJson, writeJson } from '../ui/storage';

export type QualityLevel = 0 | 1 | 2;

export interface QualitySettings {
  /** Trần tỉ lệ điểm ảnh của renderer. */
  pixelRatioCap: number;
  /** Chỉ vẽ sao nền có cấp sao ≤ giá trị này; null = vẽ tất cả. */
  catalogMagLimit: number | null;
}

export interface QualityTarget {
  setQuality(q: QualitySettings): void;
}

export interface QualityController {
  readonly level: QualityLevel;
  readonly auto: boolean;
  /** Ghi nhận thời gian một khung hình đã vẽ (ms). */
  sample(frameMs: number): void;
  attach(targets: QualityTarget[]): void;
  /** Trở lại chất lượng đầy đủ; tắt tự động trong phiên này. */
  restore(): void;
  onChange(cb: (level: QualityLevel, cause: 'auto' | 'user') => void): () => void;
}

export const QUALITY_LEVELS: Record<QualityLevel, QualitySettings> = {
  0: { pixelRatioCap: 2, catalogMagLimit: null },
  1: { pixelRatioCap: 1, catalogMagLimit: null },
  2: { pixelRatioCap: 1, catalogMagLimit: 4.0 },
};

/** Khóa sessionStorage (AGENTS.md › Browser storage): người dùng đã khôi phục chất lượng đầy đủ. */
export const QUALITY_STORAGE_KEY = 'astrosphere.quality.v1';

export const QUALITY_TUNING = {
  warmupMs: 4000,
  windowFrames: 90,
  slowFrameMs: 28,
  badWindows: 2,
  cooldownMs: 5000,
  /** Một khung hình đơn lẻ được tính tối đa chừng này (tránh một lần khựng làm hỏng cả cửa sổ). */
  maxSampleMs: 250,
} as const;

export interface QualityOptions {
  /** Tắt tự động (mặc định: theo URL ?quality=fixed và sessionStorage). */
  disabled?: boolean;
  /** Đồng hồ (ms) — để kiểm thử. */
  now?: () => number;
}

const isManual = (v: unknown): v is 'manual' | null => v === 'manual';

function disabledByEnvironment(): boolean {
  try {
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('quality') === 'fixed') return true;
  } catch {
    /* không đọc được URL: coi như không tắt */
  }
  if (typeof window === 'undefined') return false;
  return readJson<'manual' | null>(QUALITY_STORAGE_KEY, isManual, null, 'session') === 'manual';
}

export function createQuality(opts: QualityOptions = {}): QualityController {
  const now = opts.now ?? (() => performance.now());
  const listeners = new Set<(level: QualityLevel, cause: 'auto' | 'user') => void>();
  let targets: QualityTarget[] = [];
  let level: QualityLevel = 0;
  let auto = !(opts.disabled ?? disabledByEnvironment());
  let firstAt = -1;
  let lastStepAt = -Infinity;
  let winSum = 0;
  let winCount = 0;
  let bad = 0;

  const apply = () => {
    const q = QUALITY_LEVELS[level];
    for (let i = 0; i < targets.length; i++) targets[i].setQuality(q);
  };
  const emit = (cause: 'auto' | 'user') => {
    for (const cb of listeners) cb(level, cause);
  };
  const resetWindow = () => {
    winSum = 0;
    winCount = 0;
  };

  return {
    get level() {
      return level;
    },
    get auto() {
      return auto;
    },
    sample(frameMs: number) {
      if (!auto || level >= 2 || !(frameMs >= 0)) return;
      const t = now();
      if (firstAt < 0) firstAt = t;
      if (t - firstAt < QUALITY_TUNING.warmupMs) return;
      winSum += Math.min(frameMs, QUALITY_TUNING.maxSampleMs);
      winCount++;
      if (winCount < QUALITY_TUNING.windowFrames) return;
      const avg = winSum / winCount;
      resetWindow();
      bad = avg > QUALITY_TUNING.slowFrameMs ? bad + 1 : 0;
      if (bad < QUALITY_TUNING.badWindows || t - lastStepAt < QUALITY_TUNING.cooldownMs) return;
      bad = 0;
      lastStepAt = t;
      level = (level + 1) as QualityLevel;
      apply();
      emit('auto');
    },
    attach(next: QualityTarget[]) {
      targets = next.slice();
      apply();
    },
    restore() {
      auto = false;
      writeJson(QUALITY_STORAGE_KEY, 'manual', 'session');
      bad = 0;
      resetWindow();
      level = 0;
      apply();
      emit('user');
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
