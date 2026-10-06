// Kiểm tra chấp nhận R4: người hướng dẫn Usui-chan (docs/redesign-2/goal.md › R4, docs/redesign-2/guide.md).
//
// Cần máy chủ DEV (window.__app):
//   npx vite --port 5194 --strictPort   (nền), rồi
//   UAT_URL='http://localhost:5194/?quality=fixed' node docs/redesign-2/uat/guide.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { showPanel } from './focus-helpers.mjs';

const URL = process.env.UAT_URL ?? 'http://localhost:5194/?quality=fixed';
const SHOTS = new globalThis.URL('../shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const VI = JSON.parse(readFileSync(new globalThis.URL('../../../src/i18n/vi.json', import.meta.url), 'utf8'));
const TIP = VI.guide.tip;
const KEY = 'astrosphere.guide.v1';

const results = [];
const errors = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

/** Ngữ cảnh mới (bộ nhớ trống = lần đầu vào trang). `init` chạy trước mọi trang. */
async function context({ width = 1440, height = 900, touch = false, init } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    reducedMotion: 'no-preference',
    ...(touch ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  });
  if (init) await ctx.addInitScript(init);
  return ctx;
}
async function open(ctx, url = URL) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.waitForFunction(() => window.__app?.horizon, null, { timeout: 30000 });
  return page;
}
/** Đợi lời chào hiện ra và hoạt ảnh vào chạy xong. */
async function waitHello(page) {
  await page.waitForSelector('.guide-hello', { timeout: 10000 });
  await page.waitForTimeout(1200);
}
/** Phần giải thích tải lười ở lần bấm đầu: đợi trạng thái bật/tắt. */
const waitExplain = (page, on) => page.waitForFunction((v) => document.body.classList.contains('guide-explain') === v, on, { timeout: 10000 });
const helloCount = (page) => page.locator('.guide-hello').count();
const st = (page) => page.evaluate(() => { const s = window.__app.store.state; return { playing: s.playing, rate: s.rate, selected: s.selected, uiMode: s.uiMode }; });
const tipText = (page) => page.evaluate(() => { const t = document.querySelector('.guide-tip'); return t && !t.hidden ? t.querySelector('.guide-tip__text').textContent : null; });
const explaining = (page) => page.evaluate(() => document.body.classList.contains('guide-explain'));
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, vis: getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && r.width > 0 }; }, sel);
const overlaps = (a, b) => !!a && !!b && a.vis && b.vis && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Chân dung không che công cụ khung nhìn, thẻ thông tin (thẻ Polaris) hay các nút của chế độ Cơ bản. */
async function avatarClear(page) {
  const av = await rect(page, '.guide-avatar');
  const others = await page.evaluate(() =>
    [...document.querySelectorAll('.view-tool, .infocard, .simple button, .simple input, .simple label')].map((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return { x: r.x, y: r.y, w: r.width, h: r.height, vis: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && !!e.offsetParent, cls: e.className };
    }),
  );
  return others.filter((o) => overlaps(av, o)).map((o) => o.cls);
}
/** Hộp của các phần tử chữ ĐANG HIỆN khớp `sel` (fix-1: lớp nổi không được đè lên chữ). */
const textBoxes = (page, sel) =>
  page.evaluate((s) =>
    [...document.querySelectorAll(s)].map((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      let vis = cs.display !== 'none' && r.width > 0 && !!e.offsetParent;
      for (let a = e; a && vis; a = a.parentElement) if (getComputedStyle(a).visibility === 'hidden') vis = false;
      return { x: r.x, y: r.y, w: r.width, h: r.height, vis, cls: e.className || e.tagName };
    }), sel);
const SIMPLE_TEXT = '.simple legend, .simple label, .simple p, .simple .infocard, .view__hint, .view__key';
const dragSky = async (page) => {
  const r = await rect(page, '#view-horizon .view__canvas');
  const x = r.x + r.w * 0.3;
  const y = r.y + r.h * 0.35;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y + 20, { steps: 5 });
  await page.mouse.up();
};

