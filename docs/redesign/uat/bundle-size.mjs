// Đo kích thước gói JS sau khi build (gzip mức mặc định của zlib, như báo cáo của Vite).
// Chạy: npm run build && node docs/redesign/uat/bundle-size.mjs
//
// (1) Entry JS: mọi JS mà dist/index.html tải ngay (<script type=module> + <link rel=modulepreload>).
// (2) JS trước khung hình 3D đầu tiên: (1) + chunk scene/boot và mọi import tĩnh của nó (three.js…).
//     Dữ liệu lục địa và 88 chòm sao tải động sau đó nên không tính.
// (3) Tổng JS, trừ KaTeX (chỉ dùng trong hộp thoại Trợ giúp/Giới thiệu).
// Ngân sách (AGENTS.md): (1) ≤ 90 kB gzip. Thoát với mã 1 nếu vượt.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const dist = join(root, 'dist');
const BUDGET_ENTRY_KB = 90;

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
};
console.log('Gzip (zlib default level)');
for (const [k, v] of Object.entries(metrics)) console.log(`${k.padEnd(36)} ${fmt(v).padStart(10)}`);
console.log('');
console.log(`(1) files: ${list(entryFiles)}`);
console.log(`(2) files: ${list(firstFrame)}`);
console.log(`(3) files: ${list(noKatex)}`);
const ok = entry <= BUDGET_ENTRY_KB;
console.log(ok ? `BUNDLE PASS (entry ≤ ${BUDGET_ENTRY_KB} kB)` : `BUNDLE FAIL (entry > ${BUDGET_ENTRY_KB} kB)`);
process.exit(ok ? 0 : 1);
