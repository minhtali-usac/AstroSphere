// Codex › hình đầu trang và cột "số liệu" của mỗi mục.
// - Mục khái niệm: sơ đồ nhỏ (diagrams.ts) và công thức chính.
// - Mục sao, chòm sao, thiên thể sâu: ảnh bầu trời thu nhỏ từ dữ liệu thật (sky.ts) và các con số chính
//   (α, δ, cấp sao, B − V, chòm, tên tiếng Việt; khoảng cách và kích thước cho thiên thể sâu).

import content from '../i18n/codex.vi.json';
import { fmtDegSigned, fmtHMS, fmtMag, fmtNum } from '../astro';
import { catalogIndexByHip, getCatalogStar, nameOf, starConstellation } from '../data/catalog';
import { constellationName, constellationNameVi, TEMPLATE_FIGURES } from '../data/constellations';
import { DSOS, dsoGroup } from '../data/deepSky';
import { t } from '../i18n';
import { DSO_COLORS, fmtLightYears } from '../selection';
import { diagramSvg, hasDiagram, type DiagramEnv, type DiagramLabels } from './diagrams';
import { skyGroup, skySvg } from './sky';

const UI = content.ui;
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');
/** Số âm dùng dấu trừ thật (−), dấu phẩy thập phân. */
const num = fmtMag;

interface StarVis {
  hip: number;
  fig?: string;
  radius?: number;
}

/** Sao có mục riêng → HIP và chòm mẫu chứa nó (nếu có trong 16 mẫu). */
export const STAR_VISUAL: Readonly<Record<string, StarVis>> = {
  polaris: { hip: 11767, fig: 'UMi' },
  sirius: { hip: 32349, fig: 'CMa' },
  canopus: { hip: 30438, radius: 18 },
  vega: { hip: 91262, fig: 'Lyr', radius: 12 },
  betelgeuse: { hip: 27989, fig: 'Ori' },
  rigel: { hip: 24436, fig: 'Ori' },
  antares: { hip: 80763, fig: 'Sco' },
};

/** Chòm sao có mục riêng → mã IAU. */
export const CONSTELLATION_VISUAL: Readonly<Record<string, string>> = {
  uma: 'UMa',
  umi: 'UMi',
  cas: 'Cas',
  ori: 'Ori',
  sco: 'Sco',
  cru: 'Cru',
};

/** Thiên thể sâu có mục riêng → mã và chòm mẫu xung quanh. */
export const DSO_VISUAL: Readonly<Record<string, { id: string; fig?: string; radius?: number }>> = {
  m31: { id: 'M31', radius: 20 },
  m42: { id: 'M42', fig: 'Ori' },
  m45: { id: 'M45', fig: 'Tau' },
};

/** Ảnh nhiều khung cho mục chung "Chòm sao". */
const OVERVIEW = ['UMa', 'Ori', 'Cas'];

export interface Visual {
  svg: string;
  caption: string;
}

export interface Fact {
  label: string;
  value: string;
}

const dir = () => ({ north: t('scene.dirN'), east: t('scene.dirE') });

/** Mục có hình dựng từ dữ liệu bầu trời (không cần chú thích viết tay). */
export const hasSkyVisual = (id: string): boolean => id in STAR_VISUAL || id in CONSTELLATION_VISUAL || id in DSO_VISUAL;

/** Mục có hình đầu trang: ảnh bầu trời, hoặc sơ đồ khái niệm (cần chú thích `figure`). */
export const hasVisual = (id: string): boolean => hasSkyVisual(id) || id === 'constellations' || hasDiagram(id);

