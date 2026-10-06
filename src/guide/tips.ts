// Usui-chan (redesign-2 R4): bảng tra thuần (không DOM) cho chế độ giải thích.
//
// - Mỗi điều khiển mang `data-guide="<khóa>"`; lời giải thích là chuỗi `guide.tip.<khóa>` trong vi.json
//   (src/guide/guide.test.ts kiểm mọi khóa dùng trong mã đều có chuỗi, và ngược lại).
// - GUIDE_CODEX: khóa → mục Codex cho liên kết "Đọc thêm trong Codex" (khóa `term` dùng chính data-codex của nút).
// - PASSIVE: vùng không bị chặn khi chạm trong chế độ giải thích (khung nhìn 3D: chạm vẫn kéo/chọn sao).

export const tipKey = (key: string): string => `guide.tip.${key}`;

export const GUIDE_CODEX: Readonly<Record<string, string>> = {
  horizonView: 'horizon',
  sphereView: 'sphere',
  firstPerson: 'altaz',
  infoCard: 'altaz',
  dataLat: 'latPole',
  dataPole: 'latPole',
  dataIncl: 'eqAngle',
  dataLon: 'lst',
  dataLst: 'lst',
  dataGst: 'lst',
  dataSolar: 'sun',
  dataSelected: 'radec',
  simplePlaces: 'latPole',
  simpleLat: 'latPole',
  simplePlay: 'diurnal',
  simpleSpeed: 'siderealDay',
  simpleAxis: 'pole',
  simpleEquator: 'equator',
  simpleZones: 'circumpolar',
  latSlider: 'latPole',
  play: 'diurnal',
  animMode: 'siderealDay',
  lstSlider: 'lst',
  rate: 'siderealDay',
  sunDate: 'seasons',
  catalog: 'deepSky',
  templates: 'constellations',
  realSky: 'magnitude',
  trails: 'diurnal',
};

export const PASSIVE: ReadonlySet<string> = new Set(['horizonView', 'sphereView']);

/** Mục Codex cho một điều khiển (nút "?" mang sẵn mục của nó trong data-codex). */
export function codexFor(key: string, codexAttr?: string): string | null {
  if (key === 'term') return codexAttr || null;
  return GUIDE_CODEX[key] ?? null;
}
