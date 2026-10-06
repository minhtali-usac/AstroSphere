// UAT: quyết định của chủ dự án 2026-10-05 (docs/redesign-2/decisions-2026-10-05.md).
//   1. Vòng chọn nhịp một lần khi chọn (không nhịp khi giảm chuyển động; vòng lặp đang dừng ngủ lại sau nhịp).
//   2. "Đặt lại" hỏi lại: Hủy giữ trạng thái, Đặt lại đặt lại, Esc hủy, tiêu điểm về nút mở.
//   3. Viên trạng thái trung tính, chấm màu vùng.
//   4. Sàn 13 px cho chữ giải thích ngoài USACodex (1440 và 375, Cơ bản và Đầy đủ, bong bóng Usui-chan); ghi chú dòng
//      của thẻ thông tin ≥ 14 px (fix-3 #10).
//   5. Sao người dùng thêm có màu trung tính (COLORS.figure, ΔE OKLab ≥ 0,08 với mọi màu ngữ nghĩa).
// Cần máy chủ DEV (window.__app, import '/src/…'):
//   npx vite --port 5202 --strictPort (nền), rồi
//   UAT_URL='http://localhost:5202/?quality=fixed' node docs/redesign-2/uat/decisions.mjs
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const URL = process.env.UAT_URL ?? 'http://localhost:5202/?quality=fixed';
const SIRIUS = 32349;
const VEGA = 91262;

const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