// ================================================================== Máy tính 1440×900, lần đầu vào trang
{
  const ctx = await context();
  const page = await open(ctx);
  await waitHello(page);
  const hello = await page.evaluate(() => {
    const el = document.querySelector('.guide-hello');
    return {
      title: el.querySelector('.guide-hello__title').textContent,
      body: el.querySelector('.guide-hello__body').textContent,
      buttons: [...el.querySelectorAll('button')].map((b) => b.textContent),
      focus: document.activeElement === document.body || !el.contains(document.activeElement),
      stored: localStorage.getItem('astrosphere.guide.v1'),
      hint: (() => { const h = document.querySelector('.view__hint.is-new'); return h ? getComputedStyle(h).visibility : 'none'; })(),
      star: el.querySelector('.guide-hello__star')?.textContent ?? '',
      explainBg: getComputedStyle([...el.querySelectorAll('button')].find((b) => b.textContent === 'Giải thích các nút')).backgroundColor,
      accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
      pose: el.classList.contains('guide-hello--pose'),
    };
  });
  check('(hello) a fresh context shows the hello in Simple mode', (await helloCount(page)) === 1 && (await st(page)).uiMode === 'simple');
  check('(hello) title + body introduce Usui-chan as USAC mascot and explain mode', /Usui-chan/.test(hello.body) && /USAC/.test(hello.body) && /chế độ giải thích/.test(hello.body), `${hello.title} ${hello.body}`);
  check('(hello) two buttons: "Giải thích các nút" and "Để sau"', hello.buttons.join('|') === 'Giải thích các nút|Để sau', hello.buttons.join('|'));
  check('(hello) does not steal focus', hello.focus);
  check(`(hello) ${KEY} = {"hello":true} is stored as soon as it shows`, hello.stored === '{"hello":true}', hello.stored);
  // fix-2 #2 (thay cho kiểm tra cũ "dòng gợi ý chờ tới khi lời chào đóng"): dòng gợi ý hiện ngay từ lần đầu.
  check('(fix-2 #2) the first-visit hint caption "Kéo để xoay · bấm vào một ngôi sao" shows while the hello is open', hello.hint === 'visible', hello.hint);
  check('(fix-2 #2) the hello invites a star click: "Thử bấm vào một ngôi sao trên bầu trời nhé!"', hello.star === 'Thử bấm vào một ngôi sao trên bầu trời nhé!', hello.star);
  const hex = (c) => { const m = c.match(/\d+/g); return m ? '#' + m.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, '0')).join('') : c; };
  check('(fix-2 #2) "Giải thích các nút" is a secondary button, not filled orange', hex(hello.explainBg).toLowerCase() !== hello.accent.toLowerCase() && !/rgb\(242, 101, 34\)/.test(hello.explainBg), `${hello.explainBg} vs ${hello.accent}`);
  check('(fix-2 #9) 1440 × 900: the full-figure hello is used (it fits under the card)', hello.pose);
  const av = await page.evaluate(() => { const b = document.querySelector('.guide-avatar'); const r = b.getBoundingClientRect(); return { name: b.getAttribute('aria-label'), w: r.width, h: r.height }; });
  check('(avatar) accessible name "Usui-chan: giải thích các nút", ≥ 44 px', av.name === 'Usui-chan: giải thích các nút' && av.w >= 44 && av.h >= 44, JSON.stringify(av));
  check('(avatar) does not cover view tools, the info card (Polaris chip) or Simple controls', (await avatarClear(page)).length === 0, (await avatarClear(page)).join(', '));
  const hr = await rect(page, '.guide-hello');
  const sky = await rect(page, '#view-horizon .view__canvas');
  check('(hello) does not cover the horizon sky in Simple', !overlaps(hr, sky), JSON.stringify(hr));
  const under = (await textBoxes(page, SIMPLE_TEXT)).filter((b) => overlaps(hr, b)).map((b) => b.cls);
  check('(fix-1 #7) the hello overlaps no visible text (panel footer gives way while it is open)', under.length === 0, under.join(', '));
  // fix-2 #9 (thay cho "thẻ nhường chỗ"): thẻ đang chọn (Polaris) vẫn hiện, và lời chào nằm dưới nó.
  const dockCard = await page.evaluate(() => {
    const c = document.querySelector('.simple__dock .infocard');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    let vis = r.width > 0;
    for (let a = c; a && vis; a = a.parentElement) if (getComputedStyle(a).visibility === 'hidden') vis = false;
    return { vis, bottom: r.bottom, title: c.querySelector('.infocard__title').textContent };
  });
  check('(fix-2 #9) the docked selection card stays visible while the hello is open, and the hello sits below it', !!dockCard && dockCard.vis && dockCard.title === 'Polaris' && hr.y >= dockCard.bottom, JSON.stringify({ dockCard, helloTop: hr.y }));
  const cue0 = await page.evaluate(() => getComputedStyle(document.querySelector('.simple__cue')).display);
  check('(fix-1 #4) the hello replaces the first-action cue: the cue is not shown while the hello is open', cue0 === 'none', cue0);
  await page.screenshot({ path: `${SHOTS}guide-hello-1440.png` });

  // Tải lại: không chào nữa.
  await page.reload();
  await page.waitForFunction(() => window.__app?.horizon, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  check('(hello) after a reload there is no hello', (await helloCount(page)) === 0);
  await ctx.close();
}

