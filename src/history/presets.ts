// Các thời điểm lịch sử có sẵn và các nơi quan sát cổ. Năm theo cách đánh số thiên văn (0 = 1 TCN).

import { VN_PLACES } from '../data/places';
import type { H } from './text';

export interface Preset {
  id: keyof typeof H.presets;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  lat: number;
  lon: number;
  /** Điểm đánh dấu thêm (tọa độ J2000, độ), ví dụ siêu tân tinh 1054. */
  marker?: { ra: number; dec: number };
}

export const PRESETS: readonly Preset[] = [
  { id: 'giza', year: -2559, month: 3, day: 21, hour: 21, minute: 0, lat: 29.98, lon: 31.13 },
  { id: 'coloa', year: -256, month: 9, day: 1, hour: 20, minute: 0, lat: 21.11, lon: 105.87 },
  { id: 'hipparchus', year: -126, month: 6, day: 20, hour: 22, minute: 0, lat: 36.43, lon: 28.22 },
  { id: 'ptolemy', year: 150, month: 9, day: 15, hour: 21, minute: 0, lat: 31.2, lon: 29.92 },
  { id: 'thanglong', year: 1010, month: 8, day: 1, hour: 20, minute: 0, lat: 21.03, lon: 105.85 },
  { id: 'sn1054', year: 1054, month: 7, day: 4, hour: 4, minute: 0, lat: 34.8, lon: 114.3, marker: { ra: 83.633, dec: 22.015 } },
  // "today" được điền lúc bấm (ngày giờ thật và vị trí đang dùng trong mô phỏng).
  { id: 'today', year: 2000, month: 1, day: 1, hour: 21, minute: 0, lat: 21.03, lon: 105.85 },
];

export interface OldPlace {
  id: keyof typeof H.places;
  lat: number;
  lon: number;
}

export const OLD_PLACES: readonly OldPlace[] = [
  { id: 'giza', lat: 29.98, lon: 31.13 },
  { id: 'alexandria', lat: 31.2, lon: 29.92 },
  { id: 'rhodes', lat: 36.43, lon: 28.22 },
  { id: 'babylon', lat: 32.54, lon: 44.42 },
  { id: 'stonehenge', lat: 51.18, lon: -1.83 },
  { id: 'coloa', lat: 21.11, lon: 105.87 },
  { id: 'kaifeng', lat: 34.8, lon: 114.3 },
  { id: 'chichen', lat: 20.68, lon: -88.57 },
];

export const VN = VN_PLACES.filter((p) => p.lon !== undefined) as { id: string; name: string; lat: number; lon: number }[];

/** Khoảng năm cho phép (năm thiên văn). Xa hơn thì đa thức tuế sai và ΔT không còn đáng tin. */
export const YEAR_MIN = -6000;
export const YEAR_MAX = 3000;
