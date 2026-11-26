import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import dialogs from './dialogs.vi.json';
import base from './vi.json';
import { DEFAULT_LABELS, DEFAULT_TOGGLES } from '../state';

type Dict = { [k: string]: unknown };

const vi = { ...base, ...dialogs };

function has(key: string): boolean {
  let cur: unknown = vi;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Dict)) cur = (cur as Dict)[part];
    else return false;
  }
  return typeof cur === 'string' || Array.isArray(cur);
}

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

const SRC = join(__dirname, '..');
const code = sources(SRC).map((f) => readFileSync(f, 'utf8')).join('\n');

describe('Bảng chuỗi tiếng Việt (tiêu chí 7)', () => {
  it('mọi khóa t(...) cố định trong mã nguồn đều có trong vi.json', () => {
    const keys = new Set<string>();
    for (const m of code.matchAll(/\bt(?:List)?\(\s*'([a-zA-Z0-9_.]+)'/g)) keys.add(m[1]);
    const missing = [...keys].filter((k) => !has(k));
    expect(missing).toEqual([]);
    expect(keys.size).toBeGreaterThan(150);
  });

  it('có nhãn và chú thích cho mọi hộp kiểm hiển thị', () => {
    for (const k of Object.keys(DEFAULT_TOGGLES)) {
      expect(has(`toggle.${k}`), `toggle.${k}`).toBe(true);
      expect(has(`toggleTip.${k}`), `toggleTip.${k}`).toBe(true);
    }
    for (const k of Object.keys(DEFAULT_LABELS)) expect(has(`labels.${k}`), `labels.${k}`).toBe(true);
  });

  it('mọi đối tượng 3D có chú thích khi rê chuột đều có nội dung tiếng Việt', () => {
    const tips = new Set<string>();
    for (const m of code.matchAll(/userData\.tip = '([a-zA-Z0-9_]+)'/g)) tips.add(m[1]);
    for (const z of ['circumpolar', 'riseSet', 'neverRise']) tips.add(`zone_${z}`);
    for (const k of ['ncp', 'scp', 'zenith', 'nadir', 'observer']) tips.add(k);
    const missing = [...tips].filter((k) => !has(`tip.${k}`));
    expect(missing).toEqual([]);
  });

  it('các khóa động khác đều tồn tại', () => {
    const dynamic = [
      ...['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((d) => `compass.${d}`),
      ...['circumpolar', 'riseSet', 'neverRise'].map((v) => `visibility.${v}`),
      ...['location', 'animation', 'display', 'stars'].map((p) => `panel.${p}.short`),
      ...['none', 'short', 'long'].map((m) => `panel.stars.trail_${m}`),
      ...['vernal', 'summer', 'autumnal', 'winter'].map((k) => `panel.display.${k}`),
      ...['lat', 'lon', 'lst', 'gst', 'pole', 'incl', 'solar', 'selected'].map((k) => `data.${k}`),
      ...['equator', 'poleAxis', 'horizon', 'hourCircle0', 'meridian', 'verticalCircle', 'ecliptic', 'galactic', 'zoneCircumpolar', 'zoneRiseSet', 'zoneNeverRise'].map(
        (k) => `legend.${k}`,
      ),
      ...['ncp', 'scp', 'dirN', 'dirE', 'dirS', 'dirW', 'zenith', 'nadir', 'ncpAltitude', 'scpAltitude', 'summerSolstice', 'autumnEquinox', 'winterSolstice'].map(
        (k) => `scene.${k}`,
      ),
    ];
    expect(dynamic.filter((k) => !has(k))).toEqual([]);
  });

  it('không còn từ tiếng Anh thông dụng trong chuỗi giao diện', () => {
    const all: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === 'string') all.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(vi);
    const english = /\b(the|and|reset|help|about|start|pause|stop|speed|show|hide|stars?|trail|north|south|east|west|settings|loading|error)\b/i;
    const offenders = all.filter((s) => english.test(s));
    expect(offenders).toEqual([]);
  });
});

describe('Công thức trong Trợ giúp / Giới thiệu', () => {
  it('mọi công thức đều được KaTeX dựng được, không có ký tự điều khiển', async () => {
    const katex = (await import('katex')).default;
    const lines = [...(vi as unknown as { help: { body: string[] } }).help.body, ...(vi as unknown as { about: { body: string[] } }).about.body];
    const formulas: string[] = [];
    for (const line of lines) {
      expect(/[\u0000-\u001f]/.test(line), line).toBe(false);
      if (line.startsWith('$$')) formulas.push(line.slice(2).split('::').pop()!.trim());
      for (const m of line.matchAll(/\\\((.+?)\\\)/g)) formulas.push(m[1]);
    }
    expect(formulas.length).toBeGreaterThan(12);
    for (const tex of formulas) expect(() => katex.renderToString(tex, { throwOnError: true }), tex).not.toThrow();
  });
});