// ------------------------------------------------------------------ "Để sau", rồi không có gì tự hiện
{
  const ctx = await context();
  const page = await open(ctx);
  await waitHello(page);
  await page.getByRole('button', { name: 'Để sau' }).click();
  check('(later) "Để sau" dismisses the hello', (await helloCount(page)) === 0);
  check('(later) focus returns to the avatar, not to <body>', await page.evaluate(() => document.activeElement?.classList.contains('guide-avatar')));
  const cue = await page.evaluate(() => {
    const c = document.querySelector('.simple__cue');
    const cs = getComputedStyle(c);
    const step1 = document.querySelector('.simple legend').getBoundingClientRect();
    const r = c.getBoundingClientRect();
    return { text: c.textContent, display: cs.display, color: cs.color, size: parseFloat(cs.fontSize), above: r.bottom <= step1.top };
  });
  check('(fix-1 #4) after "Để sau" the cue "Bấm vào một ngôi sao…" shows above step 1, white, ≥ 15 px', cue.display !== 'none' && /^Bấm vào một ngôi sao trên bầu trời/.test(cue.text) && cue.color === 'rgb(242, 242, 242)' && cue.size >= 15 && cue.above, JSON.stringify(cue));
  const footHint = await page.evaluate(() => [...document.querySelectorAll('.simple__next p')].map((p) => p.textContent));
  check('(fix-1 #4) one cue, not three: the panel footer no longer repeats "Bấm vào một ngôi sao"', footHint.every((x) => !/Bấm vào một ngôi sao/.test(x)), footHint.join(' | '));
  await page.waitForTimeout(5000);
  await dragSky(page);
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({
    hello: !!document.querySelector('.guide-hello'),
    tip: !!document.querySelector('.guide-tip:not([hidden])'),
    banner: !!document.querySelector('.guide-banner:not([hidden])'),
    explain: document.body.classList.contains('guide-explain'),
  }));
  check('(later) nothing appears uninvited after 5 s and a sky drag', !after.hello && !after.tip && !after.banner && !after.explain, JSON.stringify(after));
  check('(fix-1 #4) a drag alone keeps the cue (it asks for a star)', await page.locator('.simple__cue').isVisible());
  await page.evaluate(async () => { const { selectCatalogHip } = await import('/src/scenario.ts'); selectCatalogHip({ store: window.__app.store, actions: window.__app.actions }, 32349); });
  await page.waitForTimeout(200);
  const gone = await page.evaluate(() => ({ hidden: document.querySelector('.simple__cue').hidden, stored: localStorage.getItem('astrosphere.hint.v1') }));
  check('(fix-1 #4) the cue hides after the first star selection, and the hint key is stored', gone.hidden && gone.stored === 'true', JSON.stringify(gone));
  await page.reload();
  await page.waitForFunction(() => window.__app?.horizon, null, { timeout: 30000 });
  check('(fix-1 #4) after a reload the cue stays hidden', await page.evaluate(() => document.querySelector('.simple__cue').hidden));
  await ctx.close();
}

