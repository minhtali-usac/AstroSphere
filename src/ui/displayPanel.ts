// Bảng 3: Hiển thị (các hộp kiểm, nhãn theo nhóm, phần mở rộng).

import { fmtDegSigned, fmtDuration, riseSet } from '../astro';
import { TOGGLE_ENTRY, termLink } from '../codex/triggers';
import { t } from '../i18n';
import { COLORS } from '../scene/colors';
import { sunEquatorial } from '../selection';
import type { Actions, LabelToggles, Store, Toggles } from '../state';
import { button, checkbox, h } from './dom';

type ToggleKey = keyof Toggles;

/**
 * Nhóm hộp kiểm theo khái niệm, đúng thứ tự câu chuyện: bầu trời quay → chân trời của bạn → hai hệ tọa độ →
 * mọc – lặn → mở rộng → nhãn. Chỉ nhóm đầu mở sẵn; mỗi nhóm đóng có một câu giới thiệu ngắn.
 */
export const DISPLAY_GROUPS: readonly { id: string; toggles: readonly [ToggleKey, string?][] }[] = [
  {
    id: 'sky',
    toggles: [
      ['poleAxis', COLORS.axis],
      ['equator', COLORS.equator],
      ['hourCircle0', COLORS.hourCircle],
      ['horizonOnSphere', COLORS.horizon],
      ['zenithNadir', COLORS.zenith],
    ],
  },
  {
    id: 'horizon',
    toggles: [
      ['meridian', COLORS.meridian],
      ['verticalCircle', COLORS.vertical],
      ['altAzGrid', COLORS.altAzGrid],
      ['underside'],
      ['poleAltitude', COLORS.latitude],
    ],
  },
  {
    id: 'coords',
    toggles: [
      ['eqGrid', COLORS.grid],
      ['equatorPlane', COLORS.equator],
      ['angle', COLORS.angle],
    ],
  },
  {
    id: 'riseSet',
    toggles: [
      ['zoneCircumpolar', COLORS.circumpolar],
      ['zoneRiseSet', COLORS.riseSet],
      ['zoneNeverRise', COLORS.neverRise],
    ],
  },
  {
    id: 'extra',
    toggles: [
      ['ecliptic', COLORS.ecliptic],
      ['galactic', COLORS.galactic],
      ['sun', COLORS.sun],
      ['deepSky', COLORS.deepSky],
    ],
  },
  { id: 'labels', toggles: [] },
];

/** Các hộp kiểm khái niệm có một dòng giải thích `toggleHint.<key>` khi đang bật. */
export const HINTED_TOGGLES: readonly ToggleKey[] = [
  'poleAxis',
  'equator',
  'hourCircle0',
  'horizonOnSphere',
  'zenithNadir',
  'meridian',
  'verticalCircle',
  'altAzGrid',
  'eqGrid',
  'poleAltitude',
  'angle',
  'equatorPlane',
  'underside',
  'zoneCircumpolar',
  'zoneRiseSet',
  'zoneNeverRise',
];

const LABEL_KEYS: (keyof LabelToggles)[] = ['directions', 'poles', 'circles', 'stars', 'angles'];

