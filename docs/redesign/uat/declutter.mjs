// Kiểm tra gỡ chồng chéo nhãn cảnh 3D (review-1 D2, C2; src/scene/declutter.ts).
// Chạy: npm run build && npx vite preview --port 4190 --strictPort (nền), rồi
//   UAT_URL='http://localhost:4190/?quality=fixed' node docs/redesign/uat/declutter.mjs
//
// Ở 1440×900, 375×812 (cả hai thẻ khung nhìn), khi rê chuột lên ô "Độ cao thiên cực" và ở chế độ trình chiếu
// 1920×1080: lấy hộp của mọi nhãn CSS2D đang hiện (display ≠ none, visibility ≠ hidden) và khẳng định
// (1) không hai nhãn nào chồng nhau quá 2 px, (2) không nhãn nào tràn ra ngoài khung canvas của nó. Khi tô sáng độ
// cao thiên cực: (3) bốn chữ hướng vẫn hiện, nhãn số đo và tên Polaris cũng hiện (review-3 D2).
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { expandFocus } from '../../redesign-2/uat/focus-helpers.mjs';

// redesign-2 R2: a first visit now lands in Simple mode. These checks exercise the Full interface, so every page
// starts with the stored choice "full" (same key the mode switch writes).
const FULL_MODE = () => {
  try {
    localStorage.setItem('astrosphere.mode.v1', JSON.stringify('full'));
    // redesign-2 R4: Usui-chan đã chào (lời chào lần đầu không che ảnh chụp và các thao tác kiểm tra).
    localStorage.setItem('astrosphere.guide.v1', JSON.stringify({ hello: true }));
  } catch {
    /* storage blocked: the page falls back to Simple and the checks will say so */
  }
};
const URL = process.env.UAT_URL ?? 'http://localhost:4190/?quality=fixed';
const TOL = 2;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

async function open(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addInitScript(FULL_MODE);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL);
  await page.waitForFunction(() => document.querySelectorAll('.view__canvas canvas').length >= 2, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  return { ctx, page };
}

/** Hộp của các nhãn đang hiện, theo từng khung nhìn đang hiển thị. Đo trong một lần evaluate (cùng một khung hình). */
function measure(page) {
  return page.evaluate(() => {
    const out = [];
    for (const host of document.querySelectorAll('.view__canvas')) {
      const c = host.getBoundingClientRect();
      if (c.width === 0 || c.height === 0) continue;
      const labels = [];
      for (const el of host.querySelectorAll('.label-layer .lbl')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        labels.push({ text: el.textContent, l: r.left, t: r.top, r: r.right, b: r.bottom });
      }
      out.push({ view: host.closest('.view').id, canvas: { l: c.left, t: c.top, r: c.right, b: c.bottom }, labels });
    }
    return out;
  });
}

function judge(tag, views) {
  for (const v of views) {
    const L = v.labels;
    const overlaps = [];
    for (let i = 0; i < L.length; i++) {
      for (let j = i + 1; j < L.length; j++) {
        const ox = Math.min(L[i].r, L[j].r) - Math.max(L[i].l, L[j].l);
        const oy = Math.min(L[i].b, L[j].b) - Math.max(L[i].t, L[j].t);
        if (ox > TOL && oy > TOL) overlaps.push(`${L[i].text} × ${L[j].text} (${ox.toFixed(1)}×${oy.toFixed(1)})`);
      }
    }
    const c = v.canvas;
    const outside = L.filter((x) => x.l < c.l - 0.5 || x.t < c.t - 0.5 || x.r > c.r + 0.5 || x.b > c.b + 0.5).map((x) => x.text);
    check(`${tag} ${v.view}: ${L.length} visible labels, none overlap by > ${TOL} px`, L.length > 0 && overlaps.length === 0, overlaps.slice(0, 4).join(' | '));
    check(`${tag} ${v.view}: no label extends outside its canvas`, outside.length === 0, outside.slice(0, 4).join(' | '));
  }
}

{
  const { ctx, page } = await open(1440, 900);
  judge('1440', await measure(page));
  // Bố cục tập trung (2026-10-05): ô độ cao thiên cực nằm trong dải số liệu đầy đủ. Mở ra rồi chờ khung nhìn đổi cỡ
  // và nhãn được đo lại trước khi rê chuột (mở dải làm khung nhìn thấp lại).
  await expandFocus(page, { data: true });
  await page.waitForTimeout(1500);
  await page.locator('.databar [data-emphasis=pole]').hover();
  await page.waitForTimeout(800);
  const hv = await measure(page);
  judge('1440 hover pole', hv);
  // review-3 D2: nhãn số đo nhường chỗ (dời dọc cung), không che chữ hướng; tên đối tượng chọn vẫn hiện ở cả hai khung.
  const hz = hv.find((v) => v.view === 'view-horizon').labels.map((l) => l.text);
  const missing = ['B', 'N', 'Đ', 'T'].filter((d) => !hz.includes(d));
  check('1440 hover pole view-horizon: all four cardinals B/N/Đ/T stay visible', missing.length === 0, `missing=${missing.join(',')}`);
  check('1440 hover pole view-horizon: the emphasised pole-altitude label is visible', hz.some((x) => x.startsWith('Độ cao thiên cực')), hz.join(' | '));
  for (const v of hv) check(`1440 hover pole ${v.view}: the selected star's name (Polaris) is visible`, v.labels.some((l) => l.text === 'Polaris'), v.labels.map((l) => l.text).join(' | '));
  await ctx.close();
}
{
  const { ctx, page } = await open(375, 812);
  judge('375', await measure(page));
  await page.locator('.viewtabs [data-view=sphere]').click();
  await page.waitForTimeout(1500);
  judge('375 sphere tab', await measure(page));
  await ctx.close();
}
{
  const { ctx, page } = await open(1920, 1080);
  await page.keyboard.press('f');
  await page.waitForTimeout(2500);
  judge('1920 present', await measure(page));
  await ctx.close();
}

await browser.close();
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `DECLUTTER FAIL (${failed.length}/${results.length})` : `DECLUTTER PASS (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
