// «Bầu trời xưa» — phần tải lười, mở từ nút trên thanh trên cùng (src/ui/history.ts).
//
// Chọn nơi và ngày (kể cả hàng nghìn năm trước), xem bầu trời người xưa đã thấy. Ba điều được tính thêm khi lùi xa:
// tuế sai của trục Trái Đất, chuyển động riêng của các sao và việc Trái Đất quay chậm dần (ΔT); mỗi điều có công tắc
// để so sánh "có" và "không". Bầu trời vẽ bằng canvas 2D, không dùng three.js và không đổi trạng thái của mô phỏng chính.

import './history.css';
import { calendarOf, calendarToJd, deltaTUncertainty, equinoxShiftDeg, jdToCalendar, separationDeg, vectorToRaDec } from '../astro/history';
import { fmtDeg, fmtHMS, fmtLat, fmtLon, fmtNum, parseNum } from '../astro/format';
import { catalogArrays, getCatalogStar } from '../data/catalog';
import { loadAllFigures } from '../data/constellations';
import { CURATED, MOTION_SOURCE } from '../data/motion';
import type { HistoryDome } from '../scene/history/dome';
import type { Store } from '../state';
import { button, checkbox, guide, h, setText } from '../ui/dom';
import { computeBodies, type BodyState } from './bodies';
import { catalogStars, momentOf, nearestToPole, sunStateOf, StarSet, type Moment, type Settings } from './model';
import { PoleChart } from './poleChart';
import { OLD_PLACES, PRESETS, VN, YEAR_MAX, YEAR_MIN, type Preset } from './presets';
import { fmt, H, num } from './text';
import { skyColors, SkyView, type FigureLines, type Layers, type Pick, type Scene, type ViewHandlers } from './view';

export interface StartOpts {
  dialog: HTMLDialogElement;
  host: HTMLElement;
  store: Store;
}

export interface HistorySession {
  /** Esc: dừng chạy thời gian nếu đang chạy (true = đã dùng phím). */
  escape(): boolean;
  dispose(): void;
}

const displayYear = (year: number): { n: number; era: 'bc' | 'ad' } => (year <= 0 ? { n: 1 - year, era: 'bc' } : { n: year, era: 'ad' });
const yearLabel = (year: number): string => {
  const { n, era } = displayYear(year);
  return `${n} ${H.era[era]}`;
};

const validDate = (year: number, month: number, day: number): boolean => {
  const back = jdToCalendar(calendarToJd(year, month, day, calendarOf(year, month, day)));
  return back.month === month && Math.floor(back.day) === day;
};

