// Một nguồn trạng thái duy nhất. Cả hai khung nhìn và mọi bảng điều khiển chỉ đọc/ghi qua đây.

import { clamp, gmstDeg, julianDate, norm360 } from './astro';
import { getCatalogStar, catalogIndexByHip } from './data/catalog';
import { TEMPLATE_FIGURES, constellationName, getTemplate } from './data/constellations';
import { DEFAULT_PLACE } from './data/places';
import { COLORS } from './scene/colors';
import type { EmphasisKey } from './emphasis';

export type { EmphasisKey } from './emphasis';

export type TrailMode = 'none' | 'short' | 'long';
/** Chế độ giao diện (redesign-2 R2): Cơ bản cho người mới, Đầy đủ là giao diện trọn vẹn. Khác `AnimMode` (chế độ chạy hoạt ảnh). */
export type UiMode = 'simple' | 'full';
export const UI_MODES: readonly UiMode[] = ['simple', 'full'];
export const isUiMode = (v: unknown): v is UiMode => v === 'simple' || v === 'full';
export type AnimMode = 'continuous' | 'oneDay' | 'stepHour';

export interface UserStar {
  id: string;
  name: string;
  ra: number;
  dec: number;
  mag: number;
  color: string;
  kind: 'random' | 'manual' | 'constellation';
  /** Số Hipparcos nếu trùng một sao trong danh mục */
  hip?: number;
  /** Tên ngắn dùng cho nhãn */
  short?: string;
  /** Hiện nhãn tên trên khung nhìn */
  labelled: boolean;
  figureId?: string;
}

export interface Figure {
  id: string;
  templateId: string;
  name: string;
  color: string;
  starIds: string[];
  segs: [number, number][];
}

export type Selection =
  | { kind: 'user'; id: string }
  | { kind: 'catalog'; index: number }
  | { kind: 'dso'; index: number }
  | { kind: 'sun' }
  | null;

export interface Toggles {
  hourCircle0: boolean;
  equator: boolean;
  underside: boolean;
  zoneNeverRise: boolean;
  zoneRiseSet: boolean;
  zoneCircumpolar: boolean;
  angle: boolean;
  poleAltitude: boolean;
  poleAxis: boolean;
  equatorPlane: boolean;
  zenithNadir: boolean;
  meridian: boolean;
  verticalCircle: boolean;
  horizonOnSphere: boolean;
  altAzGrid: boolean;
  eqGrid: boolean;
  catalog: boolean;
  constellationLines: boolean;
  ecliptic: boolean;
  galactic: boolean;
  sun: boolean;
  deepSky: boolean;
}

export interface LabelToggles {
  all: boolean;
  directions: boolean;
  poles: boolean;
  circles: boolean;
  stars: boolean;
  angles: boolean;
}

export interface AppState {
  lat: number;
  lon: number;
  /** Giờ thiên văn Greenwich (độ), liên tục — không chuẩn hóa để vết sao và hoạt ảnh tính được quãng đã quay. */
  gst: number;
  playing: boolean;
  mode: AnimMode;
  /** Số giây (thời gian thực) cho một ngày thiên văn trong hoạt ảnh. */
  rate: number;
  /** LST (liên tục) lúc bắt đầu chạy — dùng cho chế độ "chạy 1 ngày rồi dừng". */
  runStartLst: number;
  toggles: Toggles;
  labels: LabelToggles;
  stars: UserStar[];
  figures: Figure[];
  trails: TrailMode;
  /** LST (liên tục) tại lúc vết sao bắt đầu được vẽ. */
  trailStart: number;
  selected: Selection;
  /** Ngày dùng để đặt Mặt Trời (YYYY-MM-DD). */
  sunDate: string;
  /**
   * Tô sáng liên kết (ux-brief §6): con số đang được rê chuột / chọn tiêu điểm, hoặc hình 3D đang được rê chuột.
   * Hình tương ứng trong hai khung nhìn đậm lên; ô số tương ứng có lớp `is-linked`. null = không tô sáng.
   */
  emphasis: EmphasisKey | null;
  /** Chế độ giao diện: Cơ bản (mặc định cho lần đầu) hoặc Đầy đủ. Lớp `body.mode-*` phản chiếu giá trị này. */
  uiMode: UiMode;
}

