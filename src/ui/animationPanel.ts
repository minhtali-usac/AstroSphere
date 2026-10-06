// Bảng 2: Hoạt ảnh (chạy/tạm dừng, chế độ, tốc độ, giờ thiên văn).

import { fmtHMS, fmtNum, SIDEREAL_DAY_SECONDS } from '../astro';
import { t } from '../i18n';
import { lstCont, lstOf, RATE_MAX, RATE_MIN, type Actions, type AnimMode, type Store } from '../state';
import { button, h, setText } from './dom';

export interface AnimationPanel {
  el: HTMLElement;
  /** Cập nhật LST, thanh trượt và tiến độ một ngày (gọi từ nhịp giao diện của vòng lặp). */
  tick(): void;
}

export function animationPanel(store: Store, actions: Actions): AnimationPanel {
  const playBtn = h('button', { type: 'button', class: 'btn btn--play', 'aria-pressed': 'false', 'data-guide': 'play', onclick: () => actions.togglePlay() });

  const mode = h(
    'select',
    { id: 'anim-mode', 'data-guide': 'animMode', onchange: (e: Event) => actions.setMode((e.target as HTMLSelectElement).value as AnimMode) },
    h('option', { value: 'continuous', text: t('panel.animation.modeContinuous') }),
    h('option', { value: 'oneDay', text: t('panel.animation.modeOneDay') }),
    h('option', { value: 'stepHour', text: t('panel.animation.modeStep') }),
  );

  const rateOut = h('output', { class: 'value', htmlFor: 'rate' });
  const rateNote = h('p', { class: 'hint' });
  const rate = h('input', {
    type: 'range',
    id: 'rate',
    class: 'range',
    min: RATE_MIN,
    max: RATE_MAX,
    step: 1,
    oninput: (e: Event) => actions.setRate(RATE_MAX + RATE_MIN - Number((e.target as HTMLInputElement).value)),
    'aria-label': t('panel.animation.speedAria'),
  });

  const lstOut = h('output', { class: 'value value--big', htmlFor: 'lst' });
  const lst = h('input', {
    type: 'range',
    id: 'lst',
    class: 'range range--lst',
    min: 0,
    max: 1440,
    step: 1,
    oninput: (e: Event) => {
      actions.pause();
      actions.setLst((Number((e.target as HTMLInputElement).value) / 60) * 15);
    },
    'aria-label': t('panel.animation.lstAria'),
  });
  const ticks = h('div', { class: 'ticks', 'aria-hidden': 'true' }, ...[0, 6, 12, 18, 24].map((x) => h('span', { text: `${x}h` })));
  const progress = h('p', { class: 'hint progress' });

  const el = h(
    'section',
    { class: 'panel', id: 'panel-animation', 'aria-labelledby': 'h-anim' },
    h('h2', { id: 'h-anim', class: 'panel__title', text: t('panel.animation.title') }),
    h('div', { class: 'row' }, playBtn, h('label', { class: 'sr-only', htmlFor: 'anim-mode', text: t('panel.animation.mode') }), mode),
    progress,
    h('div', { class: 'field', 'data-guide': 'lstSlider' }, h('div', { class: 'field__head' }, h('label', { htmlFor: 'lst', text: t('panel.animation.lst') }), lstOut), lst, ticks),
    h(
      'div',
      { class: 'row row--wrap', 'data-guide': 'stepHour' },
      button(t('panel.animation.stepBack'), () => actions.stepHours(-1), { title: t('panel.animation.stepBackTip') }),
      button(t('panel.animation.stepForward'), () => actions.stepHours(1), { title: t('panel.animation.stepForwardTip') }),
      button(t('panel.animation.now'), () => actions.setNow(), { title: t('panel.animation.nowTip') }),
    ),
    h('div', { class: 'field', 'data-guide': 'rate' }, h('div', { class: 'field__head' }, h('label', { htmlFor: 'rate', text: t('panel.animation.speed') }), rateOut), rate, h('div', { class: 'ticks', 'aria-hidden': 'true' }, h('span', { text: t('panel.animation.slow') }), h('span', { text: t('panel.animation.fast') }))),
    rateNote,
    h('p', { class: 'note', text: t('panel.animation.siderealNote') }),
  );

  // Các trường ít đổi: chỉ ghi khi nguồn của chúng thay đổi.
  const syncPlaying = (playing: boolean) => {
    setText(playBtn, playing ? t('panel.animation.pause') : t('panel.animation.play'));
    playBtn.setAttribute('aria-pressed', String(playing));
    // Đang chạy: "Tạm dừng" là nút phụ yên lặng, để đường đọc không dừng ở nút phát (review-1 B1–B3).
    // Đang dừng: "Bắt đầu" là hành động chính (cam).
    playBtn.classList.toggle('btn--primary', !playing);
  };
  const syncMode = (m: AnimMode) => {
    if (mode.value !== m) mode.value = m;
  };
  const syncRate = (r: number) => {
    const v = String(RATE_MAX + RATE_MIN - r);
    if (rate.value !== v) rate.value = v;
    setText(rateOut, t('panel.animation.speedValue', { s: r }));
    setText(rateNote, t('panel.animation.speedNote', { x: fmtNum(SIDEREAL_DAY_SECONDS / r, 0) }));
  };
  store.subscribe((s, prev) => {
    if (s.playing !== prev.playing) syncPlaying(s.playing);
    if (s.mode !== prev.mode) syncMode(s.mode);
    if (s.rate !== prev.rate) syncRate(s.rate);
  });
  syncPlaying(store.state.playing);
  syncMode(store.state.mode);
  syncRate(store.state.rate);

  // Các trường đổi liên tục khi chạy: cập nhật theo nhịp giao diện, bỏ qua khi bảng đang ẩn
  // (tab khác trên điện thoại, chế độ trình chiếu); lần gọi đầu tiên sau khi hiện lại sẽ ghi bù.
  let lstText = '';
  const tick = () => {
    if (el.offsetParent === null) return;
    const s = store.state;
    const l = lstOf(s);
    const text = fmtHMS(l);
    if (text !== lstText) {
      lstText = text;
      lstOut.textContent = text;
      lst.setAttribute('aria-valuetext', text);
    }
    if (document.activeElement !== lst || !s.playing) {
      const v = String(Math.round((l / 15) * 60) % 1440);
      if (lst.value !== v) lst.value = v;
    }
    if (s.mode === 'oneDay') {
      const done = Math.min(1, Math.max(0, (lstCont(s) - s.runStartLst) / 360));
      setText(progress, t('panel.animation.oneDayProgress', { p: fmtNum(done * 100, 0) }));
    } else setText(progress, '');
  };
  return { el, tick };
}
