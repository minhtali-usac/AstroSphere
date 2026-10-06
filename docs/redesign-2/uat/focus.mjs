// Bố cục tập trung của chế độ Đầy đủ (owner decision 2026-10-05, docs/redesign-2/focus-layout.md).
//
// Chạy trên máy chủ phát triển (cần window.__app / window.__perf):
//   npx vite --port 5203 --strictPort (nền), rồi UAT_URL=http://localhost:5203/?quality=fixed node docs/redesign-2/uat/focus.mjs
// Ảnh chụp: docs/redesign-2/shots/focus-1440.png, focus-expanded-1440.png, focus-1280.png.
import { mkdirSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const URL = process.env.UAT_URL ?? 'http://localhost:5203/?quality=fixed';
const SHOTS = new globalThis.URL('../shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

/** Đầy đủ, Usui-chan đã chào; đồng hồ cố định để ảnh chụp lặp lại được; giảm chuyển động = không tự chạy. */
async function open(width, height, { mode = 'full', url = URL } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  await ctx.addInitScript((m) => {
    try {
      localStorage.setItem('astrosphere.mode.v1', JSON.stringify(m));
      localStorage.setItem('astrosphere.guide.v1', JSON.stringify({ hello: true }));
    } catch {
      /* bỏ qua */
    }
  }, mode);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.clock.setFixedTime(new Date('2026-10-05T13:00:00Z'));
  await page.goto(url);
  await page.waitForFunction(() => window.__app?.horizon && window.__perf?.views, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  return { ctx, page };
}

const rect = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom, display: getComputedStyle(el).display };
  }, sel);
const toggle = (page, area) =>
  page.evaluate((a) => {
    const b = document.querySelector(`.focus-toggle--${a}`);
    const r = b.getBoundingClientRect();
    return {
      expanded: b.getAttribute('aria-expanded'),
      controls: b.getAttribute('aria-controls'),
      controlsExists: !!document.getElementById(b.getAttribute('aria-controls') ?? ''),
      guide: b.dataset.guide,
      text: b.textContent.trim(),
      w: r.width,
      h: r.height,
      visible: r.width > 0 && getComputedStyle(b).display !== 'none',
    };
  }, area);
const visibleCells = (page) =>
  page.evaluate(() => [...document.querySelectorAll('.databar .data__item')].filter((c) => c.getBoundingClientRect().width > 0).map((c) => c.dataset.emphasis));
const noHScroll = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));