export const TRAIL_LENGTH_DEG: Record<TrailMode, number> = { none: 0, short: 45, long: 359 };
export const RATE_MIN = 5;
export const RATE_MAX = 60;
export const MAX_USER_STARS = 400;
/** Số Hipparcos của Polaris (α UMi). */
export const POLARIS_HIP = 11767;

export const DEFAULT_TOGGLES: Toggles = {
  hourCircle0: true,
  equator: true,
  underside: false,
  zoneNeverRise: false,
  zoneRiseSet: false,
  zoneCircumpolar: false,
  angle: false,
  poleAltitude: false,
  poleAxis: true,
  equatorPlane: false,
  zenithNadir: true,
  meridian: false,
  verticalCircle: true,
  horizonOnSphere: true,
  altAzGrid: false,
  eqGrid: false,
  catalog: true,
  constellationLines: true,
  ecliptic: false,
  galactic: false,
  sun: false,
  deepSky: false,
};

export const DEFAULT_LABELS: LabelToggles = {
  all: true,
  directions: true,
  poles: true,
  circles: true,
  stars: true,
  angles: true,
};

/**
 * Màu của sao ngẫu nhiên và sao nhập tay: tông cát trung tính của mọi thứ người dùng thêm vào (cùng màu hình chòm sao,
 * COLORS.figure). Bảng chín màu cũ trùng màu ngữ nghĩa của cảnh (hồng = vòng thẳng đứng, cam = hoàng đạo, trắng xám =
 * kinh tuyến: ΔE OKLab 0); tông này cách mọi màu ngữ nghĩa ≥ 0,098 (quyết định 2026-10-05, TODO "Random and manual
 * star colours").
 */
export const USER_STAR_COLOR = COLORS.figure;

