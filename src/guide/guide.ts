// Usui-chan (redesign-2 R4) — phần tải lười: lời chào lần đầu, chế độ giải thích và bong bóng lời giải thích.
//
// Chế độ giải thích (bật bằng nút chân dung hoặc nút "Giải thích các nút" của lời chào):
// - Chuột/bút: rê lên một điều khiển có `data-guide` → bong bóng neo cạnh nó. Bấm chuột vẫn dùng nút như thường.
// - Bàn phím: tiêu điểm vào điều khiển → bong bóng. Enter/Space vẫn kích hoạt như thường (click có detail = 0).
// - Cảm ứng: không có "rê", nên lần chạm ĐẦU vào một điều khiển chỉ hiện lời giải thích (chặn click ở pha capture);
//   chạm lần HAI vào cùng điều khiển, hoặc nút "Dùng nút này", mới kích hoạt nó. Khung nhìn 3D không bị chặn.
// - Thoát: Esc (main.ts gọi escape()), bấm lại chân dung, hoặc nút "Thoát" trên dải thông báo.
// Mọi trình nghe sự kiện chỉ gắn khi chế độ đang bật và được gỡ khi thoát; không có công việc theo khung hình.

import avatarUrl from '../assets/guide/usui-avatar.webp';
import poseUrl from '../assets/guide/usui-pose.webp';
import { openCodex } from '../codex/triggers';
import { t } from '../i18n';
import { h, setText } from '../ui/dom';
import { codexFor, PASSIVE, tipKey } from './tips';

/** Phần tử của chính Usui-chan: không bao giờ bị chặn hay giải thích. */
const OWN = '.guide-avatar, .guide-hello, .guide-banner, .guide-tip';
/** Phần tử nhận click thật bên trong một vùng `data-guide` (để "Dùng nút này" bấm đúng chỗ). */
const INTERACTIVE = 'button, a, input, select, textarea, label, summary, [role=tab], [tabindex]';

const media = (q: string): boolean => {
  try {
    return window.matchMedia?.(q).matches ?? false;
  } catch {
    return false;
  }
};
/** Điện thoại hẹp: bong bóng thành tấm đáy màn hình thay vì neo cạnh điều khiển. */
const isSheet = (): boolean => media('(max-width: 600px)');
/** Ảnh toàn thân chỉ khi màn hình đủ rộng và đủ cao để lời chào không che bầu trời. */
const wantsPose = (): boolean => media('(min-width: 901px) and (min-height: 860px)') && document.body.classList.contains('mode-simple');
/**
 * Lời chào dạng dải mảnh "chân dung · lời chào · ×" (review-1 #3, #7):
 * - điện thoại và máy tính bảng dọc: trong khung nhìn, ngay trên thẻ đang chọn — thay cho tấm đáy che 35 % màn hình
 *   và cắt dòng φ;
 * - Cơ bản trên màn hình rộng nhưng thấp (không đủ chỗ cho ảnh toàn thân): cạnh chân dung, thay cho bong bóng lớn
 *   từng che các ô của nhóm 3.
 */
const wantsToast = (): boolean => media('(max-width: 900px)') || (!wantsPose() && document.body.classList.contains('mode-simple'));

/** Lời chào đè lên thẻ đang chọn (hoặc chữ cuối của nhóm 3) trong dải điều khiển của chế độ Cơ bản. */
function coversDock(hello: HTMLElement): boolean {
  const r = hello.getBoundingClientRect();
  for (const el of document.querySelectorAll<HTMLElement>('.simple__dock, .simple fieldset, .simple__group')) {
    const d = el.getBoundingClientRect();
    if (d.width === 0 || d.height === 0) continue;
    if (r.left < d.right && d.left < r.right && r.top < d.bottom + 8 && d.top < r.bottom) return true;
  }
  return false;
}

const guideTarget = (node: EventTarget | null): HTMLElement | null =>
  node instanceof Element && !node.closest(OWN) ? node.closest<HTMLElement>('[data-guide]') : null;
