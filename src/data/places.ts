// Các vị trí chọn nhanh.

import { pick } from '../i18n/locale';

export interface Place {
  id: string;
  name: string;
  lat: number;
  /** Bỏ trống: giữ nguyên kinh độ hiện tại (dùng cho các trường hợp biên). */
  lon?: number;
}

export const VN_PLACES: Place[] = [
  { id: 'hanoi', name: pick('Hà Nội', 'Hanoi'), lat: 21.03, lon: 105.85 },
  { id: 'hue', name: pick('Huế', 'Hue'), lat: 16.46, lon: 107.59 },
  { id: 'danang', name: pick('Đà Nẵng', 'Da Nang'), lat: 16.05, lon: 108.2 },
  { id: 'hcm', name: pick('TP.HCM', 'Ho Chi Minh City'), lat: 10.82, lon: 106.63 },
  { id: 'camau', name: pick('Cà Mau', 'Ca Mau'), lat: 9.18, lon: 105.15 },
  { id: 'truongsa', name: pick('Trường Sa', 'Truong Sa'), lat: 8.64, lon: 111.92 },
  { id: 'hoangsa', name: pick('Hoàng Sa', 'Hoang Sa'), lat: 16.53, lon: 111.61 },
];

export const SPECIAL_PLACES: Place[] = [
  { id: 'equator', name: pick('Xích đạo', 'Equator'), lat: 0 },
  { id: 'northpole', name: pick('Bắc Cực', 'North Pole'), lat: 90 },
  { id: 'southpole', name: pick('Nam Cực', 'South Pole'), lat: -90 },
];

export const DEFAULT_PLACE = VN_PLACES[0];