// ------------------------------------------------------------------ 1440 × 900: mặc định (cả hai vùng đóng)
{
  const { ctx, page } = await open(1440, 900);
  const hz = await rect(page, '#view-horizon');
  const sp = await rect(page, '#view-sphere');
  const share = (hz.w * hz.h) / (1440 * 900);
  check('1440: horizon card covers at least half of the frame', share >= 0.5, `share=${(share * 100).toFixed(1)}% box=${JSON.stringify([hz.x, hz.y, hz.r, hz.b].map(Math.round))}`);
  check('1440: horizon card is at least 2× the sphere card in width and area', hz.w >= 2 * sp.w && hz.w * hz.h >= 2 * sp.w * sp.h, `width ×${(hz.w / sp.w).toFixed(2)}, area ×${((hz.w * hz.h) / (sp.w * sp.h)).toFixed(2)}`);
  check('1440: horizon left, sphere right, same height', hz.x < sp.x && Math.abs(hz.h - sp.h) < 1, JSON.stringify({ hz: hz.h, sp: sp.h }));
  const fold = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const bar = await rect(page, '.focusbar');
  check('1440: views, legend and data strip all fit in the first screen', bar.b <= 900 && bar.display === 'flex', `bar bottom=${bar.b} overflowBelow=${fold}`);

  for (const area of ['data', 'panels']) {
    const tg = await toggle(page, area);
    check(`1440: "${tg.text}" toggle is a visible 44 px target, collapsed, with aria-controls and a guide key`, tg.visible && tg.h >= 44 && tg.w >= 44 && tg.expanded === 'false' && tg.controlsExists && tg.guide === (area === 'data' ? 'focusData' : 'focusPanels'), JSON.stringify(tg));
  }
  const panels0 = await rect(page, '#panels');
  check('1440: control panels start hidden', panels0.display === 'none', panels0.display);

  // Dải thu gọn (quyết định 2026-10-05): φ = độ cao thiên cực đã ở dòng chú thích dưới giản đồ chân trời, nên dải chỉ
  // còn LST và đối tượng đang chọn; câu nghĩa ẩn.
  const cells0 = await visibleCells(page);
  const strip = await page.evaluate(() => ({
    key: document.querySelector('#view-horizon .view__key')?.textContent.match(/φ = 21,03° B\s+·\s+Độ cao thiên cực Bắc = 21,03°/)?.[0] ?? '',
    sel: document.querySelector('[data-emphasis=selected] .data__v').textContent,
    notes: [...document.querySelectorAll('.databar .data__n')].filter((n) => n.getBoundingClientRect().width > 0).length,
    // Số hàng: gom các ô có mép trên lệch nhau ≤ 4 px (hai ô cùng hàng có thể lệch 1 px do khác chiều cao chữ).
    lines: [...document.querySelectorAll('.databar .data__item')].filter((c) => c.getBoundingClientRect().width > 0).map((c) => c.getBoundingClientRect().top).sort((a, b) => a - b).reduce((rows, y) => (rows.length && y - rows[rows.length - 1] <= 4 ? rows : [...rows, y]), []).length,
  }));
  check('compact strip shows LST then the selected object, on one line, no captions; φ and the pole altitude are not repeated', cells0.join() === 'lst,selected' && /^Polaris:/.test(strip.sel) && strip.notes === 0 && strip.lines === 1, JSON.stringify({ cells0, ...strip }));
  check('φ = pole altitude stays visible in the horizon view caption', strip.key !== '', strip.key);

  // Tô sáng liên kết vẫn chạy trong dải thu gọn (ô LST → kinh tuyến và vòng giờ 0h).
  await page.locator('.databar [data-emphasis=lst]').hover();
  await page.waitForFunction(() => window.__app.store.state.emphasis === 'meridian', null, { timeout: 5000 }).catch(() => {});
  check('compact strip: hovering the LST cell lights the meridian (emphasis "meridian")', await page.evaluate(() => window.__app.store.state.emphasis === 'meridian'));
  await page.mouse.move(700, 20);

  // Thiên cầu vẫn vẽ (cột phụ, không bị ẩn).
  const calls0 = await page.evaluate(() => window.__perf.views.sphere.renderer.info.render);
  check('sphere view draws in the focus layout (non-zero draw calls)', calls0.calls > 0 && calls0.frame > 0, JSON.stringify({ calls: calls0.calls, frame: calls0.frame }));

  await page.screenshot({ path: `${SHOTS}focus-1440.png` });
  check('1440: no horizontal scroll (collapsed)', (await noHScroll(page)).sw <= 1440, JSON.stringify(await noHScroll(page)));

  // Mở dải số liệu.
  await page.locator('.focus-toggle--data').click();
  await page.waitForTimeout(300);
  const tgData = await toggle(page, 'data');
  const cells1 = await visibleCells(page);
  check('"Số liệu" toggle expands the full data bar (aria-expanded=true, all cells with captions)', tgData.expanded === 'true' && cells1.length >= 7 && cells1.slice(0, 3).join() === 'lat,pole,incl', `${tgData.expanded} ${cells1.join()}`);
  // Tô sáng liên kết sau khi mở: ô góc xích đạo (chỉ có trong dải đầy đủ).
  await page.locator('.databar [data-emphasis=incl]').hover();
  await page.waitForFunction(() => window.__app.store.state.emphasis === 'incl', null, { timeout: 5000 }).catch(() => {});
  const incl = await page.evaluate(() => ({ emphasis: window.__app.store.state.emphasis, linked: document.querySelector('.databar [data-emphasis=incl]').classList.contains('is-linked') }));
  check('expanded data bar: hovering the equator-angle cell lights its geometry (linked highlight)', incl.emphasis === 'incl' && incl.linked, JSON.stringify(incl));
  await page.mouse.move(700, 20);

  // Mở bảng điều khiển: cột phải, có thanh thẻ, khung nhìn hẹp lại nhưng vẫn vẽ.
  const frameBefore = await page.evaluate(() => window.__perf.views.sphere.renderer.info.render.frame);
  await page.locator('.focus-toggle--panels').click();
  await page.waitForTimeout(800);
  const tgPanels = await toggle(page, 'panels');
  const pn = await rect(page, '#panels');
  const hz2 = await rect(page, '#view-horizon');
  const sp2 = await rect(page, '#view-sphere');
  check('"Bảng điều khiển" toggle opens the panels as a right column (aria-expanded=true)', tgPanels.expanded === 'true' && pn.display === 'flex' && pn.x > sp2.r && pn.b <= 900, JSON.stringify({ expanded: tgPanels.expanded, panels: [pn.x, pn.y, pn.r, pn.b].map(Math.round) }));
  check('panels column has the four panel tabs and shows one panel', await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.paneltabs [role=tab]')].filter((t) => t.getBoundingClientRect().width > 0);
    const shown = [...document.querySelectorAll('.panels > .panel')].filter((p) => p.getBoundingClientRect().height > 0);
    return tabs.length === 4 && tabs.every((t) => t.getBoundingClientRect().height >= 44) && shown.length === 1;
  }));
  await page.locator('.paneltabs .tab[data-panel=display]').click();
  check('clicking a panel tab switches the visible panel', await page.locator('#panel-display').isVisible());
  await page.locator('.paneltabs .tab[data-panel=display]').click();
  check('clicking the active tab again does not collapse the panel (the toggle does that)', await page.locator('#panel-display').isVisible());
  check('with both areas open the horizon view is still the largest card', hz2.w * hz2.h > 2 * sp2.w * sp2.h, `horizon ${Math.round(hz2.w)}×${Math.round(hz2.h)}, sphere ${Math.round(sp2.w)}×${Math.round(sp2.h)}`);
  const frameAfter = await page.evaluate(() => window.__perf.views.sphere.renderer.info.render);
  check('sphere view redraws after the layout change (frame count rises, draw calls > 0)', frameAfter.frame > frameBefore && frameAfter.calls > 0, JSON.stringify({ before: frameBefore, after: frameAfter.frame, calls: frameAfter.calls }));
  check('1440: no horizontal scroll (expanded)', (await noHScroll(page)).sw <= 1440, JSON.stringify(await noHScroll(page)));
  await page.screenshot({ path: `${SHOTS}focus-expanded-1440.png` });

  // Trạng thái nhớ trong phiên (sessionStorage), qua tải lại trang.
  const stored = await page.evaluate(() => sessionStorage.getItem('astrosphere.focus.v1'));
  await page.reload();
  await page.waitForFunction(() => window.__app?.horizon, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const re = { data: (await toggle(page, 'data')).expanded, panels: (await toggle(page, 'panels')).expanded };
  check('open/closed state is kept in sessionStorage across a reload', stored === '{"data":true,"panels":true}' && re.data === 'true' && re.panels === 'true', JSON.stringify({ stored, re }));

  // Thu gọn lại bằng bàn phím (Enter trên nút).
  await page.locator('.focus-toggle--panels').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const closed = { aria: (await toggle(page, 'panels')).expanded, display: (await rect(page, '#panels')).display, focus: await page.evaluate(() => document.activeElement?.classList.contains('focus-toggle--panels')) };
  check('Enter on the focused toggle collapses the panels; focus stays on the toggle', closed.aria === 'false' && closed.display === 'none' && closed.focus, JSON.stringify(closed));

  // Trình chiếu: không còn bố cục tập trung (hai nút ẩn, dải số liệu và bảng ẩn như trước).
  await page.keyboard.press('f');
  await page.waitForTimeout(500);
  const pres = await page.evaluate(() => ({
    present: document.body.classList.contains('present'),
    toggles: [...document.querySelectorAll('.focus-toggle')].map((b) => getComputedStyle(b).display),
    databar: getComputedStyle(document.querySelector('.databar')).display,
  }));
  check('presentation mode: toggles hidden, data bar hidden as before', pres.present && pres.toggles.every((d) => d === 'none') && pres.databar === 'none', JSON.stringify(pres));
  await page.keyboard.press('f');
  await ctx.close();
}

