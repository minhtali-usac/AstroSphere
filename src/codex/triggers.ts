// Codex (redesign-2 C) — phần tải ngay, giữ thật nhỏ: quy tắc "khám phá" (trạng thái → mục Codex), tiến độ
// đọc/khám phá lưu trong localStorage, nút Codex có huy hiệu, liên kết "?" cạnh thuật ngữ và openCodex(id?) tải
// lười phần giao diện + nội dung (src/codex/ui.ts, src/i18n/codex.vi.json).
//
// Quy tắc khám phá chạy trong store.subscribe nhưng chỉ khi một lát trạng thái liên quan đổi tham chiếu; khi đang
// phát hoạt ảnh (gst đổi mỗi khung hình) hàm thoát ngay, không cấp phát.

import { classify } from '../astro';
import { catalogArrays, starConstellation } from '../data/catalog';
import { DSOS } from '../data/deepSky';
import { selectedDec } from '../emphasis';
import { t } from '../i18n';
import type { Actions, AppState, Store, Toggles } from '../state';
import { h } from '../ui/dom';
import { bookIcon } from '../ui/icons';
import { isPlainObject, readJson, writeJson } from '../ui/storage';

export const CODEX_KEY = 'astrosphere.codex.v1';

export interface CodexProgress {
  discovered: string[];
  read: string[];
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Dạng lưu trữ hợp lệ: {discovered: string[], read: string[]}. */
export const isCodexProgress = (v: unknown): v is CodexProgress => isPlainObject(v) && isStringArray(v.discovered) && isStringArray(v.read);

/** Những gì người mới đã thấy ngay khi mở trang: thiên cầu, chân trời và Polaris (đang được chọn sẵn). */
export const INITIAL_DISCOVERED: readonly string[] = ['sphere', 'horizon', 'polaris'];

/** Bật một hộp kiểm → khám phá khái niệm của nó. */
export const TOGGLE_ENTRY: Readonly<Partial<Record<keyof Toggles, string>>> = {
  hourCircle0: 'vernal',
  equator: 'equator',
  underside: 'horizon',
  zoneNeverRise: 'neverRise',
  zoneRiseSet: 'riseSetZone',
  zoneCircumpolar: 'circumpolar',
  angle: 'eqAngle',
  poleAltitude: 'latPole',
  poleAxis: 'pole',
  equatorPlane: 'equator',
  zenithNadir: 'zenith',
  meridian: 'meridian',
  verticalCircle: 'altaz',
  horizonOnSphere: 'horizon',
  altAzGrid: 'altaz',
  eqGrid: 'radec',
  catalog: 'magnitude',
  constellationLines: 'constellations',
  ecliptic: 'ecliptic',
  galactic: 'milkyWay',
  sun: 'seasons',
  deepSky: 'deepSky',
};

/** Sao có mục riêng (số Hipparcos → mục). */
export const HIP_ENTRY: Readonly<Record<number, string>> = {
  11767: 'polaris',
  32349: 'sirius',
  30438: 'canopus',
  91262: 'vega',
  27989: 'betelgeuse',
  24436: 'rigel',
  80763: 'antares',
};

/** Chòm sao có mục riêng (mã IAU → mục). */
export const CONSTELLATION_ENTRY: Readonly<Record<string, string>> = {
  UMa: 'uma',
  UMi: 'umi',
  Cas: 'cas',
  Ori: 'ori',
  Sco: 'sco',
  Cru: 'cru',
};

/** Thiên thể sâu có mục riêng. */
export const DSO_ENTRY: Readonly<Record<string, string>> = {
  M31: 'm31',
  M42: 'm42',
  M45: 'm45',
};

/** Tô sáng liên kết (rê chuột lên một con số) → khái niệm của con số đó. */
const EMPHASIS_ENTRY: Readonly<Record<string, string>> = {
  pole: 'latPole',
  incl: 'eqAngle',
  meridian: 'lst',
  az: 'altaz',
  alt: 'altaz',
  altaz: 'altaz',
};

const VISIBILITY_ENTRY = {
  circumpolar: 'circumpolar',
  riseSet: 'riseSetZone',
  neverRise: 'neverRise',
} as const;

/** Mọi id mà quy tắc khám phá có thể sinh ra (để kiểm thử: mọi id đều có trong nội dung). */
export function triggerIds(): string[] {
  return [
    ...INITIAL_DISCOVERED,
    ...Object.values(TOGGLE_ENTRY),
    ...Object.values(HIP_ENTRY),
    ...Object.values(CONSTELLATION_ENTRY),
    ...Object.values(DSO_ENTRY),
    ...Object.values(EMPHASIS_ENTRY),
    ...Object.values(VISIBILITY_ENTRY),
    'radec',
    'altaz',
    'hourAngle',
    'starColor',
    'sun',
    'lst',
    'diurnal',
    'siderealDay',
    'seasons',
    'transit',
  ];
}

function discoverSelection(s: AppState, add: (id: string) => void): void {
  const sel = s.selected;
  if (!sel) return;
  // Mọi đối tượng được chọn đều có tọa độ ở cả hai hệ, góc giờ và trạng thái mọc – lặn trên thẻ thông tin.
  add('radec');
  add('altaz');
  add('hourAngle');
  const dec = selectedDec(s);
  if (dec !== null) add(VISIBILITY_ENTRY[classify(dec, s.lat)]);
  let hip = 0;
  if (sel.kind === 'catalog') {
    const data = catalogArrays();
    hip = data.hip[sel.index] ?? 0;
    add('magnitude');
    const bv = data.bv[sel.index];
    // Sao có màu rõ rệt (xanh B − V < 0 hoặc đỏ cam B − V > 1,3) → màu sao.
    if (bv < 0 || bv > 1.3) add('starColor');
  } else if (sel.kind === 'user') {
    for (const st of s.stars) {
      if (st.id !== sel.id) continue;
      hip = st.hip ?? 0;
      if (st.kind === 'constellation') add('magnitude');
      break;
    }
  } else if (sel.kind === 'dso') {
    add('deepSky');
    const id = DSOS[sel.index]?.id;
    if (id && DSO_ENTRY[id]) add(DSO_ENTRY[id]);
  } else if (sel.kind === 'sun') add('sun');
  if (hip) {
    if (HIP_ENTRY[hip]) add(HIP_ENTRY[hip]);
    const c = CONSTELLATION_ENTRY[starConstellation(hip)];
    if (c) add(c);
  }
}

/**
 * Quy tắc khám phá: so sánh trạng thái mới với trạng thái trước (theo tham chiếu) và gọi `add(id)` cho mỗi mục
 * vừa "gặp". Thuần (không DOM), rẻ: khi chỉ gst đổi trong lúc phát hoạt ảnh, không lát nào khớp nên thoát ngay.
 */
export function discover(s: AppState, prev: AppState, add: (id: string) => void): void {
  if (s.selected !== prev.selected) discoverSelection(s, add);
  if (s.toggles !== prev.toggles) {
    for (const k in s.toggles) {
      const key = k as keyof Toggles;
      const id = TOGGLE_ENTRY[key];
      if (id && s.toggles[key] && !prev.toggles[key]) add(id);
    }
  }
  if (s.lat !== prev.lat) {
    add('latPole');
    // Đổi vĩ độ làm sao đang chọn có thể đổi vùng (cận cực ↔ mọc – lặn).
    const dec = selectedDec(s);
    if (dec !== null) add(VISIBILITY_ENTRY[classify(dec, s.lat)]);
  }
  if (s.lon !== prev.lon) add('lst');
  // Người dùng tự kéo giờ thiên văn / bước giờ (không phải hoạt ảnh đang chạy).
  if (s.gst !== prev.gst && !s.playing && !prev.playing) add('lst');
  if (s.playing && !prev.playing) add('diurnal');
  if (s.trails !== prev.trails && s.trails !== 'none') add('diurnal');
  if (s.mode !== prev.mode) add(s.mode === 'oneDay' ? 'siderealDay' : 'diurnal');
  if (s.sunDate !== prev.sunDate) add('seasons');
  if (s.figures !== prev.figures && s.figures.length > prev.figures.length) {
    const c = CONSTELLATION_ENTRY[s.figures[s.figures.length - 1].templateId];
    add(c ?? 'constellations');
  }
  if (s.emphasis !== prev.emphasis && s.emphasis) {
    const id = EMPHASIS_ENTRY[s.emphasis];
    if (id) add(id);
    if (s.emphasis === 'meridian') add('transit');
  }
}

// ---------------------------------------------------------------- Tiến độ (khám phá / đã đọc)

const discovered = new Set<string>();
const read = new Set<string>();
const listeners = new Set<() => void>();

/** Đọc tiến độ đã lưu; lần đầu (chưa có gì) bắt đầu với những mục đã thấy trên màn hình. */
export function loadProgress(): CodexProgress {
  return readJson<CodexProgress>(CODEX_KEY, isCodexProgress, {
    discovered: [...INITIAL_DISCOVERED],
    read: [],
  });
}

function save(): void {
  writeJson(CODEX_KEY, {
    discovered: [...discovered],
    read: [...read],
  } satisfies CodexProgress);
}

function changed(): void {
  save();
  for (const l of listeners) l();
}

export const isDiscovered = (id: string): boolean => discovered.has(id);
export const isRead = (id: string): boolean => read.has(id);
/** Mục mới: đã khám phá nhưng chưa đọc. */
export const isNew = (id: string): boolean => discovered.has(id) && !read.has(id);
export const discoveredCount = (): number => discovered.size;

export function unreadCount(): number {
  let n = 0;
  for (const id of discovered) if (!read.has(id)) n++;
  return n;
}

export function markRead(id: string): void {
  if (read.has(id)) return;
  read.add(id);
  changed();
}

export function onCodexChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------------------------------------------------------------- Mở Codex (tải lười)

export interface CodexContext {
  store: Store;
  actions: Actions;
}

let ctx: CodexContext | null = null;
let uiLoading: Promise<typeof import('./ui')> | null = null;

/** Mở Codex (tùy chọn: ở một mục). Tải giao diện và nội dung ở lần đầu. */
export function openCodex(id?: string): void {
  if (!ctx) return;
  const c = ctx;
  uiLoading ??= import('./ui');
  void uiLoading.then((m) => m.openCodexUi(c, id));
}

export function isCodexOpen(): boolean {
  return (document.getElementById('dlg-codex') as HTMLDialogElement | null)?.open ?? false;
}

/** Liên kết "?" nhỏ cạnh một thuật ngữ: mở mục Codex tương ứng. `data-codex` đổi được lúc chạy (vd. trạng thái). */
export function termLink(id: string, term: string): HTMLButtonElement {
  return h(
    'button',
    {
      type: 'button',
      class: 'term',
      'data-codex': id,
      'data-guide': 'term',
      title: t('codexUi.termTip'),
      onclick: (e: Event) => {
        e.stopPropagation();
        openCodex((e.currentTarget as HTMLElement).dataset.codex);
      },
    },
    // Tên truy cập lấy từ nội dung (chữ ẩn), không dùng aria-label: nhãn "Kinh tuyến thiên cầu" của hộp kiểm vẫn là
    // nhãn duy nhất mang đúng chữ đó (getByLabel, trình đọc màn hình).
    h('span', { 'aria-hidden': 'true', text: '?' }),
    h('span', { class: 'sr-only', text: t('codexUi.termAria', { term }) }),
  );
}

/**
 * Gắn liên kết "?" vào cuối một nhãn sao cho nó không bao giờ rơi xuống dòng một mình: chữ cuối của nhãn và liên
 * kết được bọc trong một span không ngắt dòng.
 */
export function appendTerm(label: HTMLElement, link: HTMLButtonElement): void {
  const last = label.lastChild;
  const text = last?.nodeType === 3 ? (last.textContent ?? '') : '';
  const cut = text.trimEnd().lastIndexOf(' ');
  if (!last || !text || cut < 0) {
    label.append(h('span', { class: 'term-wrap' }, link));
    return;
  }
  last.textContent = text.slice(0, cut + 1);
  label.append(h('span', { class: 'term-wrap' }, text.slice(cut + 1), link));
}

/**
 * Nút "Codex" trên thanh trên cùng (có huy hiệu số mục mới) và móc quy tắc khám phá vào store. Gọi một lần.
 */
export function codexButton(store: Store, actions: Actions): HTMLButtonElement {
  ctx = { store, actions };
  const init = loadProgress();
  for (const id of init.discovered) discovered.add(id);
  for (const id of init.read) read.add(id);
  save();

  const badge = h('span', {
    class: 'codex-badge',
    'aria-hidden': 'true',
    hidden: true,
  });
  const btn = h(
    'button',
    {
      type: 'button',
      class: 'btn btn--top btn--codex',
      title: t('codexUi.buttonTip'),
      'data-guide': 'codex',
      onclick: () => openCodex(),
    },
    h('span', { class: 'btn__icon', 'aria-hidden': 'true' }, bookIcon()), // fix-1 #8: cuốn sách thay cho ◈
    h('span', { class: 'btn__text', text: t('codexUi.button') }),
    badge,
  );
  // Game feel (2026-10-05): khi số mục mới TĂNG lúc người dùng đang ở mô phỏng, con số lóe sáng nhẹ một lần (~600 ms,
  // chỉ bóng sáng, không dịch chuyển; giảm chuyển động = không có). Không cấp phát: một bộ đếm và một hàm gỡ dựng sẵn.
  let last = unreadCount();
  let glowTimer = 0;
  const endGlow = () => badge.classList.remove('is-glow');
  const sync = () => {
    const n = unreadCount();
    if (n > last && !isCodexOpen()) {
      badge.classList.remove('is-glow');
      void badge.offsetWidth; // khởi động lại hoạt ảnh nếu số tăng tiếp khi đang lóe
      badge.classList.add('is-glow');
      window.clearTimeout(glowTimer);
      glowTimer = window.setTimeout(endGlow, 650);
    }
    last = n;
    badge.hidden = n === 0;
    badge.textContent = String(n);
    btn.setAttribute('aria-label', n ? t('codexUi.buttonAriaNew', { n }) : t('codexUi.button'));
    // Tooltip giải thích con số trên huy hiệu (fix-2 #10): "3 mục mới trong Codex: bấm để đọc".
    btn.title = n ? t('codexUi.buttonTipNew', { n }) : t('codexUi.buttonTip');
  };
  onCodexChange(sync);
  sync();

  let pending = false;
  const add = (id: string) => {
    if (discovered.has(id)) return;
    discovered.add(id);
    pending = true;
  };
  store.subscribe((s, prev) => {
    discover(s, prev, add);
    if (pending) {
      pending = false;
      changed();
    }
  });
  return btn;
}
