import { describe, expect, it } from 'vitest';
import { createQuality, QUALITY_LEVELS, QUALITY_TUNING, type QualityLevel, type QualitySettings } from './quality';

function rig() {
  let t = 0;
  const q = createQuality({ disabled: false, now: () => t });
  const applied: QualitySettings[] = [];
  const changes: [QualityLevel, string][] = [];
  q.attach([{ setQuality: (s) => applied.push(s) }]);
  q.onChange((l, c) => changes.push([l, c]));
  /** n khung hình, mỗi khung `ms` mili giây. */
  const run = (n: number, ms: number, clockStep = ms) => {
    for (let i = 0; i < n; i++) {
      t += clockStep;
      q.sample(ms);
    }
  };
  return { q, applied, changes, run, advance: (ms: number) => (t += ms) };
}

const W = QUALITY_TUNING.windowFrames;

describe('adaptive quality', () => {
  it('applies the current level on attach', () => {
    const { applied } = rig();
    expect(applied).toEqual([QUALITY_LEVELS[0]]);
  });

  it('ignores the warm-up period', () => {
    const { q, run } = rig();
    run(Math.floor(QUALITY_TUNING.warmupMs / 50) - 1, 50); // < 4 s of very slow frames
    expect(q.level).toBe(0);
  });

  it('steps down one level after two slow windows, with a cooldown, and never steps up', () => {
    const { q, run, changes, applied } = rig();
    run(1, 16);
    run(Math.ceil(QUALITY_TUNING.warmupMs / 16), 16); // past warm-up, fast
    expect(q.level).toBe(0);
    run(W, 40);
    expect(q.level).toBe(0); // one slow window is not enough
    run(W, 40);
    expect(q.level).toBe(1);
    expect(changes).toEqual([[1, 'auto']]);
    expect(applied.at(-1)).toEqual(QUALITY_LEVELS[1]);
    // Two more slow windows, but 2 × 90 × 20 ms = 3,6 s < 5 s cooldown
    run(2 * W, 20);
    run(2 * W, 29);
    expect(q.level).toBe(2);
    expect(applied.at(-1)?.catalogMagLimit).toBe(4.0);
    // Fast frames never raise the level automatically
    run(10 * W, 5);
    expect(q.level).toBe(2);
  });

  it('respects the cooldown between steps', () => {
    const { q, run, advance } = rig();
    run(1, 16);
    advance(QUALITY_TUNING.warmupMs);
    run(2 * W, 40);
    expect(q.level).toBe(1);
    // Two more slow windows reported within 1 s of the last step: held back by the 5 s cooldown.
    run(2 * W, 40, 1000 / (2 * W));
    expect(q.level).toBe(1);
    // Once the cooldown has passed, the next slow window completes the streak.
    advance(QUALITY_TUNING.cooldownMs);
    run(W, 40, 1);
    expect(q.level).toBe(2);
  });

  it('a fast window resets the slow streak', () => {
    const { q, run } = rig();
    run(Math.ceil(QUALITY_TUNING.warmupMs / 16) + 1, 16);
    run(W, 40);
    run(W, 16);
    run(W, 40);
    expect(q.level).toBe(0);
  });

  it('restore() returns to full quality, disables auto and reports a user change', () => {
    const { q, run, changes, applied } = rig();
    run(Math.ceil(QUALITY_TUNING.warmupMs / 16) + 1, 16);
    run(2 * W, 40);
    expect(q.level).toBe(1);
    q.restore();
    expect(q.level).toBe(0);
    expect(q.auto).toBe(false);
    expect(changes.at(-1)).toEqual([0, 'user']);
    expect(applied.at(-1)).toEqual(QUALITY_LEVELS[0]);
    run(10 * W, 60);
    expect(q.level).toBe(0);
  });

  it('can be disabled', () => {
    let t = 0;
    const q = createQuality({ disabled: true, now: () => (t += 100) });
    for (let i = 0; i < 2000; i++) q.sample(100);
    expect(q.auto).toBe(false);
    expect(q.level).toBe(0);
  });

  it('works with no arguments outside a browser', () => {
    const q = createQuality();
    expect(q.level).toBe(0);
    expect(q.auto).toBe(true);
  });
});
