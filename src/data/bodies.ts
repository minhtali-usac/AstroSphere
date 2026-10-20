// Tính chất vật lý của Mặt Trời, tám hành tinh và Mặt Trăng cho chế độ «Bay vào vũ trụ».
//
// Nguồn:
// - Bán kính trung bình, chu kỳ tự quay (giờ, âm là quay ngược), độ nghiêng trục, khối lượng (lần Trái Đất):
//   NASA NSSDCA Planetary Fact Sheets, https://nssdc.gsfc.nasa.gov/planetary/factsheet/ (Mặt Trời: sunfact.html).
// - Hướng cực Bắc quay (α, δ J2000): IAU WGCCRE 2015, Archinal và cộng sự (2018), Celest. Mech. Dyn. Astr. 130:22.
// - Vành đai Sao Thổ (bán kính các vành C, B, A và khe Cassini, khe Encke; km): NASA Saturnian Rings Fact Sheet,
//   https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html. Độ đục của từng vành là minh họa (vành B dày
//   và sáng nhất, vành C mờ), không phải số đo độ sâu quang học.
// Màu sắc là bảng màu minh họa gần với màu thật của từng thiên thể, không phải số đo.

import type { PlanetId } from '../astro/planets';

export type BodyId = 'sun' | PlanetId | 'moon';

export type Look = 'star' | 'rocky' | 'cloudy' | 'earth' | 'gasGiant' | 'iceGiant' | 'moon';

export interface BodyInfo {
  id: BodyId;
  radiusKm: number;
  /** Chu kỳ tự quay sao (giờ); âm nghĩa là quay ngược chiều. */
  rotationH: number;
  /** Độ nghiêng trục so với mặt phẳng quỹ đạo (độ). */
  tiltDeg: number;
  /** Hướng cực Bắc quay, α và δ J2000 (độ). */
  poleRa: number;
  poleDec: number;
  massEarth: number;
  look: Look;
  /** Bảng màu minh họa: màu nền, màu phụ (dải mây, vùng tối…). */
  palette: [string, string];
  /** Vành đai: các vùng [bán kính trong, ngoài (km), độ đục minh họa]. */
  rings?: readonly (readonly [number, number, number])[];
}

export const BODIES: readonly BodyInfo[] = [
  { id: 'sun', radiusKm: 695700, rotationH: 609.12, tiltDeg: 7.25, poleRa: 286.13, poleDec: 63.87, massEarth: 332946, look: 'star', palette: ['#fff1c9', '#ffb347'] },
  { id: 'mercury', radiusKm: 2439.7, rotationH: 1407.6, tiltDeg: 0.034, poleRa: 281.01, poleDec: 61.42, massEarth: 0.0553, look: 'rocky', palette: ['#9c9690', '#6e6862'] },
  { id: 'venus', radiusKm: 6051.8, rotationH: -5832.5, tiltDeg: 177.4, poleRa: 272.76, poleDec: 67.16, massEarth: 0.815, look: 'cloudy', palette: ['#e8d6a8', '#cdb27a'] },
  { id: 'earth', radiusKm: 6371.0, rotationH: 23.9345, tiltDeg: 23.44, poleRa: 0, poleDec: 90, massEarth: 1, look: 'earth', palette: ['#2b5d9c', '#4f8a3c'] },
  { id: 'moon', radiusKm: 1737.4, rotationH: 655.72, tiltDeg: 6.68, poleRa: 269.99, poleDec: 66.54, massEarth: 0.0123, look: 'moon', palette: ['#a9a6a0', '#6f6c68'] },
  { id: 'mars', radiusKm: 3389.5, rotationH: 24.6229, tiltDeg: 25.19, poleRa: 317.68, poleDec: 52.89, massEarth: 0.107, look: 'rocky', palette: ['#c1623f', '#8a3f26'] },
  { id: 'jupiter', radiusKm: 69911, rotationH: 9.925, tiltDeg: 3.13, poleRa: 268.06, poleDec: 64.5, massEarth: 317.8, look: 'gasGiant', palette: ['#d9c3a0', '#a8714a'] },
  { id: 'saturn', radiusKm: 58232, rotationH: 10.656, tiltDeg: 26.73, poleRa: 40.59, poleDec: 83.54, massEarth: 95.2, look: 'gasGiant', palette: ['#e6d3a3', '#bfa36e'], rings: [[74658, 92000, 0.28], [92000, 117580, 0.9], [122170, 133423, 0.62], [133750, 136775, 0.55]] },
  { id: 'uranus', radiusKm: 25362, rotationH: -17.24, tiltDeg: 97.77, poleRa: 257.31, poleDec: -15.18, massEarth: 14.5, look: 'iceGiant', palette: ['#a7dde0', '#82c3c9'] },
  { id: 'neptune', radiusKm: 24622, rotationH: 16.11, tiltDeg: 28.32, poleRa: 299.36, poleDec: 43.46, massEarth: 17.1, look: 'iceGiant', palette: ['#4a73d9', '#2f4fa8'] },
];

export const BODY_BY_ID: Readonly<Record<BodyId, BodyInfo>> = Object.fromEntries(BODIES.map((b) => [b.id, b])) as Record<BodyId, BodyInfo>;
