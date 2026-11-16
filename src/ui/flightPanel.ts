// Bảng điều khiển của «Bay vào vũ trụ» (chỉ tải cùng cảnh bay): điểm đến, thông tin thiên thể, thanh trạng thái.
//
// Mọi giá trị không phải số đo trực tiếp đều mang nhãn: «ước tính» (tính từ số đo khác), «ứng dụng tự chọn» (không có
// số liệu, ứng dụng chọn để vẽ được), «khoảng cách chưa chắc chắn» (thị sai quá nhỏ hoặc sai số lớn).

import { LY_PER_PC, PC_KM, starPhysics } from '../astro/stellar';
import { AU_KM } from '../astro/planets';
import { BODIES, BODY_BY_ID } from '../data/bodies';
import { catalogArrays, nameOf } from '../data/catalog';
import type { FlightData } from '../data/flightData';
import { ft } from '../scene/flight/text';
import type { FlightView, Thing } from '../scene/flight/flightView';
import { button, checkbox, guide, h, setText } from './dom';

const nf3 = new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 3 });
const nf0 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

const LY_KM = PC_KM / LY_PER_PC;

/** Khoảng cách dễ đọc: km khi gần, AU trong khoảng một năm ánh sáng, năm ánh sáng khi xa hơn. */
export function fmtDistance(km: number): string {
  if (km < 1e7) return ft('unit.km', { v: nf0.format(km) });
  if (km < 0.5 * LY_KM) return ft('unit.au', { v: nf3.format(km / AU_KM) });
  return ft('unit.ly', { v: nf3.format(km / LY_KM) });
}

function fmtRotation(hours: number): string {
  const abs = Math.abs(hours);
  const v = abs < 48 ? ft('unit.h', { v: nf2.format(abs) }) : ft('unit.d', { v: nf2.format(abs / 24) });
  return hours < 0 ? ft('unit.retro', { v }) : v;
}

function fmtPeriod(days: number): string {
  return days < 1000 ? ft('unit.d', { v: nf3.format(days) }) : ft('unit.y', { v: nf3.format(days / 365.25) });
}

const METHOD_KEY: Record<string, string> = { 'Radial Velocity': 'radialVelocity', Imaging: 'imaging', Transit: 'transit' };

/** Khóa chuỗi cho phương pháp phát hiện (họ khóa động flight.method.*, có kiểm thử riêng). */
export function methodKey(method: string | null): string {
  return `method.${METHOD_KEY[method ?? ''] ?? 'other'}`;
}

type Row = [label: string, value: string, tag?: 'estimated' | 'chosen' | 'uncertain' | 'measured'];

export interface FlightPanel {
  el: HTMLElement;
  /** Cập nhật phần thay đổi theo thời gian (khoảng cách, trạng thái) — gọi khoảng 6 lần/giây. */
  tick(): void;
  /** Vẽ lại bảng thông tin khi thiên thể đang chọn đổi. */
  refresh(): void;
}

