// Thẻ thông tin đối tượng đang chọn và thanh số liệu trực tiếp (φ, λ, LST, tọa độ ở cả hai hệ).

import {
  equatorialToHorizontal,
  equatorInclination,
  fmtDeg,
  fmtDegSigned,
  fmtDMS,
  fmtDuration,
  fmtHMS,
  fmtLat,
  fmtLon,
  fmtMag,
  norm360,
  poleAltitude,
  riseSet,
} from '../astro';
import { appendTerm, termLink } from '../codex/triggers';
import { t } from '../i18n';
import { resolveSelection, sunEquatorial } from '../selection';
import { lstOf, type Actions, type AppState, type Store } from '../state';
import { h, setHidden, setText } from './dom';
import { bindEmphasis } from './emphasis';
import { chevronIcon } from './icons';

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Chiều cao tối thiểu (px) của vùng cuộn để hiện dấu "↓ Còn nữa": dòng tiêu đề + dải che + một dòng số liệu. */
const MORE_MIN_HEIGHT = 120;

const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Tên hướng (8 hướng) cho phương vị; chuỗi rỗng nếu phương vị không xác định (vd. ở hai cực). */
export function compassName(az: number): string {
  if (!Number.isFinite(az)) return '';
  return t(`compass.${DIRS[Math.round(norm360(az) / 45) % 8]}`);
}

/** "A = 63,4° (ĐB)", hoặc "A = —" khi phương vị không xác định (|φ| = 90°). */
export function azimuthText(az: number): string {
  return Number.isFinite(az) ? `A = ${fmtDeg(az, 1)} (${compassName(az)})` : 'A = —';
}

interface Row {
  el: HTMLElement;
  v: HTMLSpanElement;
  x: HTMLSpanElement;
}

/** Các dòng của thẻ có thêm một câu nghĩa ngắn `info.<key>Note` ngay dưới giá trị. */
export const INFO_NOTE_KEYS = ['ra', 'dec', 'ha', 'az', 'alt'] as const;

function row(key: string, label: string, title?: string, note?: string): Row {
  const v = h('span', { class: 'kv__v' });
  const x = h('span', { class: 'kv__x' });
  const n = note ? h('span', { class: 'kv__note', text: note }) : null;
  // data-emphasis: khóa "tô sáng liên kết" (ui/emphasis.ts nối các khóa có hình tương ứng).
  return { el: h('div', { class: 'kv', title, 'data-emphasis': key }, h('dt', { text: label }), h('dd', null, v, x, n)), v, x };
}

function setRow(r: Row, value: string, extra = ''): void {
  setText(r.v, value);
  setText(r.x, extra);
}