// ------------------------------------------------------------------ 1280 × 800 (mặc định) và các bề ngang khác
{
  const { ctx, page } = await open(1280, 800);
  const hz = await rect(page, '#view-horizon');
  const sp = await rect(page, '#view-sphere');
  check('1280: horizon dominant (≥ 2× sphere width), toggles shown', hz.w >= 2 * sp.w && (await toggle(page, 'data')).visible, `×${(hz.w / sp.w).toFixed(2)}`);
  await page.screenshot({ path: `${SHOTS}focus-1280.png` });
  check('1280: no horizontal scroll', (await noHScroll(page)).sw <= 1280, JSON.stringify(await noHScroll(page)));
  await page.locator('.focus-toggle--panels').click();
  await page.locator('.focus-toggle--data').click();
  await page.waitForTimeout(400);
  check('1280: no horizontal scroll with both areas open', (await noHScroll(page)).sw <= 1280, JSON.stringify(await noHScroll(page)));
  await ctx.close();
}
for (const [w, hgt] of [
  [1101, 760],
  [1024, 768],
]) {
  const { ctx, page } = await open(w, hgt);
  const tg = await toggle(page, 'data');
  const db = await rect(page, '.databar');
  if (w >= 1101) check(`${w}: focus layout applies (toggles shown)`, tg.visible, JSON.stringify(tg));
  else check(`${w}: below 1101 px the previous layout is kept (no toggles, full data bar shown)`, !tg.visible && db.display !== 'none' && (await visibleCells(page)).length >= 7, JSON.stringify({ toggle: tg.visible, cells: (await visibleCells(page)).length }));
  check(`${w}: no horizontal scroll`, (await noHScroll(page)).sw <= w, JSON.stringify(await noHScroll(page)));
  await ctx.close();
}

