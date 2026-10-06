// Kiểm tra luồng giao diện U1: thương hiệu, khung ứng dụng, phím tắt, trình chiếu, Ôn tập.
// Chạy: npm run build && npx vite preview --port 4174 --strictPort (nền), rồi node docs/redesign/uat/ui.mjs
// Ảnh chụp lưu vào docs/redesign/shots/.
import { mkdirSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { showPanel } from '../../redesign-2/uat/focus-helpers.mjs';

const URL = process.env.UAT_URL ?? 'http://localhost:4174/?quality=fixed';
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

async function openPage(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript(FULL_MODE);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  await page.waitForFunction(() => document.querySelectorAll('.view__canvas canvas').length >= 2, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  return page;
}
const noHScroll = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));

// ------------------------------------------------------------------ Điện thoại 375×812
{
  const page = await openPage(375, 812);
  const canvases = await page.evaluate(() => document.querySelectorAll('.view__canvas canvas').length);
  check('375: both 3D canvases exist', canvases >= 2, `canvases=${canvases}`);
  // AGENTS.md: vùng chạm ≥ 44 px trên điện thoại — đo hộp của MỌI nút đang hiện trên thanh trên cùng (review-3 D2).
  const topBtns = await page.evaluate(() =>
    [...document.querySelectorAll('.topbar button')]
      .filter((b) => getComputedStyle(b).display !== 'none')
      .map((b) => { const r = b.getBoundingClientRect(); return { name: b.getAttribute('aria-label') || b.textContent.trim(), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }; }),
  );
  check('375: every visible top-bar button is ≥ 44 × 44 px', topBtns.length >= 4 && topBtns.every((b) => b.w >= 44 && b.h >= 44), JSON.stringify(topBtns));
  const tabs = page.locator('.paneltabs [role=tab]');
  const n = await tabs.count();
  for (let i = 0; i < n; i++) {
    const tab = tabs.nth(i);
    if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
    const label = await tab.textContent();
    const { sw, iw } = await noHScroll(page);
    check(`375: no horizontal scroll with panel tab "${label}"`, sw <= iw, `scrollWidth=${sw} innerWidth=${iw}`);
  }
  // Tab lưu động: ←/→/Home/End trên danh sách thẻ bảng điều khiển
  await tabs.nth(0).click();
  await tabs.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  const roving = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.paneltabs [role=tab]')];
    return { sel: all.findIndex((t) => t.getAttribute('aria-selected') === 'true'), focus: all.indexOf(document.activeElement), tabindex: all.map((t) => t.getAttribute('tabindex')) };
  });
  check('375: ArrowRight moves panel tab selection and focus (roving tabindex)', roving.sel === 1 && roving.focus === 1 && roving.tabindex.join() === '-1,0,-1,-1', JSON.stringify(roving));
  await page.keyboard.press('End');
  const endSel = await page.evaluate(() => [...document.querySelectorAll('.paneltabs [role=tab]')].findIndex((t) => t.getAttribute('aria-selected') === 'true'));
  check('375: End selects the last panel tab', endSel === n - 1, `selected=${endSel}`);

  await page.screenshot({ path: `${SHOTS}ui-375.png`, fullPage: false });

  await page.getByRole('button', { name: 'Ôn tập' }).click();
  await page.waitForSelector('#learn:not([hidden])');
  await page.waitForTimeout(200);
  const d = await noHScroll(page);
  check('375: no horizontal scroll with Ôn tập drawer open', d.sw <= d.iw, `scrollWidth=${d.sw} innerWidth=${d.iw}`);
  await page.close();
}

// ------------------------------------------------------------------ Máy tính bảng dọc 768×1024 (≤ 900 px: nút chỉ biểu tượng)
{
  const page = await openPage(768, 1024);
  const topBtns = await page.evaluate(() =>
    [...document.querySelectorAll('.topbar button')]
      .filter((b) => getComputedStyle(b).display !== 'none')
      .map((b) => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }; }),
  );
  check('768: every visible top-bar button is ≥ 44 × 44 px', topBtns.length >= 5 && topBtns.every((b) => b.w >= 44 && b.h >= 44), JSON.stringify(topBtns));
  await page.close();
}