export function infoCard(store: Store, actions: Actions) {
  const title = h('h3', { class: 'infocard__title', text: t('info.emptyTitle') });
  const dot = h('span', { class: 'infocard__dot', 'aria-hidden': 'true' });
  // Dòng phụ: tên tiếng Việt (nếu có) ngay dưới tên quốc tế (ux-brief §7).
  const viName = h('p', { class: 'infocard__vi', lang: 'vi', hidden: true });
  // Dòng loại: ký hiệu · chòm sao · cấp sao. Cấp sao nằm trong span không ngắt dòng để "cấp sao 1,97" không bị
  // tách thành dòng mồ côi (review-2 D2).
  const kindText = h('span');
  const magText = h('span', { class: 'infocard__mag' });
  const kind = h('p', { class: 'infocard__kind' }, kindText, magText);
  // Điện thoại, thẻ thu gọn: một dòng mảnh "tên · A …, h …" (review-3 B4) — chạm để mở đầy đủ.
  const brief = h('span', { class: 'infocard__brief' });
  const collapseBtn = h(
    'button',
    {
      type: 'button',
      class: 'icon-btn infocard__fold',
      'aria-expanded': 'true',
      'aria-label': t('info.collapse'),
      'data-guide': 'infoCollapse',
      title: t('info.collapse'),
      onclick: () => setCollapsed(!el.classList.contains('is-collapsed')),
    },
    chevronIcon(), // fix-2 #8: chevron thay cho "+"/"–" ("+" đọc thành "thêm")
  );
  /** Thu gọn thẻ về một dòng tiêu đề (tên đối tượng) hoặc mở ra đầy đủ. */
  function setCollapsed(collapsed: boolean): void {
    el.classList.toggle('is-collapsed', collapsed);
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    const label = t(collapsed ? 'info.expand' : 'info.collapse');
    collapseBtn.setAttribute('aria-label', label);
    collapseBtn.title = label;
  }
  const isWide = (): boolean => !(window.matchMedia?.('(max-width: 900px)').matches ?? false);

  // Cấu trúc thẻ dựng một lần; mỗi lần cập nhật chỉ thay chữ (rẻ khi đang chạy hoạt ảnh).
  const note = (k: (typeof INFO_NOTE_KEYS)[number]) => t(`info.${k}Note`);
  const r = {
    ra: row('ra', t('info.ra'), undefined, note('ra')),
    dec: row('dec', t('info.dec'), undefined, note('dec')),
    ha: row('ha', t('info.ha'), t('info.haTip'), note('ha')),
    az: row('az', t('info.az'), undefined, note('az')),
    alt: row('alt', t('info.alt'), undefined, note('alt')),
    rise: row('rise', t('info.rise')),
    transit: row('transit', t('info.transit')),
    set: row('set', t('info.set')),
    above: row('above', t('info.hoursAbove'), t('info.hoursAboveTip')),
    lowest: row('lowest', t('info.lowest')),
    highest: row('highest', t('info.highest')),
  };
  const status = h('span', { class: 'status' });
  // Chú giải màu chấm (fix-3 #8): lớp vùng mọc – lặn (chú giải màu của nó) tắt theo mặc định, nên chú thích của nút "?"
  // cạnh "Trạng thái" liệt kê cả ba trạng thái, mỗi cái với chấm màu vùng của nó (cùng lớp .status--* với viên).
  const statusKey = h(
    'span',
    { class: 'status-key', id: 'info-status-key', role: 'tooltip' },
    h('span', { class: 'status-key__head', text: t('info.statusKey') }),
    h('span', { class: 'status-key__item status--circumpolar', text: t('visibility.circumpolar') }),
    h('span', { class: 'status-key__item status--riseSet', text: t('visibility.riseSet') }),
    h('span', { class: 'status-key__item status--neverRise', text: t('visibility.neverRise') }),
    h('span', { class: 'status-key__foot', text: t('codexUi.termTip') }),
  );
  // Hàng trạng thái xếp dọc (nhãn trên, viên trạng thái dưới) để viên "Cận cực (không bao giờ lặn)" nằm trọn một dòng.
  const statusRow = h('div', { class: 'kv kv--stack', 'data-emphasis': 'status' }, h('dt', { text: t('info.status') }), h('dd', null, status, statusKey));
  const detailsHead = h('h4', { text: t('info.details') });
  const detailsDl = h('dl');
  const body = h(
    'div',
    { class: 'infocard__body' },
    h('h4', { text: t('info.equatorial') }),
    h('dl', null, r.ra.el, r.dec.el, r.ha.el),
    h('h4', { text: t('info.horizontal') }),
    h('dl', null, r.az.el, r.alt.el),
    h('h4', { text: t('info.riseSet') }),
    h(
      'dl',
      null,
      statusRow,
      r.rise.el,
      r.transit.el,
      r.set.el,
      r.above.el,
      r.lowest.el,
      r.highest.el,
    ),
    // Chi tiết định danh để cuối: thứ tự khái niệm đi từ tọa độ đến mọc – lặn (ux-brief §2).
    detailsHead,
    detailsDl,
  );

  for (const row of [r.ha.el, r.az.el, r.alt.el, statusRow]) bindEmphasis(row, store, actions);

  // ----- Codex (redesign-2 C): liên kết "?" nhỏ cạnh nhãn dòng → mục giải thích. Trạng thái trỏ tới vùng hiện tại.
  const statusTerm = termLink('riseSetZone', t('info.status'));
  for (const [rowEl, id, label] of [
    [r.ra.el, 'radec', t('info.ra')],
    [r.dec.el, 'radec', t('info.dec')],
    [r.ha.el, 'hourAngle', t('info.ha')],
    [r.az.el, 'altaz', t('info.az')],
    [r.alt.el, 'altaz', t('info.alt')],
  ] as const)
    appendTerm(rowEl.querySelector('dt')!, termLink(id, label));
  appendTerm(statusRow.querySelector('dt')!, statusTerm);
  // Chú giải riêng thay cho chú thích gốc (title) của nút: không hiện hai chú thích chồng nhau.
  statusTerm.removeAttribute('title');
  statusTerm.setAttribute('aria-describedby', statusKey.id);
  const STATUS_ENTRY = { circumpolar: 'circumpolar', riseSet: 'riseSetZone', neverRise: 'neverRise' } as const;

  // Trạng thái trống: nói rõ vì sao thẻ trống và việc nên làm tiếp (thay cho việc ẩn thẻ).
  const empty = h('p', { class: 'infocard__empty', text: t('info.empty') });
  // Dấu "↓ Còn nữa" (fix-3 #11): dính ở mép dưới vùng cuộn của thẻ, chỉ hiện khi còn nội dung bên dưới (lớp has-more).
  // Bấm vào thì cuộn xuống gần một khung. Chỉ dành cho chuột/chạm: bàn phím và trình đọc màn hình cuộn chính thẻ, nên
  // nút không nhận tiêu điểm (tránh tiêu điểm rơi mất khi nút ẩn đi lúc đã cuộn tới đáy).
  const more = h(
    'div',
    { class: 'infocard__more' },
    h('button', {
      type: 'button',
      class: 'infocard__more-btn',
      tabIndex: -1,
      'aria-hidden': 'true',
      'data-guide': 'infoMore',
      title: t('info.moreTip'),
      text: t('info.more'),
      onclick: () => el.scrollBy({ top: Math.max(80, el.clientHeight * 0.8), behavior: reducedMotion() ? 'auto' : 'smooth' }),
    }),
  );
  const el = h(
    'aside',
    { class: 'infocard is-empty', 'aria-label': t('info.aria'), 'data-guide': 'infoCard' },
    h(
      'header',
      { class: 'infocard__head' },
      dot,
      title,
      brief,
      collapseBtn,
      h('button', {
        type: 'button',
        class: 'icon-btn infocard__close',
        'aria-label': t('info.close'),
        title: t('info.close'),
        text: '×',
        'data-guide': 'infoClose',
        onclick: () => actions.select(null),
      }),
    ),
    viName,
    kind,
    empty,
    body,
    more,
  );

  // Kéo thẻ bằng thanh tiêu đề để không che phần đang quan sát (chỉ trên màn hình rộng).
  const head = el.querySelector('.infocard__head') as HTMLElement;
  head.addEventListener('pointerenter', () => {
    head.title = getComputedStyle(el).position === 'absolute' ? t('info.dragTip') : '';
  });
  let drag: { dx: number; dy: number } | null = null;
  let dragged = false;
  head.addEventListener('pointerdown', (e) => {
    dragged = false;
    // Chỉ kéo được khi thẻ nổi trên khung nhìn (không kéo khi là cột cố định hoặc trên điện thoại).
    if ((e.target as HTMLElement).closest('button') || window.matchMedia?.('(max-width: 900px)').matches) return;
    if (getComputedStyle(el).position !== 'absolute') return;
    const r = el.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    head.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  head.addEventListener('pointermove', (e) => {
    if (!drag || !el.parentElement) return;
    dragged = true;
    const box = el.parentElement.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - box.left - drag.dx, 0), box.width - el.offsetWidth);
    const y = Math.min(Math.max(e.clientY - box.top - drag.dy, 0), box.height - 40);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.right = 'auto';
  });
  const endDrag = () => (drag = null);
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);
  // Bấm vào thanh tiêu đề (không phải nút, không phải kéo) cũng mở/thu gọn thẻ (review-2 B2).
  head.addEventListener('click', (e) => {
    // Điện thoại: chạm vào dòng mảnh của thẻ thu gọn cũng mở thẻ ra (review-3 B4).
    if (dragged || (e.target as HTMLElement).closest('button') || el.classList.contains('is-empty')) return;
    setCollapsed(!el.classList.contains('is-collapsed'));
  });

  // Còn nội dung bên dưới mép thẻ → mép dưới mờ nhẹ và dấu "↓ Còn nữa" (lớp has-more, fix-3 #11; trước đây chỉ có
  // lớp can-scroll làm mờ). Chỉ đọc kích thước khi cuộn hoặc khi ResizeObserver báo đổi kích thước (sau bố cục), không
  // đọc trong nhịp cập nhật của vòng lặp; chỉ ghi DOM khi trạng thái đổi. Thẻ chỉ còn chỗ cho dòng tiêu đề (bố cục
  // tập trung trên màn hình thấp, fix-3 #2: thiên cầu giữ ≥ 220 px) thì không có dấu, để dải che không đè lên tên.
  let hasMore = false;
  const syncScroll = () => {
    const can = el.clientHeight >= MORE_MIN_HEIGHT && el.scrollHeight - el.scrollTop - el.clientHeight > 4;
    if (can !== hasMore) {
      hasMore = can;
      el.classList.toggle('has-more', can);
    }
  };
  el.addEventListener('scroll', syncScroll, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(syncScroll);
    ro.observe(el);
    ro.observe(body);
  }

  // Thẻ bắt đầu thu gọn về một dòng tên đối tượng (review-2 B2/B3: một tiêu điểm duy nhất là giản đồ chân trời).
  // Điện thoại: như trước, thu gọn để không che khung nhìn. Màn hình rộng: thẻ tự mở khi người dùng chọn một
  // đối tượng KHÁC (bấm vào sao), tự thu lại khi bỏ chọn; khi thu gọn, cột thứ ba trả chỗ cho hai khung nhìn.
  setCollapsed(true);

  let staticKey = '';
  let wasEmpty: boolean | null = null;
  // undefined = chưa ghi nhận (lần đầu, hoặc sau "Đặt lại"): lựa chọn mặc định không tự mở thẻ.
  let selRef: AppState['selected'] | undefined;
  const update = () => {
    const s = store.state;
    const obj = resolveSelection(s);
    const isEmpty = !obj;
    // So sánh tham chiếu: trạng thái bất biến, lựa chọn chỉ đổi khi người dùng chọn/bỏ chọn (không cấp phát).
    if (s.selected !== selRef) {
      if (selRef !== undefined && isWide()) setCollapsed(!obj);
      selRef = s.selected;
    }
    if (isEmpty !== wasEmpty) {
      wasEmpty = isEmpty;
      el.classList.toggle('is-empty', isEmpty);
      if (isEmpty) {
        staticKey = '';
        setText(title, t('info.emptyTitle'));
      }
    }
    if (!obj) return;
    const lst = lstOf(s);
    const { alt, az, ha } = equatorialToHorizontal(obj.ra, obj.dec, s.lat, lst);

    // Phần phụ thuộc vào đối tượng và vĩ độ (không đổi khi bầu trời quay)
    const key = `${obj.name}|${obj.viName ?? ''}|${obj.kind}|${obj.ra}|${obj.dec}|${s.lat}`;
    if (key !== staticKey) {
      staticKey = key;
      const rs = riseSet(obj.ra, obj.dec, s.lat);
      setText(title, obj.name);
      setText(viName, obj.viName ?? '');
      setHidden(viName, !obj.viName);
      detailsHead.hidden = detailsDl.hidden = !obj.details?.length;
      detailsDl.replaceChildren(
        ...(obj.details ?? []).map(([k, v]) => h('div', { class: 'kv' }, h('dt', { text: k }), h('dd', null, h('span', { class: 'kv__v', text: v })))),
      );
      dot.style.background = obj.color;
      const kindHead = [obj.designation, obj.kind].filter(Boolean).join(' · ');
      const mag = obj.mag !== undefined ? t('info.mag', { m: fmtMag(obj.mag, 2) }) : '';
      setText(kindText, kindHead && mag ? `${kindHead} · ` : kindHead);
      setText(magText, mag);
      setRow(r.ra, fmtHMS(obj.ra), `(${fmtDeg(obj.ra)})`);
      setRow(r.dec, fmtDMS(obj.dec), `(${fmtDegSigned(obj.dec)})`);
      status.className = `status status--${rs.visibility}`;
      statusTerm.dataset.codex = STATUS_ENTRY[rs.visibility];
      setText(status, t(`visibility.${rs.visibility}`));
      const rsVis = rs.visibility === 'riseSet';
      r.rise.el.hidden = !rsVis;
      r.set.el.hidden = !rsVis;
      r.above.el.hidden = !rsVis;
      r.transit.el.hidden = rs.visibility === 'neverRise';
      r.lowest.el.hidden = rs.visibility !== 'circumpolar';
      r.highest.el.hidden = rs.visibility !== 'neverRise';
      setRow(r.rise, `LST ${fmtHMS(rs.riseLst, { seconds: false })}`, azimuthText(rs.riseAz));
      setRow(r.transit, `LST ${fmtHMS(rs.transitLst, { seconds: false })}`, `h = ${fmtDegSigned(rs.upperAlt, 1)}`);
      setRow(r.set, `LST ${fmtHMS(rs.setLst, { seconds: false })}`, azimuthText(rs.setAz));
      setRow(r.above, fmtDuration(rs.hoursAbove), t('info.siderealHours'));
      setRow(r.lowest, `h = ${fmtDegSigned(rs.lowerAlt, 1)}`, t('info.lowestNote'));
      setRow(r.highest, `h = ${fmtDegSigned(rs.upperAlt, 1)}`, t('info.highestNote'));
    }

    // Phần thay đổi theo thời gian
    setRow(r.ha, fmtHMS(ha, { signed: true }), ha >= 0 ? t('info.haWest') : t('info.haEast'));
    setRow(r.az, Number.isFinite(az) ? fmtDeg(az, 2) : '—', compassName(az));
    setRow(r.alt, fmtDegSigned(alt, 2), alt >= 0 ? t('info.above') : t('info.below'));
    setText(brief, `A\u00a0${Number.isFinite(az) ? fmtDeg(az, 1) : '—'} · h\u00a0${fmtDegSigned(alt, 1)}`);
  };

  /** "Đặt lại": về trạng thái lần đầu vào trang (thẻ thu gọn, lựa chọn mặc định không tự mở thẻ). */
  const reset = () => {
    setCollapsed(true);
    selRef = undefined;
  };

  return { el, update, reset };
}