/** Ngày hợp lệ lớn nhất ≤ day (để 29/2 và các ngày cuối tháng không làm hỏng khi đổi năm). */
function clampDay(year: number, month: number, day: number): number {
  for (let d = Math.min(31, Math.max(1, day)); d > 1; d--) if (validDate(year, month, d)) return d;
  return 1;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function clockOf(jd: number): string {
  const f = (((jd + 0.5) % 1) + 1) % 1;
  const mins = Math.round(f * 1440) % 1440;
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
}

/** 10583 → "2 g 56 ph 23 s". */
function durationOf(sec: number): string {
  const a = Math.abs(sec);
  const sign = sec < 0 ? '−' : '';
  if (a >= 3600) {
    const hh = Math.floor(a / 3600);
    const mm = Math.floor((a % 3600) / 60);
    const ss = Math.round(a % 60);
    return sign + fmt(a >= 7200 ? H.readout.hoursMinutes : H.readout.hoursMinutesSeconds, { h: hh, m: mm, s: ss });
  }
  if (a >= 60) return sign + fmt(H.readout.hoursMinutesSeconds, { h: 0, m: Math.floor(a / 60), s: Math.round(a % 60) }).replace(/^0 g /, '');
  return sign + fmt(H.readout.seconds, { n: num(a, a < 10 ? 1 : 0) });
}

export function startHistory(o: StartOpts): HistorySession {
  const { store } = o;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const start = PRESETS[0];
  let s: Settings = {
    year: start.year,
    month: start.month,
    day: start.day,
    hour: start.hour,
    minute: start.minute,
    lat: start.lat,
    lon: start.lon,
    precession: true,
    motion: true,
    deltaT: true,
  };
  const layers: Layers = { lines: true, names: true, ecliptic: true, equator: false, bodies: true, daylight: false };
  let marker: Preset['marker'] | undefined = start.marker;
  let presetId: Preset['id'] | null = start.id;
  let selected: Pick | null = null;
  let figures: FigureLines | null = null;
  let disposed = false;
  let raf = 0;

  const stars = catalogStars();
  const cat = catalogArrays();
  const bodies: BodyState[] = [];
  const markerSet = new StarSet([0], [0], [0]);

  // ------------------------------------------------------------ Khung nhìn
  const canvas = h('canvas', { class: 'hsky-canvas', role: 'img', 'aria-label': H.view.aria });
  const tip = h('div', { class: 'hsky-tip', role: 'presentation', hidden: true });
  const summary = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const glHost = h('div', { class: 'hsky-gl3d', hidden: true });
  const stage = guide('historyView', h('div', { class: 'hsky-stage' }, canvas, glHost, tip));
  let dome: HistoryDome | null = null;
  let mode: '3d' | '2d' = '2d';
  const handlers: ViewHandlers = {
    onHover(p, x, y) {
      if (!p) {
        tip.hidden = true;
        return;
      }
      setText(tip, pickName(p, true));
      tip.style.left = `${x + 14}px`;
      tip.style.top = `${y + 14}px`;
      tip.hidden = false;
    },
    onPick(p) {
      selected = p;
      render();
    },
  };
  const view = new SkyView(canvas, handlers);

  function pickName(p: Pick, withMag: boolean): string {
    if (p.kind === 'body') return H.bodies[p.id];
    if (p.kind === 'marker') return marker ? H.presets.sn1054.marker : '';
    const star = getCatalogStar(p.index);
    const name = star.shortName || star.designation;
    if (!withMag) return name || `HIP ${star.hip}`;
    return name ? fmt(H.hover.star, { name, mag: num(star.mag, 1) }) : fmt(H.hover.unnamed, { hip: star.hip, mag: num(star.mag, 1) });
  }

  // ------------------------------------------------------------ Điều khiển: thời điểm
  const err = h('p', { class: 'field-error', role: 'alert', 'aria-live': 'polite' });

  const yearInput = h('input', { type: 'number', class: 'num hsky-year', min: 1, max: 6001, step: 1, inputmode: 'numeric', id: 'hsky-year', 'aria-label': H.time.year });
  const eraSel = h(
    'select',
    { 'aria-label': H.time.year, class: 'hsky-era' },
    h('option', { value: 'bc', text: H.era.bc, title: H.era.bcAria }),
    h('option', { value: 'ad', text: H.era.ad, title: H.era.adAria }),
  );
  const slider = h('input', { type: 'range', class: 'range', min: YEAR_MIN, max: YEAR_MAX, step: 1, 'aria-label': H.time.slider });
  const monthSel = h(
    'select',
    { 'aria-label': H.time.month },
    ...Array.from({ length: 12 }, (_, i) => h('option', { value: String(i + 1), text: fmt(H.time.monthOption, { m: i + 1 }) })),
  );
  const dayInput = h('input', { type: 'number', class: 'num hsky-day', min: 1, max: 31, step: 1, inputmode: 'numeric', 'aria-label': H.time.day });
  const timeInput = h('input', { type: 'time', class: 'hsky-time', 'aria-label': H.time.clock, step: 60 });
  const calTag = h('span', { class: 'hsky-cal', 'aria-live': 'polite' });

  const syncTime = () => {
    const d = displayYear(s.year);
    if (document.activeElement !== yearInput) yearInput.value = String(d.n);
    eraSel.value = d.era;
    slider.value = String(s.year);
    slider.setAttribute('aria-valuetext', fmt(H.time.sliderValue, { n: d.n, era: H.era[d.era] }));
    monthSel.value = String(s.month);
    if (document.activeElement !== dayInput) dayInput.value = String(s.day);
    timeInput.value = `${pad2(s.hour)}:${pad2(s.minute)}`;
    setText(calTag, H.cal[calendarOf(s.year, s.month, s.day)]);
  };

  /** Áp một phần cài đặt; trả về false (và báo lỗi) nếu ngày không hợp lệ. */
  function apply(patch: Partial<Settings>, opts: { clamp?: boolean } = {}): boolean {
    const next = { ...s, ...patch };
    next.year = Math.max(YEAR_MIN, Math.min(YEAR_MAX, Math.round(next.year)));
    if (opts.clamp) next.day = clampDay(next.year, next.month, next.day);
    if (!validDate(next.year, next.month, next.day)) {
      const gap = next.year === 1582 && next.month === 10;
      err.textContent = gap
        ? fmt(H.time.gap, { day: next.day, month: next.month })
        : fmt(H.time.invalid, { day: next.day, month: next.month, year: yearLabel(next.year) });
      syncTime();
      return false;
    }
    err.textContent = '';
    s = next;
    syncAll();
    schedule();
    return true;
  }

  const setYearFromInputs = () => {
    const n = Math.round(Number(yearInput.value));
    if (!Number.isFinite(n) || n < 1) {
      yearInput.value = String(displayYear(s.year).n);
      return;
    }
    const year = eraSel.value === 'bc' ? 1 - n : n;
    if (year < YEAR_MIN || year > YEAR_MAX) {
      err.textContent = fmt(H.time.range, { min: displayYear(YEAR_MIN).n, eraMin: H.era.bc, max: displayYear(YEAR_MAX).n, eraMax: H.era.ad });
      syncTime();
      return;
    }
    apply({ year }, { clamp: true });
  };
  yearInput.addEventListener('change', setYearFromInputs);
  yearInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') setYearFromInputs();
  });
  eraSel.addEventListener('change', setYearFromInputs);
  slider.addEventListener('input', () => apply({ year: Number(slider.value) }, { clamp: true }));
  monthSel.addEventListener('change', () => apply({ month: Number(monthSel.value) }, { clamp: true }));
  dayInput.addEventListener('change', () => {
    const d = Math.round(Number(dayInput.value));
    if (!Number.isFinite(d) || d < 1 || d > 31) {
      syncTime();
      return;
    }
    apply({ day: d });
  });
  timeInput.addEventListener('change', () => {
    const [hh, mm] = timeInput.value.split(':').map(Number);
    if (Number.isFinite(hh) && Number.isFinite(mm)) apply({ hour: hh, minute: mm });
  });

  const stepBtn = (label: string, delta: number) =>
    button(label, () => apply({ year: s.year + delta }, { clamp: true }), { cls: 'btn--small', aria: fmt(H.time.stepAria, { delta: label }), guide: 'historyStep' });

  // Chạy thời gian: tiến hoặc lùi ~ 500 năm mỗi giây (hoặc từng bước 100 năm nếu người dùng giảm chuyển động).
  let playDir = 0;
  let playYear = 0;
  let playLast = 0;
  let playTimer = 0;
  const playBack = button(H.time.playBack, () => togglePlay(-1), { cls: 'btn--small', aria: H.time.playBackAria, guide: 'historyPlay' });
  const playFwd = button(H.time.playFwd, () => togglePlay(1), { cls: 'btn--small', aria: H.time.playFwdAria, guide: 'historyPlay' });

  function syncPlay(): void {
    for (const [b, dir, label, aria] of [
      [playBack, -1, H.time.playBack, H.time.playBackAria],
      [playFwd, 1, H.time.playFwd, H.time.playFwdAria],
    ] as const) {
      const on = playDir === dir;
      setText(b.querySelector('.btn__text') as HTMLElement, on ? H.time.playStop : label);
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? H.time.playStopAria : aria);
    }
  }

  function stopPlay(): boolean {
    if (!playDir) return false;
    playDir = 0;
    window.clearInterval(playTimer);
    syncPlay();
    return true;
  }

  function togglePlay(dir: -1 | 1): void {
    if (playDir === dir) {
      stopPlay();
      return;
    }
    stopPlay();
    playDir = dir;
    playYear = s.year;
    playLast = performance.now();
    syncPlay();
    const tick = () => {
      if (!playDir || disposed) return;
      const now = performance.now();
      playYear += playDir * ((now - playLast) / 1000) * 500;
      playLast = now;
      const y = Math.max(YEAR_MIN, Math.min(YEAR_MAX, Math.round(playYear)));
      if (y !== s.year) apply({ year: y }, { clamp: true });
      if (y <= YEAR_MIN || y >= YEAR_MAX) stopPlay();
      else requestAnimationFrame(tick);
    };
    if (reduced) {
      playTimer = window.setInterval(() => {
        const y = Math.max(YEAR_MIN, Math.min(YEAR_MAX, s.year + playDir * 100));
        apply({ year: y }, { clamp: true });
        if (y <= YEAR_MIN || y >= YEAR_MAX) stopPlay();
      }, 700);
    } else requestAnimationFrame(tick);
  }

  const timeBox = h(
    'fieldset',
    { class: 'group hsky-group' },
    h('legend', { text: H.sec.time }),
    guide('historyYear', h('div', { class: 'hsky-row' }, h('label', { class: 'hsky-lbl', htmlFor: 'hsky-year', text: H.time.year }), yearInput, eraSel, calTag)),
    guide('historySlider', h('div', { class: 'hsky-row hsky-row--slider' }, slider)),
    guide('historyDate', h('div', { class: 'hsky-row' }, h('span', { class: 'hsky-lbl', text: `${H.time.day}/${H.time.month}` }), dayInput, monthSel)),
    guide('historyTime', h('div', { class: 'hsky-row' }, h('span', { class: 'hsky-lbl', text: H.time.clock }), timeInput)),
    h('p', { class: 'hsky-note', text: H.time.clockNote }),
    h('div', { class: 'hsky-row hsky-row--wrap' }, stepBtn(H.time.back1000, -1000), stepBtn(H.time.back100, -100), stepBtn(H.time.fwd100, 100), stepBtn(H.time.fwd1000, 1000)),
    h('div', { class: 'hsky-row hsky-row--wrap' }, playBack, playFwd),
    err,
  );

  // ------------------------------------------------------------ Điều khiển: địa điểm
  const latInput = h('input', { type: 'text', inputmode: 'decimal', class: 'num', id: 'hsky-lat', 'aria-label': H.place.lat });
  const lonInput = h('input', { type: 'text', inputmode: 'decimal', class: 'num', id: 'hsky-lon', 'aria-label': H.place.lon });
  const placeErr = h('p', { class: 'field-error', role: 'alert', 'aria-live': 'polite' });
  const placeSel = h(
    'select',
    { 'aria-label': H.place.preset },
    h('option', { value: 'custom', text: H.place.custom }),
    h('optgroup', { label: H.place.groupOld }, ...OLD_PLACES.map((p) => h('option', { value: `old:${p.id}`, text: H.places[p.id] }))),
    h('optgroup', { label: H.place.groupVn }, ...VN.map((p) => h('option', { value: `vn:${p.id}`, text: p.name }))),
  );
  const placeCoords = (v: string): { lat: number; lon: number } | null => {
    const [kind, id] = v.split(':');
    if (kind === 'old') return OLD_PLACES.find((p) => p.id === id) ?? null;
    if (kind === 'vn') return VN.find((p) => p.id === id) ?? null;
    return null;
  };
  const syncPlace = () => {
    if (document.activeElement !== latInput) latInput.value = fmtNum(s.lat, 2);
    if (document.activeElement !== lonInput) lonInput.value = fmtNum(s.lon, 2);
    // Chọn đúng dòng của danh sách nếu tọa độ trùng, nếu không thì "Tự nhập".
    let match = 'custom';
    for (const opt of Array.from(placeSel.options)) {
      const c = placeCoords(opt.value);
      if (c && Math.abs(c.lat - s.lat) < 0.005 && Math.abs(c.lon - s.lon) < 0.005) {
        match = opt.value;
        break;
      }
    }
    placeSel.value = match;
  };
  const applyPlace = () => {
    const la = parseNum(latInput.value);
    const lo = parseNum(lonInput.value);
    const errors: string[] = [];
    if (!Number.isFinite(la) || la < -90 || la > 90) errors.push(H.place.errLat);
    if (!Number.isFinite(lo) || lo < -180 || lo > 180) errors.push(H.place.errLon);
    placeErr.textContent = errors.join(' ');
    if (errors.length) return;
    s = { ...s, lat: la, lon: lo };
    syncAll();
    schedule();
  };
  for (const el of [latInput, lonInput]) {
    el.addEventListener('change', applyPlace);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyPlace();
    });
  }
  placeSel.addEventListener('change', () => {
    const c = placeCoords(placeSel.value);
    if (!c) return;
    placeErr.textContent = '';
    s = { ...s, lat: c.lat, lon: c.lon };
    syncAll();
    schedule();
  });
  const placeBox = h(
    'fieldset',
    { class: 'group hsky-group' },
    h('legend', { text: H.sec.place }),
    guide('historyPlace', h('div', { class: 'hsky-col' }, placeSel, h('div', { class: 'hsky-row' }, h('label', { class: 'hsky-lbl', htmlFor: 'hsky-lat', text: 'φ' }), latInput, h('label', { class: 'hsky-lbl', htmlFor: 'hsky-lon', text: 'λ' }), lonInput))),
    button(H.place.sync, () => {
      s = { ...s, lat: store.state.lat, lon: store.state.lon };
      placeErr.textContent = '';
      syncAll();
      schedule();
    }, { cls: 'btn--small hsky-sync', guide: 'historyPlaceSync' }),
    placeErr,
  );

  // ------------------------------------------------------------ Điều khiển: ba hiệu chỉnh và lớp hiển thị
  const fix = (label: string, hint: string, key: 'precession' | 'motion' | 'deltaT') => {
    const cb = checkbox(label, s[key], (v) => {
      s = { ...s, [key]: v };
      syncAll();
      schedule();
    }, { hint });
    return cb;
  };
  const fPrec = guide('historyPrecession', fix(H.fix.precession, H.fix.precessionHint, 'precession').el);
  const fMotion = guide('historyMotion', fix(H.fix.motion, H.fix.motionHint, 'motion').el);
  const fDt = guide('historyDeltaT', fix(H.fix.deltaT, H.fix.deltaTHint, 'deltaT').el);
  const fixBox = h(
    'fieldset',
    { class: 'group hsky-group' },
    h('legend', { text: H.sec.fixes }),
    fPrec,
    fMotion,
    MOTION_SOURCE === 'curated' ? h('p', { class: 'hsky-note', text: fmt(H.fix.motionCurated, { n: CURATED.length }) }) : null,
    fDt,
  );

  const layer = (label: string, key: keyof Layers) => checkbox(label, layers[key], (v) => {
    layers[key] = v;
    schedule();
  }).el;
  const layerBox = guide(
    'historyLayers',
    h(
      'fieldset',
      { class: 'group hsky-group' },
      h('legend', { text: H.sec.layers }),
      layer(H.layers.lines, 'lines'),
      layer(H.layers.names, 'names'),
      layer(H.layers.ecliptic, 'ecliptic'),
      layer(H.layers.equator, 'equator'),
      layer(H.layers.bodies, 'bodies'),
      guide('historyDaylight', layer(H.layers.daylight, 'daylight')),
    ),
  );

  // ------------------------------------------------------------ Thời điểm tiêu biểu
  const presetDesc = h('p', { class: 'hsky-desc', 'aria-live': 'polite' });
  const presetBtns = new Map<Preset['id'], HTMLButtonElement>();
  const showPresetDesc = () => {
    const key = presetId;
    setText(presetDesc, key ? H.presets[key].desc : '');
    for (const [id, b] of presetBtns) b.setAttribute('aria-pressed', String(id === key));
  };
  function choose(p: Preset): void {
    let q = p;
    if (p.id === 'today') {
      // Ngày giờ thật và nơi đang dùng trong mô phỏng chính; giờ địa phương trung bình theo kinh độ.
      const lat = store.state.lat;
      const lon = store.state.lon;
      const jdLocal = Date.now() / 86400000 + 2440587.5 + lon / 360;
      const c = jdToCalendar(jdLocal);
      const frac = c.day - Math.floor(c.day);
      q = { ...p, year: c.year, month: c.month, day: Math.floor(c.day), hour: Math.floor(frac * 24), minute: Math.floor((frac * 24 - Math.floor(frac * 24)) * 60), lat, lon };
    }
    stopPlay();
    presetId = p.id;
    marker = p.marker;
    selected = null;
    err.textContent = '';
    placeErr.textContent = '';
    s = { ...s, year: q.year, month: q.month, day: q.day, hour: q.hour, minute: q.minute, lat: q.lat, lon: q.lon };
    syncAll();
    schedule();
  }
  const presetBox = guide(
    'historyPresets',
    h(
      'section',
      { class: 'hsky-presets', 'aria-labelledby': 'hsky-presets-h' },
      h('h3', { id: 'hsky-presets-h', class: 'hsky-h', text: H.sec.presets }),
      h(
        'div',
        { class: 'hsky-chips', role: 'group', 'aria-labelledby': 'hsky-presets-h' },
        ...PRESETS.map((p) => {
          const b = button(H.presets[p.id].title, () => choose(p), { cls: 'chip' });
          b.setAttribute('aria-pressed', 'false');
          presetBtns.set(p.id, b);
          return b;
        }),
      ),
      presetDesc,
    ),
  );

  // ------------------------------------------------------------ Bảng số liệu
  const rows: Record<string, HTMLElement> = {};
  const row = (key: string, label: string): HTMLElement => {
    const dd = h('dd', { class: 'hsky-v' });
    rows[key] = dd;
    return h('div', { class: 'hsky-kv' }, h('dt', { text: label }), dd);
  };
  const readout = guide(
    'historyReadout',
    h(
      'section',
      { class: 'hsky-readout', 'aria-labelledby': 'hsky-readout-h' },
      h('h3', { id: 'hsky-readout-h', class: 'hsky-h', text: H.sec.readout }),
      h(
        'dl',
        { class: 'hsky-dl' },
        row('date', H.readout.date),
        row('jd', H.readout.jd),
        row('ut', H.readout.ut),
        row('tt', H.readout.tt),
        row('dt', H.readout.deltaT),
        row('lag', H.readout.lag),
        row('pole', H.readout.pole),
        row('eps', H.readout.obliquity),
        row('equinox', H.readout.equinox),
        row('sun', H.readout.sun),
        row('moon', H.readout.moon),
      ),
    ),
  );

  const selBody = h('p', { class: 'hsky-sel' });
  const selHead = h('h4', { class: 'hsky-sel__name' });
  const selClear = button(H.selected.dismiss, () => {
    selected = null;
    render();
  }, { cls: 'btn--small btn--ghost' });
  const selBox = h('section', { class: 'hsky-selected', 'aria-labelledby': 'hsky-sel-h' }, h('h3', { id: 'hsky-sel-h', class: 'hsky-h', text: H.sec.selected }), selHead, selBody, selClear);

  const poleCanvas = h('canvas', { class: 'hsky-pole', role: 'img', 'aria-label': H.pole.aria });
  const chart = new PoleChart(poleCanvas);
  const poleBox = guide(
    'historyPole',
    h('section', { class: 'hsky-polebox', 'aria-labelledby': 'hsky-pole-h' }, h('h3', { id: 'hsky-pole-h', class: 'hsky-h', text: H.sec.pole }), poleCanvas, h('p', { class: 'hsky-note', text: H.pole.caption })),
  );

  const notes = h('details', { class: 'hsky-notes' }, h('summary', { text: H.notes.title }), h('p', { text: H.notes.body }));

  const main = h('div', { class: 'hsky-main' }, stage, summary);
  // Kiểu hiển thị: khối 3D (giống giản đồ chân trời ngoài trang chính) hoặc bản đồ phẳng.
  const btn3d = button(H.view.mode3d, () => setMode('3d'), { cls: 'btn--small' });
  const btn2d = button(H.view.mode2d, () => setMode('2d'), { cls: 'btn--small' });
  const btnCam = button(H.view.camera, () => dome?.resetCamera(), { cls: 'btn--small btn--ghost', guide: 'historyCamera' });
  const modeBar = guide('historyMode', h('div', { class: 'hsky-modes', role: 'group', 'aria-label': H.view.modeAria }, btn3d, btn2d, btnCam));
  btn3d.disabled = true; // bật khi cảnh 3D dựng xong
  main.append(modeBar);
  const side = h('div', { class: 'hsky-side' }, presetBox, timeBox, placeBox, fixBox, readout, selBox, poleBox, layerBox, notes);
  const layout = h('div', { class: 'hsky' }, main, side);
  o.host.replaceChildren(layout);

  // ------------------------------------------------------------ Vẽ
  let lastSummary = '';
  function syncAll(): void {
    syncTime();
    syncPlace();
    showPresetDesc();
  }

  function render(): void {
    if (disposed) return;
    const m = momentOf(s);
    stars.compute(m, s.lat, s.motion);
    figures?.set.compute(m, s.lat, s.motion);
    computeBodies(m, s.lat, s.lon, bodies);
    let mk: Scene['marker'] = null;
    if (marker) {
      markerSet.p0[0] = Math.cos(marker.dec * Math.PI / 180) * Math.cos(marker.ra * Math.PI / 180);
      markerSet.p0[1] = Math.cos(marker.dec * Math.PI / 180) * Math.sin(marker.ra * Math.PI / 180);
      markerSet.p0[2] = Math.sin(marker.dec * Math.PI / 180);
      markerSet.compute(m, s.lat, false);
      mk = { alt: markerSet.alt[0], az: markerSet.az[0], label: H.presets.sn1054.marker };
    }
    const pole = nearestToPole(stars, m, s.motion, cat.mag);
    const scene: Scene = { m, lat: s.lat, stars, figures, bodies, layers, marker: mk, poleStar: pole.index, selected };
    if (mode === '3d' && dome) {
      dome.setBackground(skyColors(bodies[0] ? bodies[0].alt : -90)[0]);
      dome.draw(scene);
    } else view.draw(scene);
    chart.draw(stars, m, s.motion, s.year, pole.index);
    readoutUpdate(m, pole);
    selectedUpdate(m);
    if (!playDir) {
      const sun = bodies[0];
      const text = fmt(H.view.summary, {
        lat: fmtLat(s.lat),
        lon: fmtLon(s.lon),
        date: dateText(m),
        time: `${pad2(s.hour)}:${pad2(s.minute)}`,
        sun: sun ? H.sunState[sunStateOf(sun.alt)] : '',
      });
      if (text !== lastSummary) {
        lastSummary = text;
        summary.textContent = text;
      }
    }
  }

  function dateText(m: Moment): string {
    const c = m.calendar;
    const d = displayYear(c.year);
    return fmt(H.readout.dateValue, { day: Math.floor(c.day), month: c.month, year: d.n, era: H.era[d.era], cal: H.cal[c.calendar] });
  }

  function readoutUpdate(m: Moment, pole: { index: number; sepDeg: number }): void {
    setText(rows.date, dateText(m));
    setText(rows.jd, num(m.jdUt, 2));
    setText(rows.ut, clockOf(m.jdUt));
    setText(rows.tt, clockOf(m.jdTt));
    const sigma = deltaTUncertainty(2000 + (m.jdUt - 2451544.5) / 365.2425);
    setText(rows.dt, fmt(H.readout.deltaTValue, { dt: durationOf(m.dtReal), sigma: durationOf(sigma) }));
    setText(rows.lag, s.deltaT ? fmt(H.readout.lagValue, { deg: num((m.dtReal * 360.98564736629) / 86400, 1) }) : H.readout.lagNone);
    const star = getCatalogStar(pole.index);
    setText(rows.pole, fmt(H.readout.poleValue, { name: `${star.shortName || star.designation || `HIP ${star.hip}`}`, sep: num(pole.sepDeg, 1) }));
    setText(rows.eps, fmtDeg(m.eps, 2));
    setText(rows.equinox, s.precession ? fmt(H.readout.equinoxValue, { deg: num(equinoxShiftDeg(m.jdTt), 1).replace(/^(\d)/, '+$1') }) : H.readout.equinoxNone);
    const sun = bodies[0];
    const moon = bodies[1];
    if (sun) setText(rows.sun, fmt(H.readout.sunValue, { alt: num(sun.alt, 1), state: H.sunState[sunStateOf(sun.alt)] }));
    if (moon) {
      const phase = H.phase[Math.round(moon.elongation / 45) % 8];
      const pct = Math.round(moon.illum * 100);
      setText(rows.moon, moon.alt >= 0 ? fmt(H.readout.moonValue, { phase, pct, alt: num(moon.alt, 1) }) : fmt(H.readout.moonBelow, { phase, pct }));
    }
  }

  function selectedUpdate(m: Moment): void {
    if (!selected) {
      selHead.textContent = '';
      setText(selBody, H.selected.none);
      selClear.hidden = true;
      return;
    }
    selClear.hidden = false;
    setText(selHead, pickName(selected, false));
    if (selected.kind === 'star') {
      const i = selected.index;
      const star = getCatalogStar(i);
      const alt = stars.alt[i];
      const eq = vectorToRaDec([stars.vec[3 * i], stars.vec[3 * i + 1], stars.vec[3 * i + 2]]);
      const a: [number, number, number] = [stars.p0[3 * i], stars.p0[3 * i + 1], stars.p0[3 * i + 2]];
      const b = stars.at(i, m.years, s.motion, [0, 0, 0]);
      const parts = [
        `${fmt(H.selected.mag, { mag: num(star.mag, 1) })}; ${fmt(H.selected.altaz, { alt: num(alt, 1), az: num(stars.az[i], 0) })}.`,
        `${fmt(H.selected.coord, { ra: fmtHMS(eq.ra, { seconds: false }), dec: `${eq.dec >= 0 ? '+' : '−'}${fmtDeg(Math.abs(eq.dec), 1)}` })}.`,
        stars.moving[i] ? fmt(H.selected.moved, { sep: num(separationDeg(a, b), 2) }) : H.selected.still,
      ];
      if (alt < 0) parts.push(H.selected.belowHorizon);
      setText(selBody, parts.join(' '));
    } else if (selected.kind === 'body') {
      const id = selected.id;
      const bd = bodies.find((x) => x.id === id);
      setText(selBody, bd ? fmt(H.selected.altaz, { alt: num(bd.alt, 1), az: num(bd.az, 0) }) + (bd.alt < 0 ? ` ${H.selected.belowHorizon}` : '') : '');
    } else setText(selBody, H.presets.sn1054.desc);
  }

  function schedule(): void {
    if (raf || disposed) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      render();
    });
  }

  // ------------------------------------------------------------ Kích thước
  const fit = () => {
    const r = stage.getBoundingClientRect();
    const size = Math.floor(Math.min(r.width, r.height));
    if (size < 100) return;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    view.resize(size, size);
    dome?.resize(r.width, r.height);
    const pw = Math.floor(poleCanvas.parentElement?.getBoundingClientRect().width ?? 240);
    chart.resize(Math.min(300, pw));
    poleCanvas.style.width = `${Math.min(300, pw)}px`;
    poleCanvas.style.height = `${Math.min(300, pw)}px`;
    schedule();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(stage);
  ro.observe(side);

  syncAll();
  syncPlay();
  fit();
  render();

  function setMode(m: '3d' | '2d'): void {
    if (m === '3d' && !dome) return;
    mode = m;
    canvas.hidden = m === '3d';
    glHost.hidden = m !== '3d';
    tip.hidden = true;
    btn3d.setAttribute('aria-pressed', String(m === '3d'));
    btn2d.setAttribute('aria-pressed', String(m === '2d'));
    btnCam.hidden = m !== '3d';
    fit();
  }
  btn3d.setAttribute('aria-pressed', 'false');
  btn2d.setAttribute('aria-pressed', 'true');
  btnCam.hidden = true;

  // Cảnh 3D: tải lười (dùng chung gói three.js với trang chính). Dựng xong thì chuyển sang 3D, trừ khi trình duyệt không
  // có WebGL — khi đó giữ bản đồ phẳng.
  void import('../scene/history/dome')
    .then((m) => {
      if (disposed) return;
      try {
        dome = new m.HistoryDome(glHost, handlers);
      } catch (e) {
        console.warn(e);
        btn3d.hidden = true;
        btnCam.hidden = true;
        return;
      }
      btn3d.disabled = false;
      setMode('3d');
    })
    .catch(() => {
      btn3d.hidden = true;
    });

  // Hình 88 chòm sao: tải lười (≈ 29 kB), vẽ lại khi có.
  void loadAllFigures().then((map) => {
    if (disposed) return;
    const ra: number[] = [];
    const dec: number[] = [];
    const hip: number[] = [];
    const segs: number[] = [];
    for (const f of Object.values(map)) {
      const base = ra.length;
      for (const st of f.stars) {
        ra.push(st[0]);
        dec.push(st[1]);
        hip.push(st[3]);
      }
      for (const [a, b] of f.segs) segs.push(base + a, base + b);
    }
    figures = { set: new StarSet(ra, dec, hip), segs: Uint32Array.from(segs) };
    schedule();
  });

  return {
    escape: () => stopPlay(),
    dispose() {
      disposed = true;
      playDir = 0;
      window.clearInterval(playTimer);
      cancelAnimationFrame(raf);
      ro.disconnect();
      dome?.dispose();
      o.host.replaceChildren();
    },
  };
}
