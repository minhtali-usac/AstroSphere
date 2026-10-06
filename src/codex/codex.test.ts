import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import content from '../i18n/codex.vi.json';
import { catalogIndexByHip } from '../data/catalog';
import { DSOS } from '../data/deepSky';
import { Actions, Store, createInitialState, type AppState } from '../state';
import { hasDiagram, type DiagramLabels } from './diagrams';
import { hasCategoryGlyph } from './glyphs';
import { entryFacts, entryVisual, hasSkyVisual, hasVisual } from './visual';
import { SIM } from './sim';
import { CODEX_KEY, HIP_ENTRY, INITIAL_DISCOVERED, TOGGLE_ENTRY, discover, isCodexProgress, loadProgress, triggerIds } from './triggers';

interface Entry {
  title: string;
  aka?: string;
  lede: string;
  body: string[];
  related: string[];
  sim?: string;
  figure?: string;
}
const ENTRIES = content.entries as Record<string, Entry>;
const IDS = Object.keys(ENTRIES);

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

describe('Nội dung Codex (codex.vi.json)', () => {
  it('có 35–45 mục; mỗi mục thuộc đúng một danh mục', () => {
    expect(IDS.length).toBeGreaterThanOrEqual(35);
    expect(IDS.length).toBeLessThanOrEqual(45);
    const listed = content.categories.flatMap((c) => c.entries);
    expect([...listed].sort()).toEqual([...IDS].sort());
    expect(new Set(listed).size).toBe(listed.length);
    for (const c of content.categories) expect(c.title && c.blurb, c.id).toBeTruthy();
  });

  it('mọi mục có tiêu đề, câu dẫn, thân bài (2–4 đoạn trở lên) và mô tả thao tác "Xem trong mô phỏng"', () => {
    for (const [id, e] of Object.entries(ENTRIES)) {
      expect(e.title.trim(), id).not.toBe('');
      expect(e.lede.trim(), id).not.toBe('');
      expect(e.body.filter((l) => !l.startsWith('$$')).length, id).toBeGreaterThanOrEqual(2);
      expect(e.sim?.trim(), id).toBeTruthy();
    }
  });

  it('mọi liên kết "liên quan" trỏ tới một mục có thật (không trỏ về chính nó)', () => {
    for (const [id, e] of Object.entries(ENTRIES)) {
      expect(e.related.length, id).toBeGreaterThan(0);
      for (const r of e.related) {
        expect(IDS, `${id} → ${r}`).toContain(r);
        expect(r, id).not.toBe(id);
      }
    }
  });

  it('không có từ tiếng Anh thông dụng bị cấm (giống vi.json)', () => {
    const english = /\b(the|and|reset|help|about|start|pause|stop|speed|show|hide|stars?|trail|north|south|east|west|settings|loading|error)\b/i;
    expect(strings(content).filter((s) => english.test(s))).toEqual([]);
  });

  it('mọi công thức được KaTeX dựng được, không có ký tự điều khiển', async () => {
    const katex = (await import('katex')).default;
    const formulas: string[] = [];
    for (const line of strings(content)) {
      expect(/[\u0000-\u001f]/.test(line), line).toBe(false);
      if (line.startsWith('$$')) formulas.push(line.slice(2).split('::').pop()!.trim());
      for (const m of line.matchAll(/\\\((.+?)\\\)/g)) formulas.push(m[1]);
    }
    expect(formulas.length).toBeGreaterThan(30);
    for (const tex of formulas) expect(() => katex.renderToString(tex, { throwOnError: true }), tex).not.toThrow();
  });

  it('mục có chú thích hình thì có sơ đồ (hoặc ảnh nhiều chòm), và ngược lại', () => {
    for (const [id, e] of Object.entries(ENTRIES)) expect(!!e.figure, id).toBe(hasDiagram(id) || id === 'constellations');
  });

  it('mọi mục có hình đầu trang; mọi danh mục có biểu tượng', () => {
    expect(IDS.filter((id) => !hasVisual(id))).toEqual([]);
    for (const c of content.categories) expect(hasCategoryGlyph(c.id), c.id).toBe(true);
    // Mục khái niệm cần chú thích viết tay; ảnh bầu trời tự sinh chú thích từ dữ liệu.
    for (const id of IDS) expect(!!ENTRIES[id].figure || hasSkyVisual(id), id).toBe(true);
  });

  it('mọi hình đầu trang dựng được ở nhiều vĩ độ, có tên truy cập, không có NaN', () => {
    const L = { ...content.diagram, north: 'B', east: 'Đ', south: 'N', west: 'T' } as DiagramLabels;
    for (const lat of [21.03, 10.8, 0, -33.9, 89]) {
      const env = { lat, sun: { ra: 190, dec: -4, lambda: 192 }, sunDate: '2026-10-05' };
      for (const id of IDS) {
        const v = entryVisual(id, ENTRIES[id].figure, L, env);
        expect(v, id).not.toBeNull();
        expect(v!.caption.length, id).toBeGreaterThan(20);
        expect(v!.svg, id).toMatch(/^<svg [^>]*role="img" aria-label="[^"]{20,}"/);
        expect(v!.svg.includes('NaN') || v!.svg.includes('undefined') || v!.svg.includes('Infinity'), `${id} @ ${lat}`).toBe(false);
      }
    }
  });

  it('ảnh bầu trời vẽ sao thật: Orion có Betelgeuse và Rigel, số liệu Sirius đúng danh mục', () => {
    const L = { ...content.diagram, north: 'B', east: 'Đ', south: 'N', west: 'T' } as DiagramLabels;
    const env = { lat: 21, sun: { ra: 0, dec: 0, lambda: 0 }, sunDate: '2026-03-20' };
    const ori = entryVisual('ori', undefined, L, env)!.svg;
    expect(ori).toContain('Betelgeuse');
    expect(ori).toContain('Rigel');
    expect((ori.match(/<circle/g) ?? []).length).toBeGreaterThan(20);
    const facts = Object.fromEntries(entryFacts('sirius', env).map((f) => [f.label, f.value]));
    expect(Object.values(facts)).toContain('−1,44'); // cấp sao trong danh mục (HYG), không phải số làm tròn trong bài
    expect(Object.values(facts).join(' ')).toMatch(/Canis Major/);
    expect(entryFacts('m31', env).length).toBeGreaterThanOrEqual(5);
    expect(entryFacts('uma', env).map((f) => f.value).join(' ')).toMatch(/Alioth|Dubhe/);
  });
});