/**
 * Thứ tự ô = thứ tự khái niệm: vị trí (φ, độ cao thiên cực, góc xích đạo – chân trời) → thời gian (λ, LST, GST,
 * giờ Mặt Trời) → đối tượng đang chọn. φ và độ cao thiên cực đứng cạnh nhau để thấy chúng bằng nhau.
 * `group-end` đánh dấu ô cuối của một cụm (khoảng trống lớn hơn phía sau thay cho đường viền).
 */
export const DATA_CELLS = [
  { key: 'lat', tip: false, end: false, guide: 'dataLat' },
  { key: 'pole', tip: true, end: false, guide: 'dataPole' },
  { key: 'incl', tip: true, end: true, guide: 'dataIncl' },
  { key: 'lon', tip: false, end: false, guide: 'dataLon' },
  { key: 'lst', tip: true, end: false, guide: 'dataLst' },
  { key: 'gst', tip: true, end: false, guide: 'dataGst' },
  { key: 'solar', tip: true, end: true, guide: 'dataSolar' },
  { key: 'selected', tip: false, end: false, guide: 'dataSelected' },
] as const;
export type DataKey = (typeof DATA_CELLS)[number]['key'];

const NB = '\u00a0';

/** Giá trị ô "Đối tượng đang chọn": hai dòng (ngắt bằng \n, CSS white-space: pre-line), cặp ký hiệu–giá trị không ngắt. */
export function selectedValueText(name: string, ra: number, dec: number, az: number, alt: number): string {
  const nb = (x: string) => x.replace(/ /g, NB);
  const raText = nb(fmtHMS(ra, { seconds: false }));
  const azText = Number.isFinite(az) ? fmtDeg(az, 1) : '—';
  return `${name.split(' (')[0]}: α${NB}${raText}, δ${NB}${fmtDegSigned(dec, 1)}\nA${NB}${azText}, h${NB}${fmtDegSigned(alt, 1)}`;
}

