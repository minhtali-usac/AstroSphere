// Thông báo nhỏ, không chặn thao tác, ở góc màn hình khi chất lượng hiển thị tự hạ (spec K10).

import { t } from '../i18n';
import type { QualityController, QualityLevel } from '../runtime/quality';
import { button, h, setText } from './dom';

export function mountQualityNotice(q: QualityController, root: HTMLElement): { el: HTMLElement; dispose(): void } {
  const text = h('span', { class: 'qnotice__text' });
  const chip = h(
    'div',
    { class: 'qnotice__chip', hidden: true, 'data-guide': 'quality' },
    text,
    button(t('quality.restore'), () => q.restore(), { cls: 'btn--small btn--primary' }),
    h('button', {
      type: 'button',
      class: 'icon-btn',
      'aria-label': t('quality.dismiss'),
      title: t('quality.dismiss'),
      text: '×',
      onclick: () => {
        dismissedAt = shownLevel;
        chip.hidden = true;
      },
    }),
  );
  // Vùng role="status" luôn có trong DOM để trình đọc màn hình đọc nội dung khi thẻ hiện ra.
  const el = h('div', { class: 'qnotice', role: 'status' }, chip);
  root.append(el);

  let shownLevel: QualityLevel = 0;
  let dismissedAt: QualityLevel = 0;
  const show = (level: QualityLevel) => {
    shownLevel = level;
    if (level === 0 || level <= dismissedAt) {
      chip.hidden = true;
      return;
    }
    setText(text, t(level === 1 ? 'quality.reduced1' : 'quality.reduced2'));
    chip.hidden = false;
  };
  const off = q.onChange((level, cause) => {
    if (cause === 'user') dismissedAt = 0;
    show(cause === 'user' ? 0 : level);
  });
  if (q.auto && q.level > 0) show(q.level);
  return {
    el,
    dispose: () => {
      off();
      el.remove();
    },
  };
}
