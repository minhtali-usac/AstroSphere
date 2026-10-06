// UAT: vòng sửa 3, luồng giao diện (docs/redesign-2/review-3.md, các mục #2 và #4–#11). Một nhóm kiểm tra cho mỗi mục.
//   #2  bố cục tập trung mở cả hai nút + đang chọn Sirius: thiên cầu ≥ 220 px (1440 × 900, 1280 × 800)
//   #4  lời chào trên điện thoại mở đầu bằng "chạm vào một ngôi sao" (hồ sơ trống: KHÔNG đặt sẵn lời chào)
//   #5  hộp "Đặt lại mô phỏng?": mở bằng chuột, tiêu điểm ở "Hủy" và có vòng tiêu điểm
//   #6  thanh trên của Đầy đủ ở 375 px: ≤ 104 px, nút ≥ 44 px, không cuộn ngang, "Ôn tập" có biểu tượng + chữ (fix-4 #5)
//   #7  thẻ đã đọc có dấu không dựa vào màu; giảm chuyển động: viên "Đã mở khóa" không có hoạt ảnh
//   #8  chú thích "?" của "Trạng thái": ba chấm màu vùng + ba chữ
//   #9  chấm địa điểm trên bản đồ không mang màu vòng thẳng đứng (hồng)
//   #10 ghi chú dòng của thẻ ≥ 14 px; gợi ý dưới giản đồ và bộ đếm, chú thích hình của USACodex ≥ 13 px
//   #11 thẻ dài hơn vùng của nó có has-more + "↓ Còn nữa"; cuộn tới đáy thì không
// Cần máy chủ DEV (window.__app, import '/src/…'):
//   npx vite --port 5192 --strictPort (nền), rồi
//   UAT_URL='http://localhost:5192/?quality=fixed' node docs/redesign-2/uat/fix-3-ui.mjs
import { readFileSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { expandFocus, showPanel } from './focus-helpers.mjs';

const URL = process.env.UAT_URL ?? 'http://localhost:5192/?quality=fixed';
const VI = JSON.parse(readFileSync(new globalThis.URL('../../../src/i18n/vi.json', import.meta.url), 'utf8'));
const SIRIUS = 32349;
const VERTICAL = [0xf4, 0x72, 0xb6]; // scene/colors.ts › vertical (hồng: vòng thẳng đứng, độ cao)
const ZONES = ['rgb(139, 92, 246)', 'rgb(20, 184, 166)', 'rgb(239, 68, 68)']; // --zone-circumpolar / riseset / neverrise

const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

async function open({ width = 1440, height = 900, reducedMotion = 'no-preference', mode = 'full', hello = true, touch = false, session = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript(
    ({ mode, hello, session }) => {
      try {
        localStorage.setItem('astrosphere.mode.v1', JSON.stringify(mode));
        localStorage.setItem('astrosphere.hint.v1', 'true');
        if (hello) localStorage.setItem('astrosphere.guide.v1', JSON.stringify({ hello: true }));
        for (const [k, v] of Object.entries(session)) sessionStorage.setItem(k, v);
      } catch {}
    },
    { mode, hello, session },
  );
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  await page.waitForFunction(() => window.__app?.horizon && window.__app?.sphere, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  return { ctx, page };
}

const select = async (page, hip) => {
  await page.evaluate(async (hip) => {
    const { store, actions } = window.__app;
    const { selectCatalogHip } = await import('/src/scenario.ts');
    selectCatalogHip({ store, actions }, hip);
  }, hip);
  await page.waitForTimeout(400);
};

const rect = (page, sel) =>
  page.evaluate((sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  }, sel);

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// ------------------------------------------------------------------ #2 Thiên cầu không bị ép
for (const [w, h] of [
  [1440, 900],
  [1280, 800],
]) {
  const { ctx, page } = await open({ width: w, height: h, session: { 'astrosphere.focus.v1': JSON.stringify({ data: true, panels: true }) } });
  await expandFocus(page, { data: true, panels: true });
  await select(page, SIRIUS);
  const canvas = await rect(page, '#view-sphere .view__canvas');
  const card = await rect(page, '.infocard');
  const st = await page.evaluate(() => ({ data: document.body.classList.contains('focus-data-open'), panels: document.body.classList.contains('focus-panels-open'), card: !document.querySelector('.infocard').classList.contains('is-collapsed') }));
  check(`#2 ${w}×${h}: both toggles open + Sirius → sphere canvas ≥ 220 px, card below it`, st.data && st.panels && st.card && canvas.h >= 220 && card.y >= canvas.y + canvas.h, JSON.stringify({ st, canvas, card }));
  await ctx.close();
}

// ------------------------------------------------------------------ #4 Lời chào trên điện thoại
{
  const { ctx, page } = await open({ width: 375, height: 812, touch: true, mode: 'simple', hello: false });
  await page.waitForSelector('.guide-hello--toast', { timeout: 15000 });
  await page.waitForTimeout(300);
  const text = await page.locator('.guide-hello--toast .guide-hello__title').textContent();
  const toast = await rect(page, '.guide-hello--toast');
  const chip = await rect(page, '.infocard');
  const foot = await rect(page, '#view-horizon .view__foot');
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check('#4 375: the hello toast leads with the first action ("ngôi sao") and matches guide.helloShort', text === VI.guide.helloShort && /^Chào bạn! Thử chạm vào một ngôi sao/.test(text), text);
  check('#4 375: the toast covers neither the selection chip nor the φ readout; no horizontal scroll', !overlaps(toast, chip) && !overlaps(toast, foot) && sw <= 375, JSON.stringify({ toast, chip, foot, sw }));
  await ctx.close();
}

// ------------------------------------------------------------------ #5 Hộp xác nhận Đặt lại
{
  const { ctx, page } = await open();
  await page.locator('.btn--top-reset').click();
  await page.waitForTimeout(300);
  const d = await page.evaluate(() => {
    const a = document.activeElement;
    const cs = getComputedStyle(a);
    return { title: document.getElementById('dlg-reset-title')?.textContent, active: a.textContent.trim(), outline: cs.outlineStyle, color: cs.outlineColor, width: cs.outlineWidth };
  });
  check('#5 title is "Đặt lại mô phỏng?"', d.title === 'Đặt lại mô phỏng?', d.title);
  check('#5 opened by mouse click: focus on "Hủy" with a visible orange ring (outline ≠ none)', d.active === 'Hủy' && d.outline !== 'none' && d.color === 'rgb(255, 138, 76)' && parseFloat(d.width) >= 2, JSON.stringify(d));
  await page.keyboard.press('Escape');
  await ctx.close();
}

// ------------------------------------------------------------------ #6 Thanh trên của Đầy đủ trên điện thoại
{
  const { ctx, page } = await open({ width: 375, height: 812, touch: true });
  const top = await page.evaluate(() => {
    const bar = document.querySelector('.topbar').getBoundingClientRect();
    const btns = [...document.querySelectorAll('.topbar button, .topbar .modeswitch__opt')]
      .filter((b) => getComputedStyle(b).display !== 'none')
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { name: b.getAttribute('aria-label') || b.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) };
      });
    const learn = document.querySelector('.btn--top-main');
    const reset = document.querySelector('.btn--top-reset');
    return {
      h: Math.round(bar.height),
      sw: document.documentElement.scrollWidth,
      btns,
      learnName: learn.getAttribute('aria-label'),
      learnText: getComputedStyle(learn.querySelector('.btn__text')).display,
      learnIcon: !!learn.querySelector('.btn__icon svg'),
      learnBorder: getComputedStyle(learn).borderTopColor,
      resetBorder: getComputedStyle(reset).borderTopColor,
    };
  });
  check('#6 375 Full: header ≤ 104 px tall, no horizontal scroll', top.h <= 104 && top.sw <= 375, `h=${top.h} sw=${top.sw}`);
  check('#6 375 Full: every header button ≥ 44 × 44 px', top.btns.length >= 7 && top.btns.every((b) => b.w >= 44 && b.h >= 44), JSON.stringify(top.btns));
  // fix-4 #5 (review-4): mọi nút trên thanh có chữ chú thích dưới biểu tượng, nên "Ôn tập" không còn chỉ là biểu tượng.
  check('#6 375 Full: "Ôn tập" has its pencil icon plus a visible caption (fix-4 #5), same border as its neighbours', top.learnName === 'Ôn tập' && top.learnText !== 'none' && top.learnIcon && top.learnBorder === top.resetBorder, JSON.stringify({ name: top.learnName, text: top.learnText, icon: top.learnIcon, b: top.learnBorder, rb: top.resetBorder }));
  await ctx.close();
}

