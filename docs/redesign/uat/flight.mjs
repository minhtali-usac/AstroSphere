// Kiểm tra nghiệm thu «Bay vào vũ trụ» trên trình duyệt thật (Chromium, swiftshader).
// Chạy với máy chủ phát triển (cần window.__app và window.__flight):
//   npx vite --port 5173 --strictPort (nền), rồi node docs/redesign/uat/flight.mjs
// Biến môi trường: UAT_URL (mặc định http://127.0.0.1:5173/?quality=fixed), PLAYWRIGHT (đường dẫn index.mjs của
// Playwright, mặc định bản cài chung trong /opt), UAT_SHOTS (thư mục lưu ảnh chụp, tùy chọn).

const PW = process.env.PLAYWRIGHT ?? '/opt/node-tools/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const URL = process.env.UAT_URL ?? 'http://127.0.0.1:5173/?quality=fixed';
const SHOTS = process.env.UAT_SHOTS ?? '';
const origin = new globalThis.URL(URL).origin;

const INIT = () => {
  try {
    localStorage.setItem('astrosphere.mode.v1', JSON.stringify('full'));
    localStorage.setItem('astrosphere.guide.v1', JSON.stringify({ hello: true }));
  } catch {
    /* bị chặn lưu trữ: trang về chế độ Cơ bản, các kiểm tra sẽ báo */
  }
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function openPage(opts = {}) {
  const page = await browser.newPage({ viewport: opts.viewport ?? { width: 1280, height: 800 } });
  if (opts.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(INIT);
  const foreign = [];
  const errors = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) foreign.push(u);
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  await page.waitForFunction(() => document.querySelectorAll('.view__canvas canvas').length >= 2, null, { timeout: 30000 });
  return { page, foreign, errors };
}

const openFlight = async (page) => {
  await page.click('.btn--top-flight');
  await page.waitForFunction(() => !!window.__flight, null, { timeout: 30000 });
  await page.waitForTimeout(600);
};
const arrive = (page) => page.waitForFunction(() => !window.__flight.traveling, null, { timeout: 30000 });
const flyTo = async (page, key) => {
  await page.evaluate((k) => window.__flight.flyTo(window.__flight.get(k)), key);
  await arrive(page);
  await page.waitForTimeout(400);
};
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });
const canvasShot = (page) => page.locator('.flight__view canvas').screenshot();

