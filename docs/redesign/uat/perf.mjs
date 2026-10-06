// Kiểm tra hiệu năng chạy thật trong trình duyệt (Playwright + Chromium/SwiftShader).
//
// Chạy: npm run build && node docs/redesign/uat/perf.mjs
// Kịch bản tự khởi động máy chủ nếu chưa chạy:
//   - DEV:     npx vite --port 5190 --strictPort           (cần window.__app / window.__perf)
//   - PREVIEW: npx vite preview --port 4190 --strictPort   (bản build thật trong dist/)
//
// (a) DEV, 1280×800, ?quality=fixed: khi đang chạy hoạt ảnh, 120 khung hình (sau 30 khung khởi động)
//     không tạo LineGeometry mới (geomStats.lineGeometries) và không gọi gl.createBuffer.
// (b) PREVIEW, 375×812 (thẻ "Giản đồ chân trời" mặc định): canvas thiên cầu bị ẩn có 0 lệnh vẽ trong 60 khung.
// (c) PREVIEW, 1280×800: document.hidden = true + visibilitychange → cả hai canvas 0 lệnh vẽ trong 1 s.
// (d) Nỗ lực tốt nhất: CDP Emulation.setCPUThrottlingRate (×4, chờ tối đa 45 s) làm chất lượng tự hạ. Không bắt buộc đạt
//     (SwiftShader vốn đã chậm; kết quả phụ thuộc máy) — chỉ báo cáo.
import { spawn } from 'node:child_process';
import { get } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
// Ports can be overridden (PERF_DEV_PORT / PERF_PREVIEW_PORT) so parallel worktrees do not share a server.
const DEV_PORT = process.env.PERF_DEV_PORT ?? '5190';
const PREVIEW_PORT = process.env.PERF_PREVIEW_PORT ?? '4190';
const DEV = `http://localhost:${DEV_PORT}`;
const PREVIEW = `http://localhost:${PREVIEW_PORT}`;
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

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
const children = [];
// http.get thay vì fetch: undici chặn cổng 4190 ("bad port") nhưng Chromium thì không.
function up(url) {
  return new Promise((resolve) => {
    const req = get(url, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}
async function ensureServer(url, args) {
  if (await up(url)) return;
  const child = spawn('npx', args, { cwd: root, stdio: 'ignore', detached: true });
  children.push(child);
  for (let i = 0; i < 100; i++) {
    if (await up(url)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not start: ${url}`);
}
function stopServers() {
  for (const c of children) {
    try {
      process.kill(-c.pid);
    } catch {
      /* đã dừng */
    }
  }
}

// Đếm lệnh vẽ theo từng canvas: bọc draw* của WebGL2 (và WebGL1 nếu có) trong init script.
const DRAW_COUNTER = () => {
  const counts = new WeakMap();
  let buffers = 0;
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
    const cb = proto.createBuffer;
    proto.createBuffer = function (...a) {
      buffers++;
      return cb.apply(this, a);
    };
  };
  wrap(window.WebGL2RenderingContext?.prototype);
  wrap(window.WebGLRenderingContext?.prototype);
  window.__draws = (canvas) => (canvas ? (counts.get(canvas) ?? 0) : 0);
  window.__buffers = () => buffers;
  window.__frames = (n) =>
    new Promise((resolve) => {
      let i = 0;
      const f = () => (++i >= n ? resolve() : requestAnimationFrame(f));
      requestAnimationFrame(f);
    });
};

const canvasDraws = (page) =>
  page.evaluate(() => ({
    sphere: window.__draws(document.querySelector('#view-sphere canvas')),
    horizon: window.__draws(document.querySelector('#view-horizon canvas')),
  }));

async function openPage(browser, url, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(FULL_MODE);
  await page.addInitScript(DRAW_COUNTER);
  await page.goto(url);
  await page.waitForFunction(() => document.querySelectorAll('.view__canvas canvas').length >= 2, null, { timeout: 30000 });
  return { page, errors };
}

const results = {};
let browser;
try {
  await ensureServer(DEV, ['vite', '--port', DEV_PORT, '--strictPort']);
  await ensureServer(PREVIEW, ['vite', 'preview', '--port', PREVIEW_PORT, '--strictPort']);
  browser = await chromium.launch({ args: ARGS });

  // (a) Không tạo hình học đường mới khi chạy hoạt ảnh
  {
    const { page, errors } = await openPage(browser, `${DEV}/?quality=fixed`, { width: 1280, height: 800 });
    await page.waitForFunction(() => window.__perf && window.__app, null, { timeout: 30000 });
    await page.evaluate(() => window.__app.actions.play());
    await page.evaluate(() => window.__frames(30));
    const before = await page.evaluate(() => ({
      geoms: window.__perf.geomStats.lineGeometries,
      buffers: window.__buffers(),
      renders: window.__app.loop.stats.renders,
      lst: window.__app.store.state.gst,
      t: performance.now(),
    }));
    await page.evaluate(() => window.__frames(120));
    const after = await page.evaluate(() => ({
      geoms: window.__perf.geomStats.lineGeometries,
      buffers: window.__buffers(),
      renders: window.__app.loop.stats.renders,
      lst: window.__app.store.state.gst,
      playing: window.__app.store.state.playing,
      vertical: !!window.__app.store.state.selected && window.__app.store.state.toggles.verticalCircle,
      t: performance.now(),
    }));
    const r = {
      lineGeometriesDelta: after.geoms - before.geoms,
      createBufferDelta: after.buffers - before.buffers,
      renders: after.renders - before.renders,
      lstAdvancedDeg: +(after.lst - before.lst).toFixed(3),
      verticalCircleShown: after.vertical,
      msPerFrame: +((after.t - before.t) / 120).toFixed(1),
      errors,
    };
    r.pass = r.lineGeometriesDelta === 0 && r.createBufferDelta === 0 && r.renders > 0 && r.lstAdvancedDeg > 0 && errors.length === 0;
    results.a = r;
    await page.close();
  }

  // (b) Canvas bị ẩn trên điện thoại không vẽ
  {
    const { page, errors } = await openPage(browser, `${PREVIEW}/?quality=fixed`, { width: 375, height: 812 });
    await page.evaluate(() => window.__frames(20));
    const before = await canvasDraws(page);
    await page.evaluate(() => window.__frames(60));
    const after = await canvasDraws(page);
    const active = await page.evaluate(() => document.querySelector('.views')?.dataset.active);
    const r = {
      activeTab: active,
      sphereDraws: after.sphere - before.sphere,
      horizonDraws: after.horizon - before.horizon,
      errors,
    };
    r.pass = active === 'horizon' && r.sphereDraws === 0 && r.horizonDraws > 0 && errors.length === 0;
    results.b = r;
    await page.close();
  }

  // (c) Thẻ trình duyệt bị ẩn: không vẽ gì
  {
    const { page, errors } = await openPage(browser, `${PREVIEW}/?quality=fixed`, { width: 1280, height: 800 });
    await page.evaluate(() => window.__frames(20));
    const before = await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      return {
        sphere: window.__draws(document.querySelector('#view-sphere canvas')),
        horizon: window.__draws(document.querySelector('#view-horizon canvas')),
      };
    });
    await page.waitForTimeout(1000);
    const hidden = await canvasDraws(page);
    // Hiện lại: vòng lặp phải chạy tiếp.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.evaluate(() => window.__frames(10));
    const shown = await canvasDraws(page);
    const r = {
      sphereDrawsHidden: hidden.sphere - before.sphere,
      horizonDrawsHidden: hidden.horizon - before.horizon,
      drawsAfterVisibleAgain: shown.sphere + shown.horizon - hidden.sphere - hidden.horizon,
      errors,
    };
    r.pass = r.sphereDrawsHidden === 0 && r.horizonDrawsHidden === 0 && r.drawsAfterVisibleAgain > 0 && errors.length === 0;
    results.c = r;
    await page.close();
  }

  // (d) Nỗ lực tốt nhất: CPU chậm → chất lượng tự hạ
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(FULL_MODE);
    await page.goto(`${DEV}/`);
    await page.evaluate(() => {
      try {
        sessionStorage.removeItem('astrosphere.quality.v1');
      } catch {
        /* bỏ qua */
      }
    });
    await page.reload();
    await page.waitForFunction(() => window.__app && window.__perf, null, { timeout: 30000 });
    await page.evaluate(() => window.__app.actions.play());
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const t0 = Date.now();
    let level = 0;
    while (Date.now() - t0 < 45000) {
      level = await page.evaluate(() => window.__app.quality.level);
      if (level > 0) break;
      await page.waitForTimeout(500);
    }
    const info = await page.evaluate(() => ({
      auto: window.__app.quality.auto,
      samples: window.__app.loop.stats.samples,
      notice: !document.querySelector('.qnotice__chip')?.hidden,
    }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    results.d = { level, secondsToDrop: level > 0 ? +((Date.now() - t0) / 1000).toFixed(1) : null, ...info, informational: true };
    await page.close();
  }
} finally {
  await browser?.close();
  stopServers();
}

console.log(JSON.stringify(results, null, 2));
const ok = results.a?.pass && results.b?.pass && results.c?.pass;
console.log(`(a) ${results.a?.pass ? 'PASS' : 'FAIL'}  (b) ${results.b?.pass ? 'PASS' : 'FAIL'}  (c) ${results.c?.pass ? 'PASS' : 'FAIL'}  (d) ${results.d?.level > 0 ? 'dropped' : 'no drop'} (informational)`);
console.log(ok ? 'PERF PASS' : 'PERF FAIL');
process.exit(ok ? 0 : 1);