export function dataBar(store: Store, actions: Actions) {
  const items = {} as Record<DataKey, HTMLElement>;
  const cells = {} as Record<DataKey, HTMLElement>;
  for (const c of DATA_CELLS) {
    const v = h('span', { class: 'data__v' });
    items[c.key] = v;
    const note = h('span', { class: 'data__n', text: t(`data.${c.key}Note`) });
    // data-emphasis: khóa "tô sáng liên kết" (số ↔ hình trong hai khung nhìn), xem ui/emphasis.ts.
    cells[c.key] = h(
      'div',
      {
        class: c.end ? 'data__item data__item--end' : 'data__item',
        title: c.tip ? t(`data.${c.key}Tip`) : undefined,
        'data-emphasis': c.key,
        // Khóa giải thích của Usui-chan: chuỗi cố định trong DATA_CELLS (guide.test.ts kiểm từng khóa).
        'data-guide': c.guide,
      },
      h('span', { class: 'data__k', text: t(`data.${c.key}`) }),
      v,
      note,
    );
  }
  for (const c of DATA_CELLS) bindEmphasis(cells[c.key], store, actions);
  // Codex (redesign-2 C): liên kết "?" cạnh tên ô số liệu.
  const DATA_TERMS: Partial<Record<DataKey, string>> = { lat: 'latPole', pole: 'latPole', incl: 'eqAngle', lst: 'lst', gst: 'lst' };
  for (const [k, id] of Object.entries(DATA_TERMS)) appendTerm(cells[k as DataKey].querySelector('.data__k')!, termLink(id, t(`data.${k}`)));
  const sunCell = cells.solar;
  const el = h('section', { class: 'databar', id: 'databar', 'aria-label': t('data.aria') }, ...DATA_CELLS.map((c) => cells[c.key]));

  const update = () => {
    const s: AppState = store.state;
    const lst = lstOf(s);
    setText(items.lat, `φ = ${fmtLat(s.lat)}`);
    setText(items.lon, `λ = ${fmtLon(s.lon)}`);
    setText(items.lst, fmtHMS(lst));
    setText(items.gst, fmtHMS(s.gst));
    setText(items.pole, fmtDeg(poleAltitude(s.lat)));
    setText(items.incl, fmtDeg(equatorInclination(s.lat)));
    setHidden(sunCell, !s.toggles.sun);
    if (s.toggles.sun) {
      const p = sunEquatorial(s);
      const haSun = equatorialToHorizontal(p.ra, p.dec, s.lat, lst).ha;
      setText(items.solar, `≈ ${fmtHMS(norm360(haSun + 180), { seconds: false })}`);
    }
    const obj = resolveSelection(s);
    if (obj) {
      const { alt, az } = equatorialToHorizontal(obj.ra, obj.dec, s.lat, lst);
      // Hai dòng có chủ ý (review-3 D2): "tên: α …, δ …" rồi "A …, h …". Trong mỗi cặp "ký hiệu giá trị" dùng khoảng
      // trắng không ngắt (U+00A0), nên dòng chỉ có thể xuống sau dấu phẩy, không bao giờ giữa "h" và "+20,9°".
      setText(items.selected, selectedValueText(obj.name, obj.ra, obj.dec, az, alt));
    } else setText(items.selected, t('data.selectedNone'));
  };
  return { el, update };
}