describe('Khóa liên kết Codex', () => {
  it('mọi id do quy tắc khám phá sinh ra đều có mục', () => {
    expect(triggerIds().filter((id) => !ENTRIES[id])).toEqual([]);
  });

  it('mỗi mục có đúng một thao tác "Xem trong mô phỏng"', () => {
    expect(Object.keys(SIM).sort()).toEqual([...IDS].sort());
  });

  it('mọi liên kết "?" trong giao diện trỏ tới một mục có thật', () => {
    const dir = join(__dirname, '..');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) files.push(p);
      }
    };
    walk(dir);
    const ids = new Set<string>();
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/termLink\(\s*'(\w+)'/g)) ids.add(m[1]);
      // Bảng id dựng sẵn: [r.ra.el, 'radec', …], DATA_TERMS = { lat: 'latPole' … }, STATUS_ENTRY = { … }.
      for (const m of src.matchAll(/\[r\.\w+\.el, '(\w+)'/g)) ids.add(m[1]);
      for (const line of src.split('\n').filter((l) => /DATA_TERMS|STATUS_ENTRY = /.test(l)))
        for (const m of line.matchAll(/: '(\w+)'/g)) ids.add(m[1]);
      for (const m of src.matchAll(/openCodex\(\s*'(\w+)'/g)) ids.add(m[1]);
    }
    expect(ids.size).toBeGreaterThan(6);
    expect([...ids].filter((id) => !ENTRIES[id])).toEqual([]);
    for (const id of Object.values(TOGGLE_ENTRY)) expect(IDS).toContain(id);
  });
});

