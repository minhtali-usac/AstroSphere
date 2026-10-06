// Ảnh trước/sau của vòng sửa 1 (cảnh 3D): sao chọn dưới chân trời (#2), đĩa chân trời (#5), va chạm nhãn khi trình
// chiếu (G1). Cần máy chủ DEV (window.__app). Thời điểm cố định (tạm dừng, LST cố định) để hai bản so được cùng khung.
//   npx vite --port 5196 --strictPort (nền), rồi
//   UAT_URL='http://localhost:5196/?quality=fixed' TAG=after node docs/redesign-2/fix1-scene-shots.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const URL = process.env.UAT_URL ?? 'http://localhost:5196/?quality=fixed';
const OUT = process.env.OUT ?? 'docs/redesign-2/shots';
const TAG = process.env.TAG ?? 'after';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const seen = { 'astrosphere.hint.v1': 'true', 'astrosphere.guide.v1': JSON.stringify({ hello: true }) };
const full = { ...seen, 'astrosphere.mode.v1': JSON.stringify('full') };

/** Hà Nội, tạm dừng, LST cố định; tùy chọn chọn Sirius (HIP 32349). */
const fix = (lst, sirius) => async (p) =>
  p.evaluate(
    async ([lst, sirius]) => {
      const { store, actions } = window.__app;
      actions.pause();
      actions.setLocation(21.03, 105.85);
      actions.setLst(lst);
      if (sirius) {
        const { selectCatalogHip } = await import('/src/scenario.ts');
        selectCatalogHip({ store, actions }, 32349);
      }
    },
    [lst, sirius],
  );

async function shot(name, { w = 1440, h = 900, seed = seen, act, clip } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await ctx.addInitScript((kv) => {
    try {
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    } catch {}
  }, seed);
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForFunction(() => window.__app?.horizon, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  if (act) await act(page);
  await page.waitForTimeout(1500);
  const c = clip ? await clip(page) : undefined;
  await page.screenshot({ path: `${OUT}/fix1-scene-${TAG}-${name}.png`, clip: c });
  console.log('shot', name);
  await ctx.close();
}

const horizonBox = async (p) => p.locator('#view-horizon .view__canvas').boundingBox();
// #2: Sirius dưới chân trời (h ≈ −73°), chế độ Cơ bản và Đầy đủ, máy tính và điện thoại.
await shot('sirius-1440', { act: fix(264, true) });
await shot('sirius-full-1440', { seed: full, act: fix(264, true) });
await shot('sirius-375', { w: 375, h: 812, act: fix(264, true) });
// #5: khung đo T1/T5 — Đầy đủ, Polaris mặc định, cùng LST.
await shot('full-1440', { seed: full, act: fix(264, false) });
await shot('horizon-1440', { seed: full, act: fix(264, false), clip: horizonBox });
// G1: trình chiếu 1920.
await shot('present-1920', {
  w: 1920,
  h: 1080,
  seed: full,
  act: async (p) => {
    await fix(264, false)(p);
    await p.keyboard.press('f');
    await p.waitForTimeout(1500);
  },
});
await browser.close();