// ------------------------------------------------------------------ Máy tính 1440×900
{
  const page = await openPage(1440, 900);
  const clubLinks = await page.locator('a[href^="https://web-usac.vercel.app"]').evaluateAll((as) => as.map((a) => ({ rel: a.rel, target: a.target })));
  check('exactly one club link (rel=noopener, target=_blank)', clubLinks.length === 1 && clubLinks[0].rel.includes('noopener') && clubLinks[0].target === '_blank', JSON.stringify(clubLinks));

  const order = await page.locator('.topbar__actions .btn .btn__text').allTextContents();
  // redesign-2 C: nút Codex đứng ngay trước Trợ giúp.
  check('top bar order', order.join('|') === 'Ôn tập|Trình chiếu|Đặt lại|USACodex|Trợ giúp|Giới thiệu', order.join(' | '));

  const brand = await page.evaluate(() => {
    const cs = (sel, p) => getComputedStyle(document.querySelector(sel))[p];
    return { body: cs('body', 'backgroundColor'), topbarBorder: cs('.topbar', 'borderBottomColor'), primaryBg: cs('.btn--primary', 'backgroundColor'), primaryText: cs('.btn--primary', 'color') };
  });
  // Fix round 1 (review-1 G1): orange is reserved for interactive things, so the top rule is now neutral.
  check('brand: dark body, neutral top rule, orange primary with dark text', brand.body === 'rgb(10, 10, 10)' && brand.topbarBorder === 'rgb(46, 46, 46)' && brand.primaryBg === 'rgb(242, 101, 34)' && brand.primaryText === 'rgb(10, 10, 10)', JSON.stringify(brand));
  const staticOrange = await page.evaluate(() => {
    const orange = ['rgb(242, 101, 34)', 'rgb(255, 138, 76)'];
    const sels = ['.brand__org', '.panel__title', '.infocard h4', '.value--big', '.view__key', '.data__v'];
    return sels.filter((sel) => [...document.querySelectorAll(sel)].some((el) => orange.includes(getComputedStyle(el).color) || orange.includes(getComputedStyle(el, '::before').backgroundColor)));
  });
  check('accent discipline: no static heading, kicker, title bar or value is orange', staticOrange.length === 0, staticOrange.join(', '));

  // Cần một thiên thể đang chọn: mặc định là Polaris (HIP 11767); nếu không có thì dùng "Thiết lập" của nhiệm vụ 1.
  // Thẻ thông tin không còn ẩn khi bỏ chọn (có trạng thái trống), nên "đang chọn" = thẻ hiện VÀ không ở trạng thái trống.
  const cardShown = () => page.evaluate(() => { const c = document.querySelector('.infocard'); return !c.hidden && !c.classList.contains('is-empty'); });
  if (!(await cardShown())) {
    await page.keyboard.press('l');
    await page.locator('.learn__task').first().getByRole('button', { name: /Thiết lập/ }).click();
    await page.keyboard.press('Escape');
  }
  check('precondition: a star is selected', await cardShown());
  // Bố cục tập trung (≥ 1101 px): bảng điều khiển thu gọn mặc định — mở bảng Vị trí để ô vĩ độ thật sự nhận tiêu điểm.
  await showPanel(page, 'location');
  await page.locator('#lat-input').focus();
  await page.keyboard.press('Escape');
  check('Esc in the latitude input keeps the selection', await cardShown());
  await page.locator('#lat-input').evaluate((el) => el.blur());

  const playing = () => page.locator('.btn--play').getAttribute('aria-pressed');
  const before = await playing();
  await showPanel(page, 'display'); // <summary> đầu tiên nằm trong bảng Hiển thị
  const summary = page.locator('details > summary').first();
  await summary.focus();
  const openBefore = await summary.evaluate((s) => s.parentElement.open);
  await page.keyboard.press(' ');
  await page.waitForTimeout(100);
  const after = await playing();
  const openAfter = await summary.evaluate((s) => s.parentElement.open);
  check('Space on a focused <summary> does not toggle playback', before === after, `playing ${before}→${after}; details open ${openBefore}→${openAfter}`);
  await summary.evaluate((s) => s.blur());

  await page.screenshot({ path: `${SHOTS}ui-1440.png` });

  await page.keyboard.press('f');
  await page.waitForTimeout(300);
  const on = await page.evaluate(() => ({ present: document.body.classList.contains('present'), pressed: document.querySelector('.topbar__actions .btn:nth-child(2)').getAttribute('aria-pressed'), panels: getComputedStyle(document.querySelector('.panels')).display, legend: getComputedStyle(document.querySelector('.legend')).display }));
  check('F turns presentation mode on (panels hidden, legend kept, aria-pressed)', on.present && on.pressed === 'true' && on.panels === 'none' && on.legend !== 'none', JSON.stringify(on));
  await page.keyboard.press('f');
  await page.waitForTimeout(300);
  const off = await page.evaluate(() => document.body.classList.contains('present'));
  check('F again turns presentation mode off', !off);

  // Gợi ý sau khi trả lời đúng: giữ 2 điểm.
  await page.keyboard.press('l');
  await page.waitForSelector('#learn:not([hidden])');
  const task = page.locator('.learn__task').first();
  await task.locator('input.num').fill('21');
  await task.getByRole('button', { name: 'Kiểm tra' }).click();
  const scoreAfterCorrect = await page.locator('.learn__score').textContent();
  await task.getByRole('button', { name: 'Gợi ý' }).click();
  const scoreAfterHint = await page.locator('.learn__score').textContent();
  check('hint after a correct first answer keeps 2 points', /Điểm: 2\//.test(scoreAfterCorrect) && /Điểm: 2\//.test(scoreAfterHint), `${scoreAfterCorrect} → ${scoreAfterHint}`);
  // Esc đóng ngăn và trả tiêu điểm về nút Ôn tập (mở bằng phím L nên trả về nút).
  await task.getByRole('button', { name: 'Gợi ý' }).focus();
  await page.keyboard.press('Escape');
  const focusBack = await page.evaluate(() => ({ hidden: document.getElementById('learn').hidden, focus: document.activeElement?.textContent?.trim() }));
  check('Esc closes Ôn tập and returns focus', focusBack.hidden && /Ôn tập/.test(focusBack.focus ?? ''), JSON.stringify(focusBack));

  // Giới thiệu (tải lười) mở được.
  await page.getByRole('button', { name: 'Giới thiệu' }).click();
  await page.waitForSelector('#dlg-about[open]');
  check('Giới thiệu dialog (lazy) opens', await page.locator('#dlg-about[open]').count() === 1);
  await page.keyboard.press('Escape');
  const dlgClosed = await page.evaluate(() => { const c = document.querySelector('.infocard'); return !document.getElementById('dlg-about').open && !c.hidden && !c.classList.contains('is-empty'); });
  check('Esc closes the native dialog first and keeps the selection', dlgClosed);
  await page.close();
}

// ------------------------------------------------------------------ Máy chiếu 1920×1080, chế độ trình chiếu
{
  const page = await openPage(1920, 1080);
  await page.getByRole('button', { name: 'Trình chiếu' }).click();
  await page.waitForTimeout(800);
  const st = await page.evaluate(() => ({
    present: document.body.classList.contains('present'),
    font: getComputedStyle(document.body).fontSize,
    viewsH: Math.round(document.querySelector('.views').getBoundingClientRect().height),
    footer: getComputedStyle(document.querySelector('.site-footer')).display,
    databar: getComputedStyle(document.querySelector('.databar')).display,
    sw: document.documentElement.scrollWidth,
    iw: innerWidth,
  }));
  check('1920: button enters presentation (20px base, views tall, footer/databar hidden)', st.present && st.font === '20px' && st.viewsH > 800 && st.footer === 'none' && st.databar === 'none', JSON.stringify(st));
  await page.screenshot({ path: `${SHOTS}ui-present-1920.png` });
  await page.close();
}

await browser.close();
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `UI FAIL (${failed.length}/${results.length})` : `UI PASS (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
