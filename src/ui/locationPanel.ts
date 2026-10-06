// Bảng 1: Vị trí quan sát.

import { fmtDeg, fmtNum, parseNum } from '../astro';
import { SPECIAL_PLACES, VN_PLACES, type Place } from '../data/places';
import { termLink } from '../codex/triggers';
import { t } from '../i18n';
import type { Actions, Store } from '../state';
import { button, fieldset, guide, h } from './dom';
import { bindEmphasis } from './emphasis';
import { WorldMap } from './worldMap';

export function locationPanel(store: Store, actions: Actions): HTMLElement {
  const err = h('p', { class: 'field-error', role: 'alert', 'aria-live': 'polite' });

  const latInput = h('input', { type: 'text', inputmode: 'decimal', class: 'num', id: 'lat-input', 'aria-describedby': 'lat-help' });
  const latHem = h('select', { 'aria-label': t('panel.location.latHemAria') }, h('option', { value: 'N', text: t('panel.location.north') }), h('option', { value: 'S', text: t('panel.location.south') }));
  const lonInput = h('input', { type: 'text', inputmode: 'decimal', class: 'num', id: 'lon-input' });
  const lonHem = h('select', { 'aria-label': t('panel.location.lonHemAria') }, h('option', { value: 'E', text: t('panel.location.east') }), h('option', { value: 'W', text: t('panel.location.west') }));

  const apply = () => {
    const la = parseNum(latInput.value);
    const lo = parseNum(lonInput.value);
    const errors: string[] = [];
    if (!Number.isFinite(la) || la < 0 || la > 90) errors.push(t('panel.location.errLat'));
    if (!Number.isFinite(lo) || lo < 0 || lo > 180) errors.push(t('panel.location.errLon'));
    err.textContent = errors.join(' ');
    latInput.setAttribute('aria-invalid', String(errors.some((e) => e === t('panel.location.errLat'))));
    lonInput.setAttribute('aria-invalid', String(errors.some((e) => e === t('panel.location.errLon'))));
    if (errors.length) return;
    actions.setLocation(latHem.value === 'S' ? -la : la, lonHem.value === 'W' ? -lo : lo);
  };
  for (const el of [latInput, lonInput]) {
    el.addEventListener('change', apply);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') apply();
    });
  }
  latHem.addEventListener('change', apply);
  lonHem.addEventListener('change', apply);

  const latSlider = h('input', {
    type: 'range',
    min: -90,
    max: 90,
    step: 0.5,
    class: 'range',
    'aria-label': t('panel.location.latSlider'),
    oninput: (e: Event) => actions.setLocation(Number((e.target as HTMLInputElement).value), store.state.lon),
  });

  // Dòng "đặt cạnh nhau": vĩ độ vừa chọn và độ cao thiên cực — hai số luôn bằng nhau.
  const poleLine = h('p', { class: 'pole-line', id: 'pole-line', 'aria-live': 'polite', 'data-emphasis': 'pole' });
  latSlider.setAttribute('aria-describedby', 'pole-line');
  bindEmphasis(poleLine, store, actions);

  const map = new WorldMap((lat, lon) => actions.setLocation(lat, lon));

  const placeBtn = (p: Place) =>
    button(p.name, () => actions.setLocation(p.lat, p.lon ?? store.state.lon), {
      cls: 'chip',
      title: p.lon !== undefined ? `${fmtNum(p.lat)}°; ${fmtNum(p.lon)}°` : t('panel.location.keepLon'),
    });

  const el = h(
    'section',
    { class: 'panel', id: 'panel-location', 'aria-labelledby': 'h-location' },
    h('h2', { id: 'h-location', class: 'panel__title', text: t('panel.location.title') }),
    h(
      'div',
      { class: 'coord-grid', 'data-guide': 'latLonInput' },
      h('label', { htmlFor: 'lat-input', text: t('panel.location.lat') }),
      h('div', { class: 'coord-row' }, latInput, h('span', { class: 'unit', text: '°' }), latHem),
      h('label', { htmlFor: 'lon-input', text: t('panel.location.lon') }),
      h('div', { class: 'coord-row' }, lonInput, h('span', { class: 'unit', text: '°' }), lonHem),
    ),
    h('p', { class: 'hint', id: 'lat-help', text: t('panel.location.inputHint') }),
    err,
    h('div', { class: 'slider-row', 'data-guide': 'latSlider' }, h('span', { class: 'slider-row__label', text: t('panel.location.latSliderShort') }), latSlider),
    // Codex (redesign-2 C): dòng cốt lõi kèm liên kết "?" tới mục độ cao thiên cực = vĩ độ.
    h('div', { class: 'pole-row' }, poleLine, termLink('latPole', t('data.pole'))),
    guide('worldMap', map.el),
    h('p', { class: 'hint', text: t('panel.location.mapHint') }),
    guide('places', fieldset(t('panel.location.vn'), h('div', { class: 'chips' }, ...VN_PLACES.map(placeBtn)))),
    guide('places', fieldset(t('panel.location.special'), h('div', { class: 'chips' }, ...SPECIAL_PLACES.map(placeBtn)))),
  );

  const sync = () => {
    const { lat, lon } = store.state;
    if (document.activeElement !== latInput) latInput.value = fmtNum(Math.abs(lat));
    if (document.activeElement !== lonInput) lonInput.value = fmtNum(Math.abs(lon));
    latHem.value = lat < 0 ? 'S' : 'N';
    lonHem.value = lon < 0 ? 'W' : 'E';
    latSlider.value = String(lat);
    poleLine.textContent =
      lat === 0
        ? t('panel.location.poleLineEquator')
        : t('panel.location.poleLine', { pole: t(lat > 0 ? 'panel.location.north' : 'panel.location.south'), x: fmtDeg(Math.abs(lat)) });
    err.textContent = '';
    latInput.removeAttribute('aria-invalid');
    lonInput.removeAttribute('aria-invalid');
    map.draw(lat, lon);
  };
  store.subscribe((s, prev) => {
    if (s.lat !== prev.lat || s.lon !== prev.lon) sync();
  });
  queueMicrotask(sync);
  return el;
}