export function displayPanel(store: Store, actions: Actions): HTMLElement {
  const boxes = new Map<ToggleKey, ReturnType<typeof checkbox>>();
  const labelBoxes = new Map<keyof LabelToggles, HTMLInputElement>();

  const makeGroup = (items: readonly [ToggleKey, string?][]) =>
    items.map(([k, swatch]) => {
      const cb = checkbox(t(`toggle.${k}`), store.state.toggles[k], (v) => actions.setToggle(k, v), {
        tip: t(`toggleTip.${k}`),
        swatch,
        hint: HINTED_TOGGLES.includes(k) ? t(`toggleHint.${k}`) : undefined,
        emphasis: k,
      });
      boxes.set(k, cb);
      // Codex (redesign-2 C): liên kết "?" ở cuối dòng hộp kiểm → mục giải thích khái niệm.
      const entry = TOGGLE_ENTRY[k];
      return entry ? h('div', { class: 'check-row' }, cb.el, termLink(entry, t(`toggle.${k}`))) : cb.el;
    });

  const master = checkbox(t('labels.all'), store.state.labels.all, (v) => actions.setLabel('all', v), { tip: t('labels.allTip') });
  labelBoxes.set('all', master.input);
  const labelItems = LABEL_KEYS.map((k) => {
    const cb = checkbox(t(`labels.${k}`), store.state.labels[k], (v) => actions.setLabel(k, v));
    labelBoxes.set(k, cb.input);
    return cb.el;
  });

  const dateInput = h('input', {
    type: 'date',
    id: 'sun-date',
    value: store.state.sunDate,
    onchange: (e: Event) => actions.setSunDate((e.target as HTMLInputElement).value),
  });
  const sunInfo = h('p', { class: 'hint', 'aria-live': 'polite' });
  const seasonBtn = (key: string, md: string) =>
    button(t(`panel.display.${key}`), () => {
      const year = store.state.sunDate.slice(0, 4);
      actions.setSunDate(`${year}-${md}`);
      actions.setToggle('sun', true);
    }, { cls: 'chip' });

  const legend = h(
    'div',
    { class: 'legend-zones', 'aria-label': t('panel.display.zoneLegend') },
    ...(['zoneCircumpolar', 'zoneRiseSet', 'zoneNeverRise'] as const).map((k) =>
      h('span', { class: 'legend-item' }, h('span', { class: 'swatch swatch--zone', style: { background: COLORS[k === 'zoneCircumpolar' ? 'circumpolar' : k === 'zoneRiseSet' ? 'riseSet' : 'neverRise'] } }), t(`legend.${k}`)),
    ),
  );

  /** Phần thêm sau các hộp kiểm của từng nhóm (chú giải vùng, ngày Mặt Trời, nhãn). */
  const extras: Record<string, HTMLElement[]> = {
    riseSet: [legend],
    extra: [
      h('div', { class: 'field', 'data-guide': 'sunDate' }, h('label', { htmlFor: 'sun-date', text: t('panel.display.sunDate') }), dateInput),
      h('div', { class: 'chips', 'data-guide': 'sunDate' }, seasonBtn('vernal', '03-20'), seasonBtn('summer', '06-21'), seasonBtn('autumnal', '09-23'), seasonBtn('winter', '12-22')),
      sunInfo,
      h('div', { class: 'row' }, button(t('panel.display.openCatalog'), () => window.dispatchEvent(new Event('open-catalog')), { cls: 'btn--small btn--ghost', title: t('panel.display.openCatalogTip'), guide: 'catalog' })),
    ],
    labels: [h('div', { class: 'checks' }, master.el, h('div', { class: 'checks checks--indent' }, ...labelItems))],
  };

  const el = h(
    'section',
    { class: 'panel', id: 'panel-display', 'aria-labelledby': 'h-display' },
    h('h2', { id: 'h-display', class: 'panel__title', text: t('panel.display.title') }),
    ...DISPLAY_GROUPS.map((g, i) =>
      h(
        'details',
        { class: 'sub', open: i === 0, 'data-group': g.id, 'data-guide': 'displayGroup' },
        h(
          'summary',
          null,
          h('span', { class: 'sub__title', text: t(`displayGroup.${g.id}.title`) }),
          h('span', { class: 'sub__teaser', text: t(`displayGroup.${g.id}.teaser`) }),
        ),
        g.toggles.length ? h('div', { class: 'checks' }, ...makeGroup(g.toggles)) : null,
        ...(extras[g.id] ?? []),
      ),
    ),
  );

  const sync = () => {
    const s = store.state;
    for (const [k, cb] of boxes) cb.set(s.toggles[k]);
    for (const [k, input] of labelBoxes) {
      input.checked = s.labels[k];
      if (k !== 'all') input.disabled = !s.labels.all;
    }
    if (document.activeElement !== dateInput) dateInput.value = s.sunDate;
    legend.hidden = !(s.toggles.zoneCircumpolar || s.toggles.zoneRiseSet || s.toggles.zoneNeverRise);
    if (s.toggles.sun) {
      const p = sunEquatorial(s);
      const rs = riseSet(p.ra, p.dec, s.lat);
      const day =
        rs.visibility === 'circumpolar' ? t('panel.display.polarDay') : rs.visibility === 'neverRise' ? t('panel.display.polarNight') : t('panel.display.dayLength', { d: fmtDuration(rs.hoursAbove * 0.99727) });
      sunInfo.textContent = t('panel.display.sunInfo', { dec: fmtDegSigned(p.dec), day });
    } else sunInfo.textContent = t('panel.display.sunOff');
  };
  store.subscribe((s, prev) => {
    if (s.toggles !== prev.toggles || s.labels !== prev.labels || s.sunDate !== prev.sunDate || s.lat !== prev.lat) sync();
  });
  sync();
  return el;
}