// ------------------------------------------------------------------ Cơ bản và điện thoại: không đổi
{
  const { ctx, page } = await open(1440, 900, { mode: 'simple' });
  const st = await page.evaluate(() => ({
    toggles: [...document.querySelectorAll('.focus-toggle')].map((b) => getComputedStyle(b).display),
    databar: getComputedStyle(document.querySelector('.databar')).display,
    panels: getComputedStyle(document.querySelector('.panels')).display,
  }));
  check('Simple mode 1440: no focus toggles; data bar and panels stay hidden as before', st.toggles.every((d) => d === 'none') && st.databar === 'none' && st.panels === 'none', JSON.stringify(st));
  await ctx.close();
}
{
  const { ctx, page } = await open(375, 812);
  const st = await page.evaluate(() => ({
    toggles: [...document.querySelectorAll('.focus-toggle')].map((b) => getComputedStyle(b).display),
    tabs: getComputedStyle(document.querySelector('.viewtabs')).display,
    cells: [...document.querySelectorAll('.databar .data__item')].filter((c) => c.getBoundingClientRect().width > 0).length,
    sw: document.documentElement.scrollWidth,
  }));
  check('Full 375: no focus toggles, view tabs and full data bar as before, no horizontal scroll', st.toggles.every((d) => d === 'none') && st.tabs !== 'none' && st.cells >= 7 && st.sw <= 375, JSON.stringify(st));
  await page.locator('.viewtabs [data-view=sphere]').click();
  await page.waitForTimeout(300);
  check('Full 375: the view tabs still switch to the sphere', await page.locator('#view-sphere').isVisible());
  await ctx.close();
}

await browser.close();
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `FOCUS FAIL (${failed.length}/${results.length})` : `FOCUS PASS (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
