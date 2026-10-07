// Điểm khởi động: dựng bố cục, hai khung nhìn 3D, bốn bảng điều khiển và vòng lặp hoạt ảnh.

import './styles.css';
import logoUrl from './assets/usac-logo.png';
import { Animator } from './animator';
import { codexButton, isCodexOpen } from './codex/triggers';
import { createGuide } from './guide/boot';
import { t } from './i18n';
import { startFrameLoop, type FrameView } from './runtime/frameLoop';
import { initPwa } from './pwa';
import { createQuality } from './runtime/quality';
import { fmtDeg, fmtLat, poleAltitude } from './astro';
import { COLORS } from './scene/colors';
import type { CelestialSphereView } from './scene/celestialSphere';
import type { HorizonDiagramView } from './scene/horizonDiagram';
import { Actions, createInitialState, Store, type AppState, type Toggles } from './state';
import { animationPanel } from './ui/animationPanel';
import { displayPanel } from './ui/displayPanel';
import { button, clear, h, setText } from './ui/dom';
import { bindHintCaption } from './ui/firstHint';
import { focusLayout, FOCUS_MIN_WIDTH } from './ui/focusLayout';
import { pencilIcon } from './ui/icons';
import { dataBar, infoCard } from './ui/infoCard';
import { locationPanel } from './ui/locationPanel';
import { bindUiMode, initialUiMode, modeSwitch } from './ui/mode';
import { mountQualityNotice } from './ui/qualityNotice';
import { resetConfirm } from './ui/resetConfirm';
import { starPanel } from './ui/starPanel';
import { simpleControls } from './ui/simpleControls';
import { rovingTabs } from './ui/tabs';
import { attachViewInteraction } from './ui/viewInteraction';

// Tải cảnh 3D (three.js) song song với việc dựng giao diện.
const scenePromise = import('./scene/boot');

// Chế độ giao diện (Cơ bản / Đầy đủ) đọc trước khi dựng giao diện để trang không "nháy" giữa hai bố cục.
const store = new Store({ ...createInitialState(), uiMode: initialUiMode() });
const actions = new Actions(store);

// Cảnh mở đầu: bầu trời tự quay chậm — trừ khi người dùng yêu cầu giảm chuyển động (không tự chạy).
const reducedMotion = (): boolean => {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
};
if (reducedMotion()) actions.pause();
const app = document.getElementById('app')!;

// ---------------------------------------------------------------- Ngăn Ôn tập và hộp thoại (tải động khi dùng lần đầu)
type LearnDrawer = ReturnType<typeof import('./ui/learning').learningDrawer>;
type Dialogs = ReturnType<typeof import('./ui/dialogs').createDialogs>;

let learnDrawer: LearnDrawer | null = null;
let learnLoading: Promise<LearnDrawer> | null = null;
let learnOpener: HTMLElement | null = null;
function loadLearn(): Promise<LearnDrawer> {
  learnLoading ??= import('./ui/learning').then((m) => {
    learnDrawer = m.learningDrawer(store, actions, {
      returnFocus: () => (learnOpener?.isConnected ? learnOpener : learnBtn),
    });
    app.append(learnDrawer.el);
    return learnDrawer;
  });
  return learnLoading;
}
/** Mặt tiền an toàn: dùng được trước khi mô-đun được tải. */
const learn = {
  isOpen: () => !!learnDrawer && !learnDrawer.el.hidden,
  open(v: boolean) {
    if (!v && !learnDrawer) return;
    if (v && !learn.isOpen()) {
      // Mở bằng phím L khi không có gì được chọn tiêu điểm → trả tiêu điểm về nút "Ôn tập".
      const a = document.activeElement;
      learnOpener = a instanceof HTMLElement && a !== document.body ? a : null;
    }
    void loadLearn().then((d) => d.open(v));
  },
  toggle: () => learn.open(!learn.isOpen()),
};

let dialogsMod: Dialogs | null = null;
let dialogsLoading: Promise<Dialogs> | null = null;
function loadDialogs(): Promise<Dialogs> {
  dialogsLoading ??= import('./ui/dialogs').then((m) => (dialogsMod = m.createDialogs()));
  return dialogsLoading;
}
const dialogs = {
  help: () => void loadDialogs().then((d) => d.help()),
  about: () => void loadDialogs().then((d) => d.about()),
  catalog: () => void loadDialogs().then((d) => d.catalog()),
  isOpen: () => dialogsMod?.isOpen() ?? false,
};

