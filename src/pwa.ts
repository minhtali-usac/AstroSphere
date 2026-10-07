// PWA: cài AstroSphere như một ứng dụng và dùng offline.
//
// - Đăng ký service worker (dist/sw.js, sinh lúc build từ scripts/sw.template.js) — chỉ ở bản build, không ở dev.
// - Nút "Cài AstroSphere về máy" ở chân trang: chỉ hiện khi trình duyệt cho cài (sự kiện beforeinstallprompt của
//   Chrome/Edge/Android), hoặc trên iPhone/iPad (Safari không có lời mời cài: nút hiện hướng dẫn "Thêm vào MH chính").
//   Ẩn khi đang chạy trong cửa sổ ứng dụng đã cài.
// - Thông báo nhỏ phía trên (không chặn thao tác): "sẵn sàng dùng offline" sau lần cài service worker đầu tiên, và
//   "Đã có phiên bản mới · Tải lại" khi bản mới đã tải xong và đang chờ.

import { t } from './i18n';
import { h } from './ui/dom';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function initPwa(footer: HTMLElement): void {
  // ---- Thông báo
  const text = h('span', { class: 'pwa-toast__text' });
  const actions = h('span', { class: 'pwa-toast__actions' });
  const chip = h(
    'div',
    { class: 'pwa-toast__chip', hidden: true },
    text,
    actions,
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('pwa.dismiss'), title: t('pwa.dismiss'), text: '×', onclick: () => (chip.hidden = true) }),
  );
  // Vùng role="status" luôn có trong DOM để trình đọc màn hình đọc nội dung khi thẻ hiện ra.
  document.body.append(h('div', { class: 'pwa-toast', role: 'status' }, chip));
  let timer = 0;
  const toast = (msg: string, action?: HTMLElement, ms = 0) => {
    window.clearTimeout(timer);
    text.textContent = msg;
    actions.replaceChildren(...(action ? [action] : []));
    chip.hidden = false;
    if (ms) timer = window.setTimeout(() => (chip.hidden = true), ms);
  };

  // ---- Nút cài đặt
  let deferred: InstallPromptEvent | null = null;
  const row = h('p', { class: 'site-footer__install', hidden: true });
  row.append(
    h('button', {
      type: 'button',
      class: 'link-btn',
      text: t('pwa.install'),
      title: t('pwa.installTip'),
      'data-guide': 'install',
      onclick: async () => {
        if (deferred) {
          const ev = deferred;
          deferred = null;
          await ev.prompt();
          const { outcome } = await ev.userChoice;
          if (outcome === 'accepted') row.hidden = true;
        } else if (isIos()) toast(t('pwa.iosHow'), undefined, 15000);
      },
    }),
  );
  footer.append(row);
  if (isIos() && !isStandalone()) row.hidden = false;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    row.hidden = isStandalone();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    row.hidden = true;
    toast(t('pwa.installed'), undefined, 8000);
  });

  // ---- Service worker
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  // Chỉ tải lại khi người dùng đã bấm "Tải lại" (lần cài đầu tiên cũng đổi controller qua clients.claim).
  let wantReload = false;
  const offerUpdate = (worker: ServiceWorker) =>
    toast(
      t('pwa.update'),
      h('button', {
        type: 'button',
        class: 'btn btn--small btn--primary',
        text: t('pwa.reload'),
        'data-guide': 'pwaReload',
        onclick: () => {
          wantReload = true;
          worker.postMessage({ type: 'SKIP_WAITING' });
        },
      }),
    );
  window.addEventListener('load', () => {
    sw.register('./sw.js')
      .then((reg) => {
        if (reg.waiting && sw.controller) offerUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state !== 'installed') return;
            if (sw.controller) offerUpdate(worker);
            else toast(t('pwa.ready'), undefined, 7000);
          });
        });
      })
      .catch(() => {
        /* không đăng ký được (trình duyệt chặn, chế độ riêng tư…): trang vẫn chạy bình thường khi có mạng */
      });
  });
  sw.addEventListener('controllerchange', () => {
    if (!wantReload) return;
    wantReload = false;
    window.location.reload();
  });
}
