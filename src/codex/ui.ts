// USACodex (redesign-2 C, game feel 2026-10-05) — phần tải lười.
//
// Bố cục: trái là các ô danh mục (biểu tượng, tên, "x/y" và thanh tiến độ nhỏ) dưới thanh tiến độ chung; phải là
// lưới thẻ của danh mục đang chọn (ảnh nhỏ, tên, trạng thái) HOẶC trang đọc hai cột của một mục, có nút "← danh mục"
// để quay lại lưới. Điện thoại: ô danh mục thành dải cuộn ngang, thẻ hai cột, trang đọc thay chỗ cả hai.
//
// Phần thưởng chỉ xảy ra bên trong USACodex: lần đầu mở một mục "mới", trang đọc chơi một nhịp "mở khóa" ngắn (ổ khóa
// mở rồi mờ đi → hình đầu trang hiện rõ → dòng "Đã mở khóa"). Chữ hiện ngay, không chờ hoạt ảnh. Nhịp này dựa vào
// chuyển trạng thái mới → đã đọc nên chỉ chơi một lần cho mỗi mục.
//
// <dialog> gốc: bẫy tiêu điểm, Esc đóng trước mọi thứ khác, tiêu điểm trở về nút đã mở khi đóng.

import content from '../i18n/codex.vi.json';
import { t } from '../i18n';
import { h } from '../ui/dom';
import { renderLines, renderMath } from '../ui/dialogs';
import { sunEquatorial } from '../selection';
import type { DiagramEnv, DiagramLabels } from './diagrams';
import { categoryGlyph, stateGlyph, unlockGlyph, type EntryState } from './glyphs';
import { SIM } from './sim';
import { isDiscovered, isNew, markRead, onCodexChange, type CodexContext } from './triggers';
import { entryFacts, entryVisual, formulaLines } from './visual';

export interface CodexEntry {
  title: string;
  aka?: string;
  lede: string;
  body: string[];
  related: string[];
  sim?: string;
  figure?: string;
}

/** Trạng thái hiển thị: chưa khám phá (ổ khóa) · mới (chấm đặc + "mới") · đã đọc (dấu tích). */
export function entryState(id: string): EntryState {
  return !isDiscovered(id) ? 'locked' : isNew(id) ? 'new' : 'read';
}

const STATE_TEXT = (s: EntryState): string =>
  s === 'locked' ? t('codexUi.stateLocked') : s === 'new' ? t('codexUi.stateNew') : content.ui.stateRead;

export interface CodexCategory {
  id: string;
  title: string;
  blurb: string;
  entries: string[];
}

export const CATEGORIES = content.categories as CodexCategory[];
export const ENTRIES = content.entries as Record<string, CodexEntry>;
const ORDER = CATEGORIES.flatMap((c) => c.entries);
const CATEGORY_OF = new Map<string, CodexCategory>();
for (const c of CATEGORIES) for (const id of c.entries) CATEGORY_OF.set(id, c);

/** Thời lượng nhịp "mở khóa" (ms): khớp với tổng thời gian các hoạt ảnh .is-unlocking trong styles.css. */
const UNLOCK_MS = 900;

interface Tile {
  btn: HTMLButtonElement;
  count: HTMLElement;
  sr: HTMLElement;
}

interface Card {
  btn: HTMLButtonElement;
  thumb: HTMLElement;
  state: HTMLElement;
  mark: HTMLElement;
}

interface Ui {
  dlg: HTMLDialogElement;
  title: HTMLElement;
  tiles: Map<string, Tile>;
  cards: Map<string, Card>;
  progress: HTMLElement;
  bar: HTMLElement;
  catCount: HTMLElement;
  page: HTMLElement;
  cat: string;
  showEntry: (id: string) => void;
  showCategory: (cat: string, focusId?: string) => void;
}

let ui: Ui | null = null;

function labels(): DiagramLabels {
  return {
    ...content.diagram,
    north: t('scene.dirN'),
    east: t('scene.dirE'),
    south: t('scene.dirS'),
    west: t('scene.dirW'),
  };
}

const envOf = (ctx: CodexContext): DiagramEnv => {
  const s = ctx.store.state;
  return { lat: s.lat, sun: sunEquatorial(s), sunDate: s.sunDate };
};

/** Chỉ ghi khi khác (đồng bộ chạy sau mỗi lần khám phá / đọc). */
const setText = (el: HTMLElement, s: string) => {
  if (el.textContent !== s) el.textContent = s;
};