// ---------------------------------------------------------------- Thanh trên cùng
// "Đặt lại" hỏi lại trước (quyết định 2026-10-05): hộp <dialog> gốc, "Hủy" là mặc định.
const confirmReset = resetConfirm(() => resetAll());
let sphere: CelestialSphereView | null = null;
let horizon: HorizonDiagramView | null = null;

const learnBtn = button(t('top.learn'), () => learn.toggle(), { cls: 'btn--top btn--top-main', icon: '✎', title: t('top.learnTip'), guide: 'learn' });
const presentBtn = button(t('top.present'), () => setPresent(!presenting), { cls: 'btn--top btn--top-present', icon: '⛶', title: t('top.presentTip'), guide: 'present' });
presentBtn.setAttribute('aria-pressed', 'false');
// Bút chì SVG thay cho ký tự ✎ (không có trong Arial): trên điện thoại nút chỉ còn biểu tượng (fix-3 #6).
learnBtn.querySelector('.btn__icon')?.replaceChildren(pencilIcon());
const topbar = h(
  'header',
  { class: 'topbar' },
  h(
    'div',
    { class: 'brand' },
    h('img', { class: 'brand__logo', src: logoUrl, alt: t('app.logoAlt'), width: 44, height: 44, decoding: 'async' }),
    h(
      'h1',
      { class: 'brand__text' },
      h('span', { class: 'brand__org', text: t('app.org') }),
      h('span', { class: 'brand__name', text: t('app.title') }),
      // Tên ngắn cho điện thoại (tên đầy đủ vẫn có cho trình đọc màn hình).
      h('span', { class: 'brand__short', 'aria-hidden': 'true', text: t('app.shortTitle') }),
    ),
  ),
  // Công tắc Cơ bản | Đầy đủ (redesign-2 R2).
  modeSwitch(store, actions),
  h(
    'nav',
    { class: 'topbar__actions', 'aria-label': t('top.navAria') },
    learnBtn,
    presentBtn,
    button(t('top.reset'), () => confirmReset.open(), { cls: 'btn--top btn--top-reset', icon: '↺', title: t('top.resetTip'), guide: 'reset' }),
    codexButton(store, actions), // Codex (redesign-2 C)
    button(t('top.help'), () => dialogs.help(), { cls: 'btn--top btn--top-aux', icon: '?', title: t('top.helpTip'), guide: 'help' }),
    button(t('top.about'), () => dialogs.about(), { cls: 'btn--top btn--top-aux', icon: 'i', title: t('top.aboutTip'), guide: 'about' }),
  ),
);

// ---------------------------------------------------------------- Hai khung nhìn
const sphereHost = h('div', { class: 'view__canvas', role: 'img', 'aria-label': t('view.sphereAria'), 'data-guide': 'sphereView' });
const horizonHost = h('div', { class: 'view__canvas', role: 'img', 'aria-label': t('view.horizonAria'), 'data-guide': 'horizonView' });
/**
 * Nút công cụ của khung nhìn (review-4 B4): nút biểu tượng 44 px NỔI ở góc trên phải của cảnh, không còn chiếm một
 * hàng riêng phía trên cảnh. Tên truy cập = aria-label (cũng là chữ hiện cạnh biểu tượng trên màn hình rộng), title
 * giải thích thêm. Nằm ngoài vùng role="img" của canvas để trình đọc màn hình vẫn thấy nút.
 */
function viewTool(icon: string, label: string, tip: string, onClick: () => void, opts: { guide: string }): HTMLButtonElement {
  return h(
    'button',
    { type: 'button', class: 'view-tool', 'aria-label': label, title: tip, 'data-guide': opts.guide, onclick: onClick },
    h('span', { class: 'view-tool__icon', 'aria-hidden': 'true', text: icon }),
    h('span', { class: 'view-tool__text', 'aria-hidden': 'true', text: label }),
  ) as HTMLButtonElement;
}