export function flightPanel(view: FlightView, data: FlightData): FlightPanel {
  const cat = catalogArrays();

  // ---------------------------------------------------------------- Điểm đến
  const goButton = (thing: Thing, label: string, sub?: string) =>
    h(
      'button',
      { type: 'button', class: 'flight__dest-btn', 'data-guide': 'flightDest', onclick: () => view.flyTo(thing) },
      h('span', { class: 'flight__dest-name', text: label }),
      sub ? h('span', { class: 'flight__dest-sub', text: sub }) : null,
    );
  const solar = h(
    'div',
    { class: 'flight__chips' },
    ...BODIES.map((b) => goButton(view.get(`body:${b.id}`)!, ft(`vi.${b.id}`), ft(`name.${b.id}`))),
  );
  const hosts = h(
    'ul',
    { class: 'flight__list' },
    ...view.hosts().map((host) =>
      h(
        'li',
        null,
        goButton(host, host.name, `${ft('hostPlanets', { n: host.planets!.length })} · ${fmtDistance(Math.hypot(host.pos[0], host.pos[1], host.pos[2]))}`),
      ),
    ),
  );
  const results = h('ul', { class: 'flight__list flight__results', 'aria-live': 'polite' });
  const search = h('input', {
    type: 'search',
    class: 'flight__search',
    placeholder: ft('searchPlaceholder'),
    'aria-label': ft('groupSearch'),
    'data-guide': 'flightSearch',
    oninput: () => {
      const q = search.value.trim().toLowerCase();
      results.replaceChildren();
      if (q.length < 2) return;
      const found: number[] = [];
      for (let i = 0; i < cat.hip.length && found.length < 8; i++) {
        const nm = nameOf(cat.hip[i]);
        if (nm.label.toLowerCase().includes(q) || nm.designation.toLowerCase().includes(q) || (nm.viName ?? '').toLowerCase().includes(q)) found.push(i);
      }
      if (!found.length) results.append(h('li', { class: 'flight__none', text: ft('noMatch') }));
      for (const i of found) {
        const thing = view.starThing(i);
        results.append(h('li', null, goButton(thing, thing.name, fmtDistance(Math.hypot(thing.pos[0], thing.pos[1], thing.pos[2])))));
      }
    },
  });
  const destBody = h(
    'div',
    { class: 'flight__dest-body', id: 'flight-dest-body' },
    h('h3', { text: ft('groupSolar') }),
    solar,
    h('h3', { text: ft('groupSearch') }),
    search,
    results,
    h('h3', { text: ft('groupHosts') }),
    hosts,
  );
  const destToggle = h('button', {
    type: 'button',
    class: 'flight__dest-toggle',
    'aria-expanded': 'true',
    'aria-controls': 'flight-dest-body',
    'data-guide': 'flightDestToggle',
    text: ft('destToggle'),
    onclick: () => {
      const open = destToggle.getAttribute('aria-expanded') !== 'true';
      destToggle.setAttribute('aria-expanded', String(open));
      dest.classList.toggle('is-closed', !open);
    },
  });
  const dest = h('aside', { class: 'flight__dest', 'aria-label': ft('dest') }, destToggle, destBody);
  // Điện thoại: danh sách bắt đầu thu gọn để không che khung nhìn.
  if (window.matchMedia?.('(max-width: 700px)').matches) destToggle.click();

  // ---------------------------------------------------------------- Thông tin
  const infoName = h('h3', { class: 'flight__info-name' });
  const infoVi = h('p', { class: 'flight__info-vi' });
  const infoKind = h('p', { class: 'flight__info-kind' });
  const infoRows = h('dl', { class: 'flight__rows' });
  const infoNotes = h('div', { class: 'flight__notes' });
  const goBtn = button(ft('go'), () => view.selected && view.flyTo(view.selected), { cls: 'btn--primary flight__go', guide: 'flightGo' });
  const info = h('section', { class: 'flight__info', 'aria-live': 'polite' }, infoName, infoVi, infoKind, infoRows, infoNotes, goBtn);

  // ---------------------------------------------------------------- Thanh dưới
  const status = h('p', { class: 'flight__state' });
  const distEl = h('p', { class: 'flight__dist' });
  const orbits = checkbox(ft('orbits'), true, (v) => {
    view.showOrbits = v;
    view.select(view.selected);
  });
  guide('flightOrbits', orbits.el);
  const lines = checkbox(ft('lines'), true, (v) => {
    view.showFigures = v;
    view.select(view.selected);
  });
  guide('flightLines', lines.el);
  const holdBtn = (label: string, dir: 1 | -1) => {
    const b = h('button', { type: 'button', class: 'btn flight__hold', text: label });
    const stop = () => view.setHold(0);
    b.addEventListener('pointerdown', (e) => {
      b.setPointerCapture(e.pointerId);
      view.setHold(dir);
    });
    b.addEventListener('pointerup', stop);
    b.addEventListener('pointercancel', stop);
    b.addEventListener('lostpointercapture', stop);
    return b;
  };
  const source = h('p', { class: 'flight__source', text: ft('source', { date: data.exo.meta.retrieved }) });
  const bar = h(
    'div',
    { class: 'flight__bar' },
    h('div', { class: 'flight__readout' }, status, distEl),
    h('div', { class: 'flight__toggles' }, orbits.el, lines.el),
    h('div', { class: 'flight__holds' }, guide('flightBack', holdBtn(ft('back'), -1)), guide('flightForward', holdBtn(ft('forward'), 1))),
    source,
  );

  const el = h('div', { class: 'flight__ui' }, dest, info, bar);

  // ---------------------------------------------------------------- Nội dung bảng thông tin
  const tagText = (tag: Row[2]) => (tag ? ft(`tag.${tag}`) : '');
  function rowsFor(th: Thing): { kind: string; rows: Row[]; notes: string[] } {
    const notes: string[] = [];
    const rows: Row[] = [];
    const sunPos = view.get('body:sun')!.pos;
    const earthPos = view.get('body:earth')!.pos;
    const dist = (a: Float64Array, b: Float64Array) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    if (th.kind === 'body') {
      const b = BODY_BY_ID[th.bodyId!];
      rows.push([ft('row.radius'), ft('unit.km', { v: nf0.format(b.radiusKm) })]);
      rows.push([ft('row.mass'), ft('unit.earthMass', { v: nf3.format(b.massEarth) })]);
      rows.push([ft('row.rotation'), fmtRotation(b.rotationH)]);
      rows.push([ft('row.tilt'), ft('unit.deg', { v: nf2.format(b.tiltDeg) })]);
      if (b.id !== 'sun') rows.push([ft('row.fromSun'), fmtDistance(dist(th.pos, sunPos))]);
      if (b.id !== 'earth') rows.push([ft('row.fromEarth'), fmtDistance(dist(th.pos, earthPos))]);
      notes.push(ft(b.id === 'earth' ? 'note.earth' : 'note.illustration'));
      const kind = b.id === 'sun' ? 'kind.sun' : b.id === 'moon' ? 'kind.moon' : 'kind.planet';
      return { kind: ft(kind), rows, notes };
    }
    if (th.kind === 'star') {
      const i = th.starIndex!;
      const hip = th.hip!;
      const uncertain = view.isUncertain(th);
      const pc = data.distancePc(hip);
      const phys = starPhysics(cat.mag[i], cat.bv[i], pc ? 1000 / pc : 2);
      rows.push([ft('row.distance'), fmtDistance(dist(th.pos, sunPos)), uncertain ? 'uncertain' : 'measured']);
      rows.push([ft('row.magEarth'), nf2.format(cat.mag[i]).replace('-', '−')]);
      rows.push([ft('row.teff'), ft('unit.kelvin', { v: nf0.format(Math.round(phys.teff / 10) * 10) }), 'estimated']);
      rows.push([ft('row.radius'), ft('unit.sunRadius', { v: nf3.format(phys.radius) }), 'estimated']);
      rows.push([ft('row.luminosity'), ft('unit.sunLum', { v: nf3.format(phys.luminosity) }), 'estimated']);
      if (th.planets?.length) rows.push([ft('row.planets'), th.planets.map((p) => p.name).join(', ')]);
      notes.push(ft('note.star'));
      if (uncertain) notes.push(ft('note.uncertain'));
      return { kind: ft('kind.star'), rows, notes };
    }
    const p = th.exo!;
    rows.push([ft('row.host'), nameOf(p.hip).label]);
    rows.push([ft('row.look'), ft(`class.${th.exoClass}`)]);
    rows.push([ft('row.a'), ft('unit.au', { v: nf3.format(p.a) }), 'measured']);
    rows.push([ft('row.period'), fmtPeriod(p.per), 'measured']);
    if (p.ecc != null) rows.push([ft('row.ecc'), nf2.format(p.ecc), 'measured']);
    if (p.masse != null) rows.push([ft('row.mass'), ft(p.massIsMinimum ? 'unit.massMin' : 'unit.earthMass', { v: nf3.format(p.masse) }), 'measured']);
    if (p.rade != null) rows.push([ft('row.radius'), ft('unit.earthRadius', { v: nf3.format(p.rade) }), p.radeEstimated ? 'estimated' : 'measured']);
    const eqt = p.eqt ?? th.eqtEstimate;
    // Nhiệt độ cân bằng luôn là giá trị tính (kể cả số của kho lưu trữ), không phải số đo.
    if (eqt != null) rows.push([ft('row.eqt'), ft('unit.kelvin', { v: nf0.format(eqt) }), 'estimated']);
    rows.push([ft('row.incl'), p.incl != null ? ft('unit.deg', { v: nf2.format(p.incl) }) : '—', p.incl != null ? 'measured' : 'chosen']);
    rows.push([ft('row.orientation'), '', 'chosen']);
    rows.push([ft('row.discovery'), ft('unit.year', { method: ft(methodKey(p.method)), year: p.year ?? '—' })]);
    notes.push(ft('note.exoOrbit'));
    if (p.radeEstimated) notes.push(ft('note.radiusCalc'));
    if (p.massIsMinimum) notes.push(ft('note.massMin'));
    if (p.eqt == null) notes.push(ft('note.eqtCalc'));
    notes.push(ft('note.illustration'));
    return { kind: ft('kind.exo'), rows, notes };
  }

  let shown: Thing | null | undefined;
  function refresh(): void {
    const th = view.selected;
    if (th === shown) return;
    shown = th;
    info.hidden = !th;
    if (!th) return;
    setText(infoName, th.name);
    const vi = th.kind === 'body' ? ft(`vi.${th.bodyId}`) : (th.viName ?? '');
    setText(infoVi, vi);
    infoVi.hidden = !vi;
    const { kind, rows, notes } = rowsFor(th);
    setText(infoKind, kind);
    infoRows.replaceChildren(
      ...rows.map(([k, v, tag]) =>
        h(
          'div',
          { class: 'kv' },
          h('dt', { text: k }),
          h('dd', null, v ? h('span', { class: 'kv__v', text: v }) : null, tag ? h('span', { class: `flight__tag flight__tag--${tag}`, text: tagText(tag) }) : null),
        ),
      ),
    );
    infoNotes.replaceChildren(...notes.map((n) => h('p', { text: n })));
  }

  let lastStatus = '';
  let lastDist = '';
  function tick(): void {
    refresh();
    const f = view.focus;
    const sel = view.selected;
    let s: string;
    if (view.traveling && f) s = ft('traveling', { name: f.name });
    else if (view.mode === 'free') s = view.speedKmS > 0 ? `${ft('freeMode')} · ${ft('speedNow', { v: fmtDistance(view.speedKmS) })}` : ft('freeMode');
    else s = f ? ft('orbitMode', { name: f.name }) : ft('pickHint');
    if (s !== lastStatus) setText(status, (lastStatus = s));
    const target = sel ?? f;
    const d = target ? ft('distance', { name: target.name, d: fmtDistance(Math.max(0, view.distanceTo(target))) }) : '';
    if (d !== lastDist) setText(distEl, (lastDist = d));
    goBtn.hidden = !sel || (sel === f && view.mode === 'orbit' && !view.traveling && view.distanceTo(sel) < sel.radiusKm * 50);
  }

  refresh();
  tick();
  return { el, tick, refresh };
}
