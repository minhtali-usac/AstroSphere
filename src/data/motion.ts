// Chuyển động riêng (mas/năm) của các sao trong danh mục, dùng cho «Bầu trời xưa».
//
// Hai nguồn, nguồn đầy đủ thắng:
//   1. `fetched/hip-motion.json` — toàn bộ danh mục theo Hipparcos (CDS VizieR I/311), do `npm run fetch-sky` ghi
//      (không sửa tay). Nếu tệp chưa có thì bỏ qua.
//   2. CURATED — bảng chọn lọc gồm các sao sáng và các sao chuyển động riêng lớn nhất trong danh mục, làm tròn theo
//      Hipparcos/Gaia. Đây là mạng an toàn để «Bầu trời xưa» đúng ngay cả khi tệp trên chưa được lấy về: các sao
//      còn lại chuyển động riêng thường dưới 50 mas/năm, tức < 0,07° sau 5000 năm — nhỏ hơn đường kính một ngôi sao
//      vẽ trên màn hình.

interface MotionFile {
  hip: number[];
  pmRa: number[];
  pmDe: number[];
}

/** [HIP, tên riêng (hoặc ký hiệu Bayer nếu sao không có tên riêng), μα·cos δ, μδ] (mas/năm). Tên được kiểm tra với danh mục để bắt lỗi gõ nhầm số HIP. */
export const CURATED: readonly (readonly [number, string, number, number])[] = [
  [32349, 'Sirius', -546.01, -1223.07],
  [30438, 'Canopus', 19.93, 23.24],
  [69673, 'Arcturus', -1093.39, -2000.06],
  [71683, 'Rigil Kentaurus', -3679.25, 473.67],
  [71681, 'Toliman', -3614.39, 802.98],
  [68702, 'Hadar', -33.27, -23.16],
  [91262, 'Vega', 200.94, 286.23],
  [24608, 'Capella', 75.52, -427.11],
  [24436, 'Rigel', 1.31, 0.5],
  [37279, 'Procyon', -714.59, -1036.8],
  [7588, 'Achernar', 87.0, -38.24],
  [27989, 'Betelgeuse', 27.33, 10.86],
  [97649, 'Altair', 536.82, 385.54],
  [21421, 'Aldebaran', 62.78, -189.36],
  [80763, 'Antares', -12.11, -23.3],
  [65474, 'Spica', -42.35, -30.67],
  [37826, 'Pollux', -625.69, -45.95],
  [113368, 'Fomalhaut', 329.22, -164.22],
  [102098, 'Deneb', 1.56, 1.55],
  [49669, 'Regulus', -249.4, 4.91],
  [11767, 'Polaris', 44.48, -11.85],
  [68756, 'Thuban', -56.52, 17.19],
  [54061, 'Dubhe', -136.46, -35.25],
  [53910, 'Merak', 81.66, 33.74],
  [58001, 'Phecda', 107.76, 11.16],
  [59774, 'Megrez', 103.56, 7.81],
  [62956, 'Alioth', 111.74, -8.99],
  [65378, 'Mizar', 121.23, -22.01],
  [67301, 'Alkaid', -121.23, -15.56],
  [36850, 'Castor', -206.33, -148.18],
  [25336, 'Bellatrix', -8.75, -13.28],
  [26311, 'Alnilam', 1.49, -1.06],
  [26727, 'Alnitak', 3.19, 2.03],
  [25930, 'Mintaka', 0.64, -0.69],
  [15863, 'Mirfak', 24.11, -26.01],
  [9884, 'Hamal', 190.73, -145.77],
  [677, 'Alpheratz', 135.68, -162.95],
  [746, 'Caph', 523.39, -180.42],
  [3179, 'Shedar', 50.36, -32.17],
  [5447, 'Mirach', 175.59, -112.23],
  [14135, 'Menkar', -11.81, -78.76],
  [72607, 'Kochab', -32.29, 11.91],
  [85927, 'Shaula', -8.9, -29.95],
  [61084, 'Gacrux', 27.94, -264.33],
  [60718, 'Acrux', -35.37, -14.73],
  [62434, 'Mimosa', -48.24, -12.82],
  [100751, 'Peacock', 7.71, -86.15],
  [57632, 'Denebola', -499.02, -113.78],
  [87833, 'Eltanin', -8.52, -23.05],
  [14576, 'Algol', 2.39, -1.44],
  [3419, 'Diphda', 232.79, 32.71],
  [25428, 'Elnath', 23.28, -174.22],
  [100453, 'Sadr', 2.43, -0.93],
  [105199, 'Alderamin', 149.91, 49.73],
  [90185, 'Kaus Australis', -39.61, -124.05],
  [92855, 'Nunki', 13.87, -52.65],
  [86032, 'Rasalhague', 110.08, -222.61],
  [84345, 'Rasalgethi', -7.33, 36.13],
  [76267, 'Alphecca', 120.38, -89.44],
  [45238, 'Miaplacidus', -157.66, 108.91],
  [46390, 'Alphard', -14.49, 33.25],
  [45556, 'Aspidiske', -19.03, 13.11],
  [16537, 'Ran', -975.17, 19.49],
  [8102, 'τ Cet', -1721.78, 854.16],
  [108870, 'ε Ind', 3966.41, -2536.19],
  [2021, 'β Hyi', 2263.2, 22.5],
];

const fetchedFiles = import.meta.glob<MotionFile>('./fetched/hip-motion.json', { eager: true, import: 'default' });
const fetched: MotionFile | undefined = Object.values(fetchedFiles)[0];

const table = new Map<number, [number, number]>();
for (const [hip, , ra, de] of CURATED) table.set(hip, [ra, de]);
if (fetched) fetched.hip.forEach((hip, i) => table.set(hip, [fetched.pmRa[i], fetched.pmDe[i]]));

/** Nguồn đang dùng: "hipparcos" (toàn danh mục) hoặc "curated" (bảng chọn lọc). */
export const MOTION_SOURCE: 'hipparcos' | 'curated' = fetched ? 'hipparcos' : 'curated';

/** (μα·cos δ, μδ) mas/năm của sao theo HIP; undefined nếu không có số liệu (coi như đứng yên). */
export function properMotionOf(hip: number): readonly [number, number] | undefined {
  return table.get(hip);
}

/** Số sao có chuyển động riêng. */
export const motionCount = table.size;
