// Dải điều khiển gọn của chế độ Cơ bản (redesign-2 R2).
//
// Ba nhóm theo đúng thứ tự khái niệm: (1) bạn đứng ở đâu → (2) bầu trời quay → (3) hiện thêm gì trên bầu trời.
// Mọi điều khiển gọi CÙNG các Actions như giao diện Đầy đủ, nên đổi chế độ không làm lệch trạng thái.

import { fmtLat } from '../astro';
import { t } from '../i18n';
import { atPlace, goToPlace, QUICK_PLACES, zones } from '../scenario';
import { COLORS } from '../scene/colors';
import type { Actions, AppState, Store } from '../state';
import { checkbox, guide, h, setText } from './dom';
import { HINT_KEY, hintSeen } from './firstHint';
import { writeJson } from './storage';

/** Hai mức tốc độ cho người mới (giây cho một ngày thiên văn). */
export const SIMPLE_RATES = { slow: 60, fast: 15 } as const;
export type SimpleSpeed = keyof typeof SIMPLE_RATES;
/** Mức nào đang gần với tốc độ hiện tại nhất (tốc độ chỉnh trong Đầy đủ vẫn hiện đúng một lựa chọn). */
export const speedOf = (rate: number): SimpleSpeed => (rate >= (SIMPLE_RATES.slow + SIMPLE_RATES.fast) / 2 ? 'slow' : 'fast');

const ZONE_KEYS = ['zoneCircumpolar', 'zoneRiseSet', 'zoneNeverRise'] as const;

/** Hai lựa chọn có trỏ tới cùng một thiên thể không (so theo giá trị, không theo tham chiếu). */
export function sameSelection(a: AppState['selected'], b: AppState['selected']): boolean {
  if (!a || !b || a.kind !== b.kind) return a === b;
  if (a.kind === 'user' && b.kind === 'user') return a.id === b.id;
  if ((a.kind === 'catalog' || a.kind === 'dso') && (b.kind === 'catalog' || b.kind === 'dso')) return a.index === b.index;
  return true; // { kind: 'sun' }
}

/**
 * `el`: dải điều khiển. `dock`: chỗ trống dưới nhóm 3, nơi main.ts đặt thẻ thông tin trên màn hình rộng (review-1 #1:
 * thẻ không còn nổi đè lên nút công cụ của khung nhìn).
 */
