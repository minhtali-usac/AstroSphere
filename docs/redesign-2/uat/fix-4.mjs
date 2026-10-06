// UAT: vòng sửa 4 (docs/redesign-2/review-4.md, các mục #4, #5, #10, #11, #14, #15). Một nhóm kiểm tra cho mỗi mục.
//   #4  bố cục tập trung mở cả hai nút + Sirius ở 1280 × 800: thiên cầu nhỏ thì không hiện tên chòm sao trong thiên
//       cầu, vẫn giữ hướng và thiên cực; dải "↓ Còn nữa" làm mờ hẳn dòng bị cắt
//   #5  thanh trên ở 375 px (Đầy đủ và Cơ bản): mọi nút có chữ chú thích hiện được, nút ≥ 44 px, không cuộn ngang
//   #10 bản đồ thế giới: xích đạo Trái Đất có ở cả 1280 và 1440, màu xám nét đứt, không vàng
//   #11 thẻ Sirius: cấp sao "−1,44" (dấu trừ thật)
//   #14 lời chào trên điện thoại dùng "chạm" ở cả hai chỗ
//   #15 nút "?" trong lưới số liệu ở 375 (cảm ứng): vùng chạm ≥ 44 px
// Cần máy chủ DEV (window.__app, import '/src/…'):
//   npx vite --port 5192 --strictPort (nền), rồi
//   UAT_URL='http://localhost:5192/?quality=fixed' node docs/redesign-2/uat/fix-4.mjs
import { readFileSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { expandFocus, showPanel } from './focus-helpers.mjs';

const URL = process.env.UAT_URL ?? 'http://localhost:5192/?quality=fixed';
const VI = JSON.parse(readFileSync(new globalThis.URL('../../../src/i18n/vi.json', import.meta.url), 'utf8'));
const SIRIUS = 32349;

const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

async function open({ width = 1440, height = 900, mode = 'full', hello = true, touch = false, session = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
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

// ------------------------------------------------------------------ #10 Xích đạo trên bản đồ
for (const [w, h] of [
  [1280, 800],
  [1440, 900],
]) {
  const { ctx, page } = await open({ width: w, height: h, session: { 'astrosphere.focus.v1': JSON.stringify({ data: true, panels: true }) } });
  await showPanel(page, 'location');
  await page.waitForTimeout(600);
  const eq = await page.evaluate(() => {
    const cv = document.querySelector('.worldmap__canvas');
    const g = cv.getContext('2d');
    const y = Math.round(cv.height / 2);
    // Hàng giữa (± 1 px): đếm điểm vàng (xích đạo trời) và điểm xám trung tính (xích đạo Trái Đất).
    let yellow = 0;
    let grey = 0;
    let n = 0;
    for (const yy of [y - 1, y, y + 1]) {
      const d = g.getImageData(0, yy, cv.width, 1).data;
      for (let i = 0; i < d.length; i += 4) {
        const [r, gg, b] = [d[i], d[i + 1], d[i + 2]];
        if (yy === y) n++;
        if (r > 180 && gg > 150 && b < 120 && r - b > 80) yellow++;
        if (Math.max(r, gg, b) - Math.min(r, gg, b) <= 24 && r >= 110 && r <= 200) grey++;
      }
    }
    return { w: cv.width, h: cv.height, yellow, grey, n };
  });
  check(`#10 ${w}×${h}: the map equator is drawn (neutral grey, dashed) and has no yellow`, eq.yellow === 0 && eq.grey >= eq.n * 0.35 && eq.grey <= eq.n * 0.95 * 3, JSON.stringify(eq));
  await ctx.close();
}

// ------------------------------------------------------------------ #4 Bố cục tập trung 1280 × 800 mở rộng + Sirius; #11 cấp sao
{
  const { ctx, page } = await open({ width: 1280, height: 800, session: { 'astrosphere.focus.v1': JSON.stringify({ data: true, panels: true }) } });
  await expandFocus(page, { data: true, panels: true });
  await select(page, SIRIUS);
  await page.waitForTimeout(1200);
  const lbl = await page.evaluate(() => {
    const shown = (host) =>
      [...document.querySelectorAll(`${host} .label-layer .lbl`)]
        .filter((el) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        })
        .map((el) => ({ text: el.textContent, cls: el.className }));
    const c = document.querySelector('#view-sphere .view__canvas').getBoundingClientRect();
    return { canvas: { w: Math.round(c.width), h: Math.round(c.height) }, sphere: shown('#view-sphere'), horizon: shown('#view-horizon') };
  });
  const sph = lbl.sphere;
  const names = sph.map((l) => l.text);
  const constel = sph.filter((l) => /lbl--constellation/.test(l.cls));
  const otherStars = sph.filter((l) => /lbl--catalog|lbl--dso/.test(l.cls) && l.text !== 'Sirius');
  const cardinals = names.filter((t) => ['B', 'N', 'Đ', 'T'].includes(t));
  check(
    '#4 1280×800 expanded + Sirius: the small sphere view (< 235 px) shows no constellation names and no other star names',
    lbl.canvas.h < 235 && constel.length === 0 && otherStars.length === 0,
    JSON.stringify({ canvas: lbl.canvas, names }),
  );
  check(
    '#4 the small sphere view keeps cardinal letters and a celestial pole, and drops zenith / γ',
    cardinals.length >= 2 && names.some((t) => /^Thiên cực/.test(t)) && !names.includes(VI.scene.zenith) && !names.includes(VI.scene.vernal),
    names.join(' | '),
  );
  // Tên xích đạo: vòng chọn và tên đối tượng chọn quay theo giờ sao và có lúc chiếm hết chỗ trong khung 272 × 222 px
  // (kiểm tra cũ đọc theo đồng hồ lúc chạy). Thử 12 giờ sao cố định: tên phải hiện ở ít nhất 11 (chú giải ngay dưới
  // khung vẫn ghi "Xích đạo trời").
  const eqSeen = [];
  await page.evaluate(() => window.__app.actions.pause());
  for (let lst = 0; lst < 360; lst += 30) {
    await page.evaluate((l) => window.__app.actions.setLst(l), lst);
    await page.waitForTimeout(400);
    const on = await page.evaluate((eqText) =>
      [...document.querySelectorAll('#view-sphere .label-layer .lbl')].some((el) => {
        const r = el.getBoundingClientRect();
        return el.textContent === eqText && getComputedStyle(el).display !== 'none' && r.width > 0;
      }), VI.scene.equator);
    if (on) eqSeen.push(lst);
  }
  check('#4 the small sphere view names the celestial equator at ≥ 11 of 12 sidereal times', eqSeen.length >= 11, `shown at LST ${eqSeen.join(', ')}`);
  check(
    '#4 the horizon view is unchanged: it still shows constellation names',
    lbl.horizon.some((l) => /lbl--constellation/.test(l.cls)),
    lbl.horizon.map((l) => l.text).join(' | '),
  );

  // #4a: dải "↓ Còn nữa" làm mờ hẳn dòng bị cắt: ngay trên chỗ dải đặc lại, không còn nét chữ tương phản cao.
  const band = await page.evaluate(() => {
    const card = document.querySelector('.infocard');
    const more = card.querySelector('.infocard__more');
    const cs = getComputedStyle(more, '::before');
    const m = more.getBoundingClientRect();
    const bottom = m.top - parseFloat(cs.bottom);
    const top = bottom - parseFloat(cs.height);
    const fade = parseFloat(getComputedStyle(more).getPropertyValue('--more-fade'));
    const solid = top + fade;
    const c = card.getBoundingClientRect();
    // Viên "↓ Còn nữa" (viền xám) nằm giữa dải: chỉ lấy mẫu phần bên trái nó, nơi có nhãn của dòng bị cắt.
    const pill = card.querySelector('.infocard__more-btn').getBoundingClientRect();
    // Dòng chữ vắt ngang chỗ dải đặc lại (dòng bị cắt).
    const cut = [...card.querySelectorAll('dt, dd, .kv__note, h3, p')]
      .map((e) => [e.textContent.trim().slice(0, 30), e.getBoundingClientRect()])
      .filter(([, r]) => r.top < solid && r.bottom > solid - 4 && r.height > 0)
      .map(([t]) => t);
    return { hasMore: card.classList.contains('has-more'), top, solid, fade, x: c.x, w: pill.left - 4 - c.x, cut };
  });
  const png = await page.screenshot({ clip: { x: band.x + 2, y: band.solid - 4, width: band.w - 2, height: 4 } });
  const px = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    const lum = (i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    // Nền = điểm tối nhất; chữ = điểm sáng nhất.
    let lo = 255;
    let hi = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = lum(i);
      if (l < lo) lo = l;
      if (l > hi) hi = l;
    }
    return { lo: Math.round(lo), hi: Math.round(hi) };
  }, png.toString('base64'));
  // Chữ sáng nhất của thẻ (--text, ~242) trên nền thẻ (~16): chênh ~226. Ngay trên chỗ đặc: ≤ 20 % mức đó.
  check(
    '#4a the "↓ Còn nữa" band fades the cut-off line out fully (4 px above the solid edge: ≤ 20 % of full text contrast)',
    band.hasMore && band.fade > 0 && band.cut.length > 0 && px.hi - px.lo <= 45,
    JSON.stringify({ band: { top: Math.round(band.top), solid: Math.round(band.solid), fade: band.fade, cut: band.cut }, px }),
  );

  // #11
  const kind = await page.locator('.infocard__kind').textContent();
  check('#11 Sirius card: magnitude uses a true minus ("−1,44"), no ASCII hyphen', kind.includes('−1,44') && !kind.includes('-1,44'), kind);
  await ctx.close();
}