describe('Quy tắc khám phá', () => {
  const fresh = () => {
    const store = new Store(createInitialState());
    return { store, actions: new Actions(store) };
  };
  /** Ghi lại các id được khám phá khi chạy `act`. */
  function run(act: (a: Actions, s: Store) => void, setup?: (a: Actions, s: Store) => void): string[] {
    const { store, actions } = fresh();
    setup?.(actions, store);
    const out: string[] = [];
    store.subscribe((s: AppState, prev: AppState) => discover(s, prev, (id) => out.push(id)));
    act(actions, store);
    return out;
  }

  it('chọn Sirius → Sirius, hai hệ tọa độ, góc giờ, vùng mọc – lặn, cấp sao', () => {
    const out = run((a) => a.select({ kind: 'catalog', index: catalogIndexByHip(32349)! }));
    for (const id of ['sirius', 'radec', 'altaz', 'hourAngle', 'riseSetZone', 'magnitude']) expect(out).toContain(id);
  });

  it('chọn Polaris ở Việt Nam → Polaris, sao cận cực, chòm Ursa Minor', () => {
    const out = run(
      (a) => a.select({ kind: 'catalog', index: catalogIndexByHip(11767)! }),
      (a) => a.select(null),
    );
    for (const id of ['polaris', 'circumpolar', 'umi']) expect(out).toContain(id);
  });

  it('chọn Betelgeuse (sao đỏ) → màu sao và chòm Orion', () => {
    const out = run((a) => a.select({ kind: 'catalog', index: catalogIndexByHip(27989)! }));
    for (const id of ['betelgeuse', 'starColor', 'ori']) expect(out).toContain(id);
  });

  it('mọi sao có mục riêng đều có trong danh mục sao sáng', () => {
    for (const hip of Object.keys(HIP_ENTRY)) expect(catalogIndexByHip(Number(hip)), hip).toBeDefined();
  });

  it('chọn M31 → thiên thể sâu và M31', () => {
    const index = DSOS.findIndex((o) => o.id === 'M31');
    const out = run(
      (a) => a.select({ kind: 'dso', index }),
      (a) => a.setToggle('deepSky', true),
    );
    expect(out).toEqual(expect.arrayContaining(['deepSky', 'm31']));
  });

  it('bật hộp kiểm → khái niệm của nó; tắt thì không', () => {
    expect(run((a) => a.setToggle('ecliptic', true))).toEqual(['ecliptic']);
    expect(run((a) => a.setToggle('equator', false))).toEqual([]);
    expect(run((a) => a.setToggle('zoneCircumpolar', true))).toEqual(['circumpolar']);
  });

  it('đổi vĩ độ → độ cao thiên cực = vĩ độ', () => {
    expect(run((a) => a.setLocation(45, 10))).toContain('latPole');
  });

  it('bắt đầu chạy → chuyển động nhật động; chạy 1 ngày → ngày thiên văn', () => {
    expect(
      run(
        (a) => a.play(),
        (a) => a.pause(),
      ),
    ).toEqual(['diurnal']);
    expect(run((a) => a.setMode('oneDay'))).toEqual(['siderealDay']);
  });

  it('thêm chòm sao → mục của chòm đó', () => {
    expect(run((a) => a.addConstellation('Cru'))).toEqual(['cru']);
  });

  it('khi hoạt ảnh chạy (chỉ gst đổi) không khám phá gì', () => {
    expect(run((a) => a.advance(3))).toEqual([]);
    // Đang tạm dừng mà kéo giờ thiên văn → giờ thiên văn.
    expect(
      run(
        (a) => a.setLst(120),
        (a) => a.pause(),
      ),
    ).toEqual(['lst']);
  });

  it('rê chuột lên ô độ cao thiên cực → mục độ cao thiên cực', () => {
    expect(run((a) => a.setEmphasis('pole'))).toEqual(['latPole']);
  });
});

describe('Lưu tiến độ Codex', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('kiểm tra kiểu dữ liệu lưu', () => {
    expect(isCodexProgress({ discovered: ['a'], read: [] })).toBe(true);
    expect(isCodexProgress({ discovered: ['a'] })).toBe(false);
    expect(isCodexProgress({ discovered: [1], read: [] })).toBe(false);
    expect(isCodexProgress([])).toBe(false);
    expect(isCodexProgress(null)).toBe(false);
  });

  const fakeStorage = (raw: string | null) => ({
    getItem: (k: string) => (k === CODEX_KEY ? raw : null),
    setItem: () => {},
  });

  it('lần đầu (chưa có gì) hoặc dữ liệu hỏng → bắt đầu với các mục đã thấy trên màn hình', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage(null) });
    expect(loadProgress()).toEqual({
      discovered: [...INITIAL_DISCOVERED],
      read: [],
    });
    vi.stubGlobal('window', { localStorage: fakeStorage('{nope') });
    expect(loadProgress().discovered).toEqual([...INITIAL_DISCOVERED]);
    vi.stubGlobal('window', {
      localStorage: fakeStorage('{"discovered":"x","read":[]}'),
    });
    expect(loadProgress().discovered).toEqual([...INITIAL_DISCOVERED]);
  });

  it('đọc lại tiến độ đã lưu', () => {
    vi.stubGlobal('window', {
      localStorage: fakeStorage('{"discovered":["sirius"],"read":["sirius"]}'),
    });
    expect(loadProgress()).toEqual({
      discovered: ['sirius'],
      read: ['sirius'],
    });
  });
});
