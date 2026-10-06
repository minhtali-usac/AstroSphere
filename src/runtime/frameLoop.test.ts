import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startFrameLoop, UI_TICK_MS } from './frameLoop';
import type { QualityController } from './quality';

// Môi trường thử là Node: giả lập rAF và document.hidden / visibilitychange.
let queue: ((t: number) => void)[] = [];
let listeners: (() => void)[] = [];
const doc = { hidden: false, addEventListener: (_: string, cb: () => void) => listeners.push(cb) };
const g = globalThis as unknown as Record<string, unknown>;

beforeEach(() => {
  queue = [];
  listeners = [];
  doc.hidden = false;
  g.document = doc;
  g.requestAnimationFrame = (cb: (t: number) => void) => queue.push(cb);
  g.cancelAnimationFrame = (id: number) => {
    queue[id - 1] = () => {};
  };
});
afterEach(() => {
  delete g.document;
  delete g.requestAnimationFrame;
  delete g.cancelAnimationFrame;
});

/** Chạy các callback rAF đang chờ tại thời điểm `t`. */
function step(t: number): void {
  const q = queue;
  queue = [];
  for (const cb of q) cb(t);
}

function fakeQuality() {
  const samples: number[] = [];
  let attached = 0;
  const q = {
    level: 0,
    auto: true,
    sample: (ms: number) => samples.push(ms),
    attach: (t: unknown[]) => (attached += t.length),
    restore() {},
    onChange: () => () => {},
  } as unknown as QualityController;
  return { q, samples, attachedCount: () => attached };
}

describe('startFrameLoop', () => {
  it('throttles UI ticks while playing and runs them every dirty frame while paused', () => {
    let playing = true;
    let ticks = 0;
    const loop = startFrameLoop({ animator: { tick() {} }, getViews: () => [], onUiTick: () => ticks++, isPlaying: () => playing });
    for (let i = 1; i <= 60; i++) {
      loop.markUiDirty();
      step(i * 16);
    }
    // ≈ 960 ms / 80 ms = 12 lần (cho phép lệch 1)
    expect(ticks).toBeLessThanOrEqual(Math.ceil(960 / UI_TICK_MS) + 1);
    expect(ticks).toBeGreaterThanOrEqual(10);
    playing = false;
    const before = ticks;
    for (let i = 61; i <= 70; i++) {
      loop.markUiDirty();
      step(i * 16);
    }
    expect(ticks - before).toBe(10);
  });

  it('stops requesting frames while the document is hidden and resumes on visible', () => {
    let draws = 0;
    startFrameLoop({ animator: { tick() {} }, getViews: () => [{ frame: () => (draws++, true) }], onUiTick() {}, isPlaying: () => true });
    step(16);
    expect(draws).toBe(1);
    doc.hidden = true;
    for (const l of listeners) l();
    step(32);
    step(48);
    expect(draws).toBe(1);
    expect(queue.length).toBe(0);
    doc.hidden = false;
    for (const l of listeners) l();
    step(64);
    expect(draws).toBe(2);
  });

  it('samples quality only for rendered, unsuspended frames and attaches views once', () => {
    const fq = fakeQuality();
    let render = true;
    const view = { frame: () => render, setQuality() {} };
    const loop = startFrameLoop({ animator: { tick() {} }, getViews: () => [view], onUiTick() {}, isPlaying: () => true, quality: fq.q });
    step(16);
    step(32);
    render = false;
    step(48);
    render = true;
    loop.suspend('hero', true);
    step(64);
    loop.suspend('hero', false);
    step(80);
    expect(fq.samples.length).toBe(3);
    expect(fq.attachedCount()).toBe(1);
    expect(loop.stats.samples).toBe(3);
  });
});
