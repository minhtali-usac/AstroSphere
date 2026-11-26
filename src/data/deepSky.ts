// Thiên thể sâu (Messier + vài thiên thể NGC/PGC sáng) và sao chổi tuần hoàn tiêu biểu.
// Định danh theo chuẩn quốc tế (Messier, NGC/IC, PGC; ký hiệu sao chổi theo IAU/MPC) để tra cứu được trên
// SIMBAD, NED, VizieR. Tọa độ (J2000), cấp sao và kích thước biểu kiến lấy từ d3-celestial; khoảng cách là
// giá trị tham khảo làm tròn từ các tài liệu phổ biến (SIMBAD/NED, NASA), sai số có thể tới 10–20 %.

import { pick } from '../i18n/locale';
import raw from './generated/dsos.json';

type RawDso = [string, string, string, string, number, number, number, number];

export type DsoType = 's' | 'e' | 'i' | 'l' | 'sd' | 'oc' | 'gc' | 'sfr' | 'en' | 'rn' | 'pn' | 'snr' | 'pos';

const DSO_TYPE_VI: Record<string, string> = {
  s: 'Thiên hà xoắn ốc',
  e: 'Thiên hà elip',
  i: 'Thiên hà vô định hình',
  l: 'Thiên hà dạng thấu kính',
  sd: 'Thiên hà lùn',
  oc: 'Cụm sao mở',
  gc: 'Cụm sao cầu',
  sfr: 'Vùng hình thành sao (tinh vân phát xạ)',
  en: 'Tinh vân phát xạ',
  rn: 'Tinh vân phản xạ',
  pn: 'Tinh vân hành tinh',
  snr: 'Tàn dư siêu tân tinh',
  pos: 'Nhóm sao / đám mây sao',
};

const DSO_TYPE_EN: Record<string, string> = {
  s: 'Spiral galaxy',
  e: 'Elliptical galaxy',
  i: 'Irregular galaxy',
  l: 'Lenticular galaxy',
  sd: 'Dwarf galaxy',
  oc: 'Open cluster',
  gc: 'Globular cluster',
  sfr: 'Star-forming region (emission nebula)',
  en: 'Emission nebula',
  rn: 'Reflection nebula',
  pn: 'Planetary nebula',
  snr: 'Supernova remnant',
  pos: 'Asterism / star cloud',
};

/** Nhóm màu hiển thị theo loại. */
export function dsoGroup(type: string): 'galaxy' | 'nebula' | 'cluster' | 'other' {
  if (['s', 'e', 'i', 'l', 'sd'].includes(type)) return 'galaxy';
  if (['sfr', 'en', 'rn', 'pn', 'snr'].includes(type)) return 'nebula';
  if (['oc', 'gc'].includes(type)) return 'cluster';
  return 'other';
}

interface Extra {
  /** Tên chuẩn tiếng Anh (thay cho tên rút gọn trong dữ liệu gốc) */
  en?: string;
  vi?: string;
  /** Khoảng cách (năm ánh sáng), làm tròn */
  ly?: number;
  /** Định danh phụ bổ sung */
  desig?: string;
  type?: DsoType;
}