const isOwn = (node: EventTarget | null): boolean => node instanceof Element && !!node.closest(OWN);

/** Chạy lại hoạt ảnh vào (CSS chỉ định nghĩa nó khi người dùng không yêu cầu giảm chuyển động). */
function playIn(el: HTMLElement): void {
  el.classList.remove('is-in');
  void el.offsetWidth;
  el.classList.add('is-in');
}

export function createGuideUi({ avatar, skies }: { avatar: HTMLButtonElement; skies: HTMLElement[] }) {
  // ------------------------------------------------------------ Lời chào lần đầu
  let hello: HTMLElement | null = null;
  const onSky = () => closeHello();

  /** Máy tính: bong bóng lời chào (ảnh toàn thân ở Cơ bản khi đủ cao; nằm ngang ở Đầy đủ). */
  function bubbleHello(pose: boolean): HTMLElement {
    // Đầy đủ trên màn hình rộng: cột phải là thiên cầu, nên lời chào nằm NGANG cạnh chân dung, trên dải số liệu,
    // thay vì dựng đứng che bầu trời.
    const wide = !pose && media('(min-width: 901px)') && document.body.classList.contains('mode-full');
    const face = pose
      ? h('img', { class: 'guide-hello__pose', src: poseUrl, alt: t('guide.poseAlt'), width: 596, height: 560, decoding: 'async' })
      : h('img', { class: 'guide-hello__face', src: avatarUrl, alt: '', width: 48, height: 48, decoding: 'async' });
    return h(
      'aside',
      { class: `guide-hello${pose ? ' guide-hello--pose' : ''}${wide ? ' guide-hello--wide' : ''}`, 'aria-labelledby': 'guide-hello-title' },
      h('div', { class: 'guide-hello__head' }, face, h('h2', { class: 'guide-hello__title', id: 'guide-hello-title', text: t('guide.helloTitle') })),
      h('p', { class: 'guide-hello__body', text: t('guide.helloBody') }),
      // Việc đầu tiên nên làm là bấm vào bầu trời, không phải vào Usui-chan (fix-2 #2): dòng mời đậm, chữ sáng; hai
      // nút bên dưới cùng là nút phụ (viền), không nút nào tô cam đặc để giành chỗ "số một" với bầu trời.
      h('p', { class: 'guide-hello__star', text: t('guide.helloStar') }),
      h(
        'div',
        { class: 'guide-hello__actions' },
        h('button', {
          type: 'button',
          class: 'btn guide-hello__explain',
          text: t('guide.helloExplain'),
          onclick: () => {
            closeHello();
            enterExplain();
          },
        }),
        h('button', { type: 'button', class: 'btn', text: t('guide.helloLater'), onclick: () => closeHello(true) }),
      ),
    );
  }

  /** Điện thoại: một dải mảnh. Bấm vào chân dung hoặc lời chào = bật chế độ giải thích (đúng điều lời chào nói). */
  function toastHello(): HTMLElement {
    return h(
      'aside',
      { class: 'guide-hello guide-hello--toast', 'aria-labelledby': 'guide-hello-title' },
      h(
        'button',
        {
          type: 'button',
          class: 'guide-hello__go',
          onclick: () => {
            closeHello();
            enterExplain();
          },
        },
        h('img', { class: 'guide-hello__face', src: avatarUrl, alt: '', width: 32, height: 32, decoding: 'async' }),
        h('span', { class: 'guide-hello__title', id: 'guide-hello-title', text: t('guide.helloShort') }),
      ),
      h('button', {
        type: 'button',
        class: 'icon-btn guide-hello__x',
        'aria-label': t('guide.helloClose'),
        title: t('guide.helloClose'),
        text: '×',
        onclick: () => closeHello(true),
      }),
    );
  }

  function showHello(): void {
    if (hello || explaining || document.body.classList.contains('present')) return;
    hello = wantsToast() ? toastHello() : bubbleHello(wantsPose());
    // Ngay sau nút chân dung trong thứ tự DOM: người dùng bàn phím Tab từ chân dung là tới lời chào.
    // Không chuyển tiêu điểm vào lời chào (không cướp tiêu điểm).
    avatar.after(hello);
    // Lớp này ẩn lời mời ở đầu dải (CSS) — thêm TRƯỚC khi đo để thẻ đang chọn ở đúng chỗ của nó.
    document.body.classList.add('guide-hello-open');
    // Ảnh toàn thân phải nằm DƯỚI thẻ đang chọn trong dải điều khiển, không che nó (fix-2 #9). Không đủ chỗ (màn hình
    // thấp, thẻ cao) → dùng dải lời chào mảnh ngay trên chân dung.
    if (hello.classList.contains('guide-hello--pose') && coversDock(hello)) {
      hello.remove();
      hello = toastHello();
      avatar.after(hello);
    }
    for (const s of skies) s.addEventListener('pointerdown', onSky);
    // Vũ đạo "kích hoạt → theo sau" (motion › choreography): chân dung gật nhẹ một lần, bong bóng theo sau 120 ms.
    avatar.classList.add('is-greeting');
    avatar.addEventListener('animationend', () => avatar.classList.remove('is-greeting'), { once: true });
    playIn(hello);
  }

  /** `refocus`: đóng bằng nút của chính lời chào → trả tiêu điểm về chân dung (không để tiêu điểm rơi về body). */
  function closeHello(refocus = false): void {
    if (!hello) return;
    const hadFocus = hello.contains(document.activeElement);
    hello.remove();
    hello = null;
    document.body.classList.remove('guide-hello-open');
    for (const s of skies) s.removeEventListener('pointerdown', onSky);
    if (refocus || hadFocus) avatar.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ Dải thông báo của chế độ giải thích
  const bannerClose = h(
    'button',
    { type: 'button', class: 'btn btn--small guide-banner__close', 'aria-label': t('guide.bannerClose'), title: t('guide.bannerClose'), onclick: () => exitExplain() },
    h('span', { 'aria-hidden': 'true', text: t('guide.bannerCloseText') }),
  );
  const banner = h('div', { class: 'guide-banner', role: 'status', hidden: true }, h('p', { class: 'guide-banner__text', text: t('guide.banner') }), bannerClose);
  avatar.after(banner);

  // ------------------------------------------------------------ Bong bóng lời giải thích
  const tipText = h('p', { class: 'guide-tip__text' });
  const codexBtn = h('button', {
    type: 'button',
    class: 'link-btn guide-tip__codex',
    text: t('guide.codexLink'),
    onclick: () => {
      const id = codexBtn.dataset.codex;
      hideTip();
      if (id) openCodex(id);
    },
  });
  const useBtn = h('button', { type: 'button', class: 'btn btn--primary btn--small guide-tip__use', text: t('guide.use'), onclick: () => useArmed() });
  const tipClose = h('button', { type: 'button', class: 'icon-btn guide-tip__close', 'aria-label': t('guide.tipClose'), title: t('guide.tipClose'), text: '×', onclick: () => hideTip() });
  const tip = h(
    'div',
    { class: 'guide-tip', role: 'status', 'aria-label': t('guide.tipAria'), hidden: true },
    h('img', { class: 'guide-tip__face', src: avatarUrl, alt: '', width: 40, height: 40, decoding: 'async' }),
    h('div', { class: 'guide-tip__main' }, tipText, h('div', { class: 'guide-tip__actions' }, useBtn, codexBtn)),
    tipClose,
  );
  document.body.append(tip);

  let current: HTMLElement | null = null; // điều khiển đang được giải thích
  let armed: HTMLElement | null = null; // cảm ứng: điều khiển đã được giải thích, chạm lần hai sẽ kích hoạt
  let armedTarget: HTMLElement | null = null; // phần tử thật đã bị chặn (để "Dùng nút này" bấm lại đúng nó)
  let hideTimer = 0;
  let placeQueued = false;

  function showTip(el: HTMLElement, touch: boolean): void {
    const key = el.dataset.guide ?? '';
    setText(tipText, t(tipKey(key)));
    const id = codexFor(key, el.dataset.codex);
    codexBtn.hidden = !id;
    if (id) codexBtn.dataset.codex = id;
    useBtn.hidden = !touch || PASSIVE.has(key);
    if (el !== armed) {
      armed = null;
      armedTarget = null;
    }
    const wasHidden = tip.hidden;
    tip.hidden = false;
    current?.removeAttribute('data-guide-on');
    current = el;
    el.setAttribute('data-guide-on', '');
    place();
    if (wasHidden) playIn(tip);
  }

  function hideTip(): void {
    clearTimeout(hideTimer);
    if (tip.contains(document.activeElement)) (current?.isConnected ? current : avatar).focus({ preventScroll: true });
    tip.hidden = true;
    current?.removeAttribute('data-guide-on');
    current = armed = armedTarget = null;
  }

  /**
   * Neo bong bóng cạnh điều khiển: ưu tiên phía dưới, rồi phía trên, cuối cùng là bên trong mép trên của vùng lớn
   * (khung nhìn 3D). Điện thoại hẹp: tấm đáy màn hình (CSS), không cần tính vị trí.
   */
  function place(): void {
    if (!current) return;
    const sheet = isSheet();
    tip.classList.toggle('guide-tip--sheet', sheet);
    if (sheet) {
      tip.style.left = tip.style.top = '';
      return;
    }
    const r = current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const bw = tip.offsetWidth;
    const bh = tip.offsetHeight;
    const gap = 10;
    const m = 8;
    let top: number;
    let side: 'below' | 'above' | 'inside';
    if (r.bottom + gap + bh <= vh - m) {
      top = r.bottom + gap;
      side = 'below';
    } else if (r.top - gap - bh >= m) {
      top = r.top - gap - bh;
      side = 'above';
    } else {
      top = Math.min(Math.max(r.top + m, m), vh - bh - m);
      side = 'inside';
    }
    const cx = r.left + r.width / 2;
    const left = Math.min(Math.max(cx - bw / 2, m), vw - bw - m);
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.dataset.side = side;
    tip.style.setProperty('--arrow-x', `${Math.round(Math.min(Math.max(cx - left, 18), bw - 18))}px`);
  }

  function queuePlace(): void {
    if (placeQueued || tip.hidden) return;
    placeQueued = true;
    requestAnimationFrame(() => {
      placeQueued = false;
      if (!current || !current.isConnected) return hideTip();
      const r = current.getBoundingClientRect();
      // Điều khiển đã cuộn ra khỏi màn hình: thôi giải thích (bong bóng không lơ lửng chỉ vào khoảng không).
      if (!isSheet() && (r.bottom < 0 || r.top > window.innerHeight || (r.width === 0 && r.height === 0))) return hideTip();
      place();
    });
  }

  /** "Dùng nút này": kích hoạt điều khiển đã bị chặn ở lần chạm đầu. */
  let bypass = false;
  function useArmed(): void {
    const el = armedTarget;
    if (!el || !el.isConnected) return;
    bypass = true;
    try {
      if (el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit'].includes(el.type))) {
        el.focus();
        if (el instanceof HTMLSelectElement) {
          try {
            el.showPicker?.();
          } catch {
            /* trình duyệt không cho mở danh sách bằng mã: tiêu điểm đã ở đó */
          }
        }
      } else el.click();
    } finally {
      bypass = false;
    }
  }

  // ------------------------------------------------------------ Trình nghe sự kiện (chỉ khi chế độ bật)
  let pointerType = '';
  const cancelHide = () => clearTimeout(hideTimer);
  const scheduleHide = () => {
    clearTimeout(hideTimer);
    // Chờ một chút: người dùng kịp đưa chuột từ điều khiển sang bong bóng (WCAG 1.4.13: nội dung "rê vào được").
    hideTimer = window.setTimeout(hideTip, 700);
  };

  const onPointerDown = (e: PointerEvent) => {
    pointerType = e.pointerType;
    if (e.pointerType !== 'touch') return;
    // Khung nhìn 3D: chạm vẫn kéo/chọn sao như thường, đồng thời hiện lời giải thích.
    const el = guideTarget(e.target);
    if (el && PASSIVE.has(el.dataset.guide ?? '') && el !== current) showTip(el, true);
  };
  const onPointerOver = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    if (isOwn(e.target)) {
      if (tip.contains(e.target as Node)) cancelHide();
      return;
    }
    const el = guideTarget(e.target);
    if (!el) return scheduleHide();
    cancelHide();
    if (el !== current) showTip(el, false);
  };
  const onFocusIn = (e: FocusEvent) => {
    if (isOwn(e.target)) return;
    const el = guideTarget(e.target);
    if (el && el !== current) showTip(el, pointerType === 'touch');
  };
  const onClick = (e: MouseEvent) => {
    const type = (e as PointerEvent).pointerType || pointerType;
    // Chỉ chặn chạm thật: chuột dùng nút như thường; Enter/Space (detail = 0) và "Dùng nút này" (bypass) đi qua.
    if (bypass || type !== 'touch' || e.detail === 0 || isOwn(e.target)) return;
    const el = guideTarget(e.target);
    if (!el || PASSIVE.has(el.dataset.guide ?? '')) return;
    if (el === armed) return; // chạm lần hai vào cùng điều khiển: để nó làm việc của nó
    e.preventDefault();
    e.stopImmediatePropagation();
    const target = e.target as Element;
    const real = (target.closest(INTERACTIVE) as HTMLElement | null) ?? (target as HTMLElement);
    showTip(el, true);
    armed = el;
    armedTarget = el.contains(real) ? real : el;
  };
  // Thanh trượt và ô chọn đổi giá trị ngay khi chạm (trước cả click): chặn ở touchstart cho hai loại này.
  const onTouchStart = (e: TouchEvent) => {
    const target = e.target;
    const slider = target instanceof HTMLInputElement && target.type === 'range';
    if (!slider && !(target instanceof HTMLSelectElement)) return;
    const el = guideTarget(target);
    if (!el || el === armed) return;
    e.preventDefault();
    showTip(el, true);
    armed = el;
    armedTarget = target as HTMLElement;
  };
  const onViewport = () => queuePlace();

  const capture = { capture: true } as const;
  const listen = (on: boolean) => {
    const f = on ? 'addEventListener' : 'removeEventListener';
    document[f]('pointerdown', onPointerDown as EventListener, capture);
    document[f]('pointerover', onPointerOver as EventListener, capture);
    document[f]('focusin', onFocusIn as EventListener, capture);
    document[f]('click', onClick as EventListener, capture);
    window[f]('scroll', onViewport, { capture: true, passive: true } as AddEventListenerOptions);
    window[f]('resize', onViewport);
    if (on) document.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
    else document.removeEventListener('touchstart', onTouchStart, capture);
  };

  // ------------------------------------------------------------ Bật / tắt
  let explaining = false;

  function enterExplain(): void {
    if (explaining) return;
    closeHello();
    explaining = true;
    document.body.classList.add('guide-explain');
    avatar.setAttribute('aria-pressed', 'true');
    banner.hidden = false;
    playIn(banner);
    listen(true);
  }

  function exitExplain(): void {
    if (!explaining) return;
    explaining = false;
    const focusInside = banner.contains(document.activeElement) || tip.contains(document.activeElement);
    listen(false);
    hideTip();
    banner.hidden = true;
    document.body.classList.remove('guide-explain');
    avatar.setAttribute('aria-pressed', 'false');
    if (focusInside) avatar.focus({ preventScroll: true });
  }

  return {
    showHello,
    toggleExplain: () => (explaining ? exitExplain() : enterExplain()),
    isExplaining: () => explaining,
    /** Esc: lời chào trước, rồi chế độ giải thích. */
    escape(): boolean {
      if (hello) {
        closeHello();
        return true;
      }
      if (explaining) {
        exitExplain();
        return true;
      }
      return false;
    },
    closeAll(): void {
      closeHello();
      exitExplain();
    },
  };
}
