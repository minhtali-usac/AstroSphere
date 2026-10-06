import { afterEach, describe, expect, it } from 'vitest';
import vi from '../i18n/vi.json';
import { QUICK_PLACES, atPlace } from '../scenario';
import { Actions, createInitialState, Store, UI_MODES } from '../state';
import { DEFAULT_UI_MODE, initialUiMode, MODE_STORAGE_KEY, resolveUiMode, urlUiMode } from './mode';
import { sameSelection, SIMPLE_RATES, speedOf } from './simpleControls';

type Dict = { [k: string]: unknown };
const has = (key: string): boolean => {
  let cur: unknown = vi;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Dict)) cur = (cur as Dict)[part];
    else return false;
  }
  return typeof cur === 'string';
};

/** Cửa sổ giả (môi trường kiểm thử là Node): địa chỉ trang và localStorage trong bộ nhớ. */
function fakeWindow(search: string, stored?: string, throwing = false) {
  const data = new Map<string, string>();
  if (stored !== undefined) data.set(MODE_STORAGE_KEY, stored);
  const localStorage = {
    getItem: (k: string) => {
      if (throwing) throw new Error('blocked');
      return data.get(k) ?? null;
    },
    setItem: (k: string, v: string) => void data.set(k, v),
  };
  (globalThis as Dict).window = { location: { search }, localStorage };
  return data;
}

afterEach(() => {
  delete (globalThis as Dict).window;
});

describe('Chế độ giao diện: chọn chế độ khi mở trang', () => {
  it('lần đầu (chưa lưu gì) là Cơ bản', () => {
    expect(DEFAULT_UI_MODE).toBe('simple');
    expect(resolveUiMode('', null)).toBe('simple');
    fakeWindow('');
    expect(initialUiMode()).toBe('simple');
  });

  it('dùng lựa chọn đã lưu', () => {
    expect(resolveUiMode('', 'full')).toBe('full');
    expect(resolveUiMode('', 'simple')).toBe('simple');
    fakeWindow('', JSON.stringify('full'));
    expect(initialUiMode()).toBe('full');
  });

  it('?mode=… ghi đè giá trị đã lưu', () => {
    expect(resolveUiMode('?mode=simple', 'full')).toBe('simple');
    expect(resolveUiMode('?quality=fixed&mode=full', 'simple')).toBe('full');
    fakeWindow('?mode=simple', JSON.stringify('full'));
    expect(initialUiMode()).toBe('simple');
  });

  it('giá trị hỏng (đã lưu hoặc trên địa chỉ) bị bỏ qua', () => {
    expect(urlUiMode('?mode=expert')).toBeNull();
    expect(resolveUiMode('?mode=expert', 'full')).toBe('full');
    for (const bad of ['expert', 42, null, { mode: 'full' }, ['full'], undefined]) expect(resolveUiMode('', bad)).toBe('simple');
    fakeWindow('', '{not json');
    expect(initialUiMode()).toBe('simple');
    fakeWindow('', JSON.stringify('expert'));
    expect(initialUiMode()).toBe('simple');
  });

  it('bộ nhớ trình duyệt bị chặn: vẫn chạy, về Cơ bản', () => {
    fakeWindow('', JSON.stringify('full'), true);
    expect(initialUiMode()).toBe('simple');
  });
});

describe('Actions.setUiMode', () => {
  it('cập nhật bất biến: đối tượng trạng thái mới, các nhánh khác giữ nguyên tham chiếu', () => {
    const store = new Store(createInitialState());
    const actions = new Actions(store);
    const before = store.state;
    expect(before.uiMode).toBe('simple');
    actions.setUiMode('full');
    const after = store.state;
    expect(after).not.toBe(before);
    expect(before.uiMode).toBe('simple');
    expect(after.uiMode).toBe('full');
    expect(after.toggles).toBe(before.toggles);
    expect(after.stars).toBe(before.stars);
    expect(after.mode).toBe(before.mode); // chế độ hoạt ảnh không liên quan
  });

  it('không phát sự kiện khi giá trị không đổi hoặc không hợp lệ', () => {
    const store = new Store(createInitialState());
    const actions = new Actions(store);
    let n = 0;
    store.subscribe(() => n++);
    actions.setUiMode('simple');
    actions.setUiMode('expert' as never);
    expect(n).toBe(0);
    actions.setUiMode('full');
    expect(n).toBe(1);
  });

  it('"Đặt lại" giữ chế độ người dùng đã chọn', () => {
    const store = new Store(createInitialState());
    const actions = new Actions(store);
    actions.setUiMode('full');
    actions.setLocation(-30, 10);
    actions.resetAll();
    expect(store.state.uiMode).toBe('full');
    expect(store.state.lat).not.toBe(-30);
  });
});

describe('Chế độ Cơ bản: khóa chuỗi động và điều khiển', () => {
  it('mọi khóa dựng lúc chạy đều có trong vi.json', () => {
    const keys = [
      ...UI_MODES.flatMap((m) => [`mode.${m}`, `mode.${m}Tip`]),
      ...QUICK_PLACES.map((p) => `simple.place.${p.key}`),
      ...Object.keys(SIMPLE_RATES).flatMap((k) => [`simple.${k}`, `simple.${k}Tip`]),
    ];
    expect(keys.filter((k) => !has(k))).toEqual([]);
  });

  it('nơi chọn nhanh có một nơi ở Nam bán cầu và hai trường hợp biên', () => {
    expect(QUICK_PLACES.some((p) => p.lat < 0)).toBe(true);
    expect(QUICK_PLACES.map((p) => p.lat)).toEqual(expect.arrayContaining([0, 90]));
    const hanoi = QUICK_PLACES.find((p) => p.key === 'hanoi')!;
    expect(atPlace(21.03, 105.85, hanoi)).toBe(true);
    expect(atPlace(21.03, 0, hanoi)).toBe(false);
    expect(atPlace(0, 33, QUICK_PLACES.find((p) => p.key === 'equator')!)).toBe(true);
  });

  it('tốc độ hiện tại luôn ứng với đúng một lựa chọn Chậm/Nhanh', () => {
    expect(speedOf(SIMPLE_RATES.slow)).toBe('slow');
    expect(speedOf(SIMPLE_RATES.fast)).toBe('fast');
    expect(speedOf(5)).toBe('fast');
    expect(speedOf(45)).toBe('slow');
  });

  it('lời mời "bấm vào một ngôi sao" nhận ra lựa chọn mặc định theo giá trị (fix-1 #4)', () => {
    const start = createInitialState().selected;
    expect(start).not.toBeNull();
    // "Đặt lại" tạo đối tượng lựa chọn mới nhưng cùng thiên thể: không tính là người dùng đã chọn sao.
    expect(sameSelection(start, createInitialState().selected)).toBe(true);
    expect(sameSelection({ kind: 'catalog', index: 1 }, { kind: 'catalog', index: 2 })).toBe(false);
    expect(sameSelection({ kind: 'catalog', index: 3 }, { kind: 'dso', index: 3 })).toBe(false);
    expect(sameSelection({ kind: 'user', id: 'a' }, { kind: 'user', id: 'a' })).toBe(true);
    expect(sameSelection({ kind: 'sun' }, { kind: 'sun' })).toBe(true);
    expect(sameSelection(null, start)).toBe(false);
    expect(sameSelection(null, null)).toBe(true);
  });

  it('khóa chữ mới của fix-1 có trong vi.json', () => {
    expect(['simple.cue', 'guide.helloShort', 'guide.helloClose', 'mode.label'].filter((k) => !has(k))).toEqual([]);
  });
});