const EXTRA: Record<string, Extra> = {
  M1: { en: 'Crab Nebula', vi: 'Tinh vân Con Cua', ly: 6_500 },
  M4: { ly: 7_200 },
  M6: { en: 'Butterfly Cluster', ly: 1_600 },
  M7: { en: "Ptolemy's Cluster", ly: 980 },
  M8: { en: 'Lagoon Nebula', vi: 'Tinh vân Đầm Phá', ly: 4_100 },
  M11: { en: 'Wild Duck Cluster', ly: 6_200 },
  M13: { en: 'Great Hercules Cluster', vi: 'Cụm sao cầu lớn Vũ Tiên', ly: 22_200 },
  M16: { en: 'Eagle Nebula', vi: 'Tinh vân Đại Bàng', ly: 5_700 },
  M17: { en: 'Omega Nebula', ly: 5_500 },
  M20: { en: 'Trifid Nebula', vi: 'Tinh vân Ba Khúc', ly: 5_200 },
  M22: { ly: 10_600 },
  M27: { en: 'Dumbbell Nebula', vi: 'Tinh vân Quả Tạ', ly: 1_360 },
  M31: { en: 'Andromeda Galaxy', vi: 'Thiên hà Tiên Nữ', ly: 2_500_000 },
  M33: { en: 'Triangulum Galaxy', vi: 'Thiên hà Tam Giác', ly: 2_730_000 },
  M42: { en: 'Orion Nebula', vi: 'Tinh vân Lạp Hộ', ly: 1_344 },
  M44: { en: 'Beehive Cluster (Praesepe)', vi: 'Cụm sao Tổ Ong', ly: 577 },
  M45: { en: 'Pleiades', vi: 'Cụm sao Tua Rua (Thất Nữ)', ly: 444, desig: 'Mel 22' },
  M51: { en: 'Whirlpool Galaxy', vi: 'Thiên hà Xoáy Nước', ly: 28_000_000 },
  M57: { en: 'Ring Nebula', vi: 'Tinh vân Chiếc Nhẫn', ly: 2_600 },
  M81: { en: "Bode's Galaxy", vi: 'Thiên hà Bode', ly: 11_800_000 },
  M82: { en: 'Cigar Galaxy', vi: 'Thiên hà Xì Gà', ly: 11_400_000 },
  M87: { en: 'Virgo A', ly: 53_500_000 },
  M101: { en: 'Pinwheel Galaxy', ly: 21_000_000 },
  M104: { en: 'Sombrero Galaxy', vi: 'Thiên hà Mũ Rộng Vành', ly: 31_000_000 },
  LMC: { vi: 'Đám Mây Magellan Lớn', ly: 160_000, type: 'i' },
  SMC: { vi: 'Đám Mây Magellan Nhỏ', ly: 200_000 },
  'NGC 5139': { vi: 'Cụm sao cầu Omega Centauri', ly: 17_000 },
  'NGC 104': { vi: 'Cụm sao cầu 47 Tucanae', ly: 14_700 },
  'NGC 3372': { vi: 'Tinh vân Carina', ly: 8_500 },
  'NGC 869': { vi: 'Cụm sao đôi Anh Tiên', ly: 7_500 },
  'NGC 884': { vi: 'Cụm sao đôi Anh Tiên', ly: 7_500 },
  'IC 2602': { vi: 'Tua Rua phương Nam', ly: 480 },
};

export interface DeepSkyObject {
  index: number;
  /** Định danh chính: M31, NGC 5139, LMC… */
  id: string;
  /** Các định danh khác: NGC 224, ω Cen… */
  aliases: string[];
  nameEn: string;
  nameVi: string;
  type: string;
  typeVi: string;
  mag: number;
  /** Kích thước biểu kiến lớn nhất (phút cung) */
  sizeArcmin: number;
  ra: number;
  dec: number;
  distanceLy?: number;
  /** Đường kính thực ước tính (năm ánh sáng) = khoảng cách × kích thước góc */
  diameterLy?: number;
  /** Thiên thể tiêu biểu (có tên tiếng Việt) — được gắn nhãn trên bầu trời */
  featured: boolean;
}

export const DSOS: DeepSkyObject[] = (raw as unknown as RawDso[]).map(([id, desig, alt, type, mag, size, ra, dec], index) => {
  const x = EXTRA[id] ?? {};
  const t = x.type ?? type;
  const aliases = [desig, x.desig].filter((d): d is string => !!d);
  const distanceLy = x.ly;
  const diameterLy = distanceLy && size ? (distanceLy * size * Math.PI) / (180 * 60) : undefined;
  return {
    index,
    id,
    aliases,
    nameEn: x.en ?? alt,
    nameVi: x.vi ?? '',
    type: t,
    typeVi: pick(DSO_TYPE_VI, DSO_TYPE_EN)[t] ?? t,
    mag,
    sizeArcmin: size,
    ra,
    dec,
    distanceLy,
    diameterLy,
    featured: !!x.vi,
  };
});

/** "M31 · NGC 224" */
export function dsoDesignation(o: DeepSkyObject): string {
  return [o.id, ...o.aliases].join(' · ');
}