const fpBtn = viewTool('👁', t('view.firstPerson'), t('view.firstPersonTip'), () => {
  if (!horizon) return;
  const on = !horizon.isFirstPerson();
  horizon.setFirstPerson(on);
  // Nút bật/tắt: tên giữ nguyên, trạng thái nằm ở aria-pressed (và viền cam khi đang bật).
  fpBtn.setAttribute('aria-pressed', String(on));
  fpBtn.title = on ? t('view.outside') : t('view.firstPersonTip');
}, { guide: 'firstPerson' });
fpBtn.setAttribute('aria-pressed', 'false');

function viewBox(id: string, title: string, sub: string, host: HTMLElement, tools: HTMLElement[], foot: HTMLElement | null = null) {
  return h(
    'article',
    { class: 'view', id, 'aria-labelledby': `${id}-title` },
    h('header', { class: 'view__head' }, h('div', null, h('h2', { id: `${id}-title`, text: title }), h('p', { class: 'view__sub', text: sub }))),
    h('div', { class: 'view__stage' }, host, h('div', { class: 'view__tools', role: 'group', 'aria-label': title }, ...tools)),
    foot,
  );
}

// Chân khung giản đồ chân trời: điều cốt lõi (φ = độ cao thiên cực) và MỘT dòng gợi ý thao tác, nằm DƯỚI cảnh
// (không che cảnh, review-1 D2). Trong chế độ trình chiếu dòng cốt lõi to lên, dòng gợi ý ẩn đi.
const keyLine = h('p', { class: 'view__key', 'aria-live': 'off' });
const hintLine = h('p', { class: 'view__hint', text: t('view.hint') });
const horizonFoot = h('footer', { class: 'view__foot' }, keyLine, hintLine);
let keyText = '';
function updateKeyLine(s: AppState) {
  const text = t('view.keyline', {
    lat: fmtLat(s.lat),
    pole: t(s.lat >= 0 ? 'panel.location.north' : 'panel.location.south'),
    alt: fmtDeg(poleAltitude(s.lat)),
  });
  if (text !== keyText) {
    keyText = text;
    setText(keyLine, text);
  }
}

const sphereBox = viewBox('view-sphere', t('view.sphere'), t('view.sphereSub'), sphereHost, [
  viewTool('⟲', t('view.resetCamera'), t('view.resetCameraTip'), () => sphere?.resetCamera(), { guide: 'resetCamera' }),
]);
const horizonBox = viewBox(
  'view-horizon',
  t('view.horizon'),
  t('view.horizonSub'),
  horizonHost,
  [fpBtn, viewTool('⟲', t('view.resetCamera'), t('view.resetCameraTip'), () => horizon?.resetCamera(), { guide: 'resetCamera' })],
  horizonFoot,
);

// Dòng gợi ý nổi hơn cho tới lần kéo/bấm đầu tiên vào một khung nhìn.
bindHintCaption(hintLine, [horizonHost, sphereHost]);

// Usui-chan (redesign-2 R4): chân dung ở góc; lời chào lần đầu và chế độ giải thích tải lười (src/guide/guide.ts).
const guideUi = createGuide({ skies: [horizonHost, sphereHost] });

const card = infoCard(store, actions);
const legend = h('div', { class: 'legend', 'aria-label': t('legend.aria') });
// Thứ tự đọc = thứ tự khái niệm: giản đồ chân trời (điều bạn thấy) trước, thiên cầu (vì sao như vậy) sau.
const views = h('section', { class: 'views', 'data-active': 'horizon' }, horizonBox, sphereBox, card.el, guideUi.el);

// Điện thoại: thẻ thông tin nổi ở đáy khung nhìn phải nằm trên chân khung (dòng cốt lõi + gợi ý); lời chào dạng
// dải mảnh của Usui-chan nằm trên thẻ (--card-h), không che dòng φ hay thẻ đang chọn (review-1 #3).
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => views.style.setProperty('--foot-h', `${horizonFoot.offsetHeight}px`)).observe(horizonFoot);
  new ResizeObserver(() => views.style.setProperty('--card-h', `${card.el.offsetHeight}px`)).observe(card.el);
}

