import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLANET_IDS } from '../../astro/planets';
import { BODIES } from '../../data/bodies';
import exo from '../../data/fetched/exoplanets.json';
import strings from '../../i18n/flight.vi.json';
import { methodKey } from '../../ui/flightPanel';
import { ft } from './text';

const all = (v: unknown): string[] => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(all) : []);
const has = (key: string) => ft(key) !== key;

const sources = [
  join(__dirname, '../../ui/flightPanel.ts'),
  ...readdirSync(__dirname)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join(__dirname, f)),
];
const code = sources.map((f) => readFileSync(f, 'utf8')).join('\n');

describe('«Bay vào vũ trụ»: chuỗi giao diện (flight.vi.json)', () => {
  it('không có từ tiếng Anh thông dụng', () => {
    const english = /\b(the|and|reset|help|about|start|pause|stop|speed|show|hide|stars?|trail|north|south|east|west|settings|loading|error)\b/i;
    expect(all(strings).filter((s) => english.test(s))).toEqual([]);
  });

  it('mọi khóa viết cố định ft(\'…\') đều có chuỗi', () => {
    const keys = [...code.matchAll(/\bft\(\s*'([a-zA-Z0-9_.]+)'/g)].map((m) => m[1]);
    // Khóa trong biểu thức ba ngôi (truyền vào ft qua biến).
    keys.push('kind.sun', 'kind.moon', 'kind.planet', 'note.earth', 'note.illustration', 'unit.massMin', 'unit.earthMass');
    expect(keys.length).toBeGreaterThan(30);
    expect(keys.filter((k) => !has(k))).toEqual([]);
  });

  it('họ khóa động: tên thiên thể, loại hành tinh, nhãn, phương pháp phát hiện', () => {
    const ids = BODIES.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(['sun', 'moon', ...PLANET_IDS]));
    const keys = [
      ...ids.flatMap((id) => [`vi.${id}`, `name.${id}`]),
      ...['rocky', 'subNeptune', 'iceGiant', 'gasGiant'].map((c) => `class.${c}`),
      ...['estimated', 'chosen', 'uncertain', 'measured'].map((g) => `tag.${g}`),
      ...exo.planets.map((p) => methodKey(p.method)),
      methodKey(null),
    ];
    expect(keys.filter((k) => !has(k))).toEqual([]);
  });
});