export interface Comet {
  /** Ký hiệu chuẩn IAU/MPC */
  designation: string;
  nameVi: string;
  /** Chu kỳ quỹ đạo (năm) */
  periodYr: number;
  /** Khoảng cách cận điểm q (AU) */
  perihelionAu: number;
  eccentricity: number;
  /** Độ nghiêng quỹ đạo (độ) */
  inclinationDeg: number;
  lastPerihelion: string;
  nextPerihelion: string;
  note: string;
}

/**
 * Sao chổi tuần hoàn tiêu biểu (số liệu làm tròn theo JPL Small-Body Database / IAU Minor Planet Center).
 * Vị trí sao chổi thay đổi nhanh theo thời gian nên không được vẽ lên bầu trời; bảng chỉ dùng để tra cứu.
 */
export const COMETS: Comet[] = [
  { designation: '1P/Halley', nameVi: pick('Sao chổi Halley', 'Halley\'s Comet'), periodYr: 75.3, perihelionAu: 0.586, eccentricity: 0.967, inclinationDeg: 162.3, lastPerihelion: pick('09/02/1986', '1986-02-09'), nextPerihelion: pick('28/07/2061', '2061-07-28'), note: pick('Nguồn của mưa sao băng Eta Aquariids và Orionids.', 'Source of the Eta Aquariid and Orionid meteor showers.') },
  { designation: '2P/Encke', nameVi: pick('Sao chổi Encke', 'Encke\'s Comet'), periodYr: 3.3, perihelionAu: 0.34, eccentricity: 0.848, inclinationDeg: 11.3, lastPerihelion: pick('22/10/2023', '2023-10-22'), nextPerihelion: pick('02/2027', '2027-02'), note: pick('Chu kỳ ngắn nhất trong các sao chổi sáng; nguồn của mưa sao băng Taurids.', 'Shortest period among the bright comets; source of the Taurid meteor shower.') },
  { designation: '55P/Tempel–Tuttle', nameVi: pick('Sao chổi Tempel–Tuttle', 'Comet Tempel–Tuttle'), periodYr: 33.2, perihelionAu: 0.976, eccentricity: 0.906, inclinationDeg: 162.5, lastPerihelion: pick('28/02/1998', '1998-02-28'), nextPerihelion: pick('05/2031', '2031-05'), note: pick('Nguồn của mưa sao băng Leonids (Sư Tử).', 'Source of the Leonid meteor shower.') },
  { designation: '109P/Swift–Tuttle', nameVi: pick('Sao chổi Swift–Tuttle', 'Comet Swift–Tuttle'), periodYr: 133, perihelionAu: 0.96, eccentricity: 0.963, inclinationDeg: 113.5, lastPerihelion: pick('12/12/1992', '1992-12-12'), nextPerihelion: pick('07/2126', '2126-07'), note: pick('Nguồn của mưa sao băng Perseids (Anh Tiên).', 'Source of the Perseid meteor shower.') },
  { designation: 'C/1995 O1 (Hale–Bopp)', nameVi: pick('Sao chổi Hale–Bopp', 'Comet Hale–Bopp'), periodYr: 2530, perihelionAu: 0.914, eccentricity: 0.995, inclinationDeg: 89.4, lastPerihelion: pick('01/04/1997', '1997-04-01'), nextPerihelion: pick('≈ năm 4380', '≈ year 4380'), note: pick('Nhìn thấy bằng mắt thường suốt khoảng 18 tháng (1996–1997).', 'Visible to the naked eye for about 18 months (1996–1997).') },
  { designation: 'C/2020 F3 (NEOWISE)', nameVi: pick('Sao chổi NEOWISE', 'Comet NEOWISE'), periodYr: 6800, perihelionAu: 0.295, eccentricity: 0.999, inclinationDeg: 128.9, lastPerihelion: pick('03/07/2020', '2020-07-03'), nextPerihelion: pick('≈ 6800 năm nữa', 'in ≈ 6800 years'), note: pick('Sao chổi sáng nhất quan sát được từ Bắc bán cầu kể từ Hale–Bopp.', 'The brightest comet seen from the Northern Hemisphere since Hale–Bopp.') },
];