/**
 * Thanh tiến độ chỉ được ghi khi hộp đang mở (fix-3 #7): khám phá xảy ra trong mô phỏng lúc hộp đóng, nên thanh vẫn
 * giữ giá trị lần xem trước; lần mở sau thanh trượt từ đó tới giá trị mới (chuyển tiếp ~400 ms trong styles.css,
 * không có khi giảm chuyển động) — người dùng thấy bộ sưu tập vừa đầy thêm.
 */
function syncMarkers(u: Ui): void {
  const bars = u.dlg.open;
  for (const [id, c] of u.cards) {
    const state = entryState(id);
    if (c.btn.dataset.state === state) continue;
    c.btn.dataset.state = state;
    c.mark.innerHTML = stateGlyph(state);
    c.state.textContent = STATE_TEXT(state);
  }
  for (const rel of u.page.querySelectorAll<HTMLElement>('.cdx-rel[data-entry]')) {
    const state = entryState(rel.dataset.entry!);
    rel.dataset.state = state;
    rel.classList.toggle('is-locked', state === 'locked');
  }
  for (const c of CATEGORIES) {
    const n = c.entries.filter(isDiscovered).length;
    const fresh = c.entries.some(isNew);
    const tile = u.tiles.get(c.id)!;
    setText(tile.count, `${n}/${c.entries.length}`);
    setText(tile.sr, `, ${t('codexUi.catCountSr', { n, total: c.entries.length })}${fresh ? `, ${t('codexUi.tileNew')}` : ''}`);
    if (bars) tile.btn.style.setProperty('--p', String(n / c.entries.length));
    tile.btn.toggleAttribute('data-new', fresh);
    if (c.id === u.cat) setText(u.catCount, t('codexUi.progress', { n, total: c.entries.length }));
  }
  const n = ORDER.filter(isDiscovered).length;
  setText(u.title, t('codexUi.title', { n, total: ORDER.length }));
  setText(u.progress, t('codexUi.progress', { n, total: ORDER.length }));
  if (bars) u.bar.style.setProperty('--p', String(n / ORDER.length));
}

const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