// ------------------------------------------------------------------ #7 Mở khóa trong USACodex, trạng thái đã đọc; #10 cỡ chữ USACodex
for (const reducedMotion of ['no-preference', 'reduce']) {
  const { ctx, page } = await open({ reducedMotion });
  await select(page, SIRIUS);
  await page.locator('.btn--codex').click();
  await page.waitForTimeout(900);
  await page.locator('.cdx-card[data-state="new"]').first().click();
  await page.waitForTimeout(150);
  const pill = await page.evaluate(() => {
    const l = document.querySelector('.cdx-unlocked');
    const bar = getComputedStyle(document.querySelector('.cdx-progress__bar'), '::before');
    return { text: l?.textContent ?? null, anim: l ? getComputedStyle(l).animationName : null, op: l ? getComputedStyle(l).opacity : null, barTransition: bar.transitionDuration };
  });
  const fonts = await page.evaluate(() => ({ caption: parseFloat(getComputedStyle(document.querySelector('.cdx-figure figcaption')).fontSize) }));
  await page.waitForTimeout(1100);
  await page.locator('.cdx-page__back').click();
  await page.waitForTimeout(300);
  const read = await page.evaluate(() => {
    const c = document.querySelector('.cdx-card[data-state="read"]');
    if (!c) return null;
    const mark = c.querySelector('.cdx-card__mark svg path');
    const st = c.querySelector('.cdx-card__state');
    const r = st.getBoundingClientRect();
    return { glyph: !!mark, text: st.textContent, visible: r.width > 20 && r.height > 8, meta: parseFloat(getComputedStyle(c.querySelector('.cdx-card__meta')).fontSize) };
  });
  const count = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.cdx-catview__count')).fontSize));
  if (reducedMotion === 'no-preference') {
    check('#7 the "Đã mở khóa" pill gets a one-time glow; progress bars ease (0.4 s)', pill.text === 'Đã mở khóa' && /cdx-pill-glow/.test(pill.anim) && pill.barTransition === '0.4s', JSON.stringify(pill));
    check('#7 a read card has a non-colour cue: ✓ glyph plus a visible "đã đọc"', read && read.glyph && read.visible && read.text === 'đã đọc', JSON.stringify(read));
    check('#10 USACodex: card state line, "x/y đã khám phá" and diagram caption ≥ 13 px', read.meta >= 13 && count >= 13 && fonts.caption >= 13, JSON.stringify({ meta: read.meta, count, caption: fonts.caption }));
  } else {
    check('#7 reduced motion: the "Đã mở khóa" pill has no animation (shown at once); bars do not ease', pill.text === 'Đã mở khóa' && pill.anim === 'none' && pill.op === '1' && pill.barTransition === '0s', JSON.stringify(pill));
  }
  await ctx.close();
}