const viewTab = (key: 'sphere' | 'horizon') =>
  h('button', {
    type: 'button',
    role: 'tab',
    class: 'tab',
    'aria-selected': String(key === 'horizon'),
    'aria-controls': `view-${key}`,
    'data-view': key,
    text: t(`view.${key}`),
    onclick: () => selectView(key),
  });
const tabEls = { sphere: viewTab('sphere'), horizon: viewTab('horizon') };
const viewTabs = h('div', { class: 'viewtabs', role: 'tablist', 'aria-label': t('view.tabsAria'), 'data-guide': 'viewTabs' }, tabEls.horizon, tabEls.sphere);
type ViewKey = 'sphere' | 'horizon';
const viewRoving = rovingTabs(viewTabs, (tab) => selectView(tab.dataset.view as ViewKey));
function selectView(key: ViewKey) {
  views.dataset.active = key;
  viewTabs.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b === tabEls[key])));
  viewRoving.sync();
  window.dispatchEvent(new Event('resize'));
}

// ---------------------------------------------------------------- Bảng số liệu và bảng điều khiển
const data = dataBar(store, actions);
const animation = animationPanel(store, actions);
const panelDefs = [
  { key: 'location', el: locationPanel(store, actions) },
  { key: 'animation', el: animation.el },
  { key: 'display', el: displayPanel(store, actions) },
  { key: 'stars', el: starPanel(store, actions) },
];
const panels = h('section', { class: 'panels', id: 'panels', 'data-active': 'location', 'aria-label': t('panel.aria') });
const panelTabs = h('div', { class: 'paneltabs', role: 'tablist', 'aria-label': t('panel.tabsAria'), 'data-guide': 'panelTabs' });
/**
 * Chọn bảng; trên điện thoại bấm lại vào thẻ đang mở thì thu gọn (chỉ khi bấm, không khi dùng phím mũi tên). Bố cục
 * tập trung đã có nút "Bảng điều khiển" để thu gọn, nên ở đó bấm lại thẻ không làm gì.
 */
