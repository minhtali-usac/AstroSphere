// Ảnh cho vòng duyệt thiết kế R8 (redesign-2). UAT_URL mặc định là máy chủ phát triển (cần window.__app).
//   UAT_URL='http://localhost:5190/?quality=fixed' OUT=docs/redesign-2/review-1/ node docs/redesign-2/uat/review-shots.mjs
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const URL = process.env.UAT_URL ?? 'http://localhost:5190/?quality=fixed';
const OUT = process.env.OUT ?? 'docs/redesign-2/review-1/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function shot(name, { w = 1440, h = 900, seed = {}, touch = false, act } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  await ctx.addInitScript((kv) => { try { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); } catch {} }, seed);
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForFunction(() => window.__app?.horizon, null, { timeout: 60000 });
  await page.waitForTimeout(1800);
  if (act) await act(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('shot', name);
  await ctx.close();
}

const seen = { 'astrosphere.hint.v1': 'true', 'astrosphere.guide.v1': JSON.stringify({ hello: true }) };
const full = { ...seen, 'astrosphere.mode.v1': JSON.stringify('full') };
const pickSirius = (p) => p.evaluate(async () => { const { selectCatalogHip } = await import('/src/scenario.ts'); selectCatalogHip({ store: window.__app.store, actions: window.__app.actions }, 32349); });

await shot('01-first-visit-1440');
await shot('02-first-visit-375', { w: 375, h: 812, touch: true });
await shot('03-simple-star-1440', { seed: seen, act: pickSirius });
await shot('04-simple-375-scrolled', { w: 375, h: 812, touch: true, seed: seen, act: (p) => p.evaluate(() => scrollTo(0, 520)) });
await shot('05-full-1440', { seed: full, act: pickSirius });
await shot('06-codex-1440', { seed: full, act: async (p) => { await p.locator('.btn--codex').click(); await p.waitForTimeout(1500); } });
await shot('07-explain-1440', { seed: seen, act: async (p) => { await p.locator('.guide-avatar').first().click(); await p.waitForTimeout(500); await p.locator('.modeswitch').first().hover(); } });
await shot('08-present-1920', { w: 1920, h: 1080, seed: full, act: async (p) => { await p.keyboard.press('f'); } });
await browser.close();