// ------------------------------------------------------------------ #5 Thanh trên ở 375 px: chữ chú thích dưới biểu tượng
for (const mode of ['full', 'simple']) {
  const { ctx, page } = await open({ width: 375, height: 812, touch: true, mode });
  const top = await page.evaluate(() => {
    const bar = document.querySelector('.topbar').getBoundingClientRect();
    const btns = [...document.querySelectorAll('.topbar__actions .btn--top')]
      .filter((b) => getComputedStyle(b).display !== 'none')
      .map((b) => {
        const r = b.getBoundingClientRect();
        const t = b.querySelector('.btn__text');
        const tr = t.getBoundingClientRect();
        const cs = getComputedStyle(t);
        return {
          name: t.textContent,
          w: Math.round(r.width),
          h: Math.round(r.height),
          caption: cs.display !== 'none' && cs.visibility !== 'hidden' && tr.width > 0 && tr.height > 0,
          inside: tr.left >= r.left - 0.5 && tr.right <= r.right + 0.5 && tr.bottom <= r.bottom + 0.5,
          below: tr.top >= b.querySelector('.btn__icon').getBoundingClientRect().bottom - 0.5,
          fs: parseFloat(cs.fontSize),
        };
      });
    return { h: Math.round(bar.height), sw: document.documentElement.scrollWidth, btns };
  });
  const want = mode === 'full' ? [VI.top.learn, VI.top.reset, VI.codexUi.button, VI.top.help, VI.top.about] : [VI.top.reset, VI.codexUi.button, VI.top.help, VI.top.about];
  check(
    `#5 375 ${mode}: every header button shows its name as a caption under the icon (≥ 12 px, inside the button)`,
    JSON.stringify(top.btns.map((b) => b.name)) === JSON.stringify(want) && top.btns.every((b) => b.caption && b.inside && b.below && b.fs >= 12),
    JSON.stringify(top.btns),
  );
  check(`#5 375 ${mode}: every header button ≥ 44 × 44 px, header ≤ 104 px, no horizontal scroll`, top.btns.every((b) => b.w >= 44 && b.h >= 44) && top.h <= 104 && top.sw <= 375, JSON.stringify({ h: top.h, sw: top.sw, sizes: top.btns.map((b) => `${b.w}×${b.h}`) }));
  await ctx.close();
}

