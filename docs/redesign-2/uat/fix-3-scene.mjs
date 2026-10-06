// UAT fix-3 (scene): review-3 #3 và #12 (docs/redesign-2/review-3.md).
//  (a) Nhãn "Sirius đang ở dưới chân trời (h = …)" không đè lên dấu "bóng" của chính nó: hộp của nhãn không chạm hộp
//      vòng đứt nét ĐÃ VẼ (sau khi kẹp vào khung) và mũi tên mép khung — 1440 × 900 bố cục tập trung mở rộng (ảnh 06)
//      và 375 × 812 điện thoại chế độ Đầy đủ (ảnh 12), ở h ≈ −56° (phía Đông) và h ≈ −86° (vòng kẹp vào mép dưới).
//  (b) 1280 × 800 chế độ Đầy đủ (ảnh 07), Polaris đang chọn, đường thẳng đứng bật: chữ hướng "B" không chạm vật cản ở
//      chân đường thẳng đứng (vạch hồng của cung h).
// Hộp vòng "bóng", mũi tên và chân đường thẳng đứng đọc từ getter chỉ-đọc của khung nhìn (window.__app.horizon
// .ghostRects / .footRect — chỉ có ở chế độ phát triển). Cần máy chủ DEV:
//   npx vite --port 5191 --strictPort (nền), rồi
//   UAT_URL='http://localhost:5191/?quality=fixed' node docs/redesign-2/uat/fix-3-scene.mjs
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const URL = process.env.UAT_URL ?? 'http://localhost:5191/?quality=fixed';
const SIRIUS = 32349;
const POLARIS = 11767;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function open(width, height, { touch = false, focus = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await ctx.addInitScript((focus) => {
    try {
      localStorage.setItem('astrosphere.mode.v1', JSON.stringify('full'));
      localStorage.setItem('astrosphere.guide.v1', JSON.stringify({ hello: true }));
      localStorage.setItem('astrosphere.hint.v1', 'true');
      if (focus) sessionStorage.setItem('astrosphere.focus.v1', JSON.stringify(focus));
    } catch {
      /* bỏ qua */
    }
  }, focus);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL);
  await page.waitForFunction(() => window.__app?.horizon, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}

/** Hà Nội, tạm dừng, chọn sao `hip`, đặt LST; chờ vẽ lại (nhãn được đo ở khung hình đầu rồi gỡ chồng chéo lại). */
async function setup(page, hip, lst) {
  await page.evaluate(
    async ([hip, lst]) => {
      const { store, actions } = window.__app;
      actions.pause();
      actions.setLocation(21.03, 105.85);
      actions.setLst(lst);
      const { selectCatalogHip } = await import('/src/scenario.ts');
      selectCatalogHip({ store, actions }, hip);
    },
    [hip, lst],
  );
  await page.waitForTimeout(900);
}

const inter = (a, b) => !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const gapOf = (a, b) => (a && b ? Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h)) : NaN);
const fmt = (r) => (r ? `[${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.w)}×${Math.round(r.h)}]` : 'null');

/** Hộp nhãn "… dưới chân trời" (px, tương đối với canvas giản đồ chân trời) và các hộp của dấu "bóng". */
function readUnder(page) {
  return page.evaluate(async () => {
    const { equatorialToHorizontal } = await import('/src/astro/index.ts');
    const { lstOf } = await import('/src/state.ts');
    const { catalogArrays } = await import('/src/data/catalog.ts');
    const s = window.__app.store.state;
    const cat = catalogArrays();
    const i = s.selected.index;
    const { alt } = equatorialToHorizontal(cat.ra[i], cat.dec[i], s.lat, lstOf(s));
    const v = window.__app.horizon;
    const host = document.querySelector('#view-horizon .view__canvas').getBoundingClientRect();
    const el = document.querySelector('#view-horizon .lbl--under');
    const r = el?.getBoundingClientRect();
    const shown = !!el && el.style.display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && r.width > 0;
    const lbl = shown ? { x: r.left - host.left, y: r.top - host.top, w: r.width, h: r.height } : null;
    const { ring, arrow } = v.ghostRects;
    return { alt, text: el?.textContent ?? '', lbl, ring, arrow, clamped: v.horizon.ghostClamped, W: host.width, H: host.height };
  });
}