/** Phím mũi tên trong một danh sách nút (lưới thẻ hoặc ô danh mục): chuyển tiêu điểm, Home/End về hai đầu. */
function arrowNav(list: HTMLElement, sel: string): void {
  list.addEventListener('keydown', (e) => {
    if (!NAV_KEYS.has(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
    const btns = [...list.querySelectorAll<HTMLButtonElement>(sel)];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    // Số cột = số nút cùng hàng với nút đầu: lưới thẻ có 2–6 cột, cột ô danh mục có 1, dải ngang trên điện thoại có n.
    const top = btns[0].offsetTop;
    const cols = Math.max(1, btns.filter((b) => b.offsetTop === top).length);
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' ? -cols : e.key === 'ArrowDown' ? cols : 0;
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? btns.length - 1 : Math.min(btns.length - 1, Math.max(0, i + step));
    e.preventDefault();
    btns[j].focus();
  });
}

/** Đổi id trong SVG ảnh nhỏ (vd. dải màu B − V) để không trùng với hình lớn trên trang đọc. */
const thumbSvg = (svg: string) => svg.replace(/id="([\w-]+)"/g, 'id="$1-t"').replace(/url\(#([\w-]+)\)/g, 'url(#$1-t)');

function build(ctx: CodexContext): Ui {
  const tiles = new Map<string, Tile>();
  const cards = new Map<string, Card>();
  const lists = new Map<string, HTMLElement>();
  const progress = h('p', { class: 'cdx-progress__text', id: 'codex-progress' });
  const bar = h('div', { class: 'cdx-progress__bar', 'aria-hidden': 'true' });
  const page = h('article', { class: 'cdx-page', 'aria-live': 'off' });
  let thumbsEnv = '';
  let unlockTimer = 0;

  // ---- Ô danh mục
  const tileList = h(
    'ul',
    { class: 'cdx-tiles', role: 'list' },
    ...CATEGORIES.map((c) => {
      const count = h('span', { class: 'cdx-tile__count', 'aria-hidden': 'true' });
      const sr = h('span', { class: 'sr-only' });
      const icon = h('span', { class: 'cdx-tile__icon', 'aria-hidden': 'true' });
      icon.innerHTML = categoryGlyph(c.id);
      const btn = h(
        'button',
        { type: 'button', class: 'cdx-tile', 'data-cat': c.id, onclick: () => showCategory(c.id) },
        icon,
        h('span', { class: 'cdx-tile__name', text: c.title }),
        count,
        sr,
        h('span', { class: 'cdx-tile__bar', 'aria-hidden': 'true' }),
      );
      tiles.set(c.id, { btn, count, sr });
      return h('li', null, btn);
    }),
  );
  arrowNav(tileList, '.cdx-tile');

  const nav = h('nav', { class: 'cdx-nav', 'aria-label': t('codexUi.navAria') }, h('div', { class: 'cdx-progress' }, progress, bar), tileList);

  // ---- Lưới thẻ (một danh sách cho mỗi danh mục; chỉ danh sách đang chọn hiện ra)
  const catTitle = h('h3', { class: 'cdx-catview__title', id: 'cdx-catview-title' });
  const catBlurb = h('p', { class: 'cdx-catview__blurb' });
  const catCount = h('p', { class: 'cdx-catview__count' });
  const grids = CATEGORIES.map((c) => {
    const list = h(
      'ul',
      { class: 'cdx-grid', role: 'list', 'data-cat': c.id, hidden: true },
      ...c.entries.map((id) => {
        const thumb = h('span', { class: 'cdx-card__thumb', 'aria-hidden': 'true' });
        const mark = h('span', { class: 'cdx-card__mark', 'aria-hidden': 'true' });
        const state = h('span', { class: 'cdx-card__state' });
        const btn = h(
          'button',
          { type: 'button', class: 'cdx-card', 'data-entry': id, onclick: () => showEntry(id) },
          thumb,
          h('span', { class: 'cdx-card__name', text: ENTRIES[id].title }),
          h('span', { class: 'cdx-card__meta' }, mark, state),
        );
        cards.set(id, { btn, thumb, state, mark });
        return h('li', null, btn);
      }),
    );
    arrowNav(list, '.cdx-card');
    lists.set(c.id, list);
    return list;
  });
  const catview = h(
    'section',
    { class: 'cdx-catview', 'aria-labelledby': 'cdx-catview-title' },
    h('header', { class: 'cdx-catview__head' }, catTitle, catBlurb, catCount),
    ...grids,
  );

  const titleEl = h('h2', { id: 'codex-title' });
  const closeBtn = h('button', {
    type: 'button',
    class: 'icon-btn',
    'aria-label': t('codexUi.close'),
    title: t('codexUi.close'),
    text: '×',
    onclick: () => dlg.close(),
  });
  const dlg = h(
    'dialog',
    {
      class: 'dialog cdx',
      id: 'dlg-codex',
      'aria-labelledby': 'codex-title',
      'aria-describedby': 'codex-progress',
    },
    h('header', { class: 'dialog__head cdx__head' }, h('div', null, titleEl, h('p', { class: 'cdx__sub', text: t('codexUi.subtitle') })), closeBtn),
    h('div', { class: 'cdx__body' }, nav, h('div', { class: 'cdx-main' }, catview, page)),
  );
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
  // Đóng khi đang đọc: lần mở sau bắt đầu lại ở lưới thẻ của danh mục đó (dễ đoán hơn là quay về giữa bài).
  dlg.addEventListener('close', () => dlg.classList.remove('is-reading'));
  document.body.append(dlg);

  const u: Ui = {
    dlg,
    title: titleEl,
    tiles,
    cards,
    progress,
    bar,
    catCount,
    page,
    cat: CATEGORIES[0].id,
    showEntry: (id) => showEntry(id),
    showCategory: (cat, focusId) => showCategory(cat, focusId),
  };
  onCodexChange(() => syncMarkers(u));

  function selectCategory(cat: CodexCategory): void {
    u.cat = cat.id;
    for (const [k, tile] of tiles) {
      if (k === cat.id) tile.btn.setAttribute('aria-current', 'true');
      else tile.btn.removeAttribute('aria-current');
    }
    for (const [k, list] of lists) list.hidden = k !== cat.id;
    catTitle.replaceChildren(h('span', { text: cat.title }));
    catTitle.insertAdjacentHTML('afterbegin', categoryGlyph(cat.id));
    catBlurb.textContent = cat.blurb;
  }

  /** Ảnh nhỏ trên thẻ: dựng lười khi danh mục được mở lần đầu (và dựng lại nếu vĩ độ/ngày đã đổi). */
  function fillThumbs(cat: CodexCategory): void {
    const en = envOf(ctx);
    const key = `${en.lat}|${en.sunDate}`;
    if (key !== thumbsEnv) {
      thumbsEnv = key;
      for (const c of cards.values()) delete c.thumb.dataset.env;
    }
    const L = labels();
    for (const id of cat.entries) {
      const c = cards.get(id)!;
      if (c.thumb.dataset.env === key) continue;
      const v = entryVisual(id, ENTRIES[id].figure, L, en);
      c.thumb.innerHTML = v ? thumbSvg(v.svg) : categoryGlyph(cat.id);
      c.thumb.dataset.env = key;
    }
  }

  function showCategory(catId: string, focusId?: string): void {
    const cat = CATEGORIES.find((c) => c.id === catId) ?? CATEGORIES[0];
    selectCategory(cat);
    fillThumbs(cat);
    dlg.classList.remove('is-reading');
    syncMarkers(u);
    if (!focusId) catview.scrollTop = 0;
    const card = focusId ? cards.get(focusId)?.btn : null;
    if (card) {
      card.focus();
      card.scrollIntoView({ block: 'nearest' });
    }
  }

  function showEntry(id: string): void {
    const e = ENTRIES[id];
    if (!e) return;
    const cat = CATEGORY_OF.get(id)!;
    selectCategory(cat);
    const wasNew = isNew(id);
    const state = entryState(id);
    const found = state !== 'locked';
    const title = h('h3', {
      class: 'cdx-page__title',
      id: 'cdx-page-title',
      tabindex: '-1',
      text: e.title,
    });
    const en = envOf(ctx);
    const visual = entryVisual(id, e.figure, labels(), en);
    const fig = visual
      ? (() => {
          const f = h('figure', { class: 'cdx-figure', 'data-visual': id }, h('figcaption', { text: visual.caption }));
          f.insertAdjacentHTML('afterbegin', visual.svg);
          if (wasNew) {
            // Ổ khóa lớn phủ lên hình: mở quai rồi mờ đi (chỉ trang trí, chỉ trong lần mở khóa).
            const lock = h('span', { class: 'cdx-unlock', 'aria-hidden': 'true' });
            lock.innerHTML = unlockGlyph();
            f.append(lock);
          }
          return f;
        })()
      : null;
    const facts = entryFacts(id, en);
    const formulas = formulaLines(e.body);
    const factsBox = facts.length
      ? h(
          'section',
          { class: 'cdx-facts', 'aria-labelledby': 'cdx-facts-h' },
          h('h4', { class: 'cdx-aside__h', id: 'cdx-facts-h', text: content.ui.factsTitle }),
          h('dl', null, ...facts.flatMap((f) => [h('dt', { text: f.label }), h('dd', { text: f.value })])),
          h('p', { class: 'cdx-facts__src', text: id === 'sun' ? content.ui.factsSourceSun : content.ui.factsSource }),
        )
      : formulas.length
        ? (() => {
            // Thẻ công thức: tóm tắt nhanh ở cột bên trên màn hình rộng. Thân bài vẫn giữ công thức đúng chỗ của
            // nó trong lời giải thích, nên trên màn hình hẹp thẻ này ẩn đi (không lặp lại).
            const box = renderLines(formulas);
            box.className = 'cdx-formulas__body';
            return h(
              'section',
              { class: 'cdx-facts cdx-facts--formula', 'aria-labelledby': 'cdx-facts-h' },
              h('h4', { class: 'cdx-aside__h', id: 'cdx-facts-h', text: content.ui.formulaTitle }),
              box,
            );
          })()
        : null;
    const simFn = SIM[id];
    // Nút quay lại mang tên danh mục (thay cho dòng "kicker" cũ): một chỗ vừa cho biết đang ở đâu vừa để quay về.
    const back = h('button', {
      type: 'button',
      class: 'btn btn--ghost cdx-page__back',
      'aria-label': t('codexUi.backAria', { cat: cat.title }),
      text: t('codexUi.back', { cat: cat.title }),
      onclick: () => showCategory(cat.id, id),
    });
    // Dòng trạng thái: lần mở khóa → "Đã mở khóa" (hiện dần sau ổ khóa); sau đó → "Đã khám phá"; chưa gặp → ghi chú.
    const stateLine = wasNew
      ? h('p', { class: 'cdx-page__state cdx-unlocked', 'data-state': 'unlocked' })
      : h('p', { class: `cdx-page__state${found ? '' : ' is-locked'}`, 'data-state': state });
    stateLine.insertAdjacentHTML('afterbegin', stateGlyph(wasNew ? 'read' : state));
    stateLine.append(h('span', { text: wasNew ? t('codexUi.unlocked') : found ? t('codexUi.pageFound') : t('codexUi.pageLocked') }));
    const head = h('header', { class: 'cdx-page__head' }, back, title, e.aka ? h('p', { class: 'cdx-page__aka', text: e.aka }) : null, stateLine);
    const main = h(
      'div',
      { class: 'cdx-page__main' },
      h('p', { class: 'cdx-page__lede', text: e.lede }),
      h('hr', { class: 'cdx-page__rule' }),
      (() => {
        const body = renderLines(e.body);
        body.className = 'cdx-page__body';
        return body;
      })(),
    );
    const asideParts: (Node | null)[] = [
      fig,
      factsBox,
      simFn
        ? h(
            'div',
            { class: 'cdx-page__sim' },
            h('button', {
              type: 'button',
              class: 'btn btn--primary',
              'aria-describedby': 'cdx-sim-note',
              text: `▶ ${t('codexUi.showInSim')}`,
              onclick: () => {
                dlg.close();
                simFn(ctx);
                document.querySelector('.views')?.scrollIntoView({ block: 'nearest' });
              },
            }),
            e.sim
              ? h('p', {
                  class: 'cdx-page__simnote',
                  id: 'cdx-sim-note',
                  text: e.sim,
                })
              : null,
          )
        : null,
      e.related.length
        ? h(
            'section',
            { class: 'cdx-page__related', 'aria-labelledby': 'cdx-related-h' },
            h('h4', { class: 'cdx-aside__h', id: 'cdx-related-h', text: t('codexUi.related') }),
            h(
              'ul',
              { role: 'list' },
              ...e.related.map((r) => {
                const rs = entryState(r);
                const b = h(
                  'button',
                  {
                    type: 'button',
                    class: `cdx-rel${rs === 'locked' ? ' is-locked' : ''}`,
                    'data-entry': r,
                    'data-state': rs,
                    onclick: () => showEntry(r),
                  },
                  h('span', { class: 'cdx-rel__mark', 'aria-hidden': 'true' }),
                  h('span', { text: ENTRIES[r]?.title ?? r }),
                  h('span', { class: 'sr-only', text: `, ${STATE_TEXT(rs)}` }),
                );
                b.firstElementChild!.innerHTML = stateGlyph(rs);
                return h('li', null, b);
              }),
            ),
          )
        : null,
    ];
    const aside = h('aside', { class: 'cdx-page__aside', 'aria-label': content.ui.asideTitle }, ...asideParts.filter((p): p is Node => p !== null));
    page.replaceChildren(h('div', { class: 'cdx-page__in' }, head, main, aside));
    page.setAttribute('aria-labelledby', 'cdx-page-title');
    // Nhịp mở khóa: data-unlocked đánh dấu lần xem này (ổn định cho kiểm thử); .is-unlocking chỉ sống trong lúc
    // hoạt ảnh chạy rồi được gỡ. Mở lại cùng mục (đã đọc) thì không có cả hai.
    window.clearTimeout(unlockTimer);
    page.classList.remove('is-unlocking');
    if (wasNew) {
      page.dataset.unlocked = id;
      void page.offsetWidth; // khởi động lại hoạt ảnh nếu hai mục mới được mở liên tiếp
      page.classList.add('is-unlocking');
      unlockTimer = window.setTimeout(() => page.classList.remove('is-unlocking'), UNLOCK_MS + 100);
    } else delete page.dataset.unlocked;
    renderMath(page);
    dlg.classList.add('is-reading');
    page.scrollTop = 0;
    markRead(id); // đồng bộ dấu "mới" và huy hiệu qua onCodexChange
    syncMarkers(u);
    title.focus();
  }

  return u;
}

export function openCodexUi(ctx: CodexContext, id?: string): void {
  const u = (ui ??= build(ctx));
  if (!u.dlg.open) {
    u.dlg.showModal();
    // Tính kiểu một lần với giá trị cũ của thanh tiến độ (hộp vừa hiện), để giá trị mới ghi sau đó chạy chuyển tiếp.
    void u.bar.offsetWidth;
  }
  syncMarkers(u);
  if (id && ENTRIES[id]) {
    u.showEntry(id);
    return;
  }
  // Không chỉ định mục: mở lưới thẻ của danh mục có mục mới đầu tiên (thẻ "MỚI" nhận tiêu điểm, người dùng tự bấm
  // để mở khóa); nếu không còn mục mới, mở lại danh mục xem gần nhất.
  const fresh = ORDER.find(isNew);
  if (fresh) u.showCategory(CATEGORY_OF.get(fresh)!.id, fresh);
  else {
    u.showCategory(u.cat);
    u.tiles.get(u.cat)?.btn.focus();
  }
}
