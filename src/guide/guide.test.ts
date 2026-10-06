import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import codex from '../i18n/codex.vi.json';
import strings from '../i18n/vi.json';
import { GUIDE_KEY, helloSeen, isGuideState, markHelloSeen } from './state';
import { codexFor, GUIDE_CODEX, PASSIVE, tipKey } from './tips';

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}
const code = sources(join(__dirname, '..'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

/**
 * Mọi khóa `data-guide` trong mã nguồn. Ba cách viết được phép (đều là chuỗi cố định):
 * `'data-guide': 'khoa'`, `guide: 'khoa'` (tùy chọn của button(), viewTool(), bảng DATA_CELLS) và `guide('khoa', el)`.
 */
function guideKeys(): Set<string> {
  const keys = new Set<string>();
  for (const re of [/'data-guide':\s*'(\w+)'/g, /\bguide:\s*'(\w+)'/g, /\bguide\(\s*'(\w+)'/g]) for (const m of code.matchAll(re)) keys.add(m[1]);
  return keys;
}

const tips = (strings as unknown as { guide: { tip: Record<string, string> } }).guide.tip;
const has = (key: string): boolean => {
  let cur: unknown = strings;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
    else return false;
  }
  return typeof cur === 'string';
};

describe('Usui-chan: lời giải thích cho mọi điều khiển (redesign-2 R4)', () => {
  const keys = guideKeys();

  it('phủ đủ các nhóm điều khiển chính', () => {
    for (const k of ['mode', 'codex', 'learn', 'present', 'reset', 'help', 'about', 'simplePlay', 'play', 'horizonView', 'sphereView', 'term', 'infoCard', 'dataLat'])
      expect(keys, k).toContain(k);
    expect(keys.size).toBeGreaterThanOrEqual(45);
  });

  it('mọi khóa data-guide trong mã đều có chuỗi guide.tip.<khóa>', () => {
    expect([...keys].filter((k) => !has(tipKey(k)))).toEqual([]);
  });

  it('không có chuỗi guide.tip.* mồ côi (mọi chuỗi đều được một điều khiển dùng)', () => {
    expect(Object.keys(tips).filter((k) => !keys.has(k))).toEqual([]);
  });

  it('chỉ hai chỗ gán data-guide bằng biểu thức (cả hai lấy giá trị từ chuỗi cố định ở trên)', () => {
    const dynamic = [...code.matchAll(/'data-guide':\s*([^'\s,}][^,}]*)/g)].map((m) => m[1].trim());
    expect(dynamic.sort()).toEqual(['c.guide', 'opts.guide', 'opts.guide'].sort());
  });

  it('mỗi lời giải thích ngắn: tối đa hai câu', () => {
    for (const [k, v] of Object.entries(tips)) {
      const sentences = v.split(/[.!?](?=\s+\p{Lu}|\s*$)/u).filter((s) => s.trim()).length;
      expect(sentences, k).toBeLessThanOrEqual(2);
    }
  });

  it('liên kết "Đọc thêm trong Codex" trỏ tới mục có thật, từ khóa có thật', () => {
    const entries = (codex as unknown as { entries: Record<string, unknown> }).entries;
    for (const [k, id] of Object.entries(GUIDE_CODEX)) {
      expect(keys, k).toContain(k);
      expect(entries[id], `${k} → ${id}`).toBeTruthy();
    }
    for (const k of PASSIVE) expect(keys).toContain(k);
    expect(codexFor('term', 'pole')).toBe('pole');
    expect(codexFor('term')).toBeNull();
    expect(codexFor('help')).toBeNull();
  });
});

describe('Usui-chan: bộ nhớ trình duyệt (astrosphere.guide.v1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const memory = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      raw: m,
    };
  };

  it('bộ kiểm kiểu chỉ nhận {hello: boolean}', () => {
    expect(isGuideState({ hello: true })).toBe(true);
    expect(isGuideState({ hello: false })).toBe(true);
    for (const bad of [null, true, 'true', [], {}, { hello: 'yes' }, { hello: 1 }, [{ hello: true }]]) expect(isGuideState(bad), JSON.stringify(bad)).toBe(false);
  });

  it('chưa lưu gì → chưa chào; ghi → đã chào, đúng khóa và đúng dạng', () => {
    const ls = memory();
    vi.stubGlobal('window', { localStorage: ls });
    expect(helloSeen()).toBe(false);
    markHelloSeen();
    expect(JSON.parse(ls.raw.get(GUIDE_KEY)!)).toEqual({ hello: true });
    expect(helloSeen()).toBe(true);
  });

  it('dữ liệu hỏng hoặc sai dạng → coi như chưa chào', () => {
    const ls = memory();
    vi.stubGlobal('window', { localStorage: ls });
    for (const raw of ['{', 'true', '{"hello":"yes"}', '[]']) {
      ls.raw.set(GUIDE_KEY, raw);
      expect(helloSeen(), raw).toBe(false);
    }
  });

  it('bộ nhớ bị chặn (truy cập ném lỗi) → không vỡ', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('blocked');
      },
    });
    expect(helloSeen()).toBe(false);
    expect(() => markHelloSeen()).not.toThrow();
  });
});
