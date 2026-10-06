// UAT R2: chế độ Cơ bản / Đầy đủ (docs/redesign-2/goal.md › uat/modes.mjs).
// Cần máy chủ DEV (window.__app, window.__perf):
//   npx vite --port 5191 --strictPort   (nền), rồi
//   UAT_URL='http://localhost:5191/?quality=fixed' node docs/redesign-2/uat/modes.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const URL = process.env.UAT_URL ?? 'http://localhost:5191/?quality=fixed';
const SHOTS = new globalThis.URL('../shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const withParam = (k, v) => {
  const u = new globalThis.URL(URL);
  u.searchParams.set(k, v);
  return u.toString();
};
const KEY = 'astrosphere.mode.v1';

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// Đếm lệnh vẽ theo từng canvas (cùng cách với docs/redesign/uat/perf.mjs).
const DRAW_COUNTER = () => {
  const counts = new WeakMap();
  const wrap = (proto) => {
    if (!proto) return;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) {
      const orig = proto[name];
      if (typeof orig !== 'function') continue;
      proto[name] = function (...a) {
        counts.set(this.canvas, (counts.get(this.canvas) ?? 0) + 1);
        return orig.apply(this, a);
      };
    }
  };
  wrap(window.WebGL2RenderingContext?.prototype);
  wrap(window.WebGLRenderingContext?.prototype);
  window.__draws = (canvas) => (canvas ? (counts.get(canvas) ?? 0) : 0);
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

async function open(ctx, url = URL) {
  const page = await ctx.newPage();
  await page.addInitScript(DRAW_COUNTER);
  // redesign-2 R4: Usui-chan đã chào (lời chào lần đầu không che ảnh chụp và các thao tác kiểm tra).
  await page.addInitScript(() => localStorage.setItem('astrosphere.guide.v1', JSON.stringify({ hello: true })));
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.waitForFunction(() => window.__app?.horizon && window.__perf, null, { timeout: 30000 });
  await page.waitForTimeout(600);
  return page;
}
const visible = (page, sel) => page.locator(sel).first().isVisible();
const state = (page) => page.evaluate(() => {
  const s = window.__app.store.state;
  return { lat: s.lat, lon: s.lon, playing: s.playing, rate: s.rate, uiMode: s.uiMode, gst: s.gst, toggles: s.toggles, selected: s.selected };
});
const keyLine = (page) => page.locator('.view__key').textContent();
const renders = (page) =>
  page.evaluate(() => ({
    sphere: window.__draws(document.querySelector('#view-sphere canvas')),
    horizon: window.__draws(document.querySelector('#view-horizon canvas')),
  }));
/** Chờ dòng "φ = … · Độ cao thiên cực …" chứa một chuỗi (DOM được ghi ở nhịp giao diện ≈ 12 Hz). */
const keyLineHas = (page, text) =>
  page.waitForFunction((x) => document.querySelector('.view__key')?.textContent.includes(x), text, { timeout: 8000 }).then(
    () => true,
    () => false,
  );