function selectPanel(key: string, toggleCollapse: boolean) {
  const same = panels.dataset.active === key && !panels.classList.contains('collapsed');
  panels.dataset.active = key;
  panels.classList.toggle('collapsed', toggleCollapse && same && !focusActive());
  panelTabs.querySelectorAll<HTMLElement>('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.panel === key)));
  panelRoving.sync();
  loop.markUiDirty(); // bảng vừa hiện: ghi bù số liệu đã bỏ qua khi ẩn
}
for (const p of panelDefs) {
  panelTabs.append(
    h('button', {
      type: 'button',
      role: 'tab',
      class: 'tab',
      'aria-selected': String(p.key === 'location'),
      'aria-controls': p.el.id,
      'data-panel': p.key,
      text: t(`panel.${p.key}.short`),
      onclick: () => selectPanel(p.key, true),
    }),
  );
  p.el.dataset.panel = p.key;
}
const panelRoving = rovingTabs(panelTabs, (tab) => selectPanel(tab.dataset.panel!, false));
panels.append(panelTabs, ...panelDefs.map((p) => p.el));

// ---------------------------------------------------------------- Bố cục tập trung (Đầy đủ, màn hình ≥ 1101 px)
// Giản đồ chân trời chiếm phần lớn màn hình; dải số liệu thu gọn (vẫn có φ và độ cao thiên cực) và bảng điều khiển
// nằm sau hai nút bật/tắt (quyết định của chủ dự án 2026-10-05, docs/redesign-2/focus-layout.md).
const focusQuery = window.matchMedia?.(`(min-width: ${FOCUS_MIN_WIDTH}px)`);
/** Bố cục tập trung đang dùng: Đầy đủ, màn hình rộng, không trình chiếu. */
function focusActive(): boolean {
  return (focusQuery?.matches ?? false) && store.state.uiMode === 'full' && !presenting;
}
const focus = focusLayout({
  data: data.el,
  panels,
  onChange: () => loop.markUiDirty(), // vùng vừa hiện: ghi bù số liệu đã bỏ qua khi ẩn
});

window.addEventListener('open-catalog', () => dialogs.catalog());
// Chữ ký CLB và liên kết DUY NHẤT về Fanpage CLB (AGENTS.md › Brand).
const footer = h(
  'footer',
  { class: 'site-footer' },
  h('p', { class: 'site-footer__sig' }, h('strong', { text: t('app.signature') }), ` - ${t('app.slogan')}`),
  h('p', { class: 'site-footer__contact' }, `${t('app.contact')} `, h('a', { href: `mailto:${t('app.email')}`, text: t('app.email'), 'data-guide': 'email' })),
  h(
    'p',
    { class: 'site-footer__club' },
    `${t('app.fanpageLabel')} `,
    h('a', { href: t('app.fanpageUrl'), rel: 'noopener', target: '_blank', title: t('app.fanpageTip'), text: t('app.fanpageUrl'), 'data-guide': 'fanpage' }),
  ),
  h('p', { class: 'site-footer__links' }, h('button', { type: 'button', class: 'link-btn', text: t('app.catalogLink'), 'data-guide': 'catalog', onclick: () => dialogs.catalog() })),
);
// PWA: nút "Cài về máy" (dòng cuối chân trang, chỉ hiện khi cài được) và dùng offline (src/pwa.ts).
initPwa(footer);

// ---------------------------------------------------------------- Chế độ trình chiếu (spec K6, K8)
let presenting = false;
const PRESENT_LINE_SCALE = 2;
function setPresent(on: boolean) {
  if (on === presenting) return;
  presenting = on;
  if (on) guideUi.close(); // trình chiếu: Usui-chan ẩn (CSS) và chế độ giải thích tắt
  document.body.classList.toggle('present', on);
  // Máy chiếu: đường ×2, nhãn cảnh ×1,8 (CSS: body.present --lbl-k), đo lại nhãn để gỡ chồng chéo đúng cỡ.
  for (const v of [sphere, horizon]) v?.setPresentation(on, PRESENT_LINE_SCALE);
  presentBtn.setAttribute('aria-pressed', String(on));
  presentBtn.title = t(on ? 'top.exitPresent' : 'top.presentTip');
  const root = document.documentElement;
  try {
    if (on && !document.fullscreenElement && root.requestFullscreen) void root.requestFullscreen().catch(() => {});
    else if (!on && document.fullscreenElement && document.exitFullscreen) void document.exitFullscreen().catch(() => {});
  } catch {
    /* trình duyệt không cho toàn màn hình: vẫn giữ bố cục trình chiếu */
  }
  window.dispatchEvent(new Event('resize'));
}
// Người dùng thoát toàn màn hình bằng Esc (trình duyệt tự xử lý) → tắt luôn chế độ trình chiếu.
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && presenting) setPresent(false);
});
// Khung nhìn đổi kích thước (đổi bố cục điện thoại ↔ máy tính, trình chiếu): ghi bù số liệu.
window.addEventListener('resize', () => loop.markUiDirty());
// Dải điều khiển gọn của chế độ Cơ bản: CSS chỉ hiện nó khi body.mode-simple (redesign-2 R2).
const simple = simpleControls(store, actions);
app.append(topbar, h('main', { class: 'layout' }, viewTabs, views, simple.el, legend, focus.bar, panels), footer);
// Bố cục tập trung cao đúng phần màn hình dưới thanh trên cùng (thanh này dính ở đỉnh, cao khác nhau theo bề ngang).
if (typeof ResizeObserver !== 'undefined')
  new ResizeObserver(() => document.documentElement.style.setProperty('--focus-top', `${topbar.offsetHeight}px`)).observe(topbar);

