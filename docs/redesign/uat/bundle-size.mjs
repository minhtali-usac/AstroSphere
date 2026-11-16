// Đo kích thước gói JS sau khi build (gzip mức mặc định của zlib, như báo cáo của Vite).
// Chạy: npm run build && node docs/redesign/uat/bundle-size.mjs
//
// (1) Entry JS: mọi JS mà dist/index.html tải ngay (<script type=module> + <link rel=modulepreload>).
// (2) JS trước khung hình 3D đầu tiên: (1) + chunk scene/boot và mọi import tĩnh của nó (three.js…).
//     Dữ liệu lục địa và 88 chòm sao tải động sau đó nên không tính.
// (3) Tổng JS, trừ KaTeX (chỉ dùng trong hộp thoại Trợ giúp/Giới thiệu).
// (4) Chunk «Bay vào vũ trụ»: src/scene/flight/boot.ts và import tĩnh của nó, trừ những gì đã có ở (2) (three.js…).
// (5) Dữ liệu của chế độ bay: src/data/fetched/*.json (tải động khi mở chế độ bay).
// Ngân sách (AGENTS.md): (1) ≤ 90 kB, (4) ≤ 35 kB, (5) ≤ 25 kB gzip. Thoát với mã 1 nếu vượt.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const dist = join(root, 'dist');
const BUDGET_ENTRY_KB = 90;
const BUDGET_FLIGHT_KB = 35;
const BUDGET_FLIGHT_DATA_KB = 25;

const gz = (file) => gzipSync(readFileSync(join(dist, file))).length / 1000;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(dist, '.vite/manifest.json'), 'utf8'));

const strip = (p) => p.replace(/^\.\//, '');
const entryFiles = new Set();
for (const m of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/g)) entryFiles.add(strip(m[1]));
for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)) entryFiles.add(strip(m[1]));

// Import tĩnh (bắc cầu) của một khóa manifest.
function staticClosure(key, out = new Set()) {
  const c = manifest[key];
  if (!c || out.has(c.file)) return out;
  out.add(c.file);
  for (const k of c.imports ?? []) staticClosure(k, out);
  return out;
}
const bootKey = Object.keys(manifest).find((k) => k.endsWith('src/scene/boot.ts'));
if (!bootKey) throw new Error('scene/boot.ts not found in dist/.vite/manifest.json');
const firstFrame = new Set([...entryFiles, ...staticClosure(bootKey)]);

const flightKey = Object.keys(manifest).find((k) => k.endsWith('src/scene/flight/boot.ts'));
if (!flightKey) throw new Error('scene/flight/boot.ts not found in dist/.vite/manifest.json');
const flight = new Set([...staticClosure(flightKey)].filter((f) => !firstFrame.has(f)));
const flightData = new Set(Object.keys(manifest).filter((k) => /src\/data\/fetched\/[^/]+\.json$/.test(k)).map((k) => manifest[k].file));

const allJs = readdirSync(join(dist, 'assets'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => `assets/${f}`);
const noKatex = allJs.filter((f) => !/\/katex-[^/]+\.js$/.test(f));

const sum = (files) => [...files].reduce((a, f) => a + gz(f), 0);
const fmt = (kb) => `${kb.toFixed(2)} kB`;
const list = (files) => [...files].map((f) => `${f.replace('assets/', '')} ${fmt(gz(f))}`).join(', ');

const entry = sum(entryFiles);
const metrics = {
  '(1) Entry JS': entry,
  '(2) JS before the first 3D frame': sum(firstFrame),
  '(3) Total JS excluding KaTeX': sum(noKatex),
  '(4) Flight mode chunk': sum(flight),
  '(5) Flight mode data': sum(flightData),
};
console.log('Gzip (zlib default level)');
for (const [k, v] of Object.entries(metrics)) console.log(`${k.padEnd(36)} ${fmt(v).padStart(10)}`);
console.log('');
console.log(`(1) files: ${list(entryFiles)}`);
console.log(`(2) files: ${list(firstFrame)}`);
console.log(`(3) files: ${list(noKatex)}`);
console.log(`(4) files: ${list(flight)}`);
console.log(`(5) files: ${list(flightData)}`);
const ok = entry <= BUDGET_ENTRY_KB && metrics['(4) Flight mode chunk'] <= BUDGET_FLIGHT_KB && metrics['(5) Flight mode data'] <= BUDGET_FLIGHT_DATA_KB;
console.log(
  ok
    ? `BUNDLE PASS (entry ≤ ${BUDGET_ENTRY_KB} kB, flight ≤ ${BUDGET_FLIGHT_KB} kB, flight data ≤ ${BUDGET_FLIGHT_DATA_KB} kB)`
    : `BUNDLE FAIL (budgets: entry ${BUDGET_ENTRY_KB}, flight ${BUDGET_FLIGHT_KB}, flight data ${BUDGET_FLIGHT_DATA_KB} kB)`,
);
process.exit(ok ? 0 : 1);