try {
  // ------------------------------------------------------------ 1440 × 900, ngữ cảnh mới
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  let page = await open(ctx);

  const body = await page.evaluate(() => document.body.className);
  check('fresh context lands in Simple (body.mode-simple)', /\bmode-simple\b/.test(body) && !/\bmode-full\b/.test(body), body);
  check('nothing stored until the user chooses', (await page.evaluate((k) => localStorage.getItem(k), KEY)) === null);

  check('horizon view visible', await visible(page, '#view-horizon'));
  check('celestial sphere view hidden', !(await visible(page, '#view-sphere')));
  const hidden = {
    display: await visible(page, '#panel-display'),
    stars: await visible(page, '#panel-stars'),
    databar: await visible(page, '.databar'),
    learn: await page.getByRole('button', { name: 'Ôn tập' }).isVisible(),
    present: await page.getByRole('button', { name: 'Trình chiếu' }).isVisible(),
    viewtabs: await visible(page, '.viewtabs'),
  };
  check('display panel, star panel, data bar, Ôn tập, Trình chiếu hidden', Object.values(hidden).every((v) => !v), JSON.stringify(hidden));
  const kept = {
    keyLine: await visible(page, '.view__key'),
    reset: await page.getByRole('button', { name: 'Đặt lại' }).isVisible(),
    help: await page.getByRole('button', { name: 'Trợ giúp' }).isVisible(),
    about: await page.getByRole('button', { name: 'Giới thiệu' }).isVisible(),
    controls: await visible(page, '#simple-controls'),
  };
  check('kept: φ / pole caption, Đặt lại, Trợ giúp, Giới thiệu, simple controls', Object.values(kept).every(Boolean), JSON.stringify(kept));

  // fix-1 #4: lời mời hành động đầu tiên ở đầu dải, trước bước 1 (khóa lời chào đặt sẵn: không có lời chào).
  const cue = await page.evaluate(() => {
    const c = document.querySelector('.simple__cue');
    const cs = getComputedStyle(c);
    const r = c.getBoundingClientRect();
    const step1 = document.querySelector('.simple legend').getBoundingClientRect();
    return { shown: !c.hidden && cs.display !== 'none', text: c.textContent, size: parseFloat(cs.fontSize), color: cs.color, before: r.bottom <= step1.top };
  });
  check('fix-1 #4: the first-action cue "Bấm vào một ngôi sao…" is the first thing in the panel, body size, white', cue.shown && cue.before && cue.size >= 15 && cue.color === 'rgb(242, 242, 242)' && /Bấm vào một ngôi sao/.test(cue.text), JSON.stringify(cue));

  // fix-1 #8: nhãn "Chế độ" chỉ còn là tên truy cập; nút Codex có biểu tượng cuốn sách; huy hiệu không màu cam.
  const head = await page.evaluate(() => {
    const lbl = document.querySelector('.modeswitch__label');
    const badge = document.querySelector('.codex-badge');
    return {
      labelW: lbl.getBoundingClientRect().width,
      groupName: document.getElementById(document.querySelector('.modeswitch').getAttribute('aria-labelledby'))?.textContent,
      svg: !!document.querySelector('.btn--codex .btn__icon svg'),
      badgeBg: getComputedStyle(badge).backgroundColor,
    };
  });
  check('fix-1 #8: no visible "Chế độ" prefix (still the group\'s accessible name); Codex shows a book icon; the badge is not orange', head.labelW <= 1 && head.groupName === 'Chế độ' && head.svg && head.badgeBg !== 'rgb(242, 101, 34)', JSON.stringify(head));

  await page.screenshot({ path: `${SHOTS}simple-1440.png` });

  // Khung bị ẩn không vẽ: thiên cầu 0 lần vẽ khi đang chạy, giản đồ chân trời có vẽ.
  // swiftshader is slow (a few frames per second): wait for at least 5 horizon renders rather than a fixed time.
  await page.evaluate(() => window.__app.actions.play());
  const r0 = await renders(page);
  const n0 = await page.evaluate(() => window.__app.loop.stats.renders);
  await page.waitForFunction((n) => window.__app.loop.stats.renders >= n + 5, n0, { timeout: 20000 }).catch(() => {});
  const r1 = await renders(page);
  check('hidden sphere does no drawing while playing', r1.sphere - r0.sphere === 0 && r1.horizon - r0.horizon > 0, `sphere +${r1.sphere - r0.sphere}, horizon +${r1.horizon - r0.horizon}`);

  // Vị trí: nút chọn nhanh và thanh trượt đổi store.state.lat; dòng φ đi theo.
  await page.getByRole('button', { name: 'Bắc Cực' }).click();
  let s = await state(page);
  let ok = await keyLineHas(page, '90,00');
  let kl = await keyLine(page);
  check('chip Bắc Cực → lat 90, caption follows', s.lat === 90 && ok && (await page.getByRole('button', { name: 'Bắc Cực' }).getAttribute('aria-pressed')) === 'true', `lat=${s.lat} · ${kl}`);
  await page.getByRole('button', { name: 'Sydney (Úc)' }).click();
  s = await state(page);
  ok = await keyLineHas(page, 'Nam = 33,87');
  kl = await keyLine(page);
  check('chip Sydney → southern latitude, caption names the south pole', s.lat === -33.87 && s.lon === 151.21 && ok, `lat=${s.lat} · ${kl}`);
  await page.getByRole('button', { name: 'Hà Nội' }).click();
  s = await state(page);
  check('chip Hà Nội → lat 21.03', s.lat === 21.03, `lat=${s.lat}`);
  await page.locator('#simple-lat').focus();
  await page.keyboard.press('ArrowLeft');
  s = await state(page);
  ok = await keyLineHas(page, '20,50');
  kl = await keyLine(page);
  check('latitude slider drives the same state', s.lat === 20.5 && ok, `lat=${s.lat} · ${kl}`);

  // Thời gian: chạy/tạm dừng và Chậm/Nhanh.
  const play = page.locator('#simple-controls .simple__play');
  const p0 = (await state(page)).playing;
  await play.click();
  const p1 = (await state(page)).playing;
  await play.click();
  const p2 = (await state(page)).playing;
  check('play/pause toggles store.playing', p0 === true && p1 === false && p2 === true, `${p0} → ${p1} → ${p2}`);
  await page.getByRole('radio', { name: 'Nhanh' }).check();
  const fast = (await state(page)).rate;
  await page.getByRole('radio', { name: 'Chậm' }).check();
  const slow = (await state(page)).rate;
  check('Chậm / Nhanh set the rate', fast === 15 && slow === 60, `fast=${fast}, slow=${slow}`);

  // Lớp hiển thị: vùng mọc – lặn bật cả ba vùng.
  await page.getByLabel('Tô màu vùng mọc – lặn').check();
  s = await state(page);
  check('zones toggle turns on all three zones', s.toggles.zoneCircumpolar && s.toggles.zoneRiseSet && s.toggles.zoneNeverRise);
  await page.getByLabel('Tô màu vùng mọc – lặn').uncheck();

  // Bấm vào một ngôi sao trên giản đồ chân trời → thẻ rút gọn.
  await page.evaluate(() => window.__app.actions.pause());
  await page.waitForTimeout(200);
  // Tìm một sao danh mục (khác sao đang chọn) bằng chính hàm chọn của khung nhìn, rồi bấm chuột thật vào đó.
  // swiftshader chậm: thử lại tối đa 3 lần nếu lần bấm rơi vào lúc camera còn đang ổn định.
  const findStar = () =>
    page.evaluate(() => {
      const v = window.__perf.views.horizon;
      const host = document.querySelector('#view-horizon .view__canvas');
      const r = host.getBoundingClientRect();
      const cur = JSON.stringify(window.__app.store.state.selected);
      for (let y = r.top + 40; y < r.bottom - 160; y += 9) {
        for (let x = r.left + 40; x < r.right - 320; x += 9) {
          const sel = v.pickAt(x, y);
          if (sel && sel.kind === 'catalog' && JSON.stringify(sel) !== cur) return { x, y, sel };
        }
      }
      return null;
    });
  let target = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    target = await findStar();
    if (!target) break;
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(400);
    if ((await page.evaluate(() => JSON.stringify(window.__app.store.state.selected))) === JSON.stringify(target.sel)) break;
  }
  // Thẻ được ghi ở nhịp giao diện của vòng lặp: chờ nó mở ra.
  await page.waitForFunction(() => !document.querySelector('.infocard').classList.contains('is-collapsed'), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  const cardInfo = await page.evaluate(() => {
    const card = document.querySelector('.infocard');
    const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const row = (k) => vis(card.querySelector(`.kv[data-emphasis="${k}"]`));
    return {
      selected: JSON.stringify(window.__app.store.state.selected),
      open: !card.classList.contains('is-collapsed') && !card.classList.contains('is-empty'),
      title: card.querySelector('.infocard__title').textContent,
      alt: row('alt'),
      az: row('az'),
      status: row('status'),
      ra: row('ra'),
      dec: row('dec'),
      ha: row('ha'),
      transit: row('transit'),
      headings: [...card.querySelectorAll('h4')].filter(vis).length,
    };
  });
  check(
    'clicking a star opens the simplified card (name, h, A, status; no α/δ/H, LST rows or headings)',
    !!target &&
      cardInfo.selected === JSON.stringify(target.sel) && cardInfo.open && cardInfo.alt && cardInfo.az && cardInfo.status && !cardInfo.ra && !cardInfo.dec && !cardInfo.ha && !cardInfo.transit && cardInfo.headings === 0,
    JSON.stringify({ target, ...cardInfo }),
  );

  // fix-1 #1: ở Cơ bản trên màn hình rộng, thẻ nằm TRONG dải điều khiển (dưới nhóm 3), không nổi trên giản đồ.
  const dock = await page.evaluate(() => {
    const card = document.querySelector('.infocard');
    const cr = card.getBoundingClientRect();
    const hit = (r) => cr.left < r.right && r.left < cr.right && cr.top < r.bottom && r.top < cr.bottom;
    const btns = [...card.querySelectorAll('.infocard__head .icon-btn')].map((b) => b.getBoundingClientRect());
    const step3 = [...document.querySelectorAll('.simple__group')][2].getBoundingClientRect();
    return {
      docked: !!card.closest('#simple-controls .simple__dock'),
      toolsHit: [...document.querySelectorAll('.view-tool')].filter((b) => hit(b.getBoundingClientRect())).length,
      viewHit: hit(document.querySelector('#view-horizon').getBoundingClientRect()),
      belowStep3: cr.top >= step3.bottom,
      bg: getComputedStyle(card).backgroundColor,
      gap: btns.length === 2 ? Math.round(btns[1].left - btns[0].right) : -1,
      cue: document.querySelector('.simple__cue').hidden,
    };
  });
  check('fix-1 #1: the selection card is docked in the panel under step 3 and overlaps no .view-tool button or the view', dock.docked && dock.toolsHit === 0 && !dock.viewHit && dock.belowStep3, JSON.stringify(dock));
  check('fix-1 #1: the card is opaque and its — and × controls are ≥ 8 px apart', /^rgb\(/.test(dock.bg) && dock.gap >= 8, `${dock.bg}, gap ${dock.gap}px`);
  check('fix-1 #4: the cue hides after the first star selection', dock.cue === true);

  // Phím F (trình chiếu) và L (Ôn tập) không làm gì ở Cơ bản.
  await page.locator('body').click({ position: { x: 5, y: 890 } });
  await page.keyboard.press('f');
  await page.keyboard.press('l');
  await page.waitForTimeout(300);
  const fl = await page.evaluate(() => ({ present: document.body.classList.contains('present'), learn: !!document.querySelector('.learn:not([hidden])') }));
  check('F and L do nothing in Simple', !fl.present && !fl.learn, JSON.stringify(fl));

  // Phím mũi tên trong công tắc chế độ: đổi chế độ, KHÔNG bước giờ thiên văn (phím tắt toàn cục bỏ qua radiogroup).
  const gst0 = (await state(page)).gst;
  await page.getByRole('radio', { name: 'Cơ bản' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  const afterArrow = await state(page);
  check('arrow key inside the mode radiogroup switches mode and does not step time', afterArrow.uiMode === 'full' && afterArrow.gst === gst0, `uiMode=${afterArrow.uiMode}, Δgst=${afterArrow.gst - gst0}`);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(200);
  check('arrow back returns to Simple', (await state(page)).uiMode === 'simple');

  // Đổi sang Đầy đủ bằng công tắc rồi tải lại: vẫn Đầy đủ.
  await page.getByRole('radio', { name: 'Đầy đủ' }).check();
  await page.waitForTimeout(400);
  const fullNow = {
    body: await page.evaluate(() => document.body.className),
    sphere: await visible(page, '#view-sphere'),
    databar: await visible(page, '.databar'),
    simple: await visible(page, '#simple-controls'),
    stored: await page.evaluate((k) => localStorage.getItem(k), KEY),
  };
  check('switch to Đầy đủ shows the full interface and stores the choice', /mode-full/.test(fullNow.body) && fullNow.sphere && fullNow.databar && !fullNow.simple && fullNow.stored === '"full"', JSON.stringify(fullNow));
  await page.reload();
  await page.waitForFunction(() => window.__app?.horizon, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  const reloaded = { body: await page.evaluate(() => document.body.className), sphere: await visible(page, '#view-sphere') };
  check('after reload the page is still Full', /mode-full/.test(reloaded.body) && reloaded.sphere, JSON.stringify(reloaded));
  // fix-1 #1: in Full the card floats in the views again, with an opaque background.
  const fullCard = await page.evaluate(() => {
    const card = document.querySelector('.infocard');
    return { inViews: card.parentElement?.classList.contains('views'), docked: card.classList.contains('infocard--docked'), bg: getComputedStyle(card).backgroundColor, blur: getComputedStyle(card).backdropFilter };
  });
  check('fix-1 #1: Full keeps the card in the views, opaque (no see-through)', fullCard.inViews && !fullCard.docked && /^rgb\(/.test(fullCard.bg) && (fullCard.blur === 'none' || !fullCard.blur), JSON.stringify(fullCard));
  await page.screenshot({ path: `${SHOTS}full-1440.png` });
  await page.close();

  // ?mode=simple ghi đè giá trị đã lưu, và không được lưu.
  page = await open(ctx, withParam('mode', 'simple'));
  const ov = { body: await page.evaluate(() => document.body.className), stored: await page.evaluate((k) => localStorage.getItem(k), KEY) };
  check('?mode=simple overrides the stored Full and is not persisted', /mode-simple/.test(ov.body) && ov.stored === '"full"', JSON.stringify(ov));
  await page.close();
  await ctx.close();

  // ------------------------------------------------------------ 375 × 812 (điện thoại), ngữ cảnh mới
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  page = await open(phone);
  const m = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el || !el.getClientRects().length) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height), w: Math.round(r.width) };
    };
    return {
      scrollW: document.documentElement.scrollWidth,
      innerW: innerWidth,
      innerH: innerHeight,
      simple: document.body.classList.contains('mode-simple'),
      sw: box('.modeswitch'),
      opts: [...document.querySelectorAll('.modeswitch__opt')].map((o) => Math.round(o.getBoundingClientRect().height)),
      canvas: box('#view-horizon .view__canvas'),
      key: box('.view__key'),
      tabs: box('.viewtabs'),
      sphere: box('#view-sphere'),
      small: [...document.querySelectorAll('.topbar button, .topbar label, #simple-controls button, #simple-controls .simple__seg')]
        .filter((el) => el.getClientRects().length)
        .map((el) => [el.textContent.trim().slice(0, 14), Math.round(el.getBoundingClientRect().height)])
        .filter(([, h]) => h < 44),
    };
  });
  check('375: lands in Simple, no horizontal scroll', m.simple && m.scrollW <= m.innerW, `scrollWidth=${m.scrollW}`);
  check('375: mode switch on screen with 44 px targets', !!m.sw && m.sw.right <= m.innerW && m.sw.top >= 0 && m.opts.every((x) => x >= 44), JSON.stringify({ sw: m.sw, opts: m.opts }));
  check('375: no view-tab strip, no sphere', m.tabs === null && m.sphere === null);
  check('375: dome big on the first screen (canvas ≥ 360 px tall, φ caption above the fold)', !!m.canvas && m.canvas.h >= 360 && !!m.key && m.key.bottom <= m.innerH, JSON.stringify({ canvas: m.canvas, key: m.key }));
  check('375: every control in top bar and simple strip is ≥ 44 px tall', m.small.length === 0, JSON.stringify(m.small));
  const phoneCard = await page.evaluate(() => ({
    inViews: document.querySelector('.infocard').parentElement?.classList.contains('views'),
    names: [...document.querySelectorAll('.topbar__actions button')].filter((b) => b.getClientRects().length).map((b) => b.getAttribute('aria-label') || b.textContent.trim()),
  }));
  check('fix-1 #1/#8, 375: the card stays a chip in the view; every icon-only top-bar button has an accessible name', phoneCard.inViews && phoneCard.names.every((n) => n && n.length > 1), JSON.stringify(phoneCard));
  // fix-2 #8: nút mở/thu gọn thẻ là chevron (SVG) có tên "Chi tiết" / "Thu gọn", không còn "+" (đọc thành "thêm").
  const fold = () => page.evaluate(() => {
    const b = document.querySelector('.infocard__fold');
    const r = b.getBoundingClientRect();
    return { name: b.getAttribute('aria-label'), title: b.title, expanded: b.getAttribute('aria-expanded'), svg: !!b.querySelector('svg'), text: b.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) };
  });
  const f0 = await fold();
  check('fix-2 #8, 375: collapsed card: chevron named and titled "Chi tiết", aria-expanded=false, no "+" text, ≥ 44 px', f0.name === 'Chi tiết' && f0.title === 'Chi tiết' && f0.expanded === 'false' && f0.svg && f0.text === '' && f0.w >= 44 && f0.h >= 44, JSON.stringify(f0));
  await page.locator('.infocard__fold').click();
  await page.waitForTimeout(200);
  const f1 = await fold();
  check('fix-2 #8, 375: after a tap the chevron is named "Thu gọn", aria-expanded=true', f1.name === 'Thu gọn' && f1.title === 'Thu gọn' && f1.expanded === 'true', JSON.stringify(f1));
  await page.locator('.infocard__fold').click();
  await page.waitForTimeout(200);
  // fix-2 #7: khoảng trống rõ giữa thẻ đang chọn và dòng φ.
  const gap = await page.evaluate(() => Math.round(document.querySelector('.view__key').getBoundingClientRect().top - document.querySelector('.infocard').getBoundingClientRect().bottom));
  check('fix-2 #7, 375: ≥ 20 px between the selection chip and the φ line', gap >= 20, `${gap} px`);
  await page.screenshot({ path: `${SHOTS}simple-375.png`, fullPage: true });
  await page.close();
  await phone.close();
} finally {
  await browser.close();
}

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const passed = results.filter(Boolean).length;
console.log(`\nMODES ${passed}/${results.length} ${passed === results.length ? 'PASS' : 'FAIL'}`);
process.exit(passed === results.length ? 0 : 1);
