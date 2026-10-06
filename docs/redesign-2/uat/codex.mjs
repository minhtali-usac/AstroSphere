// Kiểm tra chấp nhận USACodex (redesign-2 R3; game feel 2026-10-05: ô danh mục, lưới thẻ, nhịp mở khóa, huy hiệu lóe).
//
// Chạy trên máy chủ phát triển (cần window.__app):
//   npx vite --port 5192 --strictPort   (nền), rồi node docs/redesign-2/uat/codex.mjs
// Đổi địa chỉ bằng UAT_URL (mặc định http://localhost:5192/?quality=fixed).
//
// Thay đổi so với bản trước (game feel), có lý do:
// - "(2) desktop opens on the first new entry" → mở ở LƯỚI THẺ của danh mục có mục mới đầu tiên, thẻ mới nhận tiêu
//   điểm, chưa có gì bị đánh dấu đã đọc. Phần thưởng (mở khóa) xảy ra khi người dùng tự bấm vào thẻ.
// - "(4) badge 3 → 2" giờ đo sau khi bấm thẻ đầu tiên (trước đây do việc tự mở mục khi mở hộp thoại).
// - Danh sách mục (.cdx-item) thành thẻ (.cdx-card) trong lưới của từng danh mục; các bước mở một mục đi qua ô danh mục
//   rồi thẻ (openEntry). Điện thoại mở ở lưới thẻ thay vì danh sách; "quay lại" về lưới thẻ.
// - Kiểm tra tương phản của mục chưa khám phá đo trên thẻ (nền thẻ) thay vì trên cột danh sách cũ.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { expandFocus } from './focus-helpers.mjs';

const URL = process.env.UAT_URL ?? 'http://localhost:5192/?quality=fixed';
const SHOTS = new globalThis.URL('../shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const errors = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function open(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  await page.waitForFunction(() => window.__app?.horizon, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__app.actions.pause());
  return page;
}

const newContext = (width, height, reducedMotion = 'no-preference') =>
  browser.newContext({ viewport: { width, height }, reducedMotion }).then(async (ctx) => {
    // Không hiện gợi ý lần đầu (che khung nhìn trong ảnh chụp).
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('astrosphere.hint.v1', 'true');
        // redesign-2 R2: lần đầu vào là chế độ Cơ bản; các kiểm tra này dùng giao diện Đầy đủ (thẻ có đủ dòng α, δ, H).
        localStorage.setItem('astrosphere.mode.v1', JSON.stringify('full'));
        // redesign-2 R4: Usui-chan đã chào (lời chào lần đầu không che ảnh chụp và các thao tác kiểm tra).
        localStorage.setItem('astrosphere.guide.v1', JSON.stringify({ hello: true }));
      } catch {
        /* bỏ qua */
      }
    });
    return ctx;
  });

const badge = (page) => page.evaluate(() => { const b = document.querySelector('.codex-badge'); return b && !b.hidden ? Number(b.textContent) : 0; });
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('astrosphere.codex.v1') ?? 'null'));
const noHScroll = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
const reading = (page) => page.evaluate(() => document.getElementById('dlg-codex').classList.contains('is-reading'));
const SIRIUS = 32349;

/** Mở một mục như người dùng: (quay lại lưới nếu đang đọc) → ô danh mục của mục → thẻ. */
async function openEntry(page, id) {
  if (await reading(page)) await page.locator('.cdx-page__back').click();
  const cat = await page.evaluate((id) => document.querySelector(`.cdx-card[data-entry=${id}]`).closest('.cdx-grid').dataset.cat, id);
  await page.locator(`.cdx-tile[data-cat=${cat}]`).click();
  await page.locator(`.cdx-card[data-entry=${id}]`).click();
  await page.waitForSelector('.cdx-page__title');
}

/** Trạng thái nhịp mở khóa trên trang đọc, đọc ngay sau khi mở. */
const unlockState = (page) =>
  page.evaluate(() => {
    const p = document.querySelector('.cdx-page');
    const line = p.querySelector('.cdx-unlocked');
    // CSS: animation-timing-function sống trên từng khung hình chính, nên đọc nó từ keyframes chứ không từ getTiming().
    const anims = p.getAnimations({ subtree: true }).map((a) => ({ ...a.effect.getTiming(), easing: a.effect.getKeyframes()[0]?.easing }));
    return {
      attr: p.dataset.unlocked ?? null,
      cls: p.classList.contains('is-unlocking'),
      line: line?.textContent ?? null,
      lineOpacity: line ? getComputedStyle(line).opacity : null,
      ledeOpacity: getComputedStyle(p.querySelector('.cdx-page__lede')).opacity,
      titleOpacity: getComputedStyle(p.querySelector('.cdx-page__title')).opacity,
      figAnim: getComputedStyle(p.querySelector('.cdx-figure') ?? p).animationName,
      lineAnim: line ? getComputedStyle(line).animationName : null,
      lock: !!p.querySelector('.cdx-unlock'),
      lockOpacityAtRest: p.querySelector('.cdx-unlock') ? getComputedStyle(p.querySelector('.cdx-unlock')).opacity : null,
      anims: anims.length,
      end: Math.max(0, ...anims.map((t) => Number(t.delay) + Number(t.duration))),
      easings: [...new Set(anims.map((t) => t.easing))],
    };
  });