export function todayIso(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** LST liên tục (độ). */
export const lstCont = (s: AppState) => s.gst + s.lon;
/** LST chuẩn hóa về [0, 360). */
export const lstOf = (s: AppState) => norm360(s.gst + s.lon);

type Listener = (s: AppState, prev: AppState) => void;

export class Store {
  private s: AppState;
  private listeners = new Set<Listener>();

  constructor(initial: AppState) {
    this.s = initial;
  }

  get state(): AppState {
    return this.s;
  }

  set(patch: Partial<AppState>): void {
    const prev = this.s;
    this.s = { ...prev, ...patch };
    for (const l of this.listeners) l(this.s, prev);
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

let idCounter = 0;
const nextId = (p: string) => `${p}${++idCounter}`;

function buildConstellation(templateId: string): { stars: UserStar[]; figure: Figure } | null {
  const tpl = getTemplate(templateId);
  const fig = TEMPLATE_FIGURES[templateId];
  if (!tpl || !fig) return null;
  const name = constellationName(templateId);
  const figureId = nextId('f');
  const stars: UserStar[] = fig.stars.map(([ra, dec, mag, hip], i) => {
    const ci = hip ? catalogIndexByHip(hip) : undefined;
    const cat = ci !== undefined ? getCatalogStar(ci) : undefined;
    return {
      id: nextId('s'),
      name: cat ? cat.label : `${name} – ${i + 1}`,
      ra,
      dec,
      mag,
      color: COLORS.figure,
      kind: 'constellation',
      labelled: !!cat?.shortName && mag <= 2.1,
      hip: hip || undefined,
      short: cat?.shortName || undefined,
      figureId,
    };
  });
  const figure: Figure = {
    id: figureId,
    templateId,
    name,
    color: COLORS.figure,
    starIds: stars.map((x) => x.id),
    segs: fig.segs.map(([a, b]) => [a, b] as [number, number]),
  };
  return { stars, figure };
}

export function createInitialState(): AppState {
  const now = new Date();
  const lon = DEFAULT_PLACE.lon ?? 0;
  const gst = gmstDeg(julianDate(now));
  const base: AppState = {
    lat: DEFAULT_PLACE.lat,
    lon,
    gst,
    // Cảnh mở đầu: bầu trời quay chậm (1 ngày thiên văn trong 60 s). main.ts tạm dừng nếu người dùng giảm chuyển động.
    playing: true,
    mode: 'continuous',
    rate: 60,
    runStartLst: gst + lon,
    toggles: { ...DEFAULT_TOGGLES },
    labels: { ...DEFAULT_LABELS },
    stars: [],
    figures: [],
    trails: 'short',
    trailStart: gst + lon,
    selected: null,
    sunDate: todayIso(now),
    emphasis: null,
    uiMode: 'simple',
  };
  // Mặc định chỉ hiện sao thật cùng đường nối và tên chòm sao (tên quốc tế); các lớp khác người dùng tự bật.
  // Cảnh mở đầu chọn sẵn Polaris (HIP 11767) trong danh mục sao thật — tìm theo số Hipparcos, không theo tên.
  const polaris = catalogIndexByHip(POLARIS_HIP);
  if (polaris !== undefined) base.selected = { kind: 'catalog', index: polaris };
  return base;
}

/** Các thao tác thay đổi trạng thái (dùng chung cho mọi bảng điều khiển). */
export class Actions {
  constructor(private store: Store) {}

  private get s() {
    return this.store.state;
  }

  setLocation(lat: number, lon: number): void {
    lat = clamp(Math.round(lat * 100) / 100, -90, 90);
    lon = clamp(Math.round(lon * 100) / 100, -180, 180);
    if (lat === this.s.lat && lon === this.s.lon) return;
    // Cùng một thời điểm (GST giữ nguyên) nhưng ở nơi khác → LST đổi theo kinh độ; vết sao vẽ lại từ đầu.
    this.store.set({ lat, lon, trailStart: this.s.gst + lon, runStartLst: this.s.gst + lon });
  }

  /** Đặt LST (độ, 0..360) — dùng cho thanh trượt "Giờ thiên văn". */
  setLst(lstDeg: number): void {
    const cur = lstCont(this.s);
    const base = Math.floor(cur / 360) * 360;
    let target = base + norm360(lstDeg);
    // Chọn giá trị gần nhất với LST hiện tại để thao tác kéo tay không nhảy cả vòng.
    if (target - cur > 180) target -= 360;
    if (cur - target > 180) target += 360;
    this.moveToLst(target);
  }

  advance(deltaDeg: number): void {
    this.moveToLst(lstCont(this.s) + deltaDeg);
  }

  private moveToLst(target: number): void {
    const patch: Partial<AppState> = { gst: target - this.s.lon };
    if (target < this.s.trailStart) patch.trailStart = target;
    this.store.set(patch);
  }

  stepHours(n: number): void {
    const cur = lstCont(this.s);
    // Bước tới mốc giờ tròn kế tiếp/trước đó.
    const h = cur / 15;
    const target = n > 0 ? (Math.floor(h + 1e-6) + n) * 15 : (Math.ceil(h - 1e-6) + n) * 15;
    this.moveToLst(target);
  }

  setNow(): void {
    const now = new Date();
    const gst = gmstDeg(julianDate(now));
    const lst = gst + this.s.lon;
    this.store.set({ gst, trailStart: lst, runStartLst: lst, sunDate: todayIso(now) });
  }

  play(): void {
    this.store.set({ playing: true, runStartLst: lstCont(this.s) });
  }

  pause(): void {
    this.store.set({ playing: false });
  }

  togglePlay(): void {
    if (this.s.playing) this.pause();
    else this.play();
  }

  setMode(mode: AnimMode): void {
    this.store.set({ mode, runStartLst: lstCont(this.s) });
  }

  setRate(rate: number): void {
    this.store.set({ rate: clamp(rate, RATE_MIN, RATE_MAX) });
  }

  setToggle<K extends keyof Toggles>(key: K, value: boolean): void {
    this.store.set({ toggles: { ...this.s.toggles, [key]: value } });
  }

  setLabel<K extends keyof LabelToggles>(key: K, value: boolean): void {
    this.store.set({ labels: { ...this.s.labels, [key]: value } });
  }

  setSunDate(iso: string): void {
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) this.store.set({ sunDate: iso });
  }

  private addStars(stars: UserStar[], figure?: Figure): boolean {
    if (this.s.stars.length + stars.length > MAX_USER_STARS) return false;
    this.store.set({
      stars: [...this.s.stars, ...stars],
      figures: figure ? [...this.s.figures, figure] : this.s.figures,
    });
    return true;
  }

  addRandomStars(n: number): boolean {
    const stars: UserStar[] = [];
    let count = this.s.stars.filter((x) => x.kind === 'random').length;
    for (let i = 0; i < n; i++) {
      // Phân bố đều trên mặt cầu.
      const dec = (Math.asin(2 * Math.random() - 1) * 180) / Math.PI;
      const ra = Math.random() * 360;
      stars.push({
        id: nextId('s'),
        name: `Sao ngẫu nhiên ${++count}`,
        ra: Math.round(ra * 100) / 100,
        dec: Math.round(dec * 100) / 100,
        mag: 1.5,
        color: USER_STAR_COLOR,
        kind: 'random',
        labelled: false,
      });
    }
    return this.addStars(stars);
  }

  addManualStar(ra: number, dec: number, name?: string): UserStar | null {
    const count = this.s.stars.filter((x) => x.kind === 'manual').length + 1;
    const star: UserStar = {
      id: nextId('s'),
      name: name?.trim() || `Sao ${count}`,
      ra: norm360(ra),
      dec: clamp(dec, -90, 90),
      mag: 1,
      color: USER_STAR_COLOR,
      kind: 'manual',
      labelled: true,
    };
    if (!this.addStars([star])) return null;
    this.store.set({ selected: { kind: 'user', id: star.id } });
    return star;
  }

  addConstellation(templateId: string): boolean {
    const c = buildConstellation(templateId);
    if (!c) return false;
    return this.addStars(c.stars, c.figure);
  }

  hasConstellation(templateId: string): boolean {
    return this.s.figures.some((f) => f.templateId === templateId);
  }

  removeFigure(figureId: string): void {
    const fig = this.s.figures.find((f) => f.id === figureId);
    if (!fig) return;
    const ids = new Set(fig.starIds);
    const sel = this.s.selected;
    this.store.set({
      stars: this.s.stars.filter((x) => !ids.has(x.id)),
      figures: this.s.figures.filter((f) => f.id !== figureId),
      selected: sel?.kind === 'user' && ids.has(sel.id) ? null : sel,
    });
  }

  clearStars(): void {
    const sel = this.s.selected;
    this.store.set({ stars: [], figures: [], selected: sel?.kind === 'user' ? null : sel });
  }

  setTrails(mode: TrailMode): void {
    this.store.set({ trails: mode });
  }

  resetTrails(): void {
    this.store.set({ trailStart: lstCont(this.s) });
  }

  /** Đặt khóa tô sáng liên kết; không làm gì nếu không đổi (tránh phát sự kiện thừa khi rê chuột). */
  setEmphasis(k: EmphasisKey | null): void {
    if (k === this.s.emphasis) return;
    this.store.set({ emphasis: k });
  }

  select(sel: Selection): void {
    this.store.set({ selected: sel });
  }

  /** Đổi chế độ giao diện (cập nhật bất biến; không làm gì nếu không đổi). */
  setUiMode(uiMode: UiMode): void {
    if (!isUiMode(uiMode) || uiMode === this.s.uiMode) return;
    this.store.set({ uiMode });
  }

  /** "Đặt lại" đưa mô phỏng về ban đầu nhưng giữ chế độ giao diện người dùng đã chọn. */
  resetAll(): void {
    this.store.set({ ...createInitialState(), uiMode: this.s.uiMode });
  }
}
