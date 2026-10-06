// Kiểm tra "kể chuyện qua giao diện" (docs/redesign/ux-brief.md §2–5).
// Chạy: npm run build && npx vite preview --port 4186 --strictPort (nền), rồi node docs/redesign/uat/ux.mjs
// Ảnh chụp lưu vào docs/redesign/shots/ux-after-*.png.
import { mkdirSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { expandFocus, showPanel } from '../../redesign-2/uat/focus-helpers.mjs';

const URL = process.env.UAT_URL ?? 'http://localhost:4186/?quality=fixed';
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
const SHOTS = new globalThis.URL('../shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

/** Mỗi lần gọi là một hồ sơ trình duyệt mới (bộ nhớ trống = lần đầu vào trang). */
async function open({ width = 1440, height = 900, reducedMotion = 'no-preference', init } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion });
  await ctx.addInitScript(FULL_MODE);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  await page.waitForFunction(() => document.querySelectorAll('.view__canvas canvas').length >= 2, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  return { ctx, page };
}

// ------------------------------------------------------------------ (a) gợi ý một lần, (b) cảnh mở đầu, (h) không còn hero/story
{
  const { ctx, page } = await open();
  // Fix round 1 (review-1 B4, E3): the floating toast is gone; the hint is ONE caption under the horizon view,
  // marked is-new until the first drag/click on a view. Fix round 2 (review-2 A2): the caption is always small and
  // muted (is-new only keeps it visible on phones); the φ key line above it is the headline.
  const cap = await page.evaluate(() => {
    const el = document.querySelector('#view-horizon .view__hint');
    const canvas = document.querySelector('#view-horizon .view__canvas');
    if (!el || !canvas) return null;
    return {
      text: el.textContent,
      isNew: el.classList.contains('is-new'),
      below: el.getBoundingClientRect().top >= canvas.getBoundingClientRect().bottom - 0.5,
      toasts: document.querySelectorAll('.firsthint').length,
      captions: document.querySelectorAll('.view__hint').length,
    };
  });
  check(
    '(a) first visit: one hint caption, under (not over) the horizon canvas, marked new, no floating toast',
    cap && cap.text === 'Kéo để xoay · bấm vào một ngôi sao' && cap.isNew && cap.below && cap.toasts === 0 && cap.captions === 1,
    JSON.stringify(cap),
  );

  const pressed = await page.locator('.btn--play').getAttribute('aria-pressed');
  check('(b) first load plays: play button aria-pressed="true"', pressed === 'true', `aria-pressed=${pressed}`);
  const playQuiet = await page.locator('.btn--play').evaluate((el) => !el.classList.contains('btn--primary'));
  check('(b) while playing, "Tạm dừng" is a quiet secondary button (not orange primary)', playQuiet);
  const rate = await page.locator('#rate + .ticks, output[for=rate]').first().textContent();
  check('(b) opening speed is one sidereal day in 60 s', /= 60 giây/.test(rate ?? ''), rate ?? '');

  const legacy = await page.locator('.hero, [class*=story]').count();
  check('(h) no element matches .hero or [class*=story]', legacy === 0, `count=${legacy}`);

  await page.screenshot({ path: `${SHOTS}ux-after-1440.png` });

  const box = await page.locator('#view-horizon .view__canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.8);
  await page.mouse.up();
  const muted = await page.evaluate(() => !document.querySelector('#view-horizon .view__hint').classList.contains('is-new'));
  const flag = await page.evaluate(() => localStorage.getItem('astrosphere.hint.v1'));
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.view__canvas canvas').length >= 2, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  const after = await page.locator('.view__hint.is-new').count();
  check('(a) after the first drag the caption is muted, and stays muted after reload (flag set)', muted && flag === 'true' && after === 0, `muted=${muted} flag=${flag} new=${after}`);
  await ctx.close();
}
{
  const { ctx, page } = await open({ init: () => localStorage.setItem('astrosphere.hint.v1', 'true') });
  const n = await page.locator('.view__hint.is-new').count();
  check('(a) with astrosphere.hint.v1 preset, the caption starts muted', n === 0, `new=${n}`);
  await ctx.close();
}
{
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  const pressed = await page.locator('.btn--play').getAttribute('aria-pressed');
  check('(b) prefers-reduced-motion: nothing autoplays (aria-pressed="false")', pressed === 'false', `aria-pressed=${pressed}`);
  const playPrimary = await page.locator('.btn--play').evaluate((el) => el.classList.contains('btn--primary') && /Bắt đầu/.test(el.textContent));
  check('(b) while paused, "Bắt đầu" is the orange primary action', playPrimary);
  // "Đặt lại" hỏi lại trước (quyết định 2026-10-05). Bấm Chạy, rồi Đặt lại → Hủy: mọi thứ giữ nguyên (vẫn chạy).
  // Bố cục tập trung (2026-10-05): nút Chạy nằm trong bảng Hoạt ảnh, mở ra trước.
  await showPanel(page, 'animation');
  await page.locator('.btn--play').click();
  await page.locator('.btn--top-reset').click();
  const dlg = page.locator('#dlg-reset');
  await dlg.waitFor({ state: 'visible' });
  await dlg.getByRole('button', { name: 'Hủy', exact: true }).click();
  await page.waitForTimeout(200);
  const afterCancel = await page.locator('.btn--play').getAttribute('aria-pressed');
  check('(b) "Đặt lại" → "Hủy" keeps the state (still playing)', afterCancel === 'true' && !(await dlg.isVisible()), `aria-pressed=${afterCancel}`);
  await page.locator('.btn--top-reset').click();
  await dlg.getByRole('button', { name: 'Đặt lại', exact: true }).click();
  await page.waitForTimeout(200);
  const afterReset = await page.locator('.btn--play').getAttribute('aria-pressed');
  check('(b) prefers-reduced-motion: still paused after "Đặt lại"', afterReset === 'false', `aria-pressed=${afterReset}`);
  await ctx.close();
}

// ------------------------------------------------------------------ (c) dòng đặt cạnh nhau, (d) trạng thái trống, (e) nhóm, (f) dòng giải thích
{
  const { ctx, page } = await open();

  // Bố cục tập trung (owner decision 2026-10-05, ≥ 1101 px): giản đồ chân trời bên trái, rộng ít nhất gấp đôi cột thiên
  // cầu (trước đây ~3fr/2fr); DOM cùng thứ tự.
  const lay = await page.evaluate(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect();
    const hz = r('view-horizon');
    const sp = r('view-sphere');
    const views = [...document.querySelectorAll('.views > .view')].map((v) => v.id);
    return { hzLeft: hz.left, spLeft: sp.left, ratio: +(hz.width / sp.width).toFixed(2), views };
  });
  check('layout: horizon view left and dominant (focus layout: at least 2× the sphere width), first in DOM', lay.hzLeft < lay.spLeft && lay.ratio >= 2 && lay.views[0] === 'view-horizon', JSON.stringify(lay));
  // Các bước sau dùng câu nghĩa của dải số liệu và bảng điều khiển: mở cả hai.
  await expandFocus(page, { data: true, panels: true });
  const cells = await page.locator('.databar .data__item').evaluateAll((els) => els.map((e) => e.dataset.emphasis));
  check('numbers bar order: φ, pole, incl, λ, LST, GST, solar, selected', cells.join() === 'lat,pole,incl,lon,lst,gst,solar,selected', cells.join());
  const notes = await page.locator('.databar .data__item:not([hidden]) .data__n').evaluateAll((els) => els.map((e) => e.textContent));
  check('every visible numbers cell has a sub-caption', notes.length >= 7 && notes.every((n) => n && n.length > 0), notes.join(' | '));

  await page.locator('#lat-input').evaluate((el) => el.blur());
  await showPanel(page, 'location');
  await page.locator('#panel-location input[type=range]').fill('45');
  // Bảng số liệu cập nhật ở nhịp khung hình kế tiếp (chậm khi vẽ bằng phần mềm): chờ điều kiện thay vì chờ cố định.
  await page.waitForFunction(() => /45/.test(document.querySelector('[data-emphasis=pole] .data__v')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => {});
  const line = await page.locator('#pole-line').textContent();
  const pole = await page.locator('[data-emphasis=pole] .data__v').textContent();
  check('(c) latitude slider at 45 → juxtaposition line reads 45', /Thiên cực Bắc cao 45/.test(line ?? '') && /45/.test(pole ?? ''), `line=${JSON.stringify(line)} pole=${pole}`);
  await page.locator('#panel-location input[type=range]').fill('0');
  await page.waitForTimeout(150);
  const eqLine = await page.locator('#pole-line').textContent();
  check('(c) at φ = 0 the line says the poles lie on the horizon', /nằm ngay trên chân trời/.test(eqLine ?? ''), JSON.stringify(eqLine));

  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('.infocard').classList.contains('is-empty'), null, { timeout: 10000 }).catch(() => {});
  const empty = await page.evaluate(() => {
    const c = document.querySelector('.infocard');
    const r = c.getBoundingClientRect();
    return { hidden: c.hidden, isEmpty: c.classList.contains('is-empty'), visible: r.width > 0 && r.height > 0, text: c.innerText.replace(/\s+/g, ' ').trim() };
  });
  check(
    '(d) after Esc the info card shows the empty state and is not hidden',
    !empty.hidden && empty.isEmpty && empty.visible && /Chưa chọn thiên thể nào/.test(empty.text) && /Bấm vào một ngôi sao/.test(empty.text),
    JSON.stringify(empty),
  );

  await showPanel(page, 'display');
  const groups = await page.locator('#panel-display > details').evaluateAll((ds) =>
    ds.map((d) => ({ title: d.querySelector('.sub__title')?.textContent, teaser: d.querySelector('.sub__teaser')?.textContent ?? '', open: d.open })),
  );
  const titles = groups.map((g) => g.title).join(' | ');
  check(
    '(e) display panel: 6 groups in story order, only the first open, each with a teaser',
    titles === 'Bầu trời quay | Chân trời của bạn | Hai hệ tọa độ | Mọc – lặn | Mở rộng | Nhãn' &&
      groups.map((g) => g.open).join() === 'true,false,false,false,false,false' &&
      groups.every((g) => g.teaser.length > 0),
    `${titles} · open=${groups.map((g) => g.open).join()}`,
  );

  // (f) Mở nhóm "Chân trời của bạn", bật kinh tuyến: dòng giải thích hiện và được nối bằng aria-describedby.
  await page.locator('#panel-display details[data-group=horizon] > summary').click();
  const meridian = page.getByLabel('Kinh tuyến thiên cầu');
  const item = page.locator('.check-item[data-emphasis=meridian]');
  const before = await item.locator('.check__hint').isVisible();
  await meridian.check();
  const afterOn = await item.locator('.check__hint').isVisible();
  const desc = await meridian.evaluate((el) => {
    const id = el.getAttribute('aria-describedby');
    return id ? document.getElementById(id)?.textContent : null;
  });
  check('(f) checking meridian reveals its one-line hint (aria-describedby)', !before && afterOn && /lên cao nhất/.test(desc ?? ''), `before=${before} after=${afterOn} desc=${JSON.stringify(desc)}`);
  await meridian.uncheck();
  const afterOff = await item.locator('.check__hint').isVisible();
  check('(f) unchecking hides the hint again', !afterOff, `visible=${afterOff}`);
  await ctx.close();
}

// ------------------------------------------------------------------ (i) thẻ thông tin trên máy tính (fix round 2, review-2 B2/B3)
// Thẻ bắt đầu thu gọn (một dòng tên); chọn một đối tượng khác → thẻ mở ra; bấm thanh tiêu đề → thu gọn; bỏ chọn (Esc)
// → thu gọn. Bố cục tập trung (≥ 1101 px): khung nhìn luôn hai cột, thẻ mở ra nằm DƯỚI thiên cầu trong cột phải
// (trước đây: cột thứ ba).
{
  const { ctx, page } = await open();
  await expandFocus(page, { data: true, panels: true });
  const state = () =>
    page.evaluate(() => {
      const c = document.querySelector('.infocard');
      const cr = c.getBoundingClientRect();
      const sr = document.getElementById('view-sphere').getBoundingClientRect();
      return {
        collapsed: c.classList.contains('is-collapsed'),
        title: c.querySelector('.infocard__title').textContent,
        cols: getComputedStyle(document.querySelector('.views')).gridTemplateColumns.split(' ').length,
        h: Math.round(cr.height),
        underSphere: cr.top >= sr.bottom - 0.5 && cr.left >= sr.left - 0.5 && cr.right <= sr.right + 0.5,
      };
    });
  const selLines = await page.evaluate(() => {
    const v = document.querySelector('.databar [data-emphasis=selected] .data__v');
    const range = document.createRange();
    range.selectNodeContents(v);
    return { text: v.textContent, lines: [...new Set([...range.getClientRects()].map((r) => Math.round(r.top)))].length };
  });
  check('1440: selected-object value renders as exactly two lines (α, δ / A, h)', selLines.lines === 2 && /\nA\u00a0/.test(selLines.text), JSON.stringify(selLines));
  // review-3 G3: gợi ý mẫu trong ô nhập đọc như gợi ý (nghiêng, màu phụ), khác chữ đã nhập.
  const ph = await page.evaluate(() => {
    const i = document.querySelector('#panel-stars input[placeholder="6h45m"]');
    const p = getComputedStyle(i, '::placeholder');
    return { color: p.color, style: p.fontStyle, value: getComputedStyle(i).color };
  });
  check('1440: input placeholders are italic and dimmer than typed values', ph.style === 'italic' && ph.color !== ph.value, JSON.stringify(ph));
  // review-3 D1: tiêu đề "Thiên cầu" là số hai nhưng không trông như bị vô hiệu: cùng màu chữ và độ đậm, nhỏ hơn.
  const titles = await page.evaluate(() => {
    const st = (sel) => { const cs = getComputedStyle(document.querySelector(sel)); return { color: cs.color, weight: Number(cs.fontWeight), size: parseFloat(cs.fontSize) }; };
    return { horizon: st('#view-horizon .view__head h2'), sphere: st('#view-sphere .view__head h2') };
  });
  check('1440: "Thiên cầu" title has the same colour and weight as the horizon title, one step smaller', titles.sphere.color === titles.horizon.color && titles.sphere.weight === titles.horizon.weight && titles.sphere.size < titles.horizon.size, JSON.stringify(titles));
  const first = await state();
  check('(i) 1440: info card starts collapsed to one line, two view columns', first.collapsed && first.cols === 2 && first.h < 60 && first.title === 'Polaris', JSON.stringify(first));
  await showPanel(page, 'stars');
  await page.locator('#panel-stars input[placeholder="6h45m"]').fill('6h45m');
  await page.locator('#panel-stars input[placeholder="−16,7"]').fill('-16,7');
  await page.getByRole('button', { name: 'Thêm sao (α, δ)' }).click();
  // Thẻ cập nhật ở nhịp giao diện kế tiếp (onUiTick); chờ theo điều kiện, không theo thời gian cố định.
  await page.waitForFunction(() => document.querySelector('.infocard__title')?.textContent !== 'Polaris', null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(200);
  const opened = await state();
  check('(i) selecting another object opens the card under the sphere view (focus layout: still two columns)', !opened.collapsed && opened.cols === 2 && opened.underSphere && opened.title !== 'Polaris', JSON.stringify(opened));
  await page.locator('.infocard__title').click();
  await page.waitForTimeout(200);
  const folded = await state();
  check('(i) clicking the card header folds it again', folded.collapsed && folded.cols === 2, JSON.stringify(folded));
  await page.locator('.infocard__title').click();
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Escape');
  // Thẻ cập nhật ở nhịp giao diện kế tiếp: chờ theo điều kiện (thẻ thu lại), không theo thời gian cố định.
  await page.waitForFunction(() => document.querySelector('.infocard')?.classList.contains('is-collapsed'), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(200);
  const cleared = await state();
  check('(i) Esc (clear selection) folds the card back', cleared.collapsed && cleared.cols === 2, JSON.stringify(cleared));
  await ctx.close();
}

// ------------------------------------------------------------------ (g) điện thoại 375×812
{
  const { ctx, page } = await open({ width: 375, height: 812 });
  const defView = await page.locator('.viewtabs [role=tab][aria-selected=true]').textContent();
  check('375: default view tab is the horizon diagram', defView === 'Giản đồ chân trời', defView ?? '');
  const collapsed = await page.evaluate(() => document.querySelector('.infocard').classList.contains('is-collapsed'));
  check('375: info card starts collapsed', collapsed);
  // review-3 B4: dòng cốt lõi nằm trong màn hình đầu; thẻ thu gọn là MỘT dòng mảnh có tên và A/h; chạm để mở.
  const first = await page.evaluate(() => {
    const key = document.querySelector('#view-horizon .view__key');
    const k = key.getBoundingClientRect();
    const c = document.querySelector('.infocard');
    const r = c.getBoundingClientRect();
    return {
      keyText: key.textContent,
      keyTop: Math.round(k.top),
      keyBottom: Math.round(k.bottom),
      keyVisible: getComputedStyle(key).visibility !== 'hidden' && k.height > 0,
      card: { h: Math.round(r.height), text: c.querySelector('.infocard__head').textContent },
    };
  });
  check('375: key formula line "φ = … · Độ cao thiên cực …" is inside the first 812 px', first.keyVisible && /^φ = .*Độ cao thiên cực/.test(first.keyText) && first.keyTop >= 0 && first.keyBottom <= 812, JSON.stringify(first));
  check('375: collapsed info card is one slim row (≤ 52 px) with the name and A/h', first.card.h <= 52 && /Polaris/.test(first.card.text) && /A\u00a0[\d,]+°/.test(first.card.text) && /h\u00a0[+−-][\d,]+°/.test(first.card.text), JSON.stringify(first.card));
  // review-3 D2: giá trị đối tượng đang chọn là hai dòng có chủ ý, không ngắt giữa "h" và giá trị.
  const selLines = await page.evaluate(() => {
    const v = document.querySelector('.databar [data-emphasis=selected] .data__v');
    const range = document.createRange();
    range.selectNodeContents(v);
    const tops = [...new Set([...range.getClientRects()].map((r) => Math.round(r.top)))];
    return { text: v.textContent, lines: tops.length };
  });
  check('375: selected-object value renders as exactly two lines (α, δ / A, h)', selLines.lines === 2 && /\nA\u00a0/.test(selLines.text), JSON.stringify(selLines));
  await page.locator('.infocard__title').click();
  await page.waitForTimeout(200);
  const opened = await page.evaluate(() => ({ collapsed: document.querySelector('.infocard').classList.contains('is-collapsed'), h: Math.round(document.querySelector('.infocard').getBoundingClientRect().height) }));
  check('375: tapping the slim row expands the info card', !opened.collapsed && opened.h > 52, JSON.stringify(opened));
  await page.locator('.infocard__title').click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}ux-after-375.png` });
  const tabs = page.locator('.paneltabs [role=tab]');
  const n = await tabs.count();
  for (let i = 0; i < n; i++) {
    const tab = tabs.nth(i);
    if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
    await page.waitForTimeout(100);
    const label = await tab.textContent();
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    check(`(g) 375: no horizontal scroll with panel tab "${label}"`, sw <= iw, `scrollWidth=${sw} innerWidth=${iw}`);
  }
  await ctx.close();
}

await browser.close();
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `UX FAIL (${failed.length}/${results.length})` : `UX PASS (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
