// Bảng 4: Điều khiển sao (mẫu chòm sao, sao ngẫu nhiên, nhập α–δ, vết sao).

import { fmtNum, parseDegrees, parseHours } from '../astro';
import { catalogCount, catalogMagLimit } from '../data/catalog';
import { constellationName, templateDescription, TEMPLATES } from '../data/constellations';
import { t } from '../i18n';
import { MAX_USER_STARS, type Actions, type Store, type TrailMode } from '../state';
import { button, checkbox, clear, fieldset, guide, h, newId } from './dom';

export function starPanel(store: Store, actions: Actions): HTMLElement {
  const msg = h('p', { class: 'field-msg', role: 'status', 'aria-live': 'polite' });
  const say = (text: string, kind: 'ok' | 'err' = 'ok') => {
    msg.textContent = text;
    msg.dataset.kind = kind;
  };

  // Mẫu chòm sao
  const tplSelect = h(
    'select',
    { id: 'tpl-select', 'aria-label': t('panel.stars.templateAria') },
    ...TEMPLATES.map((tp) => h('option', { value: tp.id, text: tp.name })),
  );
  const tplNote = h('p', { class: 'hint' });
  const updateNote = () => {
    const tp = TEMPLATES.find((x) => x.id === tplSelect.value);
    tplNote.textContent = tp ? templateDescription(tp) : '';
  };
  tplSelect.addEventListener('change', updateNote);
  updateNote();
  const addTpl = button(t('panel.stars.addTemplate'), () => {
    const id = tplSelect.value;
    const name = constellationName(id);
    if (actions.hasConstellation(id)) return say(t('panel.stars.alreadyAdded', { name }), 'err');
    if (!actions.addConstellation(id)) return say(t('panel.stars.tooMany', { n: MAX_USER_STARS }), 'err');
    say(t('panel.stars.addedTemplate', { name }));
  }, { cls: 'btn--primary' });
  const figureChips = h('div', { class: 'chips chips--figures' });

  // Sao trong danh mục
  const catalogCb = checkbox(
    t('panel.stars.catalog', { n: catalogCount, m: fmtNum(catalogMagLimit, 1) }),
    store.state.toggles.catalog,
    (v) => actions.setToggle('catalog', v),
    { tip: t('toggleTip.catalog') },
  );
  const linesCb = checkbox(t('toggle.constellationLines'), store.state.toggles.constellationLines, (v) => actions.setToggle('constellationLines', v), {
    tip: t('toggleTip.constellationLines'),
  });

  // Nhập (α, δ)
  const raId = newId('ra');
  const decId = newId('dec');
  const nameId = newId('nm');
  // inputmode="text": bàn phím số của iOS không có dấu trừ (δ âm) và chữ h/m (dạng 6h45m).
  const coordAttrs = { type: 'text', class: 'num', inputmode: 'text', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false' };
  const raInput = h('input', { ...coordAttrs, id: raId, placeholder: '6h45m' });
  const decInput = h('input', { ...coordAttrs, id: decId, placeholder: '−16,7' });
  const nameInput = h('input', { type: 'text', id: nameId, placeholder: t('panel.stars.namePlaceholder'), maxlength: 40 });
  const addManual = () => {
    const raH = parseHours(raInput.value);
    const dec = parseDegrees(decInput.value);
    if (!Number.isFinite(raH) || raH < 0 || raH >= 24) return say(t('panel.stars.errRa'), 'err');
    if (!Number.isFinite(dec) || dec < -90 || dec > 90) return say(t('panel.stars.errDec'), 'err');
    const star = actions.addManualStar(raH * 15, dec, nameInput.value);
    if (!star) return say(t('panel.stars.tooMany', { n: MAX_USER_STARS }), 'err');
    say(t('panel.stars.addedManual', { name: star.name }));
    nameInput.value = '';
  };
  for (const el of [raInput, decInput, nameInput]) el.addEventListener('keydown', (e) => e.key === 'Enter' && addManual());

  // Vết sao
  const trailName = newId('trail');
  const trailRadios = (['none', 'short', 'long'] as TrailMode[]).map((m) => {
    const id = newId('tr');
    const input = h('input', { type: 'radio', name: trailName, id, value: m, onchange: () => actions.setTrails(m) });
    return { m, input, el: h('label', { class: 'radio', htmlFor: id }, input, h('span', { text: t(`panel.stars.trail_${m}`) })) };
  });

  const count = h('p', { class: 'hint' });

  const el = h(
    'section',
    { class: 'panel', id: 'panel-stars', 'aria-labelledby': 'h-stars' },
    h('h2', { id: 'h-stars', class: 'panel__title', text: t('panel.stars.title') }),
    guide('templates', fieldset(t('panel.stars.templates'), h('div', { class: 'row' }, tplSelect, addTpl), tplNote, figureChips)),
    guide(
      'addStars',
      fieldset(
        t('panel.stars.addStars'),
        h(
          'div',
          { class: 'row row--wrap' },
          button(t('panel.stars.random1'), () => (actions.addRandomStars(1) ? say(t('panel.stars.addedRandom', { n: 1 })) : say(t('panel.stars.tooMany', { n: MAX_USER_STARS }), 'err'))),
          button(t('panel.stars.random10'), () => (actions.addRandomStars(10) ? say(t('panel.stars.addedRandom', { n: 10 })) : say(t('panel.stars.tooMany', { n: MAX_USER_STARS }), 'err'))),
        ),
        h(
          'div',
          { class: 'manual' },
          h('label', { htmlFor: raId, text: t('panel.stars.ra') }),
          raInput,
          h('label', { htmlFor: decId, text: t('panel.stars.dec') }),
          decInput,
          h('label', { htmlFor: nameId, text: t('panel.stars.name') }),
          nameInput,
        ),
        h('p', { class: 'hint', text: t('panel.stars.manualHint') }),
        h('div', { class: 'row' }, button(t('panel.stars.addManual'), addManual, { cls: 'btn--primary' }), button(t('panel.stars.clear'), () => {
          actions.clearStars();
          say(t('panel.stars.cleared'));
        }, { cls: 'btn--danger' })),
        msg,
        count,
      ),
    ),
    guide('realSky', fieldset(t('panel.stars.realSky'), h('div', { class: 'checks' }, catalogCb.el, linesCb.el))),
    guide(
      'trails',
      fieldset(
        t('panel.stars.trails'),
        h('div', { class: 'radios', role: 'radiogroup', 'aria-label': t('panel.stars.trails') }, ...trailRadios.map((r) => r.el)),
        h('div', { class: 'row' }, button(t('panel.stars.resetTrails'), () => actions.resetTrails())),
      ),
    ),
  );

  const sync = () => {
    const s = store.state;
    for (const r of trailRadios) r.input.checked = s.trails === r.m;
    catalogCb.input.checked = s.toggles.catalog;
    linesCb.input.checked = s.toggles.constellationLines;
    count.textContent = t('panel.stars.count', { n: s.stars.length, max: MAX_USER_STARS });
    clear(figureChips);
    for (const f of s.figures) {
      figureChips.append(
        h(
          'span',
          { class: 'figure-chip', style: { borderColor: f.color } },
          h('span', { class: 'swatch', style: { background: f.color }, 'aria-hidden': 'true' }),
          f.name,
          h('button', {
            type: 'button',
            class: 'figure-chip__x',
            'aria-label': t('panel.stars.removeFigure', { name: f.name }),
            title: t('panel.stars.removeFigure', { name: f.name }),
            text: '×',
            onclick: () => actions.removeFigure(f.id),
          }),
        ),
      );
    }
  };
  store.subscribe((s, prev) => {
    if (s.trails !== prev.trails || s.toggles !== prev.toggles || s.stars !== prev.stars || s.figures !== prev.figures) sync();
  });
  sync();
  return el;
}