// ------------------------------------------------------------------ #14 Lời chào trên điện thoại
{
  const { ctx, page } = await open({ width: 375, height: 812, touch: true, mode: 'simple', hello: false });
  await page.waitForSelector('.guide-hello--toast', { timeout: 15000 });
  const text = await page.locator('.guide-hello--toast .guide-hello__title').textContent();
  check('#14 375 touch: the hello toast says "chạm" for both actions', text === 'Chào bạn! Thử chạm vào một ngôi sao nhé. Chạm vào mình nếu muốn hỏi về các nút.' && !/Bấm/.test(text), text);
  await ctx.close();
}

// ------------------------------------------------------------------ #15 Vùng chạm của nút "?" trong lưới số liệu
{
  const { ctx, page } = await open({ width: 375, height: 812, touch: true });
  const hits = await page.evaluate(async () => {
    const out = [];
    for (const t of document.querySelectorAll('.databar .term')) {
      t.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 30));
      const r = t.getBoundingClientRect();
      if (r.width === 0) continue;
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      // 44 px vuông quanh tâm: bốn cạnh (± 21,5 px) và bốn góc phải trúng chính nút.
      const pts = [
        [21.5, 0],
        [-21.5, 0],
        [0, 21.5],
        [0, -21.5],
        [21.5, 21.5],
        [-21.5, -21.5],
        [21.5, -21.5],
        [-21.5, 21.5],
      ];
      const ok = pts.every(([dx, dy]) => document.elementFromPoint(cx + dx, cy + dy)?.closest('.term') === t);
      out.push({ id: t.dataset.codex, drawn: Math.round(r.width), ok });
    }
    return out;
  });
  check('#15 375 touch: every "?" in the data grid is drawn ~16 px but has a ≥ 44 × 44 px hit area', hits.length >= 4 && hits.every((x) => x.ok && x.drawn <= 20), JSON.stringify(hits));
  await ctx.close();
}

await browser.close();
check('no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const passed = results.filter(Boolean).length;
console.log(`\nFIX-4 ${passed}/${results.length} ${passed === results.length ? 'PASS' : 'FAIL'}`);
process.exit(passed === results.length ? 0 : 1);
