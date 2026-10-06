// Ảnh cho vòng duyệt thiết kế 4 (sau các quyết định của chủ dự án 2026-10-05). Máy chủ phát triển (cần window.__app).
//   UAT_URL='http://localhost:5190/?quality=fixed' OUT=docs/redesign-2/review-4/ node docs/redesign-2/uat/review-shots-4.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const URL = process.env.UAT_URL ?? 'http://localhost:5190/?quality=fixed';
const OUT = process.env.OUT ?? 'docs/redesign-2/review-4/';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function shot(name, { w = 1440, h = 900, seed = {}, session = {}, touch = false, act, ownShot = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  await ctx.addInitScript(
    ([kv, ss]) => {
      try {
        for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
        for (const [k, v] of Object.entries(ss)) sessionStorage.setItem(k, v);
      } catch {
        /* bỏ qua */
      }
    },
    [seed, session],
  );
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForFunction(() => window.__app?.horizon, null, { timeout: 60000 });
  await page.waitForTimeout(1800);
  if (act) await act(page);
  await page.waitForTimeout(500);
  if (!ownShot) await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('shot', name);
  await ctx.close();
}

const seen = { 'astrosphere.hint.v1': 'true', 'astrosphere.guide.v1': JSON.stringify({ hello: true }) };
const full = { ...seen, 'astrosphere.mode.v1': JSON.stringify('full') };
const select = (hip) => async (p) => {
  await p.evaluate(async (h) => {
    const { selectCatalogHip } = await import('/src/scenario.ts');
    selectCatalogHip({ store: window.__app.store, actions: window.__app.actions }, h);
  }, hip);
};

// Cơ bản
await shot('01-simple-first-visit-1440');
await shot('02-simple-first-visit-375', { w: 375, h: 812, touch: true });
await shot('03-simple-sirius-1440', { seed: seen, act: select(32349) });
// Nhịp đập của vòng chọn: chụp giữa nhịp (~120 ms sau khi chọn Vega).
await shot('04-simple-pulse-mid-1440', {
  seed: seen,
  ownShot: true,
  act: async (p) => {
    await select(91262)(p);
    await p.waitForTimeout(120);
    await p.screenshot({ path: `${OUT}04-simple-pulse-mid-1440.png` });
  },
});
// Đầy đủ, bố cục tập trung
await shot('05-full-focus-1440', { seed: full, act: select(32349) });
await shot('06-full-focus-expanded-1440', { seed: full, session: { 'astrosphere.focus.v1': JSON.stringify({ data: true, panels: true }) }, act: select(32349) });
await shot('07-full-focus-1280', { w: 1280, h: 800, seed: full });
// USACodex
await shot('08-usacodex-grid-1440', { seed: full, act: async (p) => { await p.locator('.btn--codex').click(); await p.waitForTimeout(1200); } });
await shot('09-usacodex-unlock-1440', {
  seed: full,
  act: async (p) => {
    await select(32349)(p);
    await p.waitForTimeout(400);
    await p.locator('.btn--codex').click();
    await p.waitForTimeout(1000);
    const card = p.locator('[data-state="new"]').first();
    if (await card.count()) await card.click();
    await p.waitForTimeout(450);
  },
});
await shot('10-usacodex-375', { w: 375, h: 812, touch: true, seed: seen, act: async (p) => { await p.locator('.btn--codex').click(); await p.waitForTimeout(1200); } });
// Hộp xác nhận Đặt lại
await shot('11-reset-confirm-1440', { seed: full, act: async (p) => { await p.locator('.btn--top-reset').click(); await p.waitForTimeout(400); } });
// Điện thoại, Đầy đủ
await shot('12-full-375', { w: 375, h: 812, touch: true, seed: full, act: select(32349) });
await browser.close();
