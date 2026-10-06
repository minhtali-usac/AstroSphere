// Usui-chan (redesign-2 R4) — phần tải ngay, giữ thật nhỏ: nút chân dung ở góc màn hình và cầu nối tới phần
// giao diện tải lười (src/guide/guide.ts: bong bóng lời chào, chế độ giải thích, ảnh toàn thân).
//
// Quyết định của chủ dự án (2026-10-05): chào MỘT lần ở lần đầu vào trang, sau đó chỉ nói khi được bấm.
// Không có vòng lặp, không theo dõi gì khi chế độ giải thích đang tắt.

import avatarUrl from '../assets/guide/usui-avatar.webp';
import { t } from '../i18n';
import { h } from '../ui/dom';
import { helloSeen, markHelloSeen } from './state';

type GuideUi = ReturnType<typeof import('./guide').createGuideUi>;

export interface Guide {
  /** Nút chân dung (main.ts đặt vào bố cục). */
  el: HTMLButtonElement;
  /** Lời chào lần đầu: không làm gì nếu đã chào ở lần mở trang trước. */
  hello(): void;
  /** Esc: đóng lời chào hoặc thoát chế độ giải thích. true = đã xử lý (main.ts dừng ở đây). */
  escape(): boolean;
  /** Tắt mọi thứ của Usui-chan (vào chế độ trình chiếu). */
  close(): void;
}

export function createGuide(opts: { skies: HTMLElement[] }): Guide {
  let ui: GuideUi | null = null;
  let loading: Promise<GuideUi> | null = null;
  const load = (): Promise<GuideUi> =>
    (loading ??= import('./guide').then((m) => (ui = m.createGuideUi({ avatar: el, skies: opts.skies }))));

  const el = h(
    'button',
    {
      type: 'button',
      class: 'guide-avatar',
      'aria-label': t('guide.avatarAria'),
      'aria-pressed': 'false',
      title: t('guide.avatarTip'),
      onclick: () => void load().then((u) => u.toggleExplain()),
    },
    h('img', { class: 'guide-avatar__img', src: avatarUrl, alt: '', width: 56, height: 56, decoding: 'async', draggable: 'false' }),
  );

  return {
    el,
    hello() {
      if (helloSeen()) return;
      markHelloSeen();
      void load().then((u) => u.showHello());
    },
    escape: () => ui?.escape() ?? false,
    close: () => ui?.closeAll(),
  };
}