async function underCase(label, page, lst) {
  await setup(page, SIRIUS, lst);
  const u = await readUnder(page);
  const tag = `${label}, h = ${u.alt.toFixed(1)}°`;
  check(`${tag}: Sirius dưới chân trời, vòng "bóng" đang vẽ`, u.alt < 0 && !!u.ring, `ring ${fmt(u.ring)}`);
  const inside = !!u.lbl && u.lbl.x >= 0 && u.lbl.y >= 0 && u.lbl.x + u.lbl.w <= u.W && u.lbl.y + u.lbl.h <= u.H;
  check(`${tag}: nhãn dưới chân trời hiện, trọn trong khung`, inside, `"${u.text}" ${fmt(u.lbl)} / ${Math.round(u.W)}×${Math.round(u.H)}`);
  check(`${tag}: nhãn không chạm vòng "bóng" đã vẽ`, !!u.lbl && !!u.ring && !inter(u.lbl, u.ring), `khoảng hở ${gapOf(u.lbl, u.ring).toFixed(1)} px`);
  if (u.clamped) {
    check(`${tag}: vòng kẹp vào mép — mũi tên hiện và nhãn không chạm mũi tên`, !!u.arrow && !inter(u.lbl, u.arrow), `arrow ${fmt(u.arrow)}, khoảng hở ${gapOf(u.lbl, u.arrow).toFixed(1)} px`);
  }
  return u;
}

// --- (a) 1440 × 900, bố cục tập trung mở rộng (ảnh 06) ------------------------------------------------------------
{
  const { ctx, page, errors } = await open(1440, 900, { focus: { data: true, panels: true } });
  const open1 = await page.evaluate(() => document.body.classList.contains('focus-data-open'));
  check('1440: bố cục tập trung mở rộng (dải số liệu mở)', open1);
  await underCase('1440 mở rộng', page, 317.5);
  const deep = await underCase('1440 mở rộng', page, 281.3);
  check('1440 mở rộng, h ≈ −86°: vòng "bóng" được kẹp vào mép (có mũi tên)', deep.clamped && !!deep.arrow, fmt(deep.arrow));
  check('không có lỗi trang (1440)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// --- (a) 375 × 812 điện thoại, chế độ Đầy đủ (ảnh 12) -------------------------------------------------------------
{
  const { ctx, page, errors } = await open(375, 812, { touch: true });
  await underCase('375 Đầy đủ', page, 317.5);
  await underCase('375 Đầy đủ', page, 281.3);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check('375: không cuộn ngang', sw <= 375, `scrollWidth ${sw}`);
  check('không có lỗi trang (375)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// --- (b) 1280 × 800 chế độ Đầy đủ, Polaris (ảnh 07) ---------------------------------------------------------------
{
  const { ctx, page, errors } = await open(1280, 800);
  await setup(page, POLARIS, 128);
  const vOn = await page.evaluate(() => window.__app.store.state.toggles.verticalCircle);
  if (!vOn) {
    await page.evaluate(() => window.__app.actions.setToggle('verticalCircle', true));
    await page.waitForTimeout(600);
  }
  const b = await page.evaluate(() => {
    const host = document.querySelector('#view-horizon .view__canvas').getBoundingClientRect();
    const el = [...document.querySelectorAll('#view-horizon .lbl--dir')].find((e) => e.textContent === 'B' && e.style.display !== 'none');
    const r = el?.getBoundingClientRect();
    return {
      B: r && r.width > 0 ? { x: r.left - host.left, y: r.top - host.top, w: r.width, h: r.height } : null,
      foot: window.__app.horizon.footRect,
    };
  });
  check('1280: đường thẳng đứng bật mặc định (Polaris đang chọn)', vOn === true);
  check('1280: vật cản ở chân đường thẳng đứng có mặt', !!b.foot, fmt(b.foot));
  check('1280: chữ "B" hiện và không chạm chân đường thẳng đứng (vạch hồng)', !!b.B && !!b.foot && !inter(b.B, b.foot), `B ${fmt(b.B)}, foot ${fmt(b.foot)}, khoảng hở ${gapOf(b.B, b.foot).toFixed(1)} px`);
  check('không có lỗi trang (1280)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const pass = results.filter(Boolean).length;
console.log(`\n${pass}/${results.length} PASS`);
process.exit(pass === results.length ? 0 : 1);
