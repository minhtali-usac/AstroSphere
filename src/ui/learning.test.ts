import { describe, expect, it } from 'vitest';
import { points, sanitizeProgress, withHint } from './learning';

describe('Tiến độ Ôn tập', () => {
  it('bỏ qua dữ liệu lưu bị hỏng thay vì làm trống ứng dụng', () => {
    expect(sanitizeProgress(null)).toEqual({});
    expect(sanitizeProgress([1, 2])).toEqual({});
    expect(sanitizeProgress('x')).toEqual({});
    expect(
      sanitizeProgress({
        ok: { attempts: 1, correct: true, hinted: false },
        bad1: null,
        bad2: { attempts: '1', correct: true, hinted: false },
        bad3: { attempts: 1, correct: true },
        bad4: { attempts: Number.NaN, correct: true, hinted: false },
      }),
    ).toEqual({ ok: { attempts: 1, correct: true, hinted: false } });
  });

  it('xem gợi ý sau khi đã làm đúng vẫn giữ 2 điểm', () => {
    const solved = { attempts: 1, correct: true, hinted: false };
    expect(points(solved)).toBe(2);
    expect(points(withHint(solved))).toBe(2);
  });

  it('xem gợi ý trước khi làm đúng chỉ được 1 điểm', () => {
    const hinted = withHint(undefined);
    expect(hinted.hinted).toBe(true);
    expect(points({ ...hinted, attempts: 1, correct: true })).toBe(1);
  });
});