// ------------------------------------------------------------------ #8 Chú thích "?" của Trạng thái; #10 ghi chú dòng; #11 dấu "Còn nữa"
{
  const { ctx, page } = await open();
  await select(page, SIRIUS);
  // #11: thẻ trong cột thiên cầu dài hơn vùng của nó.
  const more0 = await page.evaluate(() => {
    const c = document.querySelector('.infocard');
    const b = c.querySelector('.infocard__more-btn');
    return { cls: c.classList.contains('has-more'), over: c.scrollHeight > c.clientHeight, cue: b.textContent, cueShown: b.getBoundingClientRect().height > 0, guide: b.dataset.guide };
  });
  check('#11 an overflowing card has has-more and shows "↓ Còn nữa" (with a guide key)', more0.over && more0.cls && more0.cueShown && more0.cue === VI.info.more && more0.guide === 'infoMore', JSON.stringify(more0));
  await page.evaluate(() => {
    const c = document.querySelector('.infocard');
    c.scrollTop = c.scrollHeight;
  });
  // Sự kiện scroll đến ở khung hình sau (swiftshader có thể chậm): chờ trạng thái thay vì một khoảng cố định.
  await page.waitForFunction(() => !document.querySelector('.infocard').classList.contains('has-more'), null, { timeout: 3000 }).catch(() => {});
  const more1 = await page.evaluate(() => {
    const c = document.querySelector('.infocard');
    return { cls: c.classList.contains('has-more'), cueShown: c.querySelector('.infocard__more-btn').getBoundingClientRect().height > 0 };
  });
  check('#11 scrolled to the bottom: no has-more, no cue', !more1.cls && !more1.cueShown, JSON.stringify(more1));
  await page.evaluate(() => (document.querySelector('.infocard').scrollTop = 0));
  const back = await page
    .waitForFunction(() => document.querySelector('.infocard').classList.contains('has-more'), null, { timeout: 3000 })
    .then(() => true, () => false);
  check('#11 scrolled back up: has-more returns', back);

  // #10
  const sizes = await page.evaluate(() => ({
    notes: [...document.querySelectorAll('.infocard .kv__note')].map((e) => parseFloat(getComputedStyle(e).fontSize)),
    hint: parseFloat(getComputedStyle(document.querySelector('#view-horizon .view__hint')).fontSize),
  }));
  check('#10 info-card row notes ≥ 14 px; horizon hint caption ≥ 13 px', sizes.notes.length >= 5 && sizes.notes.every((f) => f >= 14) && sizes.hint >= 13, JSON.stringify(sizes));

  // #8
  const term = page.locator('[data-emphasis="status"] .term');
  await term.hover();
  await page.waitForTimeout(200);
  const key = await page.evaluate(() => {
    const k = document.querySelector('.status-key');
    const items = [...k.querySelectorAll('.status-key__item')].map((i) => {
      const dot = getComputedStyle(i, '::before');
      return { text: i.textContent, dot: dot.backgroundColor, w: parseFloat(dot.width) };
    });
    return { shown: getComputedStyle(k).display !== 'none' && k.getBoundingClientRect().height > 0, items, described: document.querySelector('[data-emphasis="status"] .term').getAttribute('aria-describedby') === k.id };
  });
  const words = [VI.visibility.circumpolar, VI.visibility.riseSet, VI.visibility.neverRise];
  check(
    '#8 the "Trạng thái" ? tip lists three statuses, each a zone-colour dot + its word',
    key.shown && key.described && key.items.length === 3 && key.items.every((it, i) => it.text === words[i] && it.dot === ZONES[i] && it.w >= 8),
    JSON.stringify(key),
  );
  await ctx.close();
}

