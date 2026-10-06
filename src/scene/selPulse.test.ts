import { describe, expect, it } from 'vitest';
import { SEL_PULSE_MS, SEL_PULSE_OPACITY, SEL_PULSE_SCALE, selPulseAmount } from './selPulse';

describe('selection-ring pulse (owner decision 2026-10-05)', () => {
  it('rests at 0 before, at and after the ends', () => {
    for (const u of [-1, 0, 1, 1.5, Number.NaN]) expect(selPulseAmount(u)).toBe(0);
  });

  it('peaks once at 1 and never leaves [0, 1] (no bounce)', () => {
    let peak = 0;
    let peakAt = 0;
    for (let i = 0; i <= 1000; i++) {
      const a = selPulseAmount(i / 1000);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      if (a > peak) {
        peak = a;
        peakAt = i / 1000;
      }
    }
    expect(peak).toBeCloseTo(1, 3);
    expect(peakAt).toBeGreaterThan(0.2);
    expect(peakAt).toBeLessThan(0.4);
  });

  it('rises, then only falls (one pulse, monotonic each side)', () => {
    let prev = 0;
    let falling = false;
    for (let i = 1; i < 1000; i++) {
      const a = selPulseAmount(i / 1000);
      if (a < prev) falling = true;
      if (falling) expect(a).toBeLessThanOrEqual(prev);
      else expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });

  it('eases out: the settle phase slows as it arrives', () => {
    const early = selPulseAmount(0.35) - selPulseAmount(0.4);
    const late = selPulseAmount(0.9) - selPulseAmount(0.95);
    expect(early).toBeGreaterThan(late * 5);
  });

  it('matches the owner numbers: about 300 ms, scale 1,35, opacity 0,5', () => {
    expect(SEL_PULSE_MS).toBe(300);
    expect(SEL_PULSE_SCALE).toBe(1.35);
    expect(SEL_PULSE_OPACITY).toBe(0.5);
  });
});
