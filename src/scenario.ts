// Tiện ích dựng tình huống trên mô phỏng — dùng cho các nhiệm vụ Ôn tập.

import { catalogIndexByHip } from './data/catalog';
import { DSOS } from './data/deepSky';
import type { Actions, Store } from './state';

export interface ScenarioContext {
  store: Store;
  actions: Actions;
}

/** Một số địa điểm hay dùng trong bài học. */
export const PLACES = {
  hanoi: { lat: 21.03, lon: 105.85 },
  hcm: { lat: 10.82, lon: 106.63 },
  /** Một nơi ở Nam bán cầu cho chế độ Cơ bản (Sydney, Úc). */
  sydney: { lat: -33.87, lon: 151.21 },
} as const;

export type PlaceKey = keyof typeof PLACES;

/** Một điểm chọn nhanh; thiếu `lon` = giữ nguyên kinh độ hiện tại (trường hợp biên như Xích đạo, Bắc Cực). */
export interface QuickPlace {
  key: 'hanoi' | 'hcm' | 'equator' | 'northPole' | 'sydney';
  lat: number;
  lon?: number;
}

/** Các nơi chọn nhanh của chế độ Cơ bản: hai nơi ở Việt Nam, hai trường hợp biên, một nơi ở Nam bán cầu. */
export const QUICK_PLACES: readonly QuickPlace[] = [
  { key: 'hanoi', ...PLACES.hanoi },
  { key: 'hcm', ...PLACES.hcm },
  { key: 'equator', lat: 0 },
  { key: 'northPole', lat: 90 },
  { key: 'sydney', ...PLACES.sydney },
];

/** Đưa người quan sát tới một nơi chọn nhanh. */
export function goToPlace(ctx: ScenarioContext, p: QuickPlace): void {
  ctx.actions.setLocation(p.lat, p.lon ?? ctx.store.state.lon);
}

/** Người quan sát đang đứng đúng ở nơi chọn nhanh này (sai số làm tròn 0,01°). */
export function atPlace(lat: number, lon: number, p: QuickPlace): boolean {
  return Math.abs(lat - p.lat) < 0.005 && (p.lon === undefined || Math.abs(lon - p.lon) < 0.005);
}

/** Thêm mẫu chòm sao nếu chưa có. */
export function ensureConstellation(ctx: ScenarioContext, id: string): void {
  if (!ctx.actions.hasConstellation(id)) ctx.actions.addConstellation(id);
}

/** Chọn sao (đã có trong danh sách sao người dùng) theo số Hipparcos. */
export function selectHip(ctx: ScenarioContext, hip: number): boolean {
  const star = ctx.store.state.stars.find((x) => x.hip === hip);
  if (star) ctx.actions.select({ kind: 'user', id: star.id });
  return !!star;
}

/** Bật/tắt cả ba vùng tô màu (cận cực, mọc – lặn, không mọc). */
export function zones(ctx: ScenarioContext, on: boolean): void {
  ctx.actions.setToggle('zoneCircumpolar', on);
  ctx.actions.setToggle('zoneRiseSet', on);
  ctx.actions.setToggle('zoneNeverRise', on);
}

/** Chọn một sao trong danh mục sao sáng theo số Hipparcos (bật lớp sao sáng nếu đang tắt). Dùng cho Codex. */
export function selectCatalogHip(ctx: ScenarioContext, hip: number): boolean {
  const index = catalogIndexByHip(hip);
  if (index === undefined) return false;
  if (!ctx.store.state.toggles.catalog) ctx.actions.setToggle('catalog', true);
  ctx.actions.select({ kind: 'catalog', index });
  return true;
}

/** Bật lớp thiên thể sâu và chọn một thiên thể theo định danh (M31, M42…). */
export function selectDso(ctx: ScenarioContext, id: string): boolean {
  const index = DSOS.findIndex((o) => o.id === id);
  if (index < 0) return false;
  ctx.actions.setToggle('deepSky', true);
  ctx.actions.select({ kind: 'dso', index });
  return true;
}
