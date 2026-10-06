// Các họ khóa chuỗi được dựng lúc chạy (toggleHint.*, data.*Note, info.*Note, displayGroup.*) mà
// i18n.test.ts không thấy được. Kiểm tra từng khóa thật sự được dùng đều có trong vi.json.

import { describe, expect, it } from 'vitest';
import vi from '../i18n/vi.json';
import { DEFAULT_TOGGLES, type Toggles } from '../state';
import { DISPLAY_GROUPS, HINTED_TOGGLES } from './displayPanel';
import { DATA_CELLS, INFO_NOTE_KEYS } from './infoCard';

type Dict = { [k: string]: unknown };

function get(key: string): unknown {
  let cur: unknown = vi;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Dict)) cur = (cur as Dict)[part];
    else return undefined;
  }
  return cur;
}
const str = (key: string) => {
  const v = get(key);
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
};
const missing = (keys: string[]) => keys.filter((k) => str(k) === null);

/** Hộp kiểm nằm ở bảng Sao, không thuộc bảng Hiển thị. */
const STAR_PANEL_TOGGLES: (keyof Toggles)[] = ['catalog', 'constellationLines'];

describe('Chữ theo ngữ cảnh (họ khóa động)', () => {
  // review-1 E2: dòng giải thích là MỘT câu ngắn nói nghĩa, không giảng giải ("Để ý: …", câu thứ hai).
  it('mọi hộp kiểm khái niệm có dòng toggleHint: một câu ngắn, không có "Để ý:"', () => {
    const keys = HINTED_TOGGLES.map((k) => `toggleHint.${k}`);
    expect(missing(keys)).toEqual([]);
    for (const k of keys) {
      const s = str(k)!;
      expect(s.length, k).toBeLessThanOrEqual(70);
      expect(s, k).not.toMatch(/Để ý/);
      // Một câu: chỉ một dấu chấm, ở cuối.
      expect(s.replace(/\.$/, ''), k).not.toMatch(/\.\s/);
    }
    // Đủ các khóa brief yêu cầu (16 hộp kiểm khái niệm).
    expect(HINTED_TOGGLES.length).toBe(16);
  });

  it('không có toggleHint thừa (khóa có trong vi.json nhưng không được dùng)', () => {
    const inJson = Object.keys(get('toggleHint') as Dict);
    expect(inJson.filter((k) => !HINTED_TOGGLES.includes(k as keyof Toggles))).toEqual([]);
  });

  it('mỗi nhóm hiển thị có tiêu đề và câu giới thiệu, theo đúng thứ tự câu chuyện', () => {
    expect(DISPLAY_GROUPS.map((g) => g.id)).toEqual(['sky', 'horizon', 'coords', 'riseSet', 'extra', 'labels']);
    const keys = DISPLAY_GROUPS.flatMap((g) => [`displayGroup.${g.id}.title`, `displayGroup.${g.id}.teaser`]);
    expect(missing(keys)).toEqual([]);
    expect(DISPLAY_GROUPS.map((g) => str(`displayGroup.${g.id}.title`))).toEqual([
      'Bầu trời quay',
      'Chân trời của bạn',
      'Hai hệ tọa độ',
      'Mọc – lặn',
      'Mở rộng',
      'Nhãn',
    ]);
  });

  it('mọi hộp kiểm của bảng Hiển thị nằm trong đúng một nhóm (không mất hộp nào)', () => {
    const grouped = DISPLAY_GROUPS.flatMap((g) => g.toggles.map(([k]) => k));
    const expected = (Object.keys(DEFAULT_TOGGLES) as (keyof Toggles)[]).filter((k) => !STAR_PANEL_TOGGLES.includes(k));
    expect([...grouped].sort()).toEqual([...expected].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    for (const k of grouped) {
      expect(str(`toggle.${k}`), `toggle.${k}`).not.toBeNull();
      expect(str(`toggleTip.${k}`), `toggleTip.${k}`).not.toBeNull();
    }
  });

  it('mỗi ô thanh số liệu có nhãn và câu nghĩa ngắn; ô có chú thích thì có data.<k>Tip', () => {
    expect(DATA_CELLS.map((c) => c.key)).toEqual(['lat', 'pole', 'incl', 'lon', 'lst', 'gst', 'solar', 'selected']);
    const keys = DATA_CELLS.flatMap((c) => [`data.${c.key}`, `data.${c.key}Note`, ...(c.tip ? [`data.${c.key}Tip`] : [])]);
    expect(missing(keys)).toEqual([]);
    expect(str('data.poleNote')).toMatch(/\|φ\|/);
    expect(str('data.inclNote')).toMatch(/90° − \|φ\|/);
  });

  it('mỗi dòng α, δ, H, A, h của thẻ thông tin có câu nghĩa info.<k>Note', () => {
    expect([...INFO_NOTE_KEYS]).toEqual(['ra', 'dec', 'ha', 'az', 'alt']);
    expect(missing(INFO_NOTE_KEYS.map((k) => `info.${k}Note`))).toEqual([]);
  });

  it('trạng thái trống của thẻ nói vì sao trống và việc nên làm tiếp', () => {
    expect(str('info.emptyTitle')).toMatch(/Chưa chọn/);
    expect(str('info.empty')).toMatch(/^Bấm vào/);
  });
});

describe('Chính tả nhất quán', () => {
  // review-2 D2: "Hệ toạ độ" ở tiêu đề nhưng "tọa độ" ở mọi chỗ khác. Thống nhất kiểu bỏ dấu "tọa".
  it('mọi chuỗi giao diện viết "tọa", không viết "toạ"', () => {
    expect(JSON.stringify(vi)).not.toMatch(/[Tt]oạ/);
  });
});