/** Cỡ chữ hiệu dụng nhỏ nhất (px) trong vùng nhìn thấy của USACodex; chữ SVG nhân theo tỉ lệ hình. Bỏ qua chỉ số
 * trên/dưới của KaTeX (dấu độ "∘" trong số mũ: quy ước sắp chữ toán) và chữ chỉ dành cho trình đọc màn hình. */
const minFont = (page) =>
  page.evaluate(() => {
    let m = 99;
    let at = '';
    for (const el of document.querySelectorAll('#dlg-codex *')) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      if (el.closest('.sr-only, .katex-mathml, .mtight, .vlist-s, [hidden]') || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      let px = parseFloat(cs.fontSize);
      const svg = el.closest('svg');
      if (svg?.viewBox?.baseVal?.width) px *= svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      if (px < m) {
        m = px;
        at = `${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''} "${el.textContent.trim().slice(0, 24)}"`;
      }
    }
    return { min: Math.round(m * 100) / 100, at };
  });

// ------------------------------------------------------------------ Máy tính 1440×900
const ctx = await newContext(1440, 900);
{
  const page = await open(ctx);

  // (1) Nút Codex trên thanh trên cùng, trước Trợ giúp, có huy hiệu.
  const order = await page.locator('.topbar__actions .btn .btn__text').allTextContents();
  check('(1) Codex button in the top bar, before Trợ giúp', order.indexOf('USACodex') >= 0 && order.indexOf('USACodex') === order.indexOf('Trợ giúp') - 1, order.join(' | '));
  const b0 = await badge(page);
  check('(1) first visit: badge shows the 3 entries already on screen (sky dome, horizon, Polaris)', b0 === 3, `badge=${b0}`);
  // fix-2 #10: con số trên huy hiệu được giải thích — tên truy cập (bắt đầu bằng chữ nhìn thấy "USACodex") và tooltip.
  const named = await page.evaluate(() => { const b = document.querySelector('.btn--codex'); return { name: b.getAttribute('aria-label'), title: b.title }; });
  check('(fix-2 #10) the badge is explained: name "USACodex: 3 mục mới chưa đọc", tooltip "3 mục mới trong USACodex: bấm để đọc"', named.name === 'USACodex: 3 mục mới chưa đọc' && named.title === '3 mục mới trong USACodex: bấm để đọc', JSON.stringify(named));
  const focusBefore = await page.evaluate(() => document.activeElement?.tagName);

  // (2) Mở hộp thoại: ô danh mục và lưới thẻ.
  await page.locator('.btn--codex').click();
  await page.waitForSelector('#dlg-codex[open] .cdx-card');
  const dom = await page.evaluate(() => {
    const visible = (el) => !!el.getClientRects().length;
    const tiles = [...document.querySelectorAll('.cdx-tile')];
    return {
      modal: document.getElementById('dlg-codex').matches(':modal'),
      title: document.getElementById('codex-title').textContent,
      tiles: tiles.map((t) => ({ name: t.querySelector('.cdx-tile__name').textContent, count: t.querySelector('.cdx-tile__count').textContent, glyph: !!t.querySelector('.cdx-tile__icon svg'), bar: !!t.querySelector('.cdx-tile__bar'), sr: t.querySelector('.sr-only').textContent })),
      cards: document.querySelectorAll('.cdx-card').length,
      visibleCards: [...document.querySelectorAll('.cdx-card')].filter(visible).map((c) => c.dataset.entry),
      locked: document.querySelectorAll('.cdx-card[data-state=locked]').length,
      progress: document.querySelector('.cdx-progress__text').textContent,
      reading: document.getElementById('dlg-codex').classList.contains('is-reading'),
      focus: document.activeElement?.dataset.entry,
      current: document.querySelector('.cdx-tile[aria-current=true]')?.dataset.cat,
      bar: (() => {
        const b = document.querySelector('.cdx-progress__bar');
        return { h: b.getBoundingClientRect().height, fill: getComputedStyle(b, '::before').backgroundColor };
      })(),
    };
  });
  check('(2) Codex opens as a modal <dialog>', dom.modal);
  check('(game) the dialog title reads "USACodex · 3/44"', dom.title === 'USACodex · 3/44', dom.title);
  check('(game) 7 category tiles, each with a glyph, its name, an "x/y" count and a mini progress bar', dom.tiles.length === 7 && dom.tiles.every((t) => t.glyph && t.bar && /^\d+\/\d+$/.test(t.count)), dom.tiles.map((t) => `${t.name} ${t.count}`).join(' · '));
  check('(game) tile counts are right on a first visit (Nền tảng 2/7, Sao sáng 1/10) and spoken in full', dom.tiles[0].count === '2/7' && dom.tiles.find((t) => t.name === 'Sao sáng')?.count === '1/10' && /2 trên 7 mục đã khám phá, có mục mới/.test(dom.tiles[0].sr), dom.tiles[0].sr);
  check('(2) 35–45 entries render as cards, undiscovered ones locked', dom.cards >= 35 && dom.cards <= 45 && dom.locked === dom.cards - 3, `cards=${dom.cards} locked=${dom.locked}`);
  check('(2) progress line "x/y đã khám phá"', /^3\/\d+ đã khám phá$/.test(dom.progress), dom.progress);
  check('(game) main progress bar is ~6 px and neutral (not orange)', dom.bar.h >= 5 && dom.bar.h <= 7 && !/242,\s*101,\s*34/.test(dom.bar.fill), JSON.stringify(dom.bar));
  check('(2, changed) opens on the card grid of the first category with a new entry; the new card has focus', !dom.reading && dom.current === 'basics' && dom.visibleCards.length === 7 && dom.focus === 'sphere', JSON.stringify({ reading: dom.reading, current: dom.current, visible: dom.visibleCards.length, focus: dom.focus }));
  check('(2, changed) opening USACodex marks nothing read by itself', (await badge(page)) === 3, `badge=${await badge(page)}`);
  await page.screenshot({ path: `${SHOTS}codex-grid-1440.png` });

  // Phím mũi tên trong lưới thẻ.
  await page.keyboard.press('ArrowRight');
  const arrowed = await page.evaluate(() => document.activeElement?.dataset.entry);
  await page.keyboard.press('ArrowLeft');
  check('(game) arrow keys move between cards', arrowed === 'horizon' && (await page.evaluate(() => document.activeElement?.dataset.entry)) === 'sphere', `→ ${arrowed}`);

  // (4) + nhịp mở khóa: bấm thẻ mới đầu tiên.
  await page.locator('.cdx-card[data-entry=sphere]').click();
  const u1 = await unlockState(page);
  check('(game) opening a new entry plays the unlock: data-unlocked + .is-unlocking + "Đã mở khóa" line', u1.attr === 'sphere' && u1.cls && u1.line === 'Đã mở khóa' && u1.lock, JSON.stringify({ attr: u1.attr, cls: u1.cls, line: u1.line, lock: u1.lock }));
  check('(game) the reveal does not delay reading: title and lede are fully visible at once', u1.titleOpacity === '1' && u1.ledeOpacity === '1', JSON.stringify({ title: u1.titleOpacity, lede: u1.ledeOpacity }));
  check('(game) the reveal is short and eased out (600–900 ms total, one ease-out curve, no bounce)', u1.anims >= 3 && u1.end >= 600 && u1.end <= 900 && u1.easings.every((e) => e === 'cubic-bezier(0.22, 1, 0.36, 1)'), JSON.stringify({ anims: u1.anims, end: u1.end, easings: u1.easings }));
  const b1 = await badge(page);
  check('(4) opening an entry marks it read: badge 3 → 2', b1 === 2, `badge=${b1}`);
  await page.waitForTimeout(1100);
  check('(game) .is-unlocking is removed after the reveal; the "Đã mở khóa" line stays for this view', await page.evaluate(() => !document.querySelector('.cdx-page').classList.contains('is-unlocking') && getComputedStyle(document.querySelector('.cdx-unlocked')).opacity === '1'));

  // Nút quay lại "← Nền tảng".
  const backText = await page.locator('.cdx-page__back').textContent();
  await page.locator('.cdx-page__back').click();
  const afterBack = await page.evaluate(() => ({ reading: document.getElementById('dlg-codex').classList.contains('is-reading'), focus: document.activeElement?.dataset.entry, gridVisible: !!document.querySelector('.cdx-grid[data-cat=basics]').getClientRects().length, state: document.querySelector('.cdx-card[data-entry=sphere]').dataset.state }));
  check('(game) back control "← Nền tảng" returns to the card grid and focuses the card just read', backText === '← Nền tảng' && !afterBack.reading && afterBack.gridVisible && afterBack.focus === 'sphere' && afterBack.state === 'read', JSON.stringify({ backText, ...afterBack }));

  // fix-1 + game feel: ba trạng thái thẻ có dấu riêng, không dựa vào màu.
  const marks = await page.evaluate(() => {
    const st = (s) => [...document.querySelectorAll(`.cdx-card[data-state=${s}]`)];
    const shape = (el) => el?.querySelector('.cdx-card__mark svg')?.innerHTML.replace(/\s+/g, ' ') ?? '';
    const locked = document.querySelector('.cdx-card[data-entry=zenith]');
    const fresh = document.querySelector('.cdx-card[data-entry=horizon]');
    const read = document.querySelector('.cdx-card[data-entry=sphere]');
    const visibleText = (el) => { const s = el.querySelector('.cdx-card__state'); return getComputedStyle(s).width !== '1px' ? s.textContent : ''; };
    const thumb = (el) => getComputedStyle(el.querySelector('.cdx-card__thumb svg')).filter;
    return {
      locked: st('locked').length,
      newer: st('new').length,
      read: st('read').length,
      all: document.querySelectorAll('.cdx-card[data-state]').length,
      states: [locked.dataset.state, fresh.dataset.state, read.dataset.state],
      shapes: new Set([shape(locked), shape(fresh), shape(read)]).size,
      lockIcon: !!locked.querySelector('.cdx-card__mark svg rect'),
      lockedText: visibleText(locked),
      newText: visibleText(fresh),
      readText: read.querySelector('.cdx-card__state').textContent,
      lockedThumb: thumb(locked),
      readThumb: thumb(read),
      newBorder: getComputedStyle(fresh).borderTopColor,
      lockedBorder: getComputedStyle(locked).borderTopStyle,
      thumbs: [...document.querySelectorAll('.cdx-grid[data-cat=basics] .cdx-card__thumb svg')].length,
      thumbText: [...document.querySelectorAll('.cdx-card__thumb text')].filter((t) => getComputedStyle(t).display !== 'none').length,
      thumbsOther: document.querySelectorAll('.cdx-grid[data-cat=deep] .cdx-card__thumb svg').length,
    };
  });
  check('(game) the grid shows locked, new and read cards with distinct data-state', marks.states.join() === 'locked,new,read' && marks.all === dom.cards && marks.newer >= 1 && marks.read >= 1 && marks.locked > 30, JSON.stringify({ states: marks.states, locked: marks.locked, newer: marks.newer, read: marks.read }));
  check('fix-1: the three states use three different glyphs (lock, filled dot, check)', marks.shapes === 3 && marks.lockIcon, `shapes=${marks.shapes}`);
  check('(game) locked card: visible "chưa khám phá", dashed border, desaturated thumbnail; new card: visible "mới" tag and bright border; read: "đã đọc" for assistive tech', marks.lockedText === 'chưa khám phá' && marks.newText === 'mới' && marks.readText === 'đã đọc' && /grayscale\(1\)/.test(marks.lockedThumb) && marks.readThumb === 'none' && marks.lockedBorder === 'dashed' && marks.newBorder === 'rgb(242, 242, 242)', JSON.stringify({ l: marks.lockedText, n: marks.newText, r: marks.readText, lt: marks.lockedThumb, nb: marks.newBorder }));
  check('(game) card thumbnails render lazily per category and drop their labels', marks.thumbs === 7 && marks.thumbText === 0 && marks.thumbsOther === 0, JSON.stringify({ basics: marks.thumbs, deep: marks.thumbsOther, labels: marks.thumbText }));

  // fix-1: "mới" và thanh tiến độ không dùng cam (cam chỉ cho thứ bấm được); tương phản ≥ 4,5:1.
  const colours = await page.evaluate(() => {
    const lum = (c) => {
      const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const fresh = document.querySelector('.cdx-card[data-state=new]');
    const locked = document.querySelector('.cdx-card[data-state=locked]');
    const tag = getComputedStyle(fresh.querySelector('.cdx-card__state'));
    const dot = getComputedStyle(fresh.querySelector('.cdx-card__mark'));
    const fill = getComputedStyle(document.querySelector('.cdx-progress__bar'), '::before').backgroundColor;
    const tileFill = getComputedStyle(document.querySelector('.cdx-tile__bar'), '::before').backgroundColor;
    const lockedBg = getComputedStyle(locked).backgroundColor;
    return {
      list: [tag.color, tag.borderTopColor, tag.backgroundColor, dot.color, fill, tileFill, getComputedStyle(fresh).borderTopColor, getComputedStyle(document.querySelector('.cdx-progress__text')).color],
      tagContrast: ratio(tag.color, getComputedStyle(fresh).backgroundColor),
      lockedName: ratio(getComputedStyle(locked.querySelector('.cdx-card__name')).color, lockedBg),
      lockedMeta: ratio(getComputedStyle(locked.querySelector('.cdx-card__meta')).color, lockedBg),
    };
  });
  check('fix-1: no orange on the "mới" tag, its dot, the new-card border or the progress bars', !colours.list.some((c) => /^rgba?\(242,101,34/.test(c.replace(/\s/g, ''))), colours.list.join(' | '));
  check('fix-1: "mới" tag and locked cards keep ≥ 4,5:1 contrast', colours.tagContrast >= 4.5 && colours.lockedName >= 4.5 && colours.lockedMeta >= 4.5, `mới ${colours.tagContrast.toFixed(2)}:1, locked name ${colours.lockedName.toFixed(2)}:1, locked meta ${colours.lockedMeta.toFixed(2)}:1`);

  // Mở lại mục đã đọc: không chơi lại nhịp mở khóa.
  await page.locator('.cdx-card[data-entry=sphere]').click();
  const u2 = await unlockState(page);
  check('(game) opening the same entry again plays no unlock and shows no "Đã mở khóa" line', u2.attr === null && !u2.cls && u2.line === null && !u2.lock, JSON.stringify({ attr: u2.attr, cls: u2.cls, line: u2.line }));
  await openEntry(page, 'horizon');
  const b2 = await badge(page);
  const newLeft = await page.locator('.cdx-card[data-state=new]').count();
  check('(4) opening another new entry: badge 2 → 1, one "mới" card left', b2 === 1 && newLeft === 1, `badge=${b2} new=${newLeft}`);
  // Mục chưa khám phá vẫn đọc được, có ghi chú "chưa khám phá"; không có nhịp mở khóa.
  await openEntry(page, 'ecliptic');
  const lockedNote = await page.locator('.cdx-page__state.is-locked').textContent();
  check('undiscovered entry is readable, with a "chưa khám phá" note and no unlock', /Chưa khám phá/.test(lockedNote ?? '') && (await page.locator('.cdx-page__body p').count()) > 1 && (await unlockState(page)).attr === null, lockedNote);
  // Công thức dựng bằng KaTeX.
  await openEntry(page, 'latPole');
  await page.waitForSelector('.cdx-page .katex', { timeout: 10000 }).catch(() => {});
  check('formulas render with KaTeX; diagram present', (await page.locator('.cdx-page .katex').count()) > 0 && (await page.locator('.cdx-page svg.cdx-svg').count()) === 1);
  await page.screenshot({ path: `${SHOTS}codex-1440.png` });

  // fix-1: mọi mục có hình đầu trang (sơ đồ khái niệm hoặc ảnh bầu trời từ dữ liệu thật). Đo luôn sàn 13 px.
  const visuals = {};
  const fonts = {};
  for (const id of ['sphere', 'meridian', 'latPole', 'magnitude', 'deepSky', 'constellations', 'canopus', 'cru', 'm42', 'circumpolar', 'starColor', 'ori']) {
    await openEntry(page, id);
    visuals[id] = await page.evaluate(() => {
      const svg = document.querySelector('.cdx-page .cdx-figure svg[role=img]');
      return svg ? { label: (svg.getAttribute('aria-label') ?? '').length, marks: svg.querySelectorAll('circle, path, line, ellipse, rect').length } : null;
    });
    fonts[id] = await minFont(page);
  }
  const missing = Object.entries(visuals).filter(([, v]) => !v || v.label < 20 || v.marks < 3);
  check('fix-1: header visual with an accessible name on concept, star, constellation and deep-sky entries', missing.length === 0, missing.length ? JSON.stringify(missing) : Object.keys(visuals).join(', '));
  const sky = await page.evaluate(() => document.querySelectorAll('.cdx-figure .cdx-svg__field circle').length);
  check('fix-1: star-pattern thumbnails draw real catalogue stars', sky > 15, `field stars in the Orion visual: ${sky}`);
  await page.locator('.cdx-page__back').click();
  fonts.grid = await minFont(page);
  const small = Object.entries(fonts).filter(([, f]) => f.min < 13);
  check('(game) 13 px floor: every visible text in USACodex, incl. diagram labels at their rendered scale, is ≥ 13 px', small.length === 0, small.length ? JSON.stringify(small) : `min ${Math.min(...Object.values(fonts).map((f) => f.min))} px over ${Object.keys(fonts).length} views`);

  // fix-1: cột số liệu bên phải trên màn hình rộng. (Vega, không phải Sirius: bước (3) cần Sirius chưa đọc.)
  await openEntry(page, 'vega');
  await page.waitForTimeout(300);
  const layout = await page.evaluate(() => {
    const r = (sel) => document.querySelector(sel)?.getBoundingClientRect();
    const main = r('.cdx-page__main');
    const aside = r('.cdx-page__aside');
    const facts = [...document.querySelectorAll('.cdx-facts dt')].map((e) => e.textContent);
    const sim = r('.cdx-page__aside .cdx-page__sim .btn');
    return { mainRight: main.right, asideLeft: aside.left, asideTop: aside.top, mainTop: main.top, facts, sim: !!sim && sim.left >= aside.left, svgW: r('.cdx-figure > svg').width };
  });
  check('fix-1: wide screens put the facts column to the right of the text', layout.asideLeft >= layout.mainRight && layout.asideTop <= layout.mainTop, JSON.stringify({ mainRight: layout.mainRight, asideLeft: layout.asideLeft }));
  check('fix-1: star facts list α, δ, magnitude, colour index, constellation and Vietnamese name; the action sits in the column', ['Xích kinh α', 'Xích vĩ δ', 'Cấp sao m', 'Chòm sao', 'Tên tiếng Việt'].every((f) => layout.facts.includes(f)) && layout.sim, layout.facts.join(' · '));
  check('(game) the header visual renders at ≥ 300 px (labels at full size)', layout.svgW >= 299.5, `svg ${layout.svgW} px`);
  await page.screenshot({ path: `${SHOTS}codex-1440-star.png` });

  // (7) Esc đóng Codex trước, không bỏ chọn.
  await page.keyboard.press('Escape');
  const afterEsc = await page.evaluate(() => ({ open: document.getElementById('dlg-codex').open, sel: window.__app.store.state.selected }));
  check('(7) Esc closes the codex without clearing the selection', !afterEsc.open && afterEsc.sel !== null, JSON.stringify(afterEsc));
  const focusAfter = await page.evaluate(() => document.activeElement?.classList.contains('btn--codex'));
  check('focus returns to the Codex button', focusAfter, `before=${focusBefore}`);

  // (3) Chọn một sao mới → số mục khám phá tăng, huy hiệu tăng và lóe sáng đúng một lần.
  await page.evaluate(() => {
    const b = document.querySelector('.codex-badge');
    window.__glow = 0;
    new MutationObserver(() => {
      const on = b.classList.contains('is-glow');
      if (on && !window.__glowOn) window.__glow++;
      window.__glowOn = on;
    }).observe(b, { attributes: true, attributeFilter: ['class'] });
  });
  const d0 = (await stored(page)).discovered.length;
  await page.evaluate(async (hip) => {
    // Chọn Sirius qua tiện ích dùng chung của scenario.ts (máy chủ phát triển phục vụ mã nguồn).
    const { selectCatalogHip } = await import('/src/scenario.ts');
    selectCatalogHip({ store: window.__app.store, actions: window.__app.actions }, hip);
  }, SIRIUS);
  await page.waitForTimeout(150);
  const s1 = await stored(page);
  const b3 = await badge(page);
  const glowNow = await page.evaluate(() => ({ n: window.__glow, anim: getComputedStyle(document.querySelector('.codex-badge')).animationName }));
  check('(3) selecting a new star increments discovered', s1.discovered.length > d0 && s1.discovered.includes('sirius'), `${d0} → ${s1.discovered.length}: ${s1.discovered.join(',')}`);
  check('(3) …and the badge counts the new entries', b3 > 1, `badge=${b3}`);
  check('(game) the badge glows once when the unread count rises', glowNow.n === 1 && glowNow.anim === 'cdx-badge-glow', JSON.stringify(glowNow));
  await page.waitForTimeout(800);
  check('(game) …and the glow class is gone after ~600 ms', await page.evaluate(() => !document.querySelector('.codex-badge').classList.contains('is-glow')));

  // (5) Liên kết "?" trong thẻ thông tin mở đúng mục.
  await page.waitForSelector('.infocard:not(.is-collapsed) .kv[data-emphasis=ha] .term');
  // Rê chuột lên dòng vẫn tô sáng liên kết (data-emphasis) như trước.
  await page.locator('.infocard .kv[data-emphasis=ha] dd').hover();
  const emph = await page.evaluate(() => window.__app.store.state.emphasis);
  // Rê chuột lên H khám phá LST và qua kinh tuyến khi đang ở mô phỏng → một nhịp lóe nữa là đúng; mốc đếm lấy sau đó.
  await page.waitForTimeout(100);
  const glowBase = await page.evaluate(() => window.__glow);
  check('term links keep the linked highlight: hovering the H row → emphasis "meridian"', emph === 'meridian', `emphasis=${emph}`);
  await page.locator('.infocard .kv[data-emphasis=ha] .term').click();
  await page.waitForSelector('#dlg-codex[open]');
  await page.waitForSelector('.cdx-page__title');
  const fromTerm = await page.evaluate(() => ({ title: document.querySelector('.cdx-page__title').textContent, current: document.querySelector('.cdx-tile[aria-current=true]')?.dataset.cat, focus: document.activeElement?.id }));
  check('(5) info-card "?" next to H opens the hour-angle entry', fromTerm.current === 'coords' && fromTerm.title === 'Góc giờ H', JSON.stringify(fromTerm));
  check('(5) …and moves focus to the entry title', fromTerm.focus === 'cdx-page-title');
  check('(game) reading entries does not glow the badge (count falls, no new pulse)', (await page.evaluate(() => window.__glow)) === glowBase, `pulses before/after reading: ${glowBase}/${await page.evaluate(() => window.__glow)}`);
  const siriusNew = await page.locator('.cdx-card[data-entry=sirius][data-state=new]').count();
  check('(3) Sirius carries the "mới" marker in the grid', siriusNew === 1);

  // Ảnh chụp: nhịp mở khóa trên Sirius (khung cuối, dòng "Đã mở khóa" đã hiện).
  await openEntry(page, 'sirius');
  const u3 = await unlockState(page);
  check('(game) opening Sirius (new) from its card plays the unlock', u3.attr === 'sirius' && u3.line === 'Đã mở khóa', JSON.stringify({ attr: u3.attr, line: u3.line }));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SHOTS}codex-unlock-1440.png` });

  // (6) "Xem trong mô phỏng" đổi store: bật hoàng đạo.
  await openEntry(page, 'ecliptic');
  const eclBefore = await page.evaluate(() => window.__app.store.state.toggles.ecliptic);
  await page.getByRole('button', { name: /Xem trong mô phỏng/ }).click();
  const eclAfter = await page.evaluate(() => ({ on: window.__app.store.state.toggles.ecliptic, open: document.getElementById('dlg-codex').open }));
  check('(6) "Xem trong mô phỏng" turns on the ecliptic and closes the codex', !eclBefore && eclAfter.on && !eclAfter.open, JSON.stringify({ eclBefore, ...eclAfter }));

  // Liên kết "?" ở dải số liệu và bảng Hiển thị.
  // Bố cục tập trung (2026-10-05): ô độ cao thiên cực nằm trong dải số liệu đầy đủ, mở ra trước.
  await expandFocus(page, { data: true });
  await page.locator('.databar [data-emphasis=pole] .term').click();
  await page.waitForSelector('#dlg-codex[open]');
  await page.waitForSelector('.cdx-page__title');
  const fromData = await page.evaluate(() => ({ cat: document.querySelector('.cdx-tile[aria-current=true]')?.dataset.cat, title: document.querySelector('.cdx-page__title').textContent }));
  check('data-bar "?" next to pole altitude opens φ = pole altitude', fromData.cat === 'coords' && (await page.evaluate(() => document.querySelector('.cdx-figure')?.dataset.visual)) === 'latPole', JSON.stringify(fromData));
  await page.keyboard.press('Escape');
  const termCount = await page.locator('.term').count();
  check('term links are present across the UI (info card, data bar, location, display)', termCount >= 25, `count=${termCount}`);

  // (8) Tải lại → tiến độ còn nguyên.
  const before = await stored(page);
  const badgeBefore = await badge(page);
  await page.reload();
  await page.waitForFunction(() => window.__app?.horizon, null, { timeout: 30000 });
  const after = await stored(page);
  const badgeAfter = await badge(page);
  check('(8) progress persists after reload', after.discovered.length === before.discovered.length && after.read.length === before.read.length && badgeAfter === badgeBefore, `discovered ${before.discovered.length}→${after.discovered.length}, read ${before.read.length}→${after.read.length}, badge ${badgeBefore}→${badgeAfter}`);
  check('(game) no glow on page load (only a rise while in the sim glows)', await page.evaluate(() => !document.querySelector('.codex-badge').classList.contains('is-glow')));
  await page.close();
}
await ctx.close();

// ------------------------------------------------------------------ Giảm chuyển động (1440×900)
{
  const c = await newContext(1440, 900, 'reduce');
  const page = await open(c);
  await page.locator('.btn--codex').click();
  await page.waitForSelector('#dlg-codex[open] .cdx-card');
  await page.locator('.cdx-card[data-entry=sphere]').click();
  const u = await unlockState(page);
  check('(reduced motion) the unlock plays no animation, but the "Đã mở khóa" line is shown at once', u.attr === 'sphere' && u.line === 'Đã mở khóa' && u.lineOpacity === '1' && u.anims === 0 && u.figAnim === 'none' && u.lineAnim === 'none' && u.lockOpacityAtRest === '0', JSON.stringify({ line: u.line, op: u.lineOpacity, anims: u.anims, fig: u.figAnim, lock: u.lockOpacityAtRest }));
  await page.keyboard.press('Escape');
  const n0 = await badge(page);
  await page.evaluate(async (hip) => {
    const { selectCatalogHip } = await import('/src/scenario.ts');
    selectCatalogHip({ store: window.__app.store, actions: window.__app.actions }, hip);
  }, SIRIUS);
  await page.waitForTimeout(100);
  const g = await page.evaluate(() => ({ n: Number(document.querySelector('.codex-badge').textContent), anim: getComputedStyle(document.querySelector('.codex-badge')).animationName }));
  check('(reduced motion) the badge count rises with no glow animation', g.n > n0 && g.anim === 'none', JSON.stringify({ from: n0, ...g }));
  await page.close();
  await c.close();
}

// ------------------------------------------------------------------ Điện thoại 375×812
{
  const c = await newContext(375, 812);
  const page = await open(c);
  const top = await noHScroll(page);
  check('375: no horizontal scroll with the Codex button in the top bar', top.sw <= top.iw, JSON.stringify(top));
  const btn = await page.locator('.btn--codex').boundingBox();
  check('375: Codex button ≥ 44 × 44 px', btn.width >= 44 && btn.height >= 44, JSON.stringify(btn));
  await page.locator('.btn--codex').click();
  await page.waitForSelector('#dlg-codex[open] .cdx-card');
  await page.waitForTimeout(300);
  const grid = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.cdx-tile')].map((t) => t.getBoundingClientRect());
    const cards = [...document.querySelectorAll('.cdx-card')].filter((el) => el.getClientRects().length).map((el) => el.getBoundingClientRect());
    const strip = document.querySelector('.cdx-tiles');
    return {
      catview: getComputedStyle(document.querySelector('.cdx-catview')).display,
      page: getComputedStyle(document.querySelector('.cdx-page')).display,
      tilesOneRow: new Set(tiles.map((r) => Math.round(r.top))).size === 1,
      tileH: Math.min(...tiles.map((r) => r.height)),
      stripScrolls: strip.scrollWidth > strip.clientWidth && getComputedStyle(strip).overflowX === 'auto',
      cols: new Set(cards.map((r) => Math.round(r.left))).size,
      cardW: Math.round(cards[0].width),
      cardH: Math.min(...cards.map((r) => r.height)),
    };
  });
  check('375: opens on the card grid (reading pane hidden)', grid.catview !== 'none' && grid.page === 'none', JSON.stringify({ catview: grid.catview, page: grid.page }));
  check('375: category tiles form one horizontal strip that scrolls inside itself; tiles ≥ 44 px tall', grid.tilesOneRow && grid.stripScrolls && grid.tileH >= 44, JSON.stringify({ row: grid.tilesOneRow, scrolls: grid.stripScrolls, h: grid.tileH }));
  check('375: the cards use a 2-column grid; cards ≥ 44 px tall', grid.cols === 2 && grid.cardW >= 140 && grid.cardH >= 44, JSON.stringify({ cols: grid.cols, w: grid.cardW, h: grid.cardH }));
  const h1 = await noHScroll(page);
  check('375: no horizontal scroll with the card grid open', h1.sw <= h1.iw, JSON.stringify(h1));
  const f1 = await minFont(page);
  check('375: 13 px floor on the grid', f1.min >= 13, JSON.stringify(f1));
  await page.screenshot({ path: `${SHOTS}codex-grid-375.png` });
  await openEntry(page, 'altaz');
  await page.waitForTimeout(200);
  const read = await page.evaluate(() => ({ nav: getComputedStyle(document.querySelector('.cdx-nav')).display, catview: getComputedStyle(document.querySelector('.cdx-catview')).display, back: getComputedStyle(document.querySelector('.cdx-page__back')).display, backH: document.querySelector('.cdx-page__back').getBoundingClientRect().height, pw: document.querySelector('.cdx-page').scrollWidth, cw: document.querySelector('.cdx-page').clientWidth }));
  check('375: entry replaces the tiles and grid, with a ≥ 44 px back control', read.nav === 'none' && read.catview === 'none' && read.back !== 'none' && read.backH >= 44, JSON.stringify(read));
  const h2 = await noHScroll(page);
  check('375: no horizontal scroll while reading an entry', h2.sw <= h2.iw && read.pw <= read.cw + 1, JSON.stringify({ ...h2, pw: read.pw, cw: read.cw }));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}codex-375.png` });
  // fix-1: một cột ở 375 px — hình đầu trang trước câu dẫn, số liệu sau bài; không cuộn ngang.
  await openEntry(page, 'betelgeuse');
  await page.waitForTimeout(300);
  const one = await page.evaluate(() => {
    const r = (sel) => document.querySelector(sel).getBoundingClientRect();
    const fig = r('.cdx-figure');
    const lede = r('.cdx-page__lede');
    const facts = r('.cdx-facts');
    const body = r('.cdx-page__body');
    return { figAboveLede: fig.bottom <= lede.top, factsBelowBody: facts.top >= body.bottom, sameColumn: Math.abs(fig.left - lede.left) < 2 && Math.abs(facts.left - lede.left) < 2, sw: document.documentElement.scrollWidth, iw: innerWidth, pw: document.querySelector('.cdx-page').scrollWidth, cw: document.querySelector('.cdx-page').clientWidth };
  });
  check('375: one column — header visual above the lede, facts after the text', one.figAboveLede && one.factsBelowBody && one.sameColumn, JSON.stringify(one));
  check('375: no horizontal scroll on a star entry with facts', one.sw <= one.iw && one.pw <= one.cw + 1, JSON.stringify(one));
  const f2 = await minFont(page);
  check('375: 13 px floor on a star entry (diagram labels included)', f2.min >= 13, JSON.stringify(f2));
  await page.screenshot({ path: `${SHOTS}codex-375-star.png`, fullPage: false });
  await openEntry(page, 'altaz');
  await page.locator('.cdx-page__back').click();
  const back = await page.evaluate(() => ({ nav: getComputedStyle(document.querySelector('.cdx-nav')).display, catview: getComputedStyle(document.querySelector('.cdx-catview')).display, focus: document.activeElement?.dataset.entry }));
  check('375: back returns to the grid and focuses the card', back.nav !== 'none' && back.catview !== 'none' && back.focus === 'altaz', JSON.stringify(back));
  await page.close();
  await c.close();
}

await browser.close();
const real = errors.filter((e) => !/favicon|WebGL|GPU stall|swiftshader/i.test(e));
check('no page errors', real.length === 0, real.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
