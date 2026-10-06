// Vòng lặp khung hình: tiến hoạt ảnh, vẽ các khung nhìn và cập nhật giao diện DOM.
//
// Ngân sách (AGENTS.md › Performance budgets):
//  - Thẻ trình duyệt bị ẩn → hủy rAF hoàn toàn (không tiến hoạt ảnh, không vẽ).
//  - Khi đang chạy, DOM chỉ được ghi tối đa mỗi UI_TICK_MS (≈ 12 Hz); khi dừng, ghi ngay ở khung "bẩn".
//  - Bộ đo chất lượng chỉ nhận khung hình có vẽ thật, khi trang hiển thị và không tạm dừng.

import type { QualityController, QualityTarget } from './quality';

export interface FrameView {
  /** Vẽ nếu cần; trả về true nếu đã vẽ. */
  frame(): boolean | void;
}

export interface FrameLoopOptions {
  animator: { tick(dt: number): void };
  /** Danh sách khung nhìn hiện có ([] cho tới khi cảnh 3D tải xong). */
  getViews(): readonly FrameView[];
  /** Cập nhật DOM (bảng số liệu, thẻ thông tin…) — chỉ gọi khi giao diện "bẩn". */
  onUiTick(): void;
  isPlaying(): boolean;
  quality?: QualityController;
}

export interface FrameLoopStats {
  frames: number;
  renders: number;
  uiTicks: number;
  /** Số khung hình đã đưa vào bộ đo chất lượng. */
  samples: number;
}

export interface FrameLoop {
  markUiDirty(): void;
  /** Tạm dừng vẽ 3D vì một lý do (vd. màn hình mở đầu che khung nhìn). */
  suspend(reason: string, on: boolean): void;
  readonly stats: FrameLoopStats;
}

/** Khoảng cách tối thiểu giữa hai lần cập nhật DOM khi đang chạy hoạt ảnh (≈ 12 Hz). */
export const UI_TICK_MS = 80;

const isHidden = (): boolean => typeof document !== 'undefined' && document.hidden === true;

function isQualityTarget(v: FrameView): v is FrameView & QualityTarget {
  return typeof (v as Partial<QualityTarget>).setQuality === 'function';
}

export function startFrameLoop(o: FrameLoopOptions): FrameLoop {
  const stats: FrameLoopStats = { frames: 0, renders: 0, uiTicks: 0, samples: 0 };
  const suspended = new Set<string>();
  let uiDirty = true;
  let last = performance.now();
  let lastUi = -Infinity;
  let raf = 0;
  let attached = false;

  function loop(now: number): void {
    raf = 0;
    const ms = now - last;
    const dt = Math.min(0.1, Math.max(0, ms / 1000));
    last = now;
    stats.frames++;
    o.animator.tick(dt);

    const views = o.getViews();
    if (!attached && views.length > 0) {
      // Lần đầu có khung nhìn (cảnh 3D vừa tải xong): giao chúng cho bộ điều khiển chất lượng.
      attached = true;
      o.quality?.attach(views.filter(isQualityTarget));
    }
    let rendered = false;
    if (suspended.size === 0) {
      for (let i = 0; i < views.length; i++) {
        if (views[i].frame()) {
          stats.renders++;
          rendered = true;
        }
      }
    }
    if (rendered && o.quality && !isHidden()) {
      stats.samples++;
      o.quality.sample(ms);
    }

    if (uiDirty && (!o.isPlaying() || now - lastUi >= UI_TICK_MS)) {
      uiDirty = false;
      lastUi = now;
      stats.uiTicks++;
      o.onUiTick();
    }
    if (!isHidden()) raf = requestAnimationFrame(loop);
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        // Bỏ qua khoảng thời gian đã trôi khi ẩn: khung đầu tiên có dt ≈ 0.
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    });
  }
  if (!isHidden()) raf = requestAnimationFrame(loop);

  return {
    markUiDirty: () => {
      uiDirty = true;
    },
    suspend: (reason, on) => {
      if (on) suspended.add(reason);
      else suspended.delete(reason);
    },
    stats,
  };
}
