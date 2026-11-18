import { describe, expect, it } from 'vitest';
import strings from '../i18n/history.vi.json';
import { OLD_PLACES, PRESETS } from './presets';
import { fmt, num } from './text';

function all(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => all(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => all(x, out));
  return out;
}

describe('Bầu trời xưa: chữ (history.vi.json)', () => {
  it('không có từ tiếng Anh thông dụng trong chữ hiển thị', () => {
    const english = /\b(the|and|reset|help|about|start|pause|stop|speed|show|hide|stars?|trail|north|south|east|west|settings|loading|error)\b/i;
    expect(all(strings).filter((s) => english.test(s))).toEqual([]);
  });

  it('mọi thời điểm và nơi chọn sẵn có chữ; tám tên pha Mặt Trăng', () => {
    for (const p of PRESETS) expect(strings.presets[p.id].title.length, p.id).toBeGreaterThan(3);
    for (const o of OLD_PLACES) expect(strings.places[o.id].length, o.id).toBeGreaterThan(2);
    expect(strings.phase).toHaveLength(8);
    expect(new Set(strings.phase).size).toBe(8);
  });

  it('thay tham số và số kiểu Việt Nam', () => {
    expect(fmt('{a}-{b}', { a: 1, b: 'x' })).toBe('1-x');
    expect(fmt('{thieu}')).toBe('{thieu}');
    expect(num(10583.6, 1)).toBe('10583,6');
    expect(num(-3.5, 1)).toBe('−3,5');
  });
});