async function open({ width = 1440, height = 900, reducedMotion = 'no-preference', mode = 'full', hello = true, seed = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion });
  await ctx.addInitScript(
    ({ mode, hello, seed }) => {
      try {
        localStorage.setItem('astrosphere.mode.v1', JSON.stringify(mode));
        localStorage.setItem('astrosphere.hint.v1', 'true');
        if (hello) localStorage.setItem('astrosphere.guide.v1', JSON.stringify({ hello: true }));
        // Chỉ ghi ở lần nạp đầu (trang không bị nạp lại trong các kiểm tra này).
        for (const [k, v] of Object.entries(seed)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
      } catch {}
    },
    { mode, hello, seed },
  );
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  await page.waitForFunction(() => window.__app?.horizon && window.__app?.sphere, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  return { ctx, page };
}

/**
 * Chọn một sao danh mục theo số HIP (đường của Ôn tập). Đo nhịp vòng chọn ở hai khung theo hai cách:
 *  - thật: bọc stepSelPulse để ghi cỡ/độ đục vòng sau mỗi bước mà frame() thực sự chạy, trong `ms`;
 *  - tất định: đọc thời điểm bắt đầu nhịp rồi gọi stepSelPulse ở +90 ms (đỉnh) — không phụ thuộc tốc độ máy (swiftshader
 *    chậm có thể chỉ vẽ 2–3 khung trong 300 ms).
 */
const PULSE = async (page, hip, ms = 600) =>
  page.evaluate(
    async ({ hip, ms }) => {
      const { store, actions, loop } = window.__app;
      actions.pause();
      // Khởi động: chờ vòng lặp chạy đều (vài khung hình liên tiếp) trước khi đo.
      const f0 = loop.stats.frames;
      const tWarm = performance.now() + 8000;
      while (loop.stats.frames < f0 + 5 && performance.now() < tWarm) await new Promise((r) => setTimeout(r, 50));
      await new Promise((r) => setTimeout(r, 300));
      const { selectCatalogHip } = await import('/src/scenario.ts');
      const { SEL_RING_SCALE } = await import('/src/scene/skyLayer.ts');
      const views = { horizon: window.__app.horizon, sphere: window.__app.sphere };
      const out = {};
      for (const [k, v] of Object.entries(views)) {
        const o = (out[k] = { real: [], started: false });
        const sky = v.sky;
        const orig = sky.stepSelPulse;
        sky.stepSelPulse = function (now) {
          orig.call(this, now);
          o.real.push(+(this.selRing.scale.x / SEL_RING_SCALE).toFixed(3));
        };
        o.restore = () => (sky.stepSelPulse = orig);
      }
      const r0 = loop.stats.renders;
      selectCatalogHip({ store, actions }, hip);
      for (const [k, v] of Object.entries(views)) {
        const o = out[k];
        const sky = v.sky;
        o.started = sky.pulsing;
        if (o.started) {
          // Tất định: bước ở đỉnh (+90 ms) rồi để vòng lặp chạy tiếp theo thời gian thật.
          const t0 = sky.pulseT0;
          Object.getPrototypeOf(sky).stepSelPulse.call(sky, t0 + 90);
          o.peak = sky.selRing.scale.x / SEL_RING_SCALE;
          o.peakOp = sky.selRing.material.opacity;
        }
      }
      // Chờ tới khi nhịp kết thúc ở cả hai khung (tối thiểu `ms`, tối đa 8 s: swiftshader đang bận có thể mất hơn một
      // giây cho một khung hình khi biên dịch shader của lớp vừa tải).
      const tEnd = performance.now() + 8000;
      await new Promise((r) => setTimeout(r, ms));
      while ((views.horizon.sky.pulsing || views.sphere.sky.pulsing) && performance.now() < tEnd) await new Promise((r) => setTimeout(r, 50));
      const r1 = loop.stats.renders;
      await new Promise((r) => setTimeout(r, 500));
      const r2 = loop.stats.renders;
      for (const [k, v] of Object.entries(views)) {
        const o = out[k];
        o.restore();
        delete o.restore;
        o.realMax = Math.max(1, ...o.real);
        o.end = v.sky.selRing.scale.x / SEL_RING_SCALE;
        o.endOp = v.sky.selRing.material.opacity;
        o.visible = v.sky.selRing.visible;
        o.still = v.sky.pulsing;
      }
      return { ...out, rendersDuring: r1 - r0, rendersAfter: r2 - r1 };
    },
    { hip, ms },
  );

// ------------------------------------------------------------------ 1. Nhịp vòng chọn
{
  const { ctx, page } = await open();
  const p = await PULSE(page, VEGA);
  for (const k of ['horizon', 'sphere']) {
    const q = p[k];
    check(`(1) ${k}: selecting starts a pulse`, q.visible && q.started);
    check(`(1) ${k}: at its peak the ring is ×1,35 with opacity 0,5`, Math.abs(q.peak - 1.35) < 0.01 && Math.abs(q.peakOp - 0.5) < 0.01, `×${q.peak?.toFixed(3)} op ${q.peakOp?.toFixed(2)}`);
    check(`(1) ${k}: frames drawn during the pulse show the ring above scale 1`, q.realMax > 1, `steps ${q.real.join(', ')}`);
    check(`(1) ${k}: the ring returns to scale 1 and opacity 1, pulse over`, Math.abs(q.end - 1) < 1e-6 && q.endOp === 1 && !q.still, `end ×${q.end} op ${q.endOp}`);
  }
  check('(1) the paused loop redraws during the pulse and sleeps after it', p.rendersDuring > 0 && p.rendersAfter === 0, `during=${p.rendersDuring} after=${p.rendersAfter}`);
  // Chọn lại chính sao đang chọn (bấm lại) vẫn nhịp; bỏ chọn thì không.
  const again = await PULSE(page, VEGA, 450);
  check('(1) selecting the same star again pulses again', again.horizon.started && again.sphere.started, `peak ×${again.horizon.peak?.toFixed(3)}`);
  const cleared = await page.evaluate(async () => {
    const { actions, horizon } = window.__app;
    actions.select(null);
    await new Promise((r) => setTimeout(r, 200));
    return horizon.sky.pulsing;
  });
  check('(1) clearing the selection does not pulse', cleared === false);
  await ctx.close();
}
{
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  const p = await PULSE(page, VEGA);
  check(
    '(1) prefers-reduced-motion: no pulse in either view',
    !p.horizon.started && !p.sphere.started && p.horizon.realMax === 1 && p.sphere.realMax === 1 && p.horizon.end === 1,
    `started ${p.horizon.started}/${p.sphere.started}, steps ${p.horizon.real.length}`,
  );
  check('(1) prefers-reduced-motion: the selection still shows its ring', p.horizon.visible || p.sphere.visible);
  await ctx.close();
}
{
  // Lần mở trang đầu tiên (Polaris chọn sẵn) không nhịp.
  const { ctx, page } = await open();
  const first = await page.evaluate(() => [window.__app.horizon.sky.pulsing, window.__app.sphere.sky.pulsing]);
  check('(1) the default selection on page load does not pulse', !first[0] && !first[1]);
  await ctx.close();
}

// ------------------------------------------------------------------ 2. Hộp xác nhận "Đặt lại"
const snapshot = (page) =>
  page.evaluate(() => {
    const s = window.__app.store.state;
    return {
      lat: s.lat,
      stars: s.stars.length,
      sel: !!s.selected,
      mode: s.uiMode,
      open: document.getElementById('dlg-reset')?.open ?? false,
      active: document.activeElement?.className ?? '',
      activeText: document.activeElement?.textContent?.trim() ?? '',
      codex: localStorage.getItem('astrosphere.codex.v1'),
      learn: localStorage.getItem('thien-cau.hoc-tap.v1'),
    };
  });
for (const [w, h] of [
  [1440, 900],
  [375, 812],
]) {
  const { ctx, page } = await open({
    width: w,
    height: h,
    seed: { 'astrosphere.codex.v1': JSON.stringify({ discovered: ['pole'], read: ['pole'] }), 'thien-cau.hoc-tap.v1': JSON.stringify({ t1: { correct: true } }) },
  });
  await page.evaluate(() => {
    const { actions } = window.__app;
    actions.setLocation(45, 10);
    actions.addRandomStars(3);
  });
  const reset = page.locator('.btn--top-reset');
  const dlg = page.locator('#dlg-reset');

  await reset.click();
  await dlg.waitFor({ state: 'visible' });
  const d = await page.evaluate(() => {
    const el = document.getElementById('dlg-reset');
    const btns = [...el.querySelectorAll('button')].map((b) => {
      const r = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      return { text: b.textContent.trim(), h: Math.round(r.height), bg: cs.backgroundColor, color: cs.color };
    });
    return {
      modal: el.matches(':modal'),
      title: el.querySelector('h2').textContent,
      body: el.querySelector('.dialog__content').textContent,
      btns,
      focus: document.activeElement.textContent.trim(),
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
    };
  });
  check(`(2) ${w}: "Đặt lại" opens a modal dialog "Đặt lại mô phỏng?" (fix-3 #5)`, d.modal && d.title === 'Đặt lại mô phỏng?', d.title);
  check(
    `(2) ${w}: the body names what is reset and what is kept`,
    ['vị trí', 'thời gian', 'hiển thị', 'sao', 'Vẫn giữ', 'chế độ', 'USACodex', 'Ôn tập'].every((x) => d.body.includes(x)),
    d.body,
  );
  check(`(2) ${w}: buttons "Hủy" then "Đặt lại"; default focus on "Hủy"`, d.btns.map((b) => b.text).join('|') === 'Hủy|Đặt lại' && d.focus === 'Hủy', `${d.btns.map((b) => b.text).join('|')} focus=${d.focus}`);
  check(
    `(2) ${w}: "Đặt lại" is the orange primary with dark text; "Hủy" is not orange`,
    d.btns[1].bg === 'rgb(242, 101, 34)' && d.btns[1].color === 'rgb(10, 10, 10)' && d.btns[0].bg !== 'rgb(242, 101, 34)',
    `${d.btns[1].bg} / ${d.btns[1].color} · Hủy ${d.btns[0].bg}`,
  );
  check(`(2) ${w}: both buttons ≥ 44 px tall, no horizontal scroll`, d.btns.every((b) => b.h >= 44) && d.sw <= d.iw, `${d.btns.map((b) => b.h).join('/')} px, ${d.sw}/${d.iw}`);

  await dlg.getByRole('button', { name: 'Hủy', exact: true }).click();
  await page.waitForTimeout(150);
  const s1 = await snapshot(page);
  check(`(2) ${w}: "Hủy" keeps the state (φ 45, 3 stars) and closes`, !s1.open && s1.lat === 45 && s1.stars === 3, JSON.stringify(s1));
  check(`(2) ${w}: focus returns to "Đặt lại" after "Hủy"`, /btn--top-reset/.test(s1.active), s1.active);

  await reset.click();
  await dlg.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const s2 = await snapshot(page);
  check(`(2) ${w}: Esc cancels: state kept, selection kept (Esc did not also clear it)`, !s2.open && s2.lat === 45 && s2.stars === 3 && s2.sel, JSON.stringify(s2));
  check(`(2) ${w}: focus returns to "Đặt lại" after Esc`, /btn--top-reset/.test(s2.active), s2.active);

  await reset.click();
  await dlg.waitFor({ state: 'visible' });
  const before = await snapshot(page);
  await dlg.getByRole('button', { name: 'Đặt lại', exact: true }).click();
  await page.waitForFunction(() => window.__app.store.state.lat !== 45, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(200);
  const s3 = await snapshot(page);
  // Codex tự ghi thêm mục vừa khám phá; "giữ" nghĩa là không mất mục nào đã có.
  const kept = (a, b, f) => (JSON.parse(a ?? '{}')[f] ?? []).every((id) => (JSON.parse(b ?? '{}')[f] ?? []).includes(id));
  check(`(2) ${w}: "Đặt lại" resets (φ back to 21,03, no stars)`, !s3.open && Math.abs(s3.lat - 21.03) < 0.01 && s3.stars === 0, JSON.stringify(s3));
  check(
    `(2) ${w}: the text is truthful: mode, USACodex and Ôn tập progress are kept`,
    s3.mode === 'full' && kept(before.codex, s3.codex, 'discovered') && kept(before.codex, s3.codex, 'read') && JSON.parse(before.codex).read.includes('pole') && s3.learn === before.learn,
    `${s3.mode} · codex ${before.codex} → ${s3.codex} · learn ${s3.learn}`,
  );
  check(`(2) ${w}: focus returns to "Đặt lại" after confirming`, /btn--top-reset/.test(s3.active), s3.active);
  await ctx.close();
}

// ------------------------------------------------------------------ 3. Viên trạng thái trung tính
{
  const { ctx, page } = await open();
  const pills = [];
  for (const [hip, lat] of [
    [SIRIUS, 21.03],
    [11767, 21.03],
    [SIRIUS, 80],
  ]) {
    pills.push(
      await page.evaluate(
        async ({ hip, lat }) => {
          const { store, actions, card } = window.__app;
          actions.setLocation(lat, 105.85);
          const { selectCatalogHip } = await import('/src/scenario.ts');
          selectCatalogHip({ store, actions }, hip);
          card.update();
          await new Promise((r) => setTimeout(r, 300));
          const el = document.querySelector('.infocard .status');
          const cs = getComputedStyle(el);
          const root = getComputedStyle(document.documentElement);
          const zone = { circumpolar: '--zone-circumpolar', riseSet: '--zone-riseset', neverRise: '--zone-neverrise' };
          const k = [...el.classList].find((c) => c.startsWith('status--')).slice(8);
          const probe = document.createElement('span');
          probe.style.color = root.getPropertyValue(zone[k]).trim();
          document.body.append(probe);
          const zoneRgb = getComputedStyle(probe).color;
          probe.style.color = root.getPropertyValue('--surface-3').trim();
          const surface = getComputedStyle(probe).color;
          probe.remove();
          const dot = getComputedStyle(el, '::before');
          return { k, text: el.textContent, bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor, zoneRgb, surface, dot: dot.backgroundColor, dotW: parseFloat(dot.width), fs: parseFloat(cs.fontSize) };
        },
        { hip, lat },
      ),
    );
  }
  const lum = (rgb) => {
    const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map((v) => {
      const c = Number(v) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  check('(3) the three states were seen', pills.map((p) => p.k).sort().join(',') === 'circumpolar,neverRise,riseSet', pills.map((p) => `${p.k}:${p.text}`).join(' · '));
  for (const p of pills) {
    check(`(3) ${p.k}: pill background is the neutral surface, not the zone colour; border is not the zone colour`, p.bg === p.surface && p.bg !== p.zoneRgb && p.border !== p.zoneRgb, `bg ${p.bg} zone ${p.zoneRgb} border ${p.border}`);
    check(`(3) ${p.k}: an 8–10 px dot carries the zone colour`, p.dot === p.zoneRgb && p.dotW >= 8 && p.dotW <= 10, `${p.dot} ${p.dotW}px`);
    check(`(3) ${p.k}: text contrast ≥ 4,5:1 and ≥ 13 px`, ratio(p.color, p.bg) >= 4.5 && p.fs >= 13, `${ratio(p.color, p.bg).toFixed(2)}:1, ${p.fs}px`);
  }
  await ctx.close();
}

// ------------------------------------------------------------------ 4. Sàn 13 px
const MEASURE = () => {
  const SEL = [
    '.infocard', // ghi chú từng dòng của thẻ thông tin, viên trạng thái
    '.databar', // chú thích dải số liệu
    '.view__sub', // phụ đề khung nhìn
    '.view__hint', // dòng gợi ý dưới giản đồ chân trời
    '.check__hint', // gợi ý dưới hộp kiểm
    '.panels .hint',
    '.panels .note',
    '.sub__teaser', // gợi ý trong bảng
    '.legend', // chú giải màu
    '.simple', // chú thích của chế độ Cơ bản
    '.guide-hello',
    '.guide-tip',
    '.guide-banner', // bong bóng của Usui-chan
  ];
  // Ngoài phạm vi: nút "?" mở USACodex (biểu tượng), phần trang trí ẩn với trình đọc màn hình, ô nhập.
  const EXCLUDE = '.term, [aria-hidden="true"], input, select, textarea';
  const bad = [];
  let min = Infinity;
  let n = 0;
  for (const sel of SEL)
    for (const root of document.querySelectorAll(sel))
      for (const el of [root, ...root.querySelectorAll('*')]) {
        if (el.closest(EXCLUDE)) continue;
        if (![...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        n++;
        min = Math.min(min, fs);
        if (fs < 13) bad.push(`${el.className || el.tagName} ${fs}px "${el.textContent.trim().slice(0, 24)}"`);
      }
  return { min, n, bad: [...new Set(bad)].slice(0, 6), sw: document.documentElement.scrollWidth, iw: window.innerWidth };
};
for (const [w, h] of [
  [1440, 900],
  [375, 812],
])
  for (const mode of ['full', 'simple']) {
    const { ctx, page } = await open({ width: w, height: h, mode });
    // Mở thẻ thông tin (Sirius có đủ các dòng ghi chú).
    await page.evaluate(async (hip) => {
      const { store, actions } = window.__app;
      const { selectCatalogHip } = await import('/src/scenario.ts');
      selectCatalogHip({ store, actions }, hip);
    }, SIRIUS);
    await page.waitForTimeout(400);
    const m = await page.evaluate(MEASURE);
    check(`(4) ${w} ${mode}: explanatory text ≥ 13 px (${m.n} elements)`, m.min >= 13 && m.n > 50, `min ${m.min}px ${m.bad.join(' | ')}`);
    check(`(4) ${w} ${mode}: no horizontal scroll`, m.sw <= m.iw, `${m.sw}/${m.iw}`);
    // fix-3 #10: câu nghĩa ngắn dưới mỗi dòng của thẻ thông tin (người mới đọc chúng) ≥ 14 px, không chỉ sàn 13 px.
    const notes = await page.evaluate(() => [...document.querySelectorAll('.infocard .kv__note')].map((e) => parseFloat(getComputedStyle(e).fontSize)));
    check(`(4, fix-3 #10) ${w} ${mode}: info-card row notes ≥ 14 px (${notes.length})`, notes.length >= 5 && notes.every((f) => f >= 14), notes.join(','));
    await ctx.close();
  }
{
  // Bong bóng chào lần đầu của Usui-chan (hồ sơ trống).
  const { ctx, page } = await open({ hello: false });
  await page.waitForSelector('.guide-hello', { timeout: 15000 });
  await page.waitForTimeout(300);
  const m = await page.evaluate(MEASURE);
  const hasHello = await page.locator('.guide-hello').count();
  check('(4) 1440: Usui-chan hello and tip bubbles ≥ 13 px', hasHello > 0 && m.min >= 13, `min ${m.min}px ${m.bad.join(' | ')}`);
  await ctx.close();
}

// ------------------------------------------------------------------ 5. Màu trung tính cho sao người dùng
{
  const { ctx, page } = await open();
  const r = await page.evaluate(async () => {
    const { actions, store } = window.__app;
    const { COLORS } = await import('/src/scene/colors.ts');
    actions.addRandomStars(25);
    actions.addManualStar(101.3, -16.7, 'Sao A');
    actions.addManualStar(10, 40);
    const colors = [...new Set(store.state.stars.map((s) => s.color))];
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const oklab = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.629978700 * b);
      return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
    };
    const dE = (a, b) => Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]));
    let worst = { d: Infinity, k: '' };
    for (const c of colors)
      for (const [k, v] of Object.entries(COLORS)) {
        if (['figure', 'figureSky', 'ground'].includes(k)) continue;
        const d = dE(c, v);
        if (d < worst.d) worst = { d, k };
      }
    return { colors, figure: COLORS.figure, worst, n: store.state.stars.length };
  });
  check('(5) random and manual stars all use the neutral figure tone', r.n === 27 && r.colors.length === 1 && r.colors[0] === r.figure, `${r.colors.join(',')} (${r.n} stars)`);
  check('(5) user-star colour is ≥ 0,08 OKLab from every semantic scene colour', r.worst.d >= 0.08, `nearest ${r.worst.k} ΔE ${r.worst.d.toFixed(3)}`);
  await ctx.close();
}

await browser.close();
check('no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const passed = results.filter(Boolean).length;
console.log(`\nDECISIONS ${passed}/${results.length} ${passed === results.length ? 'PASS' : 'FAIL'}`);
process.exit(passed === results.length ? 0 : 1);
