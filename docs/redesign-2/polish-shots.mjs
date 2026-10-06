// Ảnh chụp trước/sau của luồng P (review-4 polish): 1440×900, 375×812, 1920×1080 trình chiếu, và cận cảnh thiên cực.
// Chạy: npm run build && npx vite preview --port 4193 --strictPort (nền), rồi
//   UAT_URL=http://localhost:4193/?quality=fixed TAG=after node docs/redesign-2/polish-shots.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const URL = process.env.UAT_URL ?? 'http://localhost:4193/?quality=fixed';
const OUT = process.env.OUT ?? 'docs/redesign-2/shots';
const TAG = process.env.TAG ?? 'after';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function open(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForFunction(() => document.querySelectorAll('.view__canvas canvas').length >= 2, null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  return { ctx, page };
}

{
  const { ctx, page } = await open(1440, 900);
  await page.screenshot({ path: `${OUT}/polish-${TAG}-1440.png` });
  // Cận cảnh vùng thiên cực (D2) trong khung giản đồ chân trời.
  const box = await page.locator('#view-horizon .view__canvas').boundingBox();
  if (box) await page.screenshot({ path: `${OUT}/polish-${TAG}-pole-1440.png`, clip: { x: box.x + box.width * 0.35, y: box.y, width: box.width * 0.5, height: box.height * 0.55 } });
  await ctx.close();
}
{
  const { ctx, page } = await open(375, 812);
  await page.screenshot({ path: `${OUT}/polish-${TAG}-375.png` });
  await ctx.close();
}
{
  const { ctx, page } = await open(1920, 1080);
  await page.keyboard.press('f');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/polish-${TAG}-present-1920.png` });
  await ctx.close();
}
await browser.close();
console.log(`wrote polish-${TAG}-*.png to ${OUT}`);