// ---------------------------------------------------------------- Chú giải màu
const LEGEND: { key: keyof Toggles | 'horizon'; color: string; zone?: boolean }[] = [
  { key: 'equator', color: COLORS.equator },
  { key: 'poleAxis', color: COLORS.axis },
  { key: 'horizon', color: COLORS.horizon },
  { key: 'hourCircle0', color: COLORS.hourCircle },
  { key: 'meridian', color: COLORS.meridian },
  { key: 'verticalCircle', color: COLORS.vertical },
  { key: 'ecliptic', color: COLORS.ecliptic },
  { key: 'galactic', color: COLORS.galactic },
  { key: 'zoneCircumpolar', color: COLORS.circumpolar, zone: true },
  { key: 'zoneRiseSet', color: COLORS.riseSet, zone: true },
  { key: 'zoneNeverRise', color: COLORS.neverRise, zone: true },
];
let legendKey = '';
function updateLegend(s: AppState) {
  const items = LEGEND.filter((l) => l.key === 'horizon' || s.toggles[l.key as keyof Toggles]);
  const key = items.map((i) => i.key).join(',');
  if (key === legendKey) return;
  legendKey = key;
  clear(legend);
  legend.append(h('span', { class: 'legend__title', text: t('legend.title') }));
  for (const it of items) {
    legend.append(
      h(
        'span',
        { class: 'legend-item' },
        h('span', { class: it.zone ? 'swatch swatch--zone' : 'swatch swatch--line', style: { background: it.color }, 'aria-hidden': 'true' }),
        t(`legend.${it.key}`),
      ),
    );
  }
}

// ---------------------------------------------------------------- Khởi tạo 3D (tải động)
for (const host of [sphereHost, horizonHost]) host.append(h('p', { class: 'view__loading', text: t('view.loading') }));

/**
 * Lời chào lần đầu của Usui-chan: SAU khi bầu trời đã hiện (người mới thấy bầu trời trước, rồi mới được chào), và
 * trễ thêm một nhịp để hai thứ không xuất hiện cùng lúc. Không chào trong chế độ trình chiếu.
 */
function greet() {
  window.setTimeout(() => {
    if (!presenting) guideUi.hello();
  }, 700);
}

function showSceneError(key: 'view.webglError' | 'view.loadError') {
  for (const host of [sphereHost, horizonHost]) {
    clear(host);
    host.append(h('p', { class: 'webgl-error', text: t(key) }));
  }
}

scenePromise.then(
  (m) => {
    for (const host of [sphereHost, horizonHost]) clear(host);
    try {
      const v = m.bootScene(sphereHost, horizonHost, store);
      sphere = v.sphere;
      horizon = v.horizon;
      for (const view of [sphere, horizon]) attachViewInteraction(view, store, actions);
      // Nút công cụ nổi trên cảnh là vật cản cứng của bộ gỡ chồng chéo nhãn: "Thiên đỉnh" không nằm dưới nút
      // "Nhìn từ người quan sát" (fix-2 #1). Đo khi đổi kích thước, không đo mỗi khung hình.
      sphere.setOverlays([...sphereBox.querySelectorAll<HTMLElement>('.view-tool')]);
      horizon.setOverlays([...horizonBox.querySelectorAll<HTMLElement>('.view-tool')]);
      if (presenting) for (const view of [sphere, horizon]) view.setPresentation(true, PRESENT_LINE_SCALE);
      sphere.update(store.state);
      horizon.update(store.state);
      loop.markUiDirty();
      greet();
      return v;
    } catch (err) {
      console.error(err);
      showSceneError('view.webglError');
      greet();
      return null;
    }
  },
  (err) => {
    console.error(err);
    showSceneError('view.loadError');
    greet();
    return null;
  },
);

store.subscribe((s) => {
  sphere?.update(s);
  horizon?.update(s);
  loop.markUiDirty();
});
updateLegend(store.state);
updateKeyLine(store.state);

function resetAll() {
  actions.resetAll();
  card.reset();
  if (reducedMotion()) actions.pause();
  if (horizon?.isFirstPerson()) fpBtn.click();
  sphere?.resetCamera();
  horizon?.resetCamera();
}

// ---------------------------------------------------------------- Vòng lặp
const animator = new Animator(store, actions);
const quality = createQuality();
const loop = startFrameLoop({
  animator,
  getViews: (): readonly FrameView[] => (sphere && horizon ? [sphere, horizon] : []),
  onUiTick: () => {
    data.update();
    card.update();
    updateLegend(store.state);
    updateKeyLine(store.state);
    animation.tick();
  },
  isPlaying: () => store.state.playing,
  quality,
});
mountQualityNotice(quality, app);

