// Bản tiếng Anh phải khớp bản tiếng Việt: cùng khóa, cùng tham số, công thức dựng được, không sót chữ Việt.
import { describe, expect, it } from 'vitest';
import katex from 'katex';
import codexEn from './codex.en.json';
import codexVi from './codex.vi.json';
import dialogsEn from './dialogs.en.json';
import dialogsVi from './dialogs.vi.json';
import en from './en.json';
import flightEn from './flight.en.json';
import flightVi from './flight.vi.json';
import historyEn from './history.en.json';
import historyVi from './history.vi.json';
import vi from './vi.json';
import { resolveLang } from './locale';
import { loadAllFigures, constellationName } from '../data/constellations';

/** Đường dẫn khóa → chuỗi lá. Mảng văn bản (help.body…) được coi là một khóa, vì số dòng có thể khác nhau. */
const FREE_LISTS = /(^|\.)(body|intro|sources|resets|lede)$/;

function leaves(v: unknown, path = '', out = new Map<string, string>()): Map<string, string> {
  if (typeof v === 'string') out.set(path, v);
  else if (Array.isArray(v) && FREE_LISTS.test(path)) out.set(path, v.filter((x) => typeof x === 'string').join('\n'));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) leaves(x, path ? `${path}.${k}` : k, out);
  return out;
}

const params = (s: string) => [...new Set(s.match(/\{[a-zA-Z]+\}/g) ?? [])].sort();

const PAIRS = [
  ['giao diện', vi, en],
  ['Trợ giúp, Giới thiệu, Danh mục', dialogsVi, dialogsEn],
  ['USACodex', codexVi, codexEn],
  ['Bầu trời xưa', historyVi, historyEn],
  ['Bay vào vũ trụ', flightVi, flightEn],
] as const;

const VIETNAMESE = /[ăâđêôơưàảãạằắẳẵặầấẩẫậèẻẽẹềếểễệìỉĩịòỏõọồốổỗộờớởỡợùủũụừứửữựỳỷỹỵ]/i;

/** Chữ Việt được phép ở bản tiếng Anh: tên ngôn ngữ, tên tiếng Việt của thiên thể, tên bài nguồn dữ liệu. */
const ALLOWED = /^(top\.language(Tip)?|info\.sunViName|about\.body|vi\.\w+)$/;

describe.each(PAIRS)('bản tiếng Anh: %s', (_name, source, target) => {
  const a = leaves(source);
  const b = leaves(target);

  it('có đúng bộ khóa như bản tiếng Việt', () => {
    expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
  });

  it('giữ nguyên các tham số {…} ngoài công thức', () => {
    const strip = (s: string) => s.replace(/\\\(.+?\\\)|^\$\$.*$/gm, '');
    for (const [k, v] of a) expect(params(strip(b.get(k) ?? '')), k).toEqual(params(strip(v)));
  });

  it('không sót chữ tiếng Việt', () => {
    const left = [...b].filter(([k, v]) => !ALLOWED.test(k) && VIETNAMESE.test(v)).map(([k]) => k);
    expect(left).toEqual([]);
  });

  it('mọi công thức đều được KaTeX dựng được', () => {
    for (const [k, v] of b) {
      for (const line of v.split('\n')) {
        const formulas = [...line.matchAll(/\\\((.+?)\\\)/g)].map((m) => m[1]);
        if (line.startsWith('$$')) formulas.push(line.slice(2).split('::').pop()!.trim());
        for (const tex of formulas) expect(() => katex.renderToString(tex, { throwOnError: true }), `${k}: ${tex}`).not.toThrow();
      }
    }
  });
});

describe('chọn ngôn ngữ', () => {
  it('địa chỉ trang → lựa chọn đã lưu → trình duyệt', () => {
    expect(resolveLang('?lang=en', 'vi', ['vi-VN'])).toBe('en');
    expect(resolveLang('?lang=fr', 'vi', ['en-US'])).toBe('vi');
    expect(resolveLang('', null, ['en-US', 'vi'])).toBe('vi');
    expect(resolveLang('', null, ['ja-JP', 'en'])).toBe('en');
    expect(resolveLang('', null, [])).toBe('vi');
  });
});

describe('tên chòm sao theo IAU', () => {
  // Danh sách chính thức 88 chòm sao của IAU: mã viết tắt và tên.
  const IAU =
    'And Andromeda|Ant Antlia|Aps Apus|Aqr Aquarius|Aql Aquila|Ara Ara|Ari Aries|Aur Auriga|Boo Boötes|Cae Caelum|Cam Camelopardalis|Cnc Cancer|CVn Canes Venatici|CMa Canis Major|CMi Canis Minor|Cap Capricornus|Car Carina|Cas Cassiopeia|Cen Centaurus|Cep Cepheus|Cet Cetus|Cha Chamaeleon|Cir Circinus|Col Columba|Com Coma Berenices|CrA Corona Australis|CrB Corona Borealis|Crv Corvus|Crt Crater|Cru Crux|Cyg Cygnus|Del Delphinus|Dor Dorado|Dra Draco|Equ Equuleus|Eri Eridanus|For Fornax|Gem Gemini|Gru Grus|Her Hercules|Hor Horologium|Hya Hydra|Hyi Hydrus|Ind Indus|Lac Lacerta|Leo Leo|LMi Leo Minor|Lep Lepus|Lib Libra|Lup Lupus|Lyn Lynx|Lyr Lyra|Men Mensa|Mic Microscopium|Mon Monoceros|Mus Musca|Nor Norma|Oct Octans|Oph Ophiuchus|Ori Orion|Pav Pavo|Peg Pegasus|Per Perseus|Phe Phoenix|Pic Pictor|Psc Pisces|PsA Piscis Austrinus|Pup Puppis|Pyx Pyxis|Ret Reticulum|Sge Sagitta|Sgr Sagittarius|Sco Scorpius|Scl Sculptor|Sct Scutum|Ser Serpens|Sex Sextans|Tau Taurus|Tel Telescopium|Tri Triangulum|TrA Triangulum Australe|Tuc Tucana|UMa Ursa Major|UMi Ursa Minor|Vel Vela|Vir Virgo|Vol Volans|Vul Vulpecula';

  it('đủ 88 chòm, đúng mã và tên', async () => {
    const list = IAU.split('|').map((x) => [x.slice(0, x.indexOf(' ')), x.slice(x.indexOf(' ') + 1)]);
    expect(list).toHaveLength(88);
    expect(Object.keys(await loadAllFigures()).sort()).toEqual(list.map(([a]) => a).sort());
    for (const [abbr, name] of list) expect(constellationName(abbr), abbr).toBe(name);
  });
});