// ------------------------------------------------------------------ #9 Chấm địa điểm trên bản đồ
{
  const { ctx, page } = await open();
  await showPanel(page, 'location');
  await page.waitForTimeout(400);
  const px = await page.evaluate(() => {
    const cv = document.querySelector('.worldmap__canvas');
    const g = cv.getContext('2d');
    // Trường Sa (8,64° B, 111,92° Đ): giữa biển, xa ghim vị trí hiện tại (Hà Nội).
    const x = Math.round(((111.92 + 180) / 360) * cv.width);
    const y = Math.round(((90 - 8.64) / 180) * cv.height);
    const d = g.getImageData(x - 3, y - 3, 7, 7).data;
    let best = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > best[0] + best[1] + best[2]) best = [d[i], d[i + 1], d[i + 2]];
    const hint = [...document.querySelectorAll('[data-panel="location"] .hint')].map((e) => e.textContent).find((t) => /bản đồ/.test(t)) ?? '';
    return { best, hint };
  });
  const dist = Math.hypot(px.best[0] - VERTICAL[0], px.best[1] - VERTICAL[1], px.best[2] - VERTICAL[2]);
  const neutral = Math.max(...px.best) - Math.min(...px.best) <= 30 && Math.min(...px.best) >= 180;
  check('#9 map place dots are neutral white, not the vertical-circle pink; hint says "Chấm trắng"', neutral && dist > 60 && /Chấm trắng/.test(px.hint), JSON.stringify({ rgb: px.best, dist: Math.round(dist), hint: px.hint }));
  await ctx.close();
}

await browser.close();
check('no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const passed = results.filter(Boolean).length;
console.log(`\nFIX-3 UI ${passed}/${results.length} ${passed === results.length ? 'PASS' : 'FAIL'}`);
process.exit(passed === results.length ? 0 : 1);