// ---------------------------------------------------------------- Máy tính để bàn
{
  const { page, foreign, errors } = await openPage();
  const rendersBefore = await page.evaluate(() => window.__app.loop.stats.renders);
  await openFlight(page);
  await shot(page, 'flight-start');

  // Khung nhìn không trống: đếm điểm ảnh sáng trên ảnh chụp canvas.
  const lit = await page.evaluate(() => {
    // Vẽ lại một khung rồi đọc ngay trong cùng tác vụ (bộ đệm WebGL chưa bị xóa).
    window.__flight.select(window.__flight.selected);
    window.__flight.frame(0);
    const c = document.querySelector('.flight__view canvas');
    const g = document.createElement('canvas');
    g.width = 160;
    g.height = 100;
    const x = g.getContext('2d');
    x.drawImage(c, 0, 0, 160, 100);
    const d = x.getImageData(0, 0, 160, 100).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) n++;
    return n / (160 * 100);
  });
  check('khung nhìn bay có hình (không trống)', lit > 0.02, `${(lit * 100).toFixed(1)} % điểm ảnh sáng`);
  const startFocus = await page.evaluate(() => window.__flight.focus?.key);
  check('bắt đầu quanh Trái Đất, phía trên người quan sát', startFocus === 'body:earth', startFocus);

  // Bay tới Sao Hỏa: dừng trong vòng 3 bán kính tính từ bề mặt.
  await flyTo(page, 'body:mars');
  const mars = await page.evaluate(() => {
    const v = window.__flight;
    const t = v.get('body:mars');
    return { d: v.distanceTo(t), r: t.radiusKm, label: t.label.visible };
  });
  check('bay tới Sao Hỏa: cách bề mặt ≤ 3 bán kính', mars.d - mars.r <= 3 * mars.r, `${((mars.d - mars.r) / mars.r).toFixed(2)} bán kính`);
  check('nhãn Sao Hỏa hiện', mars.label);
  await shot(page, 'flight-mars');

  // Không rung khi đứng yên: hai ảnh chụp cách nhau 1 s giống hệt, ở Sao Hải Vương và ở một sao cách ≈ 500 pc.
  await flyTo(page, 'body:neptune');
  const n1 = await canvasShot(page);
  await page.waitForTimeout(1000);
  const n2 = await canvasShot(page);
  check('đứng yên ở Sao Hải Vương: hai khung hình giống hệt', n1.equals(n2));
  const far = await page.evaluate(() => {
    const v = window.__flight;
    const cat = v.things.length;
    let best = -1;
    let bestErr = Infinity;
    for (let i = 0; i < 1334; i++) {
      const t = v.starThing(i);
      const pc = Math.hypot(t.pos[0], t.pos[1], t.pos[2]) / 3.0856775814913673e13;
      if (Math.abs(pc - 500) < bestErr && !v.isUncertain(t)) {
        bestErr = Math.abs(pc - 500);
        best = i;
      }
    }
    const t = v.starThing(best);
    return { key: t.key, name: t.name, pc: Math.hypot(t.pos[0], t.pos[1], t.pos[2]) / 3.0856775814913673e13, cat };
  });
  await flyTo(page, far.key);
  const f1 = await canvasShot(page);
  await page.waitForTimeout(1000);
  const f2 = await canvasShot(page);
  check(`đứng yên cạnh ${far.name} (${far.pc.toFixed(0)} pc): hai khung hình giống hệt`, f1.equals(f2));
  await shot(page, 'flight-500pc');

  // Hệ ngoại hành tinh: nhãn «ước tính» / «ứng dụng tự chọn» có trong bảng thông tin.
  const exoKey = await page.evaluate(() => window.__flight.things.find((t) => t.kind === 'exo' && t.exo.radeEstimated)?.key);
  await flyTo(page, exoKey);
  const tags = await page.evaluate(() => [...document.querySelectorAll('.flight__tag')].map((e) => e.textContent));
  check('ngoại hành tinh: có nhãn «ước tính» và «ứng dụng tự chọn»', tags.includes('ước tính') && tags.includes('ứng dụng tự chọn'), tags.join(', '));
  await shot(page, 'flight-exo');

  // Không tạo hình học mới trong 5 s bay tự do (W giữ).
  const mem0 = await page.evaluate(() => ({ ...window.__flight.renderer.info.memory }));
  const frames0 = await page.evaluate(() => window.__flight.renderer.info.render.frame);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(5000);
  await page.keyboard.up('KeyW');
  const mem1 = await page.evaluate(() => ({ ...window.__flight.renderer.info.memory }));
  const frames1 = await page.evaluate(() => window.__flight.renderer.info.render.frame);
  check('bay tự do 5 s: không tạo hình học hay texture mới', mem0.geometries === mem1.geometries && mem0.textures === mem1.textures, `geometries ${mem0.geometries} → ${mem1.geometries}`);
  console.log(`      khung hình vẽ trong 5 s bay tự do (swiftshader, không phải số đo FPS trên máy thật): ${frames1 - frames0}`);

  // Esc: dừng chuyến bay đang diễn ra, rồi đóng chế độ bay; tiêu điểm về nút đã mở; hai khung nhìn vẽ lại.
  await page.evaluate(() => window.__flight.flyTo(window.__flight.get('body:jupiter')));
  await page.keyboard.press('Escape');
  const stillOpen = await page.evaluate(() => document.getElementById('dlg-flight').open && !window.__flight.traveling);
  check('Esc lần 1 dừng chuyến bay, hộp thoại vẫn mở', stillOpen);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const closed = await page.evaluate(() => ({
    open: document.getElementById('dlg-flight').open,
    focus: document.activeElement?.classList.contains('btn--top-flight'),
  }));
  const rendersAfter = await page.evaluate(async () => {
    const a = window.__app.loop.stats.renders;
    window.__app.sphere.dirty = window.__app.horizon.dirty = true;
    await new Promise((r) => setTimeout(r, 1000));
    return window.__app.loop.stats.renders - a;
  });
  check('Esc lần 2 đóng chế độ bay, tiêu điểm về nút «Bay vào vũ trụ»', !closed.open && closed.focus);
  check('hai khung nhìn chính vẽ lại sau khi đóng', rendersAfter > 0 && rendersBefore > 0, `${rendersAfter} lần vẽ trong 1 s`);

  // «Bay tới» trong thẻ thông tin của một sao.
  await page.evaluate(() => window.__app.actions.select({ kind: 'catalog', index: 0 }));
  await page.waitForTimeout(300);
  const flyVisible = await page.isVisible('.infocard__fly');
  check('thẻ thông tin của sao có nút «Bay tới»', flyVisible);
  if (flyVisible) {
    await page.click('.infocard__fly');
    await page.waitForFunction(() => !!window.__flight, null, { timeout: 30000 });
    await arrive(page);
    const focus = await page.evaluate(() => window.__flight.focus?.kind);
    check('«Bay tới» mở chế độ bay và tới sao đã chọn', focus === 'star', focus);
  }
  check('không có yêu cầu mạng ra ngoài nguồn của trang', foreign.length === 0, foreign.slice(0, 3).join(' '));
  check('không có lỗi trên trang', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

// ---------------------------------------------------------------- Điện thoại 375 px
{
  const { page } = await openPage({ viewport: { width: 375, height: 740 } });
  const topW = await page.evaluate(() => document.documentElement.scrollWidth);
  check('375 px: trang chính không cuộn ngang (có thêm nút bay)', topW <= 375, `scrollWidth ${topW}`);
  await openFlight(page);
  await shot(page, 'flight-phone');
  const m = await page.evaluate(() => {
    const dlg = document.getElementById('dlg-flight');
    const small = [];
    for (const el of dlg.querySelectorAll('button, input, label.check')) {
      const r = el.getBoundingClientRect();
      // Hộp kiểm: vùng chạm là cả nhãn bao quanh nó (label.check), được đo riêng.
      if (el.matches('label.check > input[type=checkbox]')) continue;
      if (r.width === 0 || el.closest('[hidden]') || getComputedStyle(el).display === 'none') continue;
      if (el.closest('.is-closed .flight__dest-body')) continue;
      if (r.height < 44 || r.width < 44) small.push(`${el.className || el.tagName} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return { w: Math.max(document.documentElement.scrollWidth, dlg.scrollWidth), small };
  });
  check('375 px: chế độ bay không cuộn ngang', m.w <= 375, `scrollWidth ${m.w}`);
  check('375 px: mọi nút trong chế độ bay ≥ 44 px', m.small.length === 0, m.small.join('; '));
  await page.close();
}

// ---------------------------------------------------------------- Giảm chuyển động
{
  const { page } = await openPage({ reducedMotion: true });
  await openFlight(page);
  const instant = await page.evaluate(() => {
    const v = window.__flight;
    v.flyTo(v.get('body:jupiter'));
    return !v.traveling && v.focus?.key === 'body:jupiter';
  });
  check('giảm chuyển động: bay tới là chuyển cảnh tức thì', instant);
  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `FLIGHT UAT FAIL (${failed.length}/${results.length})` : `FLIGHT UAT PASS (${results.length})`);
process.exit(failed.length ? 1 : 0);