// ------------------------------------------------------------------ Lời chào tự đóng khi chạm bầu trời / Esc
{
  const ctx = await context();
  const page = await open(ctx);
  await waitHello(page);
  await dragSky(page);
  check('(hello) interacting with the sky dismisses the hello', (await helloCount(page)) === 0);
  await ctx.close();

  const ctx2 = await context();
  const page2 = await open(ctx2);
  await waitHello(page2);
  const sel0 = (await st(page2)).selected;
  await page2.keyboard.press('Escape');
  const s1 = await st(page2);
  check('(hello) Esc dismisses the hello and keeps the selection', (await helloCount(page2)) === 0 && JSON.stringify(s1.selected) === JSON.stringify(sel0) && !!sel0, JSON.stringify(s1.selected));
  // Nút "Giải thích các nút" của lời chào vào thẳng chế độ giải thích.
  await ctx2.close();
  const ctx3 = await context();
  const page3 = await open(ctx3);
  await waitHello(page3);
  await page3.getByRole('button', { name: 'Giải thích các nút', exact: true }).click();
  await waitExplain(page3, true).catch(() => {});
  check('(hello) "Giải thích các nút" enters explain mode', (await explaining(page3)) && (await helloCount(page3)) === 0);
  await ctx3.close();
}

// ------------------------------------------------------------------ Chế độ giải thích trên máy tính (Cơ bản rồi Đầy đủ)
const SEEN = () => localStorage.setItem('astrosphere.guide.v1', JSON.stringify({ hello: true }));
{
  const ctx = await context({ init: SEEN });
  const page = await open(ctx);
  await page.waitForTimeout(1500);
  check('(seen) with the key preset there is no hello', (await helloCount(page)) === 0);
  const sel0 = (await st(page)).selected;

  await page.getByRole('button', { name: 'Usui-chan: giải thích các nút' }).click();
  await waitExplain(page, true);
  const on = await page.evaluate(() => ({
    body: document.body.classList.contains('guide-explain'),
    pressed: document.querySelector('.guide-avatar').getAttribute('aria-pressed'),
    banner: document.querySelector('.guide-banner:not([hidden]) .guide-banner__text')?.textContent,
    ring: getComputedStyle(document.querySelector('.guide-avatar')).borderTopColor,
  }));
  check('(explain) clicking the avatar enters explain mode (aria-pressed, orange ring)', on.body && on.pressed === 'true' && on.ring === 'rgb(242, 101, 34)', JSON.stringify(on));
  check('(explain) banner reads "Chế độ giải thích — rê chuột hoặc chạm vào một nút · Esc để thoát"', on.banner === 'Chế độ giải thích — rê chuột hoặc chạm vào một nút · Esc để thoát', on.banner);
  const bannerBox = await rect(page, '.guide-banner');
  const underBanner = (await textBoxes(page, SIMPLE_TEXT)).filter((b) => overlaps(bannerBox, b)).map((b) => b.cls);
  check('(fix-1 #7) the explain banner overlaps no visible text (panel footer, hint caption)', underBanner.length === 0, underBanner.join(', '));

  await page.locator('.btn--codex').hover();
  await page.waitForTimeout(300);
  check('(explain) hovering the Codex button shows the Codex tip', (await tipText(page)) === TIP.codex, await tipText(page));
  const tipBox = await rect(page, '.guide-tip');
  const codexBox = await rect(page, '.btn--codex');
  check('(explain) the bubble is anchored next to the control, on screen', tipBox.y >= codexBox.y + codexBox.h && tipBox.y - (codexBox.y + codexBox.h) < 30 && tipBox.x >= 0 && tipBox.x + tipBox.w <= 1440, JSON.stringify(tipBox));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}guide-explain-1440.png` });

  await page.locator('.simple__play').hover();
  await page.waitForTimeout(200);
  check('(explain) hovering play shows its tip with a Codex link', (await tipText(page)) === TIP.simplePlay && (await page.locator('.guide-tip__codex').isVisible()));
  // Bàn phím: tiêu điểm vào điều khiển cũng hiện lời giải thích.
  await page.focus('.modeswitch input');
  await page.waitForTimeout(200);
  check('(explain) keyboard focus shows the tip too (mode switch)', (await tipText(page)) === TIP.mode, await tipText(page));
  // Chuột vẫn dùng nút như thường.
  const p0 = (await st(page)).playing;
  await page.locator('.simple__play').click();
  check('(explain) on desktop a mouse click still activates the control', (await st(page)).playing === !p0);
  // Khung nhìn 3D có lời giải thích và liên kết Codex mở đúng mục.
  const sky = await rect(page, '#view-horizon .view__canvas');
  await page.mouse.move(sky.x + 40, sky.y + sky.h - 40);
  await page.waitForTimeout(300);
  check('(explain) hovering the horizon view explains it', (await tipText(page)) === TIP.horizonView, await tipText(page));
  await page.locator('.guide-tip__codex').click();
  await page.waitForSelector('#dlg-codex[open] .cdx-page__title', { timeout: 10000 });
  const codexTitle = await page.locator('#dlg-codex .cdx-page__title').textContent();
  check('(explain) "Đọc thêm trong Codex" opens the matching entry', /chân trời/i.test(codexTitle), codexTitle);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('(esc) Esc closes the Codex dialog first; explain mode stays on', !(await page.evaluate(() => document.getElementById('dlg-codex').open)) && (await explaining(page)));
  await page.keyboard.press('Escape');
  const s1 = await st(page);
  check('(esc) next Esc exits explain mode without clearing the selection', !(await explaining(page)) && JSON.stringify(s1.selected) === JSON.stringify(sel0) && !!sel0, JSON.stringify(s1.selected));
  check('(esc) the bubble and banner are gone', (await tipText(page)) === null && !(await page.locator('.guide-banner').isVisible()));

  // Bấm lại chân dung: bật rồi tắt.
  await page.locator('.guide-avatar').click();
  await page.locator('.guide-avatar').click();
  check('(explain) clicking the avatar again exits', !(await explaining(page)));

  // ---- Đầy đủ
  await page.evaluate(() => window.__app.actions.setUiMode('full'));
  await page.waitForTimeout(500);
  check('(full) the avatar is present in Full', await page.locator('.guide-avatar').isVisible());
  check('(full) the avatar does not cover view tools or the Polaris chip', (await avatarClear(page)).length === 0, (await avatarClear(page)).join(', '));
  // Bố cục tập trung (≥ 1101 px): bảng điều khiển thu gọn mặc định — mở bảng Hiển thị trước khi rê chuột lên nó.
  await showPanel(page, 'display');
  await page.locator('.guide-avatar').click();
  await waitExplain(page, true);
  await page.locator('.btn--top-present').hover();
  await page.waitForTimeout(200);
  check('(full) hovering Trình chiếu explains it', (await tipText(page)) === TIP.present, await tipText(page));
  // Dải số liệu thu gọn chỉ còn LST và đối tượng đang chọn (quyết định 2026-10-05).
  await page.locator('.data__item[data-guide="dataLst"] .data__v').hover();
  await page.waitForTimeout(200);
  check('(full) hovering a data-bar cell explains it', (await tipText(page)) === TIP.dataLst, await tipText(page));
  await page.locator('.focus-toggle--panels').hover();
  await page.waitForTimeout(200);
  check('(full) hovering the "Bảng điều khiển" toggle explains it', (await tipText(page)) === TIP.focusPanels, await tipText(page));
  await page.locator('#panel-display summary').first().hover();
  await page.waitForTimeout(200);
  check('(full) hovering a display group explains it', (await tipText(page)) === TIP.displayGroup, await tipText(page));
  await page.locator('#panel-display .term').first().hover();
  await page.waitForTimeout(200);
  check('(full) hovering a codex "?" term link explains it', (await tipText(page)) === TIP.term, await tipText(page));
  // Esc khi đang gõ trong ô nhập: không làm gì. (Bố cục tập trung: chuyển sang thẻ Vị trí; chuột vẫn bấm được khi giải thích.)
  await showPanel(page, 'location');
  await page.locator('#lat-input').click();
  await page.keyboard.press('Escape');
  check('(esc) Esc while typing in an input does not exit explain mode', await explaining(page));
  await page.locator('#lat-input').blur();
  // Trình chiếu: Usui-chan ẩn, chế độ giải thích tắt.
  await page.locator('.btn--top-present').click();
  await page.waitForTimeout(400);
  const pres = await page.evaluate(() => ({
    present: document.body.classList.contains('present'),
    avatar: getComputedStyle(document.querySelector('.guide-avatar')).display,
    explain: document.body.classList.contains('guide-explain'),
  }));
  check('(present) the avatar is hidden in presentation mode and explain mode is off', pres.present && pres.avatar === 'none' && !pres.explain, JSON.stringify(pres));
  await page.keyboard.press('f');
  await page.waitForTimeout(300);
  check('(present) the avatar returns after presentation', await page.locator('.guide-avatar').isVisible());
  await ctx.close();
}

// ------------------------------------------------------------------ Hello trong Đầy đủ (người đã quen trang, chưa từng được chào)
{
  const ctx = await context({ init: () => localStorage.setItem('astrosphere.mode.v1', JSON.stringify('full')) });
  const page = await open(ctx);
  await waitHello(page);
  check('(full) the hello also shows once in Full', (await helloCount(page)) === 1);
  check('(full) no horizontal scroll at 1440 with the hello open', await noHScroll(page));
  const hr = await rect(page, '.guide-hello');
  const hit = [];
  for (const sel of ['#view-horizon .view__canvas', '#view-sphere .view__canvas', '.infocard', '.view-tool']) if (overlaps(hr, await rect(page, sel))) hit.push(sel);
  check('(full) the wide hello covers neither sky nor the Polaris chip', hit.length === 0, hit.join(', ') || JSON.stringify(hr));
  const wideStar = await page.evaluate(() => document.querySelector('.guide-hello__star')?.textContent ?? '');
  check('(fix-2 #2, full) the wide hello carries the star invitation too', wideStar === 'Thử bấm vào một ngôi sao trên bầu trời nhé!', wideStar);
  await ctx.close();
}

// ------------------------------------------------------------------ Giảm chuyển động: mọi thứ hiện ngay
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await open(ctx);
  await page.waitForSelector('.guide-hello', { timeout: 10000 });
  const anim = await page.evaluate(() => ({
    hello: getComputedStyle(document.querySelector('.guide-hello')).animationName,
    avatar: getComputedStyle(document.querySelector('.guide-avatar')).animationName,
    opacity: getComputedStyle(document.querySelector('.guide-hello')).opacity,
  }));
  check('(reduced motion) the hello and the avatar do not animate; the hello is fully visible at once', anim.hello === 'none' && anim.avatar === 'none' && anim.opacity === '1', JSON.stringify(anim));
  await page.getByRole('button', { name: 'Giải thích các nút', exact: true }).click();
  await waitExplain(page, true);
  await page.locator('.btn--codex').hover();
  await page.waitForTimeout(200);
  const tipAnim = await page.evaluate(() => getComputedStyle(document.querySelector('.guide-tip')).animationName);
  check('(reduced motion) the explain bubble appears without animation', tipAnim === 'none', tipAnim);
  await ctx.close();
}

// ================================================================== Điện thoại 375×812, cảm ứng
{
  const ctx = await context({ width: 375, height: 812, touch: true });
  const page = await open(ctx);
  await waitHello(page);
  const hr = await rect(page, '.guide-hello');
  const sky = await rect(page, '#view-horizon .view__canvas');
  // fix-1 #3: không còn tấm đáy; một dải mảnh trong khung nhìn, trên thẻ đang chọn và dòng φ.
  check('(fix-1 #3, 375) the hello is a compact toast: height ≤ 90 px, inside the viewport', hr.h <= 90 && hr.x >= 0 && hr.x + hr.w <= 375 && hr.y >= 0 && hr.y + hr.h <= 812, JSON.stringify(hr));
  const foot = await rect(page, '#view-horizon .view__foot');
  const chip = await rect(page, '.infocard');
  check('(fix-1 #3, 375) the toast overlaps neither the φ readout bar nor the selection chip', !overlaps(hr, foot) && !overlaps(hr, chip) && hr.y + hr.h <= chip.y, JSON.stringify({ hr, foot, chip }));
  check('(fix-1 #3, 375) the toast covers ≤ 15 % of the sky', (hr.w * hr.h) / (sky.w * sky.h) <= 0.15, `${Math.round((100 * hr.w * hr.h) / (sky.w * sky.h))} %`);
  const toast = await page.evaluate(() => ({
    text: document.querySelector('.guide-hello__title').textContent,
    face: !!document.querySelector('.guide-hello .guide-hello__face'),
    fs: parseFloat(getComputedStyle(document.querySelector('.guide-hello__title')).fontSize),
  }));
  // fix-3 #4: lời chào trên điện thoại mở đầu bằng việc đầu tiên nên làm (chạm vào một ngôi sao), như trên máy tính.
  check('(fix-1 #3, fix-3 #4, 375) toast = avatar + "Chào bạn! Thử chạm vào một ngôi sao nhé. Chạm vào mình nếu muốn hỏi về các nút." + ×, text ≥ 15 px', toast.face && toast.text === 'Chào bạn! Thử chạm vào một ngôi sao nhé. Chạm vào mình nếu muốn hỏi về các nút.' && toast.fs >= 15, JSON.stringify(toast));
  check('(375) no horizontal scroll with the hello open', await noHScroll(page));
  const btnH = await page.evaluate(() => [...document.querySelectorAll('.guide-hello button')].map((b) => b.getBoundingClientRect().height));
  check('(375) hello buttons are ≥ 44 px', btnH.every((x) => x >= 44), btnH.join(','));
  await page.getByRole('button', { name: 'Đóng lời chào' }).tap();
  check('(fix-1 #3, 375) × dismisses the toast', (await helloCount(page)) === 0);

  const av = await rect(page, '.guide-avatar');
  check('(375) avatar ≥ 44 px, inside the viewport', av.w >= 44 && av.h >= 44 && av.x >= 0 && av.x + av.w <= 375, JSON.stringify(av));
  check('(375) the avatar does not cover view tools, the info card or controls', (await avatarClear(page)).length === 0, (await avatarClear(page)).join(', '));

  await page.locator('.guide-avatar').tap();
  await waitExplain(page, true).catch(() => {});
  check('(375) tapping the avatar enters explain mode', await explaining(page));
  await page.evaluate(() => window.__app.actions.play());
  const p0 = (await st(page)).playing;
  await page.locator('.simple__play').tap();
  await page.waitForTimeout(300);
  check('(touch) first tap on play shows its tip', (await tipText(page)) === TIP.simplePlay, await tipText(page));
  check('(touch) first tap does NOT toggle playing', (await st(page)).playing === p0, `playing=${(await st(page)).playing}`);
  const tb = await rect(page, '.guide-tip');
  check('(375) the tip fits on screen', tb.x >= 0 && tb.x + tb.w <= 375 && tb.y >= 0 && tb.y + tb.h <= 812, JSON.stringify(tb));
  check('(375) no horizontal scroll in explain mode', await noHScroll(page));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}guide-375.png` });
  await page.locator('.simple__play').tap();
  await page.waitForTimeout(200);
  check('(touch) second tap on the same control activates it', (await st(page)).playing === !p0);

  // "Dùng nút này" trên một điều khiển khác (Nhanh).
  const r0 = (await st(page)).rate;
  await page.locator('.simple__seg', { hasText: 'Nhanh' }).tap();
  await page.waitForTimeout(200);
  check('(touch) first tap on "Nhanh" shows the speed tip and does not change the rate', (await tipText(page)) === TIP.simpleSpeed && (await st(page)).rate === r0, `rate=${(await st(page)).rate}`);
  await page.getByRole('button', { name: 'Dùng nút này' }).tap();
  await page.waitForTimeout(200);
  check('(touch) "Dùng nút này" activates it', (await st(page)).rate === 15, `rate=${(await st(page)).rate}`);
  const useH = await page.evaluate(() => document.querySelector('.guide-tip__use').getBoundingClientRect().height);
  check('(375) "Dùng nút này" is ≥ 44 px', useH >= 44, `${useH}`);

  // Bầu trời: chạm vẫn kéo/chọn sao (không bị chặn) và hiện lời giải thích.
  await page.evaluate(() => window.scrollTo(0, 0));
  const skyR = await rect(page, '#view-horizon .view__canvas');
  await page.touchscreen.tap(skyR.x + skyR.w * 0.5, skyR.y + skyR.h * 0.15);
  await page.waitForTimeout(300);
  check('(touch) tapping the sky explains the view (the sky is never blocked)', (await tipText(page)) === TIP.horizonView, await tipText(page));

  // Đầy đủ trên điện thoại.
  await page.evaluate(() => window.__app.actions.setUiMode('full'));
  await page.waitForTimeout(400);
  check('(375 full) the avatar is present in Full', await page.locator('.guide-avatar').isVisible());
  const active0 = await page.evaluate(() => document.querySelector('.panels').dataset.active);
  await page.locator('.paneltabs .tab[data-panel="stars"]').tap();
  await page.waitForTimeout(200);
  const active1 = await page.evaluate(() => document.querySelector('.panels').dataset.active);
  check('(375 full) first tap on a panel tab explains instead of switching', (await tipText(page)) === TIP.panelTabs && active1 === active0, `${active0}→${active1}`);
  check('(375 full) no horizontal scroll', await noHScroll(page));
  await page.getByRole('button', { name: 'Thoát chế độ giải thích' }).tap();
  check('(375) the banner close button exits explain mode', !(await explaining(page)));
  await ctx.close();
}