// ---------------------------------------------------------------- Chế độ Cơ bản / Đầy đủ (redesign-2 R2)
// Cơ bản chỉ có giản đồ chân trời: tắt trình chiếu, đóng ngăn Ôn tập, chọn thẻ "Giản đồ chân trời" (để thiên cầu
// bị ẩn không vẽ), rồi đo lại khung nhìn và ghi bù số liệu cho các phần vừa hiện.
bindUiMode(store, (mode) => {
  if (mode === 'simple') {
    setPresent(false);
    learn.open(false);
    selectView('horizon');
  }
  window.dispatchEvent(new Event('resize'));
  loop.markUiDirty();
});
const isSimple = () => store.state.uiMode === 'simple';

/**
 * Cơ bản trên màn hình rộng (review-1 #1): thẻ thông tin vào chỗ trống dưới nhóm 3 của dải điều khiển, thay vì nổi
 * trên giản đồ và đè lên nút "Nhìn từ người quan sát / Góc nhìn mặc định". Cùng MỘT phần tử, chỉ đổi chỗ trong DOM
 * (không nhân đôi trạng thái). Đầy đủ và điện thoại: thẻ ở lại trong khung nhìn như trước.
 */
const wideQuery = window.matchMedia?.('(min-width: 901px)');
function placeCard() {
  const dock = isSimple() && (wideQuery?.matches ?? true);
  card.el.classList.toggle('infocard--docked', dock);
  if (dock && card.el.parentElement !== simple.dock) simple.dock.append(card.el);
  else if (!dock && card.el.parentElement !== views) views.insertBefore(card.el, guideUi.el);
}
placeCard();
store.subscribe((s, prev) => {
  if (s.uiMode !== prev.uiMode) placeCard();
});
wideQuery?.addEventListener?.('change', placeCard);

// Hook gỡ lỗi/đo hiệu năng — chỉ có ở chế độ phát triển.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__app = {
    store,
    actions,
    data,
    card,
    animator,
    loop,
    quality,
    get sphere() {
      return sphere;
    },
    get horizon() {
      return horizon;
    },
  };
}

// ---------------------------------------------------------------- Phím tắt
// Không chiếm phím của phần tử tương tác: Space trên nút/liên kết/summary…, mũi tên trong tablist/slider/radiogroup.
const SPACE_OWNERS = 'button,a,summary,label,[role=tab],input,select,textarea,[contenteditable]';
const ARROW_OWNERS = '[role=tablist],[role=slider],[role=radiogroup]';

window.addEventListener('keydown', (e) => {
  // Ưu tiên Esc: 1) hộp thoại gốc, kể cả Codex (trình duyệt tự đóng) → 2) lời chào / chế độ giải thích của
  // Usui-chan → 3) ngăn Ôn tập → 4) bỏ chọn.
  if (e.ctrlKey || e.metaKey || e.altKey || dialogs.isOpen() || isCodexOpen() || confirmReset.isOpen()) return;
  const target = e.target instanceof HTMLElement ? e.target : null;
  // Tính "đang gõ" TRƯỚC khi xử lý Esc: Esc trong ô nhập không được bỏ chọn hay đóng ngăn.
  const typing = !!target && (!!target.closest('input,select,textarea') || target.isContentEditable || target.getAttribute('role') === 'slider');
  if (typing) return;
  if (e.key === 'Escape') {
    if (guideUi.escape()) return;
    if (learn.isOpen()) learn.open(false);
    else actions.select(null);
    return;
  }
  const k = e.key.toLowerCase();
  if (e.key === ' ') {
    if (target?.closest(SPACE_OWNERS)) return;
    e.preventDefault();
    actions.togglePlay();
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    if (target?.closest(ARROW_OWNERS)) return;
    e.preventDefault();
    actions.stepHours(e.key === 'ArrowRight' ? 1 : -1);
  } else if (e.key === '+' || e.key === '=') actions.setRate(store.state.rate - 5);
  else if (e.key === '-' || e.key === '_') actions.setRate(store.state.rate + 5);
  else if (k === 'n') actions.setNow();
  else if (k === 'v') actions.resetTrails();
  else if (k === 'c') {
    sphere?.resetCamera();
    horizon?.resetCamera();
  } else if (k === 'h' || e.key === '?') dialogs.help();
  // Cơ bản không có Ôn tập và Trình chiếu: phím L và F không làm gì.
  else if (k === 'l' && !isSimple()) learn.toggle();
  else if (k === 'f' && !isSimple()) setPresent(!presenting);
});