/** Hình đầu trang của mục (null nếu mục không có). */
export function entryVisual(id: string, figure: string | undefined, L: DiagramLabels, env: DiagramEnv): Visual | null {
  const sv = STAR_VISUAL[id];
  if (sv) {
    const idx = catalogIndexByHip(sv.hip);
    if (idx === undefined) return null;
    const s = getCatalogStar(idx);
    const figure = sv.fig ? TEMPLATE_FIGURES[sv.fig] : undefined;
    const caption = fill(UI.capStar, { name: s.label }) + (sv.fig ? ` ${fill(UI.capFigure, { con: constellationName(sv.fig) })}` : '');
    return { caption, svg: skySvg({ figure, mark: { ra: s.ra, dec: s.dec, label: s.label }, radius: sv.radius, labelBright: 3, labelField: sv.fig ? undefined : 2.6 }, caption, dir()) };
  }
  const abbr = CONSTELLATION_VISUAL[id];
  if (abbr) {
    const caption = fill(UI.capConstellation, { con: constellationName(abbr) });
    return { caption, svg: skySvg({ figure: TEMPLATE_FIGURES[abbr], labelBright: 3 }, caption, dir()) };
  }
  const dv = DSO_VISUAL[id];
  if (dv) {
    const o = DSOS.find((x) => x.id === dv.id);
    if (!o) return null;
    const caption = fill(UI.capDso, { name: o.nameEn ? `${o.id} (${o.nameEn})` : o.id }) + (dv.fig ? ` ${fill(UI.capFigure, { con: constellationName(dv.fig) })}` : '');
    const svg = skySvg(
      {
        figure: dv.fig ? TEMPLATE_FIGURES[dv.fig] : undefined,
        mark: { ra: o.ra, dec: o.dec, label: o.id, ring: o.sizeArcmin / 120, color: DSO_COLORS[dsoGroup(o.type)] },
        radius: dv.radius,
        labelBright: 2,
        labelField: dv.fig ? undefined : 2.6,
      },
      caption,
      dir(),
    );
    return { caption, svg };
  }
  if (id === 'constellations' && figure) {
    const w = 100;
    const body = OVERVIEW.map((a, i) => skyGroup({ x: i * w + 2, y: 0, w: w - 4, h: 150 }, { figure: TEMPLATE_FIGURES[a], title: constellationName(a) })).join('');
    return { caption: figure, svg: `<svg class="cdx-svg" viewBox="0 0 300 150" role="img" aria-label="${figure.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">${body}</svg>` };
  }
  if (!figure) return null;
  const svg = diagramSvg(id, L, env, figure);
  return svg ? { svg, caption: figure } : null;
}

/** Các con số chính của mục thiên thể (rỗng với mục khái niệm: cột bên hiện công thức thay vào). */
export function entryFacts(id: string, env: DiagramEnv): Fact[] {
  const out: Fact[] = [];
  const add = (label: string, value: string | undefined) => {
    if (value) out.push({ label, value });
  };
  const sv = STAR_VISUAL[id];
  if (sv) {
    const idx = catalogIndexByHip(sv.hip);
    if (idx === undefined) return out;
    const s = getCatalogStar(idx);
    const abbr = starConstellation(sv.hip);
    add(t('info.ra'), fmtHMS(s.ra, { seconds: false }));
    add(t('info.dec'), fmtDegSigned(s.dec, 1));
    add(UI.mag, num(s.mag));
    add(UI.bv, num(s.bv));
    add(t('info.constellation'), abbr ? `${constellationName(abbr)} · ${constellationNameVi(abbr)}` : undefined);
    add(t('info.nameVi'), s.viName);
    return out;
  }
  const abbr = CONSTELLATION_VISUAL[id];
  if (abbr) {
    const f = TEMPLATE_FIGURES[abbr];
    add(UI.code, abbr);
    add(t('info.nameVi'), constellationNameVi(abbr));
    if (f) {
      add(UI.figStars, String(f.stars.length));
      const b = [...f.stars].sort((x, y) => x[2] - y[2])[0];
      if (b) add(UI.brightest, `${b[3] ? nameOf(b[3]).label : '—'} · m = ${num(b[2])}`);
      const decs = f.stars.map((x) => x[1]);
      add(UI.decRange, `${fmtDegSigned(Math.min(...decs), 0)} … ${fmtDegSigned(Math.max(...decs), 0)}`);
    }
    return out;
  }
  const dv = DSO_VISUAL[id];
  if (dv) {
    const o = DSOS.find((x) => x.id === dv.id);
    if (!o) return out;
    add(t('info.ra'), fmtHMS(o.ra, { seconds: false }));
    add(t('info.dec'), fmtDegSigned(o.dec, 1));
    add(UI.mag, num(o.mag, 1));
    add(UI.type, o.typeVi);
    add(t('info.nameVi'), o.nameVi);
    if (o.sizeArcmin) add(t('info.apparentSize'), o.sizeArcmin >= 60 ? `${fmtNum(o.sizeArcmin / 60, 1)}°` : `${fmtNum(o.sizeArcmin, 0)}′`);
    if (o.distanceLy) add(t('info.distance'), `≈ ${fmtLightYears(o.distanceLy)}`);
    return out;
  }
  if (id === 'sun') {
    add(UI.date, env.sunDate.split('-').reverse().join('/'));
    add(t('info.ra'), fmtHMS(env.sun.ra, { seconds: false }));
    add(t('info.dec'), fmtDegSigned(env.sun.dec, 1));
    add(UI.mag, num(-26.74));
    add(UI.bv, num(0.65));
  }
  return out;
}

/** Các dòng công thức ($$ …) trong thân bài của mục khái niệm. */
export const formulaLines = (body: string[]): string[] => body.filter((l) => l.startsWith('$$'));