// fix-1 #3: chạm vào lời chào (chân dung + chữ) làm đúng điều nó nói — bật chế độ giải thích.
{
  const ctx = await context({ width: 375, height: 812, touch: true });
  const page = await open(ctx);
  await waitHello(page);
  await page.locator('.guide-hello__go').tap();
  await waitExplain(page, true).catch(() => {});
  check('(fix-1 #3, 375) tapping the toast enters explain mode', (await explaining(page)) && (await helloCount(page)) === 0);
  await ctx.close();
}

// ================================================================== fix-2 #2/#9: máy tính thấp 1280×800, Cơ bản
{
  const ctx = await context({ width: 1280, height: 800 });
  const page = await open(ctx);
  await waitHello(page);
  const kind = await page.evaluate(() => document.querySelector('.guide-hello').className);
  check('(fix-2 #9, 1280×800) no room for the full figure under the card → the slim hello is used', /guide-hello--toast/.test(kind), kind);
  const hr = await rect(page, '.guide-hello');
  const hit = [];
  for (const sel of ['#view-horizon .view__canvas', '.simple__dock .infocard', '.view__hint', '.view__key', '.guide-avatar']) if (overlaps(hr, await rect(page, sel))) hit.push(sel);
  check('(fix-2 #2/#9, 1280×800) the slim hello covers neither the sky, the selection card, the hint caption nor the avatar', hit.length === 0, hit.join(', ') || JSON.stringify(hr));
  check('(fix-2 #2, 1280×800) the hint caption is visible on the first visit', (await rect(page, '.view__hint'))?.vis === true);
  await ctx.close();
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);