export function simpleControls(store: Store, actions: Actions): { el: HTMLElement; dock: HTMLElement } {
  const ctx = { store, actions };

  // ------------------------------------------------ 0. Lời mời hành động đầu tiên (review-1 #4)
  // Cỡ chữ thân, màu chữ chính, ở đầu dải: "bấm vào một ngôi sao". Lời chào của Usui-chan THAY THẾ lời mời này
  // (CSS ẩn nó khi body.guide-hello-open), không che nó. Ẩn hẳn sau lần đầu người dùng chọn một ngôi sao; lần sau
  // vào trang không hiện nếu người dùng đã từng kéo hoặc bấm vào khung nhìn (cùng khóa với dòng gợi ý, firstHint.ts).
  const cue = h('p', { class: 'simple__cue', id: 'simple-cue', text: t('simple.cue'), hidden: hintSeen() });
  const startSel = store.state.selected;

  // ------------------------------------------------ 1. Bạn đứng ở đâu?
  const chips = QUICK_PLACES.map((p) => ({
    p,
    el: h('button', {
      type: 'button',
      class: 'btn chip',
      'aria-pressed': 'false',
      text: t(`simple.place.${p.key}`),
      onclick: () => goToPlace(ctx, p),
    }),
  }));
  const latOut = h('output', { class: 'simple__value', htmlFor: 'simple-lat', 'aria-live': 'off' });
  const latSlider = h('input', {
    type: 'range',
    id: 'simple-lat',
    class: 'range',
    min: -90,
    max: 90,
    step: 0.5,
    oninput: (e: Event) => actions.setLocation(Number((e.target as HTMLInputElement).value), store.state.lon),
  });
  const where = h(
    'fieldset',
    { class: 'simple__group' },
    h('legend', { text: t('simple.whereTitle') }),
    h('div', { class: 'chips', role: 'group', 'aria-label': t('simple.placesAria'), 'data-guide': 'simplePlaces' }, ...chips.map((c) => c.el)),
    h(
      'div',
      { class: 'simple__slider', 'data-guide': 'simpleLat' },
      h('label', { htmlFor: 'simple-lat', text: t('simple.lat') }),
      latOut,
      latSlider,
    ),
  );

  // ------------------------------------------------ 2. Bầu trời quay
  const playBtn = h('button', { type: 'button', class: 'btn simple__play', 'aria-pressed': 'false', 'data-guide': 'simplePlay', onclick: () => actions.togglePlay() });
  const speedInputs = new Map<SimpleSpeed, HTMLInputElement>();
  const speedOpt = (k: SimpleSpeed) => {
    const input = h('input', {
      type: 'radio',
      name: 'simple-speed',
      value: k,
      onchange: () => actions.setRate(SIMPLE_RATES[k]),
    });
    speedInputs.set(k, input);
    return h('label', { class: 'radio simple__seg', title: t(`simple.${k}Tip`) }, input, h('span', { text: t(`simple.${k}`) }));
  };
  const time = h(
    'fieldset',
    { class: 'simple__group' },
    h('legend', { text: t('simple.timeTitle') }),
    h(
      'div',
      { class: 'simple__row' },
      playBtn,
      h('div', { class: 'simple__speed', role: 'radiogroup', 'aria-label': t('simple.speedAria'), 'data-guide': 'simpleSpeed' }, speedOpt('slow'), speedOpt('fast')),
    ),
  );

  // ------------------------------------------------ 3. Hiện trên bầu trời (ba lớp quan trọng nhất cho người mới)
  const axis = checkbox(t('simple.axis'), store.state.toggles.poleAxis, (v) => actions.setToggle('poleAxis', v), {
    tip: t('toggleTip.poleAxis'),
    swatch: COLORS.axis,
  });
  const equator = checkbox(t('simple.equator'), store.state.toggles.equator, (v) => actions.setToggle('equator', v), {
    tip: t('toggleTip.equator'),
    swatch: COLORS.equator,
  });
  const zoneBox = checkbox(t('simple.zones'), false, (v) => zones(ctx, v), { tip: t('simple.zonesTip') });
  // Ô mẫu ba màu cho ba vùng (tím · xanh ngọc · đỏ), cùng màu với cảnh 3D.
  const zoneSwatch = h(
    'span',
    { class: 'simple__zones', 'aria-hidden': 'true' },
    ...[COLORS.circumpolar, COLORS.riseSet, COLORS.neverRise].map((c) => h('span', { class: 'swatch swatch--zone', style: { background: c } })),
  );
  zoneBox.input.after(zoneSwatch);
  const zoneKey = h(
    'ul',
    { class: 'simple__zonekey' },
    h('li', null, h('span', { class: 'swatch swatch--zone', style: { background: COLORS.circumpolar }, 'aria-hidden': 'true' }), t('visibility.circumpolar')),
    h('li', null, h('span', { class: 'swatch swatch--zone', style: { background: COLORS.riseSet }, 'aria-hidden': 'true' }), t('visibility.riseSet')),
    h('li', null, h('span', { class: 'swatch swatch--zone', style: { background: COLORS.neverRise }, 'aria-hidden': 'true' }), t('visibility.neverRise')),
  );
  const dock = h('div', { class: 'simple__dock' });
  const layers = h(
    'fieldset',
    { class: 'simple__group' },
    h('legend', { text: t('simple.layersTitle') }),
    h('div', { class: 'checks' }, guide('simpleAxis', axis.el), guide('simpleEquator', equator.el), guide('simpleZones', zoneBox.el)),
    zoneKey,
  );

  const el = h(
    'section',
    { class: 'simple', id: 'simple-controls', 'aria-labelledby': 'simple-title' },
    h('h2', { class: 'sr-only', id: 'simple-title', text: t('simple.title') }),
    cue,
    where,
    time,
    layers,
    dock,
    // Bước tiếp theo (ux: viết cho cả nhiệm vụ): nơi tìm phần còn lại. Lời mời "bấm vào một ngôi sao" đã ở đầu dải,
    // nên chân dải chỉ còn một dòng (một lời nhắc, không phải ba).
    h('div', { class: 'simple__next' }, h('p', { class: 'simple__more', text: t('simple.more') })),
  );

  // ------------------------------------------------ Đồng bộ từ store (chỉ ghi khi nguồn đổi)
  const syncPlace = (s: AppState) => {
    for (const c of chips) {
      const on = atPlace(s.lat, s.lon, c.p);
      if (c.el.getAttribute('aria-pressed') !== String(on)) c.el.setAttribute('aria-pressed', String(on));
    }
    const v = String(s.lat);
    if (latSlider.value !== v) latSlider.value = v;
    const text = fmtLat(s.lat);
    setText(latOut, text);
    latSlider.setAttribute('aria-valuetext', text);
  };
  const syncPlay = (playing: boolean) => {
    setText(playBtn, playing ? t('panel.animation.pause') : t('panel.animation.play'));
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.classList.toggle('btn--primary', !playing);
  };
  const syncRate = (rate: number) => {
    const k = speedOf(rate);
    for (const [key, input] of speedInputs) if (input.checked !== (key === k)) input.checked = key === k;
  };
  const syncLayers = (s: AppState) => {
    axis.set(s.toggles.poleAxis);
    equator.set(s.toggles.equator);
    const n = ZONE_KEYS.filter((k) => s.toggles[k]).length;
    zoneBox.set(n === ZONE_KEYS.length);
    zoneBox.input.indeterminate = n > 0 && n < ZONE_KEYS.length;
    zoneKey.hidden = n === 0;
  };
  store.subscribe((s, prev) => {
    if (s.lat !== prev.lat || s.lon !== prev.lon) syncPlace(s);
    if (s.playing !== prev.playing) syncPlay(s.playing);
    if (s.rate !== prev.rate) syncRate(s.rate);
    if (s.toggles !== prev.toggles) syncLayers(s);
    // Người dùng đã chọn một thiên thể khác lựa chọn mặc định: lời mời đã làm xong việc của nó.
    if (!cue.hidden && s.selected !== prev.selected && s.selected && !sameSelection(s.selected, startSel)) {
      cue.hidden = true;
      writeJson(HINT_KEY, true);
    }
  });
  syncPlace(store.state);
  syncPlay(store.state.playing);
  syncRate(store.state.rate);
  syncLayers(store.state);
  return { el, dock };
}
