// Mẫu chòm sao (đường nối từ d3-celestial) với tên quốc tế IAU và tên tiếng Việt (phụ).
// Tên tiếng Việt (Hán Việt / thuần Việt) lấy từ Wikipedia tiếng Việt "Danh sách chòm sao" (CC BY-SA 4.0),
// chỉ hiện trong phần chi tiết.
//
// Gói khởi động chỉ chứa hình của 16 mẫu (TEMPLATE_FIGURES, ~7 KB). Đủ 88 chòm sao (~29 KB) được
// tải động bằng loadAllFigures() khi lớp "Chòm sao" cần vẽ.

import templateRaw from './generated/constellation-templates.json';
import names from './constellationNames.json';
import { LANG, pick } from '../i18n/locale';

export interface ConstellationFigure {
  /** [α (độ), δ (độ), cấp sao, HIP (0 nếu không khớp)] */
  stars: [number, number, number, number][];
  /** Cặp chỉ số sao được nối với nhau */
  segs: [number, number][];
}

export type FigureMap = Record<string, ConstellationFigure>;

/** Hình của các mẫu trong TEMPLATES (nạp sẵn). */
export const TEMPLATE_FIGURES = templateRaw as unknown as FigureMap;

let allFigures: Promise<FigureMap> | null = null;

/** Tải hình của đủ 88 chòm sao (một lần, dùng chung). */
export function loadAllFigures(): Promise<FigureMap> {
  allFigures ??= import('./generated/constellations.json').then((m) => m.default as unknown as FigureMap);
  return allFigures;
}

const NAMES = names as Record<string, { iau: string; hanViet: string; thuanViet: string }>;

/** Tên quốc tế (IAU) theo mã viết tắt 3 chữ: "UMa" → "Ursa Major". */
export function constellationName(abbr: string): string {
  return NAMES[abbr]?.iau ?? abbr;
}

/** Tên tiếng Việt: "Đại Hùng (Gấu Lớn)". */
export function constellationNameVi(abbr: string): string {
  const { viName, alias } = viParts(abbr);
  return alias ? `${viName} (${alias})` : viName;
}

export interface ConstellationTemplate {
  /** Mã IAU 3 chữ */
  id: string;
  /** Tên IAU (Latin) — dùng cho danh sách mẫu, nhãn 3D, thẻ chòm và thẻ thông tin (ux-brief §7). */
  name: string;
  /** Tên tiếng Việt — chỉ hiện ở dòng mô tả của mẫu, sau tên IAU. */
  viName: string;
  /** Tên gọi khác bằng tiếng Việt (có thể rỗng). */
  alias: string;
  note: string;
}

/** Tên tiếng Việt của một chòm: Hán Việt chính, tên thuần Việt khác (nếu có) làm tên gọi khác. */
function viParts(abbr: string): { viName: string; alias: string } {
  const n = NAMES[abbr];
  if (!n) return { viName: '', alias: '' };
  const han = n.hanViet.split(', ');
  const extra = n.thuanViet.split(', ').filter((x) => x && !han.includes(x));
  return { viName: n.hanViet, alias: extra.join(', ') };
}

function tpl(id: string, rest: { note: string }): ConstellationTemplate {
  return { id, name: constellationName(id), ...viParts(id), ...rest };
}

export const TEMPLATES: ConstellationTemplate[] = [
  tpl('UMa', { note: pick('Chứa nhóm sao Big Dipper (Bắc Đẩu, cái gáo); hai sao Dubhe và Merak chỉ hướng về Polaris.', 'Contains the Big Dipper asterism (the Plough); the stars Dubhe and Merak point towards Polaris.') }),
  tpl('UMi', { note: pick('Polaris (sao Bắc Cực) ở đuôi, gần như trùng thiên cực Bắc (δ ≈ +89,3°).', 'Polaris (the North Star) marks the tail, almost exactly at the north celestial pole (δ ≈ +89.3°).') }),
  tpl('Cas', { note: pick('Hình chữ W, đối diện Big Dipper qua Polaris.', 'A W-shaped figure, opposite the Big Dipper across Polaris.') }),
  tpl('Ori', { note: pick('Nằm trên xích đạo trời: mọc gần chính Đông, lặn gần chính Tây. Có Betelgeuse và Rigel.', 'Lies on the celestial equator: rises almost due east and sets almost due west. Home of Betelgeuse and Rigel.') }),
  tpl('Cru', { note: pick('Chòm sao nhỏ nhất, gần thiên cực Nam (δ ≈ −57° … −63°). Có Acrux và Gacrux.', 'The smallest constellation, near the south celestial pole (δ ≈ −57° … −63°). Home of Acrux and Gacrux.') }),
  tpl('Sco', { note: pick('Có Antares màu đỏ, nằm ở phía Nam xích đạo trời.', 'Home of the red star Antares, south of the celestial equator.') }),
  tpl('Cyg', { note: pick('Có Deneb, nằm trên dải Ngân Hà.', 'Home of Deneb, lying along the Milky Way.') }),
  tpl('Lyr', { note: pick('Có Vega, một trong các sao sáng nhất bầu trời.', 'Home of Vega, one of the brightest stars in the sky.') }),
  tpl('Aql', { note: pick('Có Altair; cùng Vega và Deneb tạo thành Tam giác Mùa hè.', 'Home of Altair, which forms the Summer Triangle with Vega and Deneb.') }),
  tpl('Leo', { note: pick('Có Regulus, nằm gần hoàng đạo.', 'Home of Regulus, close to the ecliptic.') }),
  tpl('Gem', { note: pick('Hai sao sáng Castor và Pollux.', 'Marked by the two bright stars Castor and Pollux.') }),
  tpl('CMa', { note: pick('Có Sirius — sao sáng nhất bầu trời đêm.', 'Home of Sirius, the brightest star in the night sky.') }),
  tpl('Tau', { note: pick('Có Aldebaran và cụm sao Pleiades (M45) gần đó.', 'Home of Aldebaran, with the Pleiades cluster (M45) nearby.') }),
  tpl('Sgr', { note: pick('Hướng về tâm Ngân Hà.', 'Points towards the centre of the Milky Way.') }),
  tpl('Cen', { note: pick('Có Rigil Kentaurus (α Centauri) — hệ sao gần Mặt Trời nhất.', 'Home of Rigil Kentaurus (α Centauri), the closest star system to the Sun.') }),
  tpl('Peg', { note: pick('Hình vuông lớn Great Square of Pegasus, dễ nhận vào mùa thu.', 'Known for the Great Square of Pegasus, easy to find in the northern autumn.') }),
];

/** Dòng mô tả của mẫu: tên IAU trước, tên tiếng Việt sau, rồi ghi chú — "Ursa Major — Đại Hùng (Gấu Lớn). …". */
export function templateDescription(t: ConstellationTemplate): string {
  // Bản tiếng Anh: chỉ tên và mã viết tắt theo chuẩn IAU.
  if (LANG === 'en') return `${t.name} (${t.id}). ${t.note}`;
  return `${t.name} — ${t.viName}${t.alias ? ` (${t.alias})` : ''}. ${t.note}`;
}

export function getTemplate(id: string): ConstellationTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
